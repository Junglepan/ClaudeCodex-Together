import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { handleBackendRequest } from './api'
import pkg from '../../package.json'

test('health reports package version', async () => {
  const health = await handleBackendRequest({ endpoint: 'health' }) as { version: string }
  assert.equal(health.version, pkg.version)
})

test('meta keeps home as default project path when no env project is set', async () => {
  const oldProject = process.env.CC_STEWARD_PROJECT
  const oldLegacyProject = process.env.CCT_PROJECT
  delete process.env.CC_STEWARD_PROJECT
  delete process.env.CCT_PROJECT
  try {
    const meta = await handleBackendRequest({ endpoint: 'meta' }) as { project_path: string; home_path: string }
    assert.equal(meta.project_path, meta.home_path)
  } finally {
    if (oldProject === undefined) delete process.env.CC_STEWARD_PROJECT
    else process.env.CC_STEWARD_PROJECT = oldProject
    if (oldLegacyProject === undefined) delete process.env.CCT_PROJECT
    else process.env.CCT_PROJECT = oldLegacyProject
  }
})

test('backend routes session endpoints', async () => {
  const homePath = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-steward-api-sessions-'))
  const payload = { scope: 'all', home_path: homePath }

  const watchPaths = await handleBackendRequest({ endpoint: 'sessions.watchPaths', payload: { home_path: homePath } })
  const sessions = await handleBackendRequest({ endpoint: 'sessions.list', payload })
  const projects = await handleBackendRequest({ endpoint: 'sessions.projects', payload })

  assert.ok(Array.isArray(watchPaths))
  assert.ok(Array.isArray(sessions))
  assert.ok(Array.isArray(projects))
})
