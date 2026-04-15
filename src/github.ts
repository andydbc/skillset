import type { GitHubFile } from './types.js'
export type { GitHubFile }

export async function fetchJSON<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'skillset' }
  })
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

export async function fetchRaw(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'skillset' } })
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`)
  return res.text()
}

export interface ParsedSkillsShUrl {
  owner: string
  repo: string
  skill: string | null
}

export function parseSkillsShUrl(url: string): ParsedSkillsShUrl | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('skills.sh')) return null
    const parts = u.pathname.replace(/^\//, '').split('/')
    if (parts.length < 2) return null
    return { owner: parts[0], repo: parts[1], skill: parts[2] ?? null }
  } catch {
    return null
  }
}

export interface ParsedGitHubUrl {
  owner: string
  repo: string
}

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('github.com')) return null
    const parts = u.pathname.replace(/^\//, '').split('/')
    if (parts.length < 2) return null
    return { owner: parts[0], repo: parts[1] }
  } catch {
    return null
  }
}

export interface PluginMetadata {
  name?: string
  description?: string
  version?: string
  author?: { name?: string; email?: string } | string
}

// Fetch .claude-plugin/plugin.json metadata if present
export async function fetchPluginMetadata(owner: string, repo: string): Promise<PluginMetadata | null> {
  try {
    const file = await fetchJSON<GitHubFile>(
      `https://api.github.com/repos/${owner}/${repo}/contents/.claude-plugin/plugin.json`
    )
    const raw = Buffer.from((file as any).content, 'base64').toString('utf8')
    return JSON.parse(raw) as PluginMetadata
  } catch {
    return null
  }
}

// List skill names in a GitHub repo (skills/<name>/SKILL.md)
export async function listSkillsInRepo(owner: string, repo: string): Promise<string[]> {
  try {
    const items = await fetchJSON<GitHubFile[]>(
      `https://api.github.com/repos/${owner}/${repo}/contents/skills`
    )
    return items.filter(i => i.type === 'dir').map(i => i.name)
  } catch {
    return []
  }
}
