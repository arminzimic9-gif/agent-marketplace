// Guild Hall is a view of stored run events, never a source of simulated work.
export const GUILD_STATIONS = [
  { id: 'researcher', label: 'Library', prop: 'books', x: 14.5, y: 27 },
  { id: 'sentinel', label: 'Guardhouse', prop: 'guard', x: 38.2, y: 27 },
  { id: 'design-critic', label: 'Studio', prop: 'easel', x: 61.8, y: 27 },
  { id: 'recruiter', label: 'Interview room', prop: 'interview', x: 85.5, y: 27 },
  { id: 'brief-builder', label: 'Brief desk', prop: 'brief', x: 14.5, y: 82 },
  { id: 'launch-writer', label: 'Writing room', prop: 'launch', x: 38.2, y: 82 },
  { id: 'seo-scout', label: 'SEO radar', prop: 'seo', x: 61.8, y: 82 },
  { id: 'bug-triage', label: 'Triage bay', prop: 'triage', x: 85.5, y: 82 },
]

export function guildActivity(agentId, runs = [], pending = []) {
  const run = runs.find(item => item.agent_id === agentId && ['queued', 'running'].includes(item.status))
  const request = pending.find(item => item.agent_id === agentId)
  const event = run?.timeline?.at(-1)
  return {
    status: run ? run.status : request ? 'waiting' : 'idle',
    run,
    request,
    // No guessed step or stale status_detail: bubbles quote the actual journal.
    bubble: run?.status === 'running' && event ? event.description : '',
  }
}
