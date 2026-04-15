import prompts from 'prompts'
import kleur from 'kleur'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fetchJSON } from '../github.js'
import { listLocalSkillsets, readSkillset } from '../utils.js'
import type { Skillset, GitHubFile } from '../types.js'

export async function install([source, skillsetName]: string[], { yes }: { yes: boolean } = { yes: false }): Promise<void> {
  if (!source) {
    if (yes) {
      console.error(kleur.red('Source required: npx @andbc/skillset install <path|owner/repo>'))
      process.exit(1)
    }
    const { input } = await prompts({
      type: 'text',
      name: 'input',
      message: 'Source',
      hint: 'local path, . for current dir, or user/repo'
    }, { onCancel: () => process.exit(0) })
    source = input as string
  }

  const isLocal = source === '.' || source.startsWith('./') || source.startsWith('/') || fs.existsSync(source)
  if (isLocal) {
    return installFromLocal(path.resolve(source), skillsetName, yes)
  }

  return installFromGitHub(source, skillsetName, yes)
}

async function installFromLocal(dir: string, skillsetName?: string, yes = false): Promise<void> {
  // Try root first, then fall back to skillsets/ subfolder
  let skillsetsDir = dir
  let skillsetFiles = listLocalSkillsets(dir)
  if (skillsetFiles.length === 0) {
    skillsetsDir = path.join(dir, 'skillsets')
    if (!fs.existsSync(skillsetsDir)) {
      console.error(kleur.red(`No skillsets found at ${dir} or ${skillsetsDir}`))
      process.exit(1)
    }
    skillsetFiles = listLocalSkillsets(skillsetsDir)
  }

  if (skillsetFiles.length === 0) {
    console.error(kleur.red(`No skillsets found in ${skillsetsDir}`))
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

  // Try root first, then fall back to skillsets/ subfolder
  let skillsetFiles: string[] = []
  let skillsetsPath = ''
  try {
    const contents = await fetchJSON<GitHubFile[]>(
      `https://api.github.com/repos/${owner}/${repo}/contents`
    )
    skillsetFiles = (contents as GitHubFile[]).filter(f => f.type === 'file' && f.name.endsWith('.json')).map(f => f.name.replace('.json', ''))
  } catch { /* ignore, try subfolder */ }

  if (skillsetFiles.length === 0) {
    try {
      const contents = await fetchJSON<GitHubFile[]>(
        `https://api.github.com/repos/${owner}/${repo}/contents/skillsets`
      )
      skillsetFiles = (contents as GitHubFile[]).filter(f => f.name.endsWith('.json')).map(f => f.name.replace('.json', ''))
      skillsetsPath = 'skillsets'
    } catch {
      console.error(kleur.red(`Could not fetch skillsets from ${slug}. Make sure the repo has .json skillset files at the root or in a skillsets/ directory.`))
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
  console.log(`\n${kleur.bold(skillset.name)}  ${kleur.dim(skillset.description ?? '')}`)
  console.log(kleur.dim(`${skillset.skills.length} skill(s):\n`))
  for (const s of skillset.skills) {
    console.log(`  ${kleur.dim('·')} ${s.skill}  ${kleur.dim(s.repo)}`)
  }

  if (!yes) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Install these ${skillset.skills.length} skill(s)?`,
      initial: true
    }, { onCancel: () => process.exit(0) })
    if (!confirm) return
  }

  for (const s of skillset.skills) {
    console.log(kleur.dim(`  Installing ${s.skill}...`))
    try {
      execSync(`npx skills add ${s.repo} --skill ${s.skill} -y`, { stdio: 'pipe' })
      console.log(kleur.green(`  ✓ ${s.skill}`))
    } catch (err) {
      console.error(kleur.red(`  ✗ ${s.skill}: ${(err as Error).message}`))
    }
  }

  console.log(kleur.green(`\n✓ Skillset "${skillset.name}" installed\n`))
}
