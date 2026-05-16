import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { syncDryRun, syncExecute, syncPlan } from './sync'

function makeTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cc-steward-sync-'))
}

test('syncDryRun reports per-item write, skip, overwrite, and unsupported actions', () => {
  const root = makeTmp()
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  fs.mkdirSync(path.join(home, '.claude', 'commands'), { recursive: true })
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'Use /compact carefully\n')
  fs.writeFileSync(path.join(home, '.claude', 'commands', 'ship.md'), 'ship it\n')
  fs.writeFileSync(path.join(home, '.codex', 'AGENTS.md'), 'existing\n')

  const skip = syncDryRun({ scope: 'global', replace: false, home_path: home, project_path: project })
  assert.equal(skip.items.find((item) => item.type === 'Instruction')?.dry_run_action, 'would_skip')
  const cmdItem = skip.items.find((item) => item.type === 'Command')
  if (cmdItem) {
    assert.equal(cmdItem.dry_run_action, 'would_write')
  }

  const overwrite = syncDryRun({ scope: 'global', replace: true, home_path: home, project_path: project })
  assert.equal(overwrite.items.find((item) => item.type === 'Instruction')?.dry_run_action, 'would_overwrite')
})

test('syncDryRun reports new target writes', () => {
  const root = makeTmp()
  const home = path.join(root, 'home')
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'new content\n')

  const result = syncDryRun({ scope: 'global', replace: false, home_path: home })
  assert.equal(result.items.find((item) => item.type === 'Instruction')?.dry_run_action, 'would_write')
  assert.deepEqual(result.would_write, [path.join(home, '.codex', 'AGENTS.md')])
})

test('syncPlan marks existing targets as conflicts', () => {
  const root = makeTmp()
  const home = path.join(root, 'home')
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'new content\n')
  fs.writeFileSync(path.join(home, '.codex', 'AGENTS.md'), 'old content\n')

  const result = syncPlan({ scope: 'global', replace: false, home_path: home })
  const instruction = result.items.find((item) => item.type === 'Instruction')
  assert.equal(instruction?.status, 'conflict')
  assert.equal(result.stats.conflicts, 1)
  assert.equal(result.stats.migratable, 0)
})

test('syncExecute backs up existing targets before overwrite', () => {
  const root = makeTmp()
  const home = path.join(root, 'home')
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true })
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true })
  fs.writeFileSync(path.join(home, '.claude', 'CLAUDE.md'), 'new content\n')
  const target = path.join(home, '.codex', 'AGENTS.md')
  fs.writeFileSync(target, 'old content\n')

  const result = syncExecute({ scope: 'global', replace: true, home_path: home })
  assert.deepEqual(result.errors, [])
  assert.equal(fs.readFileSync(target, 'utf8'), 'new content\n')
  assert.equal(result.overwritten.includes(target), true)
  assert.equal(result.backups.length, 1)
  assert.equal(result.backups[0].target, target)
  assert.equal(fs.readFileSync(result.backups[0].backup, 'utf8'), 'old content\n')
})

test('syncPlan writes Codex agents using the resolved .toml format', () => {
  const root = makeTmp()
  const home = path.join(root, 'home')
  fs.mkdirSync(path.join(home, '.claude', 'agents'), { recursive: true })
  fs.writeFileSync(
    path.join(home, '.claude', 'agents', 'reviewer.md'),
    [
      '---',
      'name: reviewer',
      'description: Reviews code',
      'tools: [Read, Bash]',
      '---',
      'Check implementation risks.',
      '',
    ].join('\n'),
  )

  const result = syncExecute({ scope: 'global', replace: false, home_path: home })
  const target = path.join(home, '.codex', 'agents', 'reviewer.toml')
  assert.equal(result.written.includes(target), true)
  const content = fs.readFileSync(target, 'utf8')
  assert.match(content, /^name = "reviewer"/)
  assert.match(content, /developer_instructions = """/)
  assert.match(content, /Check implementation risks\./)
  assert.match(content, /You're allowed to use these tools:/)
})
