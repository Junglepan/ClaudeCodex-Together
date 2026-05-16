import fs from 'node:fs'
import path from 'node:path'
import { homeDir, isDirectory, readText } from './fsUtils'

export interface SkillItem {
  name: string
  description: string
  source: 'global' | 'project'
  path: string
  content: string
}

function parseFrontmatter(content: string) {
  if (!content.startsWith('---')) return { data: {} as Record<string, string>, body: content }
  const parts = content.split('---')
  if (parts.length < 3) return { data: {} as Record<string, string>, body: content }
  const data: Record<string, string> = {}
  for (const line of parts[1].split(/\r?\n/)) {
    const index = line.indexOf(':')
    if (index === -1) continue
    data[line.slice(0, index).trim()] = line.slice(index + 1).trim()
  }
  return { data, body: parts.slice(2).join('---').replace(/^\r?\n/, '') }
}

function scanSkillsDir(dir: string, scope: 'global' | 'project', agent: string): SkillItem[] {
  if (!isDirectory(dir)) return []

  if (agent === 'claude') {
    return fs.readdirSync(dir).flatMap((name) => {
      const skillFile = path.join(dir, name, 'SKILL.md')
      if (!fs.existsSync(skillFile)) return []
      const content = readText(skillFile)
      const fm = parseFrontmatter(content)
      return [{
        name: String(fm.data.name || name),
        description: String(fm.data.description || ''),
        source: scope,
        path: skillFile,
        content,
      }]
    })
  }

  return fs.readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => {
    const filePath = path.join(dir, name)
    const content = readText(filePath)
    const fm = parseFrontmatter(content)
    return {
      name: String(fm.data.name || name.slice(0, -3)),
      description: String(fm.data.description || ''),
      source: scope,
      path: filePath,
      content,
    }
  })
}

export function listSkills(agent: string, project?: string | null): SkillItem[] {
  const home = homeDir()
  const configDir = agent === 'claude' ? '.claude' : '.codex'
  const globalDir = path.join(home, configDir, 'skills')
  const projectDir = project ? path.join(project, configDir, 'skills') : null

  const globalSkills = scanSkillsDir(globalDir, 'global', agent)
  const projectSkills = projectDir ? scanSkillsDir(projectDir, 'project', agent) : []

  return [...globalSkills, ...projectSkills]
}
