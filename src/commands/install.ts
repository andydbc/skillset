import prompts from 'prompts'
import kleur from 'kleur'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { fetchJSON, fetchRaw } from '../github.js'
import { listLocalSkillsets, readSkillset } from '../utils.js'
import type { Skillset, GitHubFile, PluginRef, SkillRef } from '../types.js'

export async function install([source, skillsetName]: string[], { yes }: { yes: boolean } = { yes: false }): Promise<void> {
  if (!source) {
    source = '.'
  }

  const isLocal = source === '.' || source.startsWith('./') || source.startsWith('/') || fs.existsSync(source)
  if (isLocal) {
    return installFromLocal(path.resolve(source), skillsetName, yes)
  }

  return installFromGitHub(source, skillsetName, yes)
}

async function installFromLocal(dir: string, skillsetName?: string, yes = false): Promise<void> {
  // Try skillsets/ subfolder first, then fall back to root
  let skillsetsDir = path.join(dir, '.skillsets')
  let skillsetFiles: string[] = []
  if (fs.existsSync(skillsetsDir)) {
    skillsetFiles = listLocalSkillsets(skillsetsDir)
  }
  if (skillsetFiles.length === 0) {
    skillsetsDir = dir
    skillsetFiles = listLocalSkillsets(dir)
  }

  if (skillsetFiles.length === 0) {
    console.error(kleur.red(`No skillsets found at ${path.join(dir, '.skillsets')} or ${dir}`))
    process.exit(1)
  }

  const toInstall = await pickSkillsets(skillsetFiles, skillsetName, yes)

  for (const name of toInstall) {
    const skillset = readSkillset(skillsetsDir, name)!
    await runInstall(skillset, yes)
  }
}

async function installFromGitHub(source: string, skillsetName?: string, yes = false): Promise<void> {
  const slug = source
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .split('/').slice(0, 2).join('/')

  const [owner, repo] = slug.split('/')

  console.log(kleur.dim(`\nFetching skillsets from ${slug}...`))

  // Try skillsets/ subfolder first, then fall back to root
  let skillsetFiles: string[] = []
  let skillsetsPath = '.skillsets'
  try {
    const contents = await fetchJSON<GitHubFile[]>(
      `https://api.github.com/repos/${owner}/${repo}/contents/.skillsets`
    )
    skillsetFiles = (contents as GitHubFile[]).filter(f => f.type === 'file' && f.name.endsWith('.json')).map(f => f.name.replace('.json', ''))
  } catch { /* ignore, try root */ }

  if (skillsetFiles.length === 0) {
    skillsetsPath = ''
    try {
      const contents = await fetchJSON<GitHubFile[]>(
        `https://api.github.com/repos/${owner}/${repo}/contents`
      )
      skillsetFiles = (contents as GitHubFile[]).filter(f => f.type === 'file' && f.name.endsWith('.json')).map(f => f.name.replace('.json', ''))
    } catch {
      console.error(kleur.red(`Could not fetch skillsets from ${slug}. Make sure the repo has .json skillset files in a .skillsets/ directory or at the root.`))
      process.exit(1)
    }
    if (skillsetFiles.length === 0) {
      console.error(kleur.red(`No skillset JSON files found in ${slug}.`))
      process.exit(1)
    }
  }

  const toInstall = await pickSkillsets(skillsetFiles, skillsetName, yes)

  for (const name of toInstall) {
    const filePath = skillsetsPath ? `${skillsetsPath}/${name}.json` : `${name}.json`
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`
    let skillset: Skillset
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      skillset = await res.json() as Skillset
    } catch {
      console.error(kleur.red(`Could not fetch skillset "${name}"`))
      process.exit(1)
    }
    await runInstall(skillset, yes)
  }
}

function resolveSkillsDir(scope: 'project' | 'user'): string {
  if (scope === 'user') return path.join(os.homedir(), '.claude', 'skills')
  return path.join(process.cwd(), '.claude', 'skills')
}

async function installSkillFiles(s: SkillRef, scope: 'project' | 'user' = 'project'): Promise<void> {
  const [owner, repo] = s.repo.split('/')
  const contents = await fetchJSON<GitHubFile[]>(
    `https://api.github.com/repos/${owner}/${repo}/contents/skills/${s.skill}`
  )
  if (!Array.isArray(contents)) throw new Error(`Unexpected response for skill "${s.skill}"`)

  const skillDir = path.join(resolveSkillsDir(scope), s.skill)
  fs.mkdirSync(skillDir, { recursive: true })

  for (const file of contents) {
    if (file.type !== 'file') continue
    const content = await fetchRaw(file.download_url)
    fs.writeFileSync(path.join(skillDir, file.name), content)
  }
}

async function pickSkillsets(available: string[], specified?: string, yes = false): Promise<string[]> {
  if (specified) {
    if (!available.includes(specified)) {
      console.error(kleur.red(`Skillset "${specified}" not found. Available: ${available.join(', ')}`))
      process.exit(1)
    }
    return [specified]
  }
  if (available.length === 1) return available
  if (yes) return available

  const { picked } = await prompts({
    type: 'multiselect',
    name: 'picked',
    message: 'Which skillsets to install?',
    choices: available.map(s => ({ title: s, value: s, selected: true })),
    hint: 'space to toggle, enter to confirm'
  }, { onCancel: () => process.exit(0) })
  return picked as string[]
}

async function runInstall(skillset: Skillset, yes = false): Promise<void> {
  const plugins = skillset.dependencies.filter((s): s is PluginRef => s.type === 'plugin')
  const skills = skillset.dependencies.filter((s): s is SkillRef => s.type !== 'plugin') as SkillRef[]

  console.log(`\n${kleur.bold(skillset.name)}  ${kleur.dim(skillset.description ?? '')}`)
  if (plugins.length > 0) {
    console.log(kleur.dim(`\n  Plugins (${plugins.length}):`))
    for (const p of plugins) console.log(`  ${kleur.dim('·')} ${p.name}  ${kleur.dim('@' + p.marketplace)}`)
  }
  if (skills.length > 0) {
    console.log(kleur.dim(`\n  Skills (${skills.length}):`))
    for (const s of skills) console.log(`  ${kleur.dim('·')} ${s.skill}  ${kleur.dim(s.repo)}`)
  }

  if (!yes) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Install ${skillset.dependencies.length} item(s)?`,
      initial: true
    }, { onCancel: () => process.exit(0) })
    if (!confirm) return
  }

  for (const p of plugins) {
    console.log(kleur.dim(`  Installing plugin ${p.name}...`))
    try {
      // Uninstall first for a clean install (ignore errors if not installed)
      try { execSync(`claude plugin uninstall ${p.name}`, { stdio: 'pipe', input: '\n' }) } catch { /* not installed yet */ }
      const marketplaceFlag = p.marketplace === 'claude-plugins-official' ? '' : ` --marketplace ${p.marketplace}`
      execSync(`claude plugin install ${p.name}${marketplaceFlag} --scope project`, { stdio: 'pipe', input: '\n' })
      console.log(kleur.green(`  ✓ plugin ${p.name}`))
    } catch (err) {
      const msg = (err as any).stderr?.toString() ?? (err as Error).message
      if (msg.includes('marketplace') || msg.includes('not found')) {
        console.error(kleur.red(`  ✗ plugin ${p.name}: marketplace "${p.marketplace}" not found. Add it first: claude plugin marketplace add ${p.marketplace}`))
      } else {
        console.error(kleur.red(`  ✗ plugin ${p.name}: ${msg}`))
      }
    }
  }

  for (const s of skills) {
    console.log(kleur.dim(`  Installing ${s.skill}...`))
    try {
      await installSkillFiles(s)
      console.log(kleur.green(`  ✓ ${s.skill}`))
    } catch (err) {
      console.error(kleur.red(`  ✗ ${s.skill}: ${(err as Error).message}`))
    }
  }

  console.log(kleur.green(`\n✓ Skillset "${skillset.name}" installed\n`))
}
