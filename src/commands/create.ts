import prompts from 'prompts'
import kleur from 'kleur'
import fs from 'fs'
import path from 'path'
import { findSkillsetsDir, writeSkillset } from '../utils.js'

export async function create(): Promise<void> {
  let skillsetsDir = findSkillsetsDir()
  if (!skillsetsDir) {
    skillsetsDir = path.join(process.cwd(), 'skillsets')
    fs.mkdirSync(skillsetsDir)
    console.log(kleur.dim('Created skillsets/\n'))
  }

  console.log(kleur.bold('\nCreate a new skillset\n'))

  const { name, description } = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Skillset name',
      hint: 'e.g. frontend, backend, devops',
      validate: (v: string) => /^[a-z][a-z0-9-]*$/.test(v) || 'Use lowercase letters, numbers and hyphens'
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description'
    }
  ], { onCancel: () => process.exit(0) })

  const file = path.join(skillsetsDir, `${name}.json`)
  if (fs.existsSync(file)) {
    console.error(kleur.red(`Skillset "${name}" already exists`))
    process.exit(1)
  }

  writeSkillset(skillsetsDir, { name, description, skills: [] })

  console.log(kleur.green(`\n✓ Created skillsets/${name}.json`))
  console.log(kleur.dim('\nNext: npx skillset add <skill-url>'))
}
