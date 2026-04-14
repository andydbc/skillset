import prompts from 'prompts'
import kleur from 'kleur'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fetchJSON } from '../github.js'
import { listLocalSkillsets, readSkillset } from '../utils.js'
import type { Skillset, GitHubFile } from '../types.js'

export async function install([source, skillsetName]: string[]): Promise<void> {
  if (!source) {
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
    return installFromLocal(path.resolve(source), skillsetName)
  }

  return installFromGitHub(source, skillsetName)
}

async function installFromLocal(dir: string, skillsetName?: string): Promise<void> {
  const skillsetsDir = path.join(dir, 'skillsets')
  if (!fs.existsSync(skillsetsDir)) {
    console.error(kleur.red(`No skillsets/ directory found at ${dir}`))
    process.exit(1)
  }

  const skillsetFiles = listLocalSkillsets(skillsetsDir)
  if (skillsetFiles.length === 0) {
    console.error(kleur.red(`No skillsets found in ${skillsetsDir}`))
    process.exit(1)
  }

  const toInstall = await pickSkillsets(skillsetFiles, skillsetName)

  for (const name of toInstall) {
    const skillset = readSkillset(skillsetsDir, name)!
    await runInstall(skillset)
  }
}

async function installFromGitHub(source: string, skillsetName?: string): Promise<void> {
  const slug = source
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .split('/').slice(0, 2).join('/')

  const [owner, repo] = slug.split('/')

  console.log(kleur.dim(`\nFetching skillsets from ${slug}...`))

  let skillsetFiles: string[]
  try {
    const contents = await fetchJSON<GitHubFile[]>(
      `https://api.github.com/repos/${owner}/${repo}/contents/skillsets`
    )
    skillsetFiles = contents.filter(f => f.name.endsWith('.json')).map(f => f.name.replace('.json', ''))
  } catch {
    console.error(kleur.red(`Could not fetch skillsets from ${slug}. Make sure the repo has a skillsets/ directory.`))
    process.exit(1)
  }

  const toInstall = await pickSkillsets(skillsetFiles, skillsetName)

  for (const name of toInstall) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/skillsets/${name}.json`
    let skillset: Skillset
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status}`)
      skillset = await res.json() as Skillset
    } catch {
      console.error(kleur.red(`Could not fetch skillset "${name}"`))
      process.exit(1)
    }
    await runInstall(skillset)
  }
}

async function pickSkillsets(available: string[], specified?: string): Promise<string[]> {
  if (specified) {
    if (!available.includes(specified)) {
      console.error(kleur.red(`Skillset "${specified}" not found. Available: ${available.join(', ')}`))
      process.exit(1)
    }
    return [specified]
  }
  if (available.length === 1) return available

  const { picked } = await prompts({
    type: 'multiselect',
    name: 'picked',
    message: 'Which skillsets to install?',
    choices: available.map(s => ({ title: s, value: s, selected: true })),
    hint: 'space to toggle, enter to confirm'
  }, { onCancel: () => process.exit(0) })
  return picked as string[]
}

async function runInstall(skillset: Skillset): Promise<void> {
  console.log(`\n${kleur.bold(skillset.name)}  ${kleur.dim(skillset.description ?? '')}`)
  console.log(kleur.dim(`${skillset.skills.length} skill(s):\n`))
  for (const s of skillset.skills) {
    console.log(`  ${kleur.dim('·')} ${s.skill}  ${kleur.dim(s.repo)}`)
  }

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `Install these ${skillset.skills.length} skill(s)?`,
    initial: true
  }, { onCancel: () => process.exit(0) })

  if (!confirm) return

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
