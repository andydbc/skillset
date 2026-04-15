import prompts from 'prompts'
import kleur from 'kleur'
import { execSync } from 'child_process'
import { findSkillsetsDir, listLocalSkillsets, readSkillset, writeSkillset } from '../utils.js'
import type { SkillRef } from '../types.js'

export async function remove([skillsetArg, skillArg]: string[], { yes }: { yes: boolean } = { yes: false }): Promise<void> {
  const skillsetsDir = findSkillsetsDir()
  if (!skillsetsDir) {
    console.error(kleur.red('No skillsets/ directory found.'))
    process.exit(1)
  }

  const skillsets = listLocalSkillsets(skillsetsDir)
  if (skillsets.length === 0) {
    console.error(kleur.red('No skillsets found.'))
    process.exit(1)
  }

  // Pick skillset
  let targetSkillset: string
  if (skillsetArg && skillsets.includes(skillsetArg)) {
    targetSkillset = skillsetArg
  } else if (skillsets.length === 1) {
    targetSkillset = skillsets[0]
  } else if (yes) {
    console.error(kleur.red('Multiple skillsets found — specify one: npx @andbc/skillset remove <skillset> <skill>'))
    process.exit(1)
  } else {
    const { picked } = await prompts({
      type: 'select',
      name: 'picked',
      message: 'Which skillset?',
      choices: skillsets.map(s => ({ title: s, value: s }))
    }, { onCancel: () => process.exit(0) })
    targetSkillset = picked
  }

  const skillset = readSkillset(skillsetsDir, targetSkillset)!

  if (skillset.dependencies.length === 0) {
    console.log(kleur.yellow(`Skillset "${targetSkillset}" has no skills.`))
    return
  }

  let toRemove: string[]
  if (skillArg) {
    if (!skillset.dependencies.some(s => s.type !== 'plugin' && (s as SkillRef).skill === skillArg)) {
      console.error(kleur.red(`Skill "${skillArg}" not found in skillset "${targetSkillset}"`))
      process.exit(1)
    }
    toRemove = [skillArg]
  } else if (yes) {
    console.error(kleur.red('Skill name required: npx @andbc/skillset remove <skillset> <skill>'))
    process.exit(1)
  } else {
    const { picked } = await prompts({
      type: 'multiselect',
      name: 'picked',
      message: 'Which skills to remove?',
      choices: skillset.dependencies.filter((s): s is SkillRef => s.type !== 'plugin').map(s => ({ title: `${s.skill}  ${kleur.dim(s.repo)}`, value: s.skill })),
      hint: 'space to toggle, enter to confirm'
    }, { onCancel: () => process.exit(0) })
    toRemove = picked
  }

  if (toRemove.length === 0) return

  // Check which skills are still referenced by other skillsets
  const otherSkillsets = skillsets
    .filter(name => name !== targetSkillset)
    .map(name => readSkillset(skillsetsDir, name))
    .filter(Boolean)

  const stillReferenced = new Set(
    otherSkillsets.flatMap(s => s!.dependencies.filter((r): r is SkillRef => r.type !== 'plugin').map(r => r.skill))
  )

  skillset.dependencies = skillset.dependencies.filter(s => s.type === 'plugin' || !toRemove.includes((s as SkillRef).skill))
  writeSkillset(skillsetsDir, skillset)

  for (const skill of toRemove) {
    if (stillReferenced.has(skill)) {
      console.log(kleur.green(`  ✓ ${skill}`) + kleur.dim(' (kept — used by another skillset)'))
      continue
    }
    try {
      execSync(`npx skills remove ${skill} -y`, { stdio: 'pipe' })
      console.log(kleur.green(`  ✓ Removed ${skill}`))
    } catch {
      console.log(kleur.green(`  ✓ ${skill}`) + kleur.dim(' (not installed locally)'))
    }
  }
  console.log(kleur.dim(`\nUpdated skillsets/${targetSkillset}.json`))
}
