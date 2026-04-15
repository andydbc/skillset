import prompts from 'prompts'
import kleur from 'kleur'
import { fetchJSON } from '../github.js'
import { findSkillsetsDir, listLocalSkillsets, readSkillset } from '../utils.js'
import type { Skillset, GitHubFile } from '../types.js'

export async function list([repoSlug]: string[], { yes }: { yes: boolean } = { yes: false }): Promise<void> {
  if (!repoSlug) {
    const skillsetsDir = findSkillsetsDir()
    if (skillsetsDir) return printLocal(skillsetsDir)

    if (yes) {
      console.error(kleur.red('No local skillsets/ found. Provide a repo: npx @andbc/skillset list user/my-skillsets'))
      process.exit(1)
    }

    const { input } = await prompts({
      type: 'text',
      name: 'input',
      message: 'Skillset repo to browse',
      hint: 'e.g. user/my-skillsets'
    }, { onCancel: () => process.exit(0) })
    if (!input) return
    repoSlug = input as string
  }

  const slug = repoSlug
    .replace(/^https?:\/\/github\.com\//, '')
    .replace(/\.git$/, '')
    .split('/').slice(0, 2).join('/')

  const [owner, repo] = slug.split('/')

  console.log(kleur.dim(`\nFetching skillsets from ${slug}...\n`))

  let files: GitHubFile[]
  try {
    const contents = await fetchJSON<GitHubFile[]>(
      `https://api.github.com/repos/${owner}/${repo}/contents/skillsets`
    )
    files = contents.filter(f => f.name.endsWith('.json'))
  } catch {
    console.error(kleur.red(`Could not reach ${slug}. Is the repo public with a skillsets/ directory?`))
    process.exit(1)
  }

  for (const file of files) {
    const res = await fetch(file.download_url)
    const skillset = await res.json() as Skillset
    printSkillset(skillset)
  }
}

function printLocal(skillsetsDir: string): void {
  const names = listLocalSkillsets(skillsetsDir)
  if (names.length === 0) {
    console.log(kleur.dim('No skillsets yet. Run `npx skillset create`.'))
    return
  }
  console.log()
  for (const name of names) {
    const skillset = readSkillset(skillsetsDir, name)
    if (skillset) printSkillset(skillset)
  }
}

function printSkillset(skillset: Skillset): void {
  console.log(`${kleur.bold().cyan(skillset.name)}  ${kleur.dim(skillset.description ?? '')}`)
  for (const s of skillset.dependencies) {
    if (s.type === 'plugin') {
      console.log(`  ${kleur.dim('·')} ${s.name}  ${kleur.dim('@' + s.marketplace)}`)
    } else {
      console.log(`  ${kleur.dim('·')} ${s.skill}  ${kleur.dim(s.repo)}`)
    }
  }
  console.log()
}
