import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { resolveClaude, resolveCodex } from './config'

test('resolveClaude merges array settings across layers', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-claude-'))
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.mkdirSync(path.join(project, '.claude'), { recursive: true })

  fs.writeFileSync(path.join(home, '.claude', 'settings.json'), JSON.stringify({
    hooks: [{ event: 'global' }],
    permissions: ['Read'],
    model: 'global-model',
  }))
  fs.writeFileSync(path.join(project, '.claude', 'settings.json'), JSON.stringify({
    hooks: [{ event: 'project' }],
    permissions: ['Write'],
    model: 'project-model',
  }))
  fs.writeFileSync(path.join(project, '.claude', 'settings.local.json'), JSON.stringify({
    hooks: [{ event: 'local' }],
    permissions: ['Bash'],
  }))

  const resolved = resolveClaude(home, project)
  const rows = Object.fromEntries(resolved.settings.map((row) => [row.key, row]))

  assert.equal(rows.hooks.source, 'merged')
  assert.deepEqual(JSON.parse(rows.hooks.value), [{ event: 'global' }, { event: 'project' }, { event: 'local' }])
  assert.equal(rows.permissions.source, 'merged')
  assert.deepEqual(JSON.parse(rows.permissions.value), ['Read', 'Write', 'Bash'])
  assert.equal(rows.model.source, 'project')
  assert.deepEqual(rows.model.overrides, ['global'])
})

test('resolveCodex agents are resolved from toml files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-codex-config-'))
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  fs.mkdirSync(path.join(home, '.codex', 'agents'), { recursive: true })
  fs.mkdirSync(path.join(project, '.codex', 'agents'), { recursive: true })
  fs.writeFileSync(path.join(home, '.codex', 'agents', 'reviewer.toml'), "name = 'reviewer'\n")
  fs.writeFileSync(path.join(project, '.codex', 'agents', 'planner.toml'), "name = 'planner'\n")

  const resolved = resolveCodex(home, project)
  const agents = new Set(resolved.agents.map((item) => `${item.name}:${item.source}`))

  assert.deepEqual(agents, new Set(['reviewer:global', 'planner:project']))
})
