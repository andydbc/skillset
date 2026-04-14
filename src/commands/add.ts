import prompts from 'prompts'
import kleur from 'kleur'
import { parseSkillsShUrl, parseGitHubUrl, listSkillsInRepo } from '../github.js'
import { findSkillsetsDir, readSkillset, writeSkillset, listLocalSkillsets } from '../utils.js'

export async function add([url]: string[], { yes }: { yes: boolean } = { yes: false }): Promise<void> {
  const skillsetsDir = findSkillsetsDir()
  if (!skillsetsDir) {
    console.error(kleur.red('No skillsets/ directory found. Run `npx skillset create` first.'))
    process.exit(1)
  }

  const skillsets = listLocalSkillsets(skillsetsDir)
  if (skillsets.length === 0) {
    console.error(kleur.red('No skillsets yet. Run `npx skillset create` first.'))
    process.exit(1)
  }

  // Pick target skillset (skip prompt if only one)
  let targetSkillset: string
  if (skillsets.length === 1) {
    targetSkillset = skillsets[0]
  } else if (yes) {
    console.error(kleur.red('Multiple skillsets found — specify which one: npx @andbc/skillset add <url> <skillset>'))
    process.exit(1)
  } else {
    const { picked } = await prompts({
      type: 'select',
      name: 'picked',
      message: 'Add to which skillset?',
      choices: skillsets.map(s => ({ title: s, value: s }))
    }, { onCancel: () => process.exit(0) })
    targetSkillset = picked
  }

  if (!url) {
    if (yes) {
      console.error(kleur.red('URL required: npx @andbc/skillset add <url>'))
      process.exit(1)
    }
    const { input } = await prompts({
      type: 'text',
      name: 'input',
      message: 'Skill URL',
      hint: 'skills.sh or GitHub URL'
    }, { onCancel: () => process.exit(0) })
    url = input as string
  }

  const skillsSh = parseSkillsShUrl(url)
  const github = !skillsSh ? parseGitHubUrl(url) : null

  if (!skillsSh && !github) {
    console.error(kleur.red('Unrecognized URL. Provide a skills.sh or GitHub URL.'))
    process.exit(1)
  }

  const owner = (skillsSh ?? github)!.owner
  const repo = (skillsSh ?? github)!.repo
  const knownSkill = skillsSh?.skill ?? null

  const skillsToAdd: string[] = []

  if (knownSkill) {
    skillsToAdd.push(knownSkill)
  } else {
    console.log(kleur.dim(`Fetching skills from ${owner}/${repo}...`))
    const available = await listSkillsInRepo(owner, repo)

    if (available.length === 0) {
      console.error(kleur.red(`No skills found in ${owner}/${repo}`))
      process.exit(1)
    }

    if (available.length === 1) {
      skillsToAdd.push(available[0])
    } else if (yes) {
      skillsToAdd.push(...available)
    } else {
      const { picked } = await prompts({
        type: 'multiselect',
        name: 'picked',
        message: 'Which skills to add?',
        choices: available.map(s => ({ title: s, value: s, selected: true })),
        hint: 'space to toggle, enter to confirm'
      }, { onCancel: () => process.exit(0) })
      skillsToAdd.push(...picked)
    }
  }

  const skillset = readSkillset(skillsetsDir, targetSkillset)!

  for (const skill of skillsToAdd) {
    const source = skillsSh
      ? `https://skills.sh/${owner}/${repo}/${skill}`
      : `https://github.com/${owner}/${repo}`

    const exists = skillset.skills.some(s => s.skill === skill && s.repo === `${owner}/${repo}`)
    if (exists) {
      console.log(kleur.yellow(`  · ${skill} already in skillset, skipping`))
      continue
    }

    skillset.skills.push({ skill, repo: `${owner}/${repo}`, source })
    console.log(kleur.green(`  ✓ ${skill}`))
  }

  writeSkillset(skillsetsDir, skillset)
  console.log(kleur.dim(`\nUpdated skillsets/${targetSkillset}.json`))
}
