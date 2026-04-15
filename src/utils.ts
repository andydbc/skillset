import fs from 'fs'
import path from 'path'
import type { Skillset } from './types.js'

export type { Skillset }

export function findSkillsetsDir(): string | null {
  const candidate = path.join(process.cwd(), '.skillsets')
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate
  return null
}

export function readSkillset(skillsetsDir: string, name: string): Skillset | null {
  const file = path.join(skillsetsDir, `${name}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Skillset
}

export function writeSkillset(skillsetsDir: string, skillset: Skillset): void {
  const file = path.join(skillsetsDir, `${skillset.name}.json`)
  const { $skillset, name, description, dependencies } = skillset
  const sorted = [...dependencies].sort((a, b) => {
    const keyA = (a.type !== 'plugin' ? (a as any).skill : a.name) ?? ''
    const keyB = (b.type !== 'plugin' ? (b as any).skill : b.name) ?? ''
    return keyA.localeCompare(keyB)
  })
  const ordered = { $skillset, name, description, dependencies: sorted }
  fs.writeFileSync(file, JSON.stringify(ordered, null, 2))
}

export function listLocalSkillsets(skillsetsDir: string): string[] {
  return fs.readdirSync(skillsetsDir)
    .filter(f => f.endsWith('.json'))
    .filter(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(skillsetsDir, f), 'utf8'))
        return data.$skillset === true
      } catch { return false }
    })
    .map(f => f.replace('.json', ''))
}
