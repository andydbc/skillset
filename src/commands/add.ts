import prompts from 'prompts'
import kleur from 'kleur'
import { parseSkillsShUrl, parseGitHubUrl, listSkillsInRepo } from '../github.js'
import { findSkillsetsDir, readSkillset, writeSkillset, listLocalSkillsets } from '../utils.js'
import { execSync } from 'child_process'

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
      message: 'Skill or plugin',
      hint: 'plugin@marketplace, skills.sh URL, or GitHub URL'
    }, { onCancel: () => process.exit(0) })
    url = input as string
  }

  const skillset = readSkillset(skillsetsDir, targetSkillset)!

  // --- Plugin: name@marketplace syntax ---
  const pluginMatch = /^([a-zA-Z0-9_-]+)@([a-zA-Z0-9_-]+)$/.exec(url)
  if (pluginMatch) {
    const [, name, marketplace] = pluginMatch
    let marketplaceList = ''
    try {
      marketplaceList = execSync(`claude plugin marketplace list`, { stdio: 'pipe', input: '\n' }).toString()
    } catch { /* claude not available or command failed — skip validation */ }
    if (marketplaceList) {
      const configured = marketplaceList.split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('❯'))
        .map(l => l.replace(/^❯\s*/, '').trim())
      if (!configured.includes(marketplace)) {
        console.error(kleur.red(`Marketplace "${marketplace}" not found. Add it first: claude plugin marketplace add ${marketplace}`))
        process.exit(1)
      }
    }

    const alreadyExists = skillset.dependencies.some(s => s.type === 'plugin' && s.name === name && s.marketplace === marketplace)
    if (alreadyExists) {
      console.log(kleur.yellow(`  · plugin ${name}@${marketplace} already in skillset, skipping`))
    } else {
      skillset.dependencies.push({ type: 'plugin', name, marketplace })
      console.log(kleur.green(`  ✓ plugin ${kleur.bold(name)}`) + kleur.dim(`  @${marketplace}`))
    }
    writeSkillset(skillsetsDir, skillset)
    console.log(kleur.dim(`\nUpdated .skillsets/${targetSkillset}.json`))
    return
  }

  // --- GitHub or skills.sh URL: individual skills ---
  const skillsSh = parseSkillsShUrl(url)
  const github = !skillsSh ? parseGitHubUrl(url) : null

  if (!skillsSh && !github) {
    console.error(kleur.red('Unrecognized input. Use plugin@marketplace, a skills.sh URL, or a GitHub URL.'))
    process.exit(1)
  }

  const owner = (skillsSh ?? github)!.owner
  const repo = (skillsSh ?? github)!.repo
  const knownSkill = skillsSh?.skill ?? null

  if (!knownSkill && github) {
    console.log(kleur.dim(`Fetching ${owner}/${repo}...`))
    const available = await listSkillsInRepo(owner, repo)

    if (available.length === 0) {
      console.error(kleur.red(`No skills found in ${owner}/${repo}`))
      process.exit(1)
    }

    const skillsToAdd: string[] = []
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

    for (const skill of skillsToAdd) {
      const source = `https://github.com/${owner}/${repo}`
      const exists = skillset.dependencies.some(s => s.type !== 'plugin' && (s as any).skill === skill && s.repo === `${owner}/${repo}`)
      if (exists) {
        console.log(kleur.yellow(`  · ${skill} already in skillset, skipping`))
        continue
      }
      skillset.dependencies.push({ skill, repo: `${owner}/${repo}`, source })
      console.log(kleur.green(`  ✓ ${skill}`))
    }

    writeSkillset(skillsetsDir, skillset)
    console.log(kleur.dim(`\nUpdated .skillsets/${targetSkillset}.json`))
    return
  }

  // --- skills.sh URL or direct skill name ---
  const skill = knownSkill!
  const source = skillsSh
    ? `https://skills.sh/${owner}/${repo}/${skill}`
    : `https://github.com/${owner}/${repo}`

  const exists = skillset.dependencies.some(s => s.type !== 'plugin' && (s as any).skill === skill && s.repo === `${owner}/${repo}`)
  if (exists) {
    console.log(kleur.yellow(`  · ${skill} already in skillset, skipping`))
  } else {
    skillset.dependencies.push({ skill, repo: `${owner}/${repo}`, source })
    console.log(kleur.green(`  ✓ ${skill}`))
  }

  writeSkillset(skillsetsDir, skillset)
  console.log(kleur.dim(`\nUpdated .skillsets/${targetSkillset}.json`))
}
