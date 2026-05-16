import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { discoverFromCodex, mergeProjects } from './projects'

test('mergeProjects preserves latest last_used and sorts recent first', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-projects-'))
  const older = path.join(root, 'older')
  const newer = path.join(root, 'newer')
  const shared = path.join(root, 'shared')
  fs.mkdirSync(older)
  fs.mkdirSync(newer)
  fs.mkdirSync(shared)

  const merged = mergeProjects(
    [
      { path: older, name: 'older', exists: true, source: 'codex', last_used: null },
      { path: shared, name: 'shared', exists: true, source: 'codex', last_used: null },
    ],
    [
      { path: newer, name: 'newer', exists: true, source: 'claude', last_used: 200 },
      { path: shared, name: 'shared', exists: true, source: 'claude', last_used: 100 },
    ],
  )

  assert.deepEqual(merged.map((item) => item.name), ['newer', 'shared', 'older'])
  assert.equal(merged[1].source, 'both')
  assert.equal(merged[1].last_used, 100)
  assert.equal(merged[2].last_used, null)
})

test('discoverFromCodex returns projects from config.toml', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-codex-'))
  const home = path.join(root, 'home')
  const project = path.join(root, 'project')
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true })
  fs.mkdirSync(project)
  fs.writeFileSync(
    path.join(home, '.codex', 'config.toml'),
    `[projects."${project}"]\ntrust_level = "trusted"\n`,
    'utf8',
  )

  assert.deepEqual(discoverFromCodex(home), [{
    path: project,
    name: 'project',
    exists: true,
    source: 'codex',
    last_used: null,
  }])
})
