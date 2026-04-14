export interface SkillRef {
  skill: string
  repo: string
  source: string
}

export interface Skillset {
  name: string
  description?: string
  skills: SkillRef[]
}

export interface GitHubFile {
  path: string
  name: string
  download_url: string
  type: string
}
