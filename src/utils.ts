import fs from 'fs'
import path from 'path'
import type { Skillset } from './types.js'

export type { Skillset }

export function findSkillsetsDir(): string | null {
  let dir = process.cwd()
  for (let i = 0; i < 4; i++) {
    const candidate = path.join(dir, 'skillsets')
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

export function readSkillset(skillsetsDir: string, name: string): Skillset | null {
  const file = path.join(skillsetsDir, `${name}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Skillset
}

export function writeSkillset(skillsetsDir: string, skillset: Skillset): void {
  const file = path.join(skillsetsDir, `${skillset.name}.json`)
  fs.writeFileSync(file, JSON.stringify(skillset, null, 2))
}

export function listLocalSkillsets(skillsetsDir: string): string[] {
  return fs.readdirSync(skillsetsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
}
