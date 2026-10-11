// The shared agent.json authoring model. Runtime facts come only from the app service.
import { characterFor } from './sprites.js'
export const CATEGORIES = ['All agents', 'Code & QA', 'Research', 'DevOps', 'Personal Assistant', 'Design & UX', 'Installed Agents']
export const TOOL_CHOICES = [
  { name: 'code.review', label: 'Code review', purpose: 'Send an explicitly selected source for review' },
  { name: 'filesystem.read', label: 'App source read', purpose: 'Read declared files of a selected installed app' },
  { name: 'web.fetch', label: 'Public source fetch', purpose: 'Retrieve a selected public repository or research abstracts' },
  { name: 'memory.suggest', label: 'Memory suggestion', purpose: 'Prepare text for owner review; never save it automatically' },
]

export function makeManifest(draft) {
  const slug = draft.id || draft.name.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const id = (/^[a-z]/.test(slug) ? slug : 'agent-' + slug).slice(0, 48).replace(/-$/, '')
  const name = draft.name.trim()
  if (!id || !name || !draft.prompt?.trim()) throw new Error('Name and system prompt are required.')
  const playbook = (draft.playbook || '').split('\n').map((step) => step.trim()).filter(Boolean)
  if (!playbook.length) throw new Error('Add at least one playbook step.')
  const tools = [...new Set((draft.tools || []).filter((tool) => TOOL_CHOICES.some((choice) => choice.name === tool)))]
  const tags = [...new Set(typeof draft.tags === 'string' ? draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean) : (draft.tags || []))].slice(0, 8)
  const handle = `@${id}`
  return {
    schema_version: '1.0.0', id, name, version: draft.version || '1.0.0',
    author: { name: draft.author?.trim() || 'Local creator' },
    description: draft.description?.trim() || name,
    category: draft.category || 'Personal Assistant', tags,
    icon: { kind: 'monogram', value: name.slice(0, 1).toUpperCase() },
    persona: { system_prompt: draft.prompt.trim(), playbook, skills: [] },
    capabilities: {
      permissions: tools.map((tool) => ({ scope: tool, required: true, reason: TOOL_CHOICES.find((choice) => choice.name === tool).purpose })),
      tools: tools.map((tool) => ({ name: tool, required: true })),
    },
    // Installation never arms automatic triggers; the owner can opt in later.
    triggers: {
      manual: { enabled: true }, mention: { enabled: false, handle },
      cron: { enabled: false, expression: '0 8 * * *', timezone: 'UTC' }, events: [],
    },
    execution: { timeout_seconds: 300, max_concurrent_runs: 1, input_mode: 'user_supplied' },
    // A generated character; superpowers mirror exactly the powers requested above.
    character: {
      ...characterFor({ id, category: draft.category || 'Personal Assistant' }),
      superpowers: tools.map((tool) => {
        const choice = TOOL_CHOICES.find((item) => item.name === tool)
        return { name: choice.label, scope: tool, description: choice.purpose }
      }),
    },
    feedback: {
      log: { enabled: true, retention_days: 30, include_inputs: false },
      ratings: { enabled: true, allow_notes: true },
      memory: { capture: ['outcome', 'feedback'], refinement_mode: 'suggest_only', requires_owner_approval: true },
    },
  }
}
