import test from 'node:test'
import assert from 'node:assert/strict'
import { makeManifest } from './domain.mjs'

test('a created agent has a valid slug, stored playbook and no armed triggers', () => {
  const manifest = makeManifest({
    name: '24/7 Review', prompt: 'Review carefully.', playbook: 'Inspect the source\nCheck the bug report',
    tools: ['code.review', 'code.review'], tags: 'quality, quality, review',
  })
  assert.equal(manifest.id, 'agent-24-7-review')
  assert.deepEqual(manifest.persona.playbook, ['Inspect the source', 'Check the bug report'])
  assert.deepEqual(manifest.tags, ['quality', 'review'])
  assert.equal(manifest.capabilities.permissions.length, 1)
  assert.equal(manifest.triggers.mention.enabled, false)
  assert.equal(manifest.triggers.cron.enabled, false)
  assert.deepEqual(manifest.triggers.events, [])
})

test('an agent needs a prompt and a real playbook', () => {
  assert.throws(() => makeManifest({name: 'Watch', prompt: 'A', playbook: ''}), /playbook/)
  assert.throws(() => makeManifest({name: 'Watch', prompt: '', playbook: 'One step'}), /prompt/)
})

test('a forged agent gets a deterministic character whose powers match its requested scopes', () => {
  const draft = { name: 'Release Watch', category: 'DevOps', prompt: 'Watch releases.', playbook: 'Check tags', tools: ['web.fetch'] }
  const a = makeManifest(draft)
  const b = makeManifest(draft)
  assert.deepEqual(a.character, b.character)
  assert.equal(a.character.class, 'Ranger')
  assert.deepEqual(a.character.superpowers.map((p) => p.scope), ['web.fetch'])
  assert.match(a.character.palette.primary, /^#[0-9a-f]{6}$/)
})
