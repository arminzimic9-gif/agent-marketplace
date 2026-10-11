import test from 'node:test'
import assert from 'node:assert/strict'
import { GUILD_STATIONS, guildActivity } from './guild-state.mjs'

test('the eight built-in agents have distinct stations', () => {
  assert.equal(GUILD_STATIONS.length, 8)
  assert.equal(new Set(GUILD_STATIONS.map(item => item.id)).size, 8)
})

test('Guild bubbles contain only current, real journal descriptions', () => {
  const pending = [{ id: 'request', agent_id: 'sentinel' }]
  assert.deepEqual(guildActivity('sentinel', [], pending).status, 'waiting')
  assert.equal(guildActivity('sentinel', [], pending).bubble, '')
  assert.equal(guildActivity('sentinel', [{ agent_id: 'sentinel', status: 'queued', status_detail: 'Planning' }], pending).bubble, '')
  const run = { agent_id: 'sentinel', status: 'running', timeline: [{ tool: 'run_checks', description: 'Checking source syntax' }] }
  assert.equal(guildActivity('sentinel', [run], pending).bubble, 'Checking source syntax')
  assert.equal(guildActivity('researcher', [run], pending).bubble, '')
  assert.equal(guildActivity('sentinel', [{ ...run, status: 'completed' }], pending).bubble, '')
})

test('an agent with no run or request is idle without a current step', () => {
  assert.deepEqual(guildActivity('brief-builder', [], []), {
    status: 'idle', run: undefined, request: undefined, bubble: '',
  })
})

test('stations stay on a grid with room for the walkway between rows', () => {
  const rows = [...new Set(GUILD_STATIONS.map(item => item.y))].sort((a, b) => a - b)
  assert.equal(rows.length, 2)
  assert.ok(rows[1] - rows[0] >= 50)
  const cols = [...new Set(GUILD_STATIONS.map(item => item.x))].sort((a, b) => a - b)
  assert.equal(cols.length, 4)
  assert.ok(cols.every((x, i) => i === 0 || x - cols[i - 1] >= 22))
})
