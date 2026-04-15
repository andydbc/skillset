export interface SkillRef {
  type?: 'skill'
  skill: string
  repo: string
  source: string
}

export interface PluginRef {
  type: 'plugin'
  name: string
  marketplace: string
}

export type SkillsetEntry = SkillRef | PluginRef

export interface Skillset {
  $skillset: true
  name: string
  description?: string
  dependencies: SkillsetEntry[]
}

export interface GitHubFile {
  path: string
  name: string
  download_url: string
  type: string
}
