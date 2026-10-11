import React, { useCallback, useEffect, useState } from 'react'

const KIND = {
  added: 'New rule', changed: 'Rule changed', removed: 'Rule removed',
  noted: 'Noted', kept_out: 'Not kept', nothing: 'Nothing new',
}

function when(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

export function SyncLine({ sync }) {
  if (!sync || sync.status === 'off') return null
  if (sync.status === 'error') return <span className="am-learned-sync is-error">GitHub sync failed: {sync.error || 'unknown error'}. Nothing was lost; use “Sync now” in Settings.</span>
  const short = sync.commit ? sync.commit.slice(0, 7) : ''
  return <span className="am-learned-sync">{sync.status === 'unchanged' ? 'Private GitHub repository already up to date' : 'Saved to your private GitHub repository'}
    {sync.url && <> · <a href={sync.url} target="_blank" rel="noopener noreferrer">commit {short}</a></>}</span>
}

// The "What I learned" report that closes every run.
export function LearnedCard({ learned, sync }) {
  if (!learned) return null
  const replay = learned.replay
  return <section className="am-learned" aria-label="What I learned">
    <div className="am-learned-head"><span className="am-mono">/ What I learned</span>{learned.version_after ? <span className="am-mono am-dim">Rulebook v{learned.version_after}</span> : null}</div>
    <h4>{learned.headline}</h4>
    {learned.worked && <p className="am-learned-sum"><b>What worked:</b> {learned.worked}</p>}
    {learned.failed && <p className="am-learned-sum"><b>What did not:</b> {learned.failed}</p>}
    <ul className="am-learned-list">{(learned.bullets || []).map((item, index) => <li key={index}>
      <span className={'am-learned-kind is-' + item.kind}>{KIND[item.kind] || item.kind}</span>
      <span>{item.text}{item.reason ? <small>{item.kind === 'nothing' ? '' : 'Because: '}{item.reason}</small> : null}</span>
    </li>)}</ul>
    <div className="am-learned-foot">
      {replay && replay.total > 0 && <span>Replay over {replay.total} earlier result{replay.total === 1 ? '' : 's'}: {replay.before} → {replay.after} good · {replay.broken} made worse</span>}
      {typeof learned.cost_usd === 'number' && <span>Reflection ≈ US${learned.cost_usd.toFixed(3)} (inside the run’s cost cap)</span>}
      <SyncLine sync={sync}/>
    </div>
  </section>
}

export function KnowledgeSettings({ call }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({ repo: '', token: '' })
  const load = useCallback(() => call('knowledge/status').then(setStatus).catch((failure) => setError(failure.message)), [call])
  useEffect(() => { load() }, [load])

  async function toggle(enabled) {
    setBusy(true); setError(''); setNotice('')
    try { setStatus(await call('knowledge/settings', { enabled })) } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  async function syncNow(agentId) {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await call('knowledge/sync', agentId ? { agent_id: agentId } : {})
      setStatus(result.status)
      const failed = result.results.filter((item) => item.status === 'error')
      setNotice(failed.length ? '' : 'Knowledge is synced to your private repository.')
      if (failed.length) setError(failed[0].error)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  async function saveToken(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      setStatus(await call('knowledge/token', { token: form.token, repo: form.repo }))
      setForm({ ...form, token: '' })
      setNotice('Token saved. Turn the sync on below.')
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  async function removeToken() {
    setBusy(true); setError(''); setNotice('')
    try { setStatus(await call('knowledge/token', { remove: true })); setNotice('Token removed. Nothing will be synced.') } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  if (!status) return <div className="am-kn"><div className="am-alert" role={error ? 'alert' : 'status'}>{error || 'Loading settings…'}</div></div>
  const conn = status.connection
  const ready = conn.configured
  return <div className="am-kn">
    <div className="am-section-head"><span className="am-mono">/ Settings</span><h2>Keep what your agents <em>learn</em>.</h2><p>After every run an agent reflects, updates its rules only if a replay of your earlier feedback shows nothing gets worse, and can save the distilled result to a private GitHub repository.</p></div>
    <section className="am-kn-card am-glass" aria-label="GitHub knowledge sync">
      <span className="am-mono">/ Private GitHub sync</span>
      <h3>Sync knowledge to GitHub (private)</h3>
      <p>Only distilled rules and “What I learned” notes are saved: no CVs, task content, client messages, names, links, contact details or tokens. The repository <code>{status.repo_name}</code> must be private and is checked before every push; if it is ever public, nothing is pushed.</p>
      <label className="am-kn-toggle"><input type="checkbox" checked={status.enabled} disabled={busy || !ready} onChange={(event) => toggle(event.target.checked)}/> Sync knowledge to GitHub (private)</label>
      <div className="am-kn-state">
        <span className={'am-kn-chip ' + (ready ? 'is-ok' : 'is-bad')}>{ready ? 'Token saved' : 'No token saved · sync is off'}</span>
        {status.repo ? <span className={'am-kn-chip ' + (status.repo.private ? 'is-ok' : 'is-bad')}>{status.repo.full} · {status.repo.private ? 'private' : 'PUBLIC — sync refused'}</span> : null}
        {status.wide_token && <span className="am-kn-chip is-bad">Token can reach other repositories</span>}
      </div>
      {status.wide_token && <p>This token can also reach other repositories. Replace it with a fine-grained token limited to <code>{status.repo_name}</code> only.</p>}
      {status.error && <div className="am-alert" role="alert">{status.error}</div>}
      {error && <div className="am-alert" role="alert"><span>{error}</span><button className="am-ghost" onClick={() => setError('')}>Close</button></div>}
      {notice && <p role="status">{notice}</p>}
      <div className="am-kn-actions"><button className="am-pill" disabled={busy || !ready} onClick={() => syncNow()}>{busy ? 'Working…' : 'Sync now'}</button>
        {ready && <button className="am-ghost" disabled={busy} onClick={removeToken}>Remove token</button>}</div>
      <details className="am-kn-steps" open={!ready}>
        <summary>{ready ? 'Replace the token' : 'Set up the token (about 3 minutes)'}</summary>
        <ol>
          <li>On github.com create a new repository named <code>{status.repo_name}</code>. Choose <strong>Private</strong> and tick <strong>Add a README file</strong>.</li>
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token</a>. Name it “Agent Marketplace knowledge” and pick an expiry (90 days is fine).</li>
          <li>Under <strong>Repository access</strong> choose <strong>Only select repositories</strong> and select just <code>{status.repo_name}</code>. Nothing else.</li>
          <li>Under <strong>Repository permissions</strong> set <strong>Contents: Read and write</strong>. Leave every other permission off (Metadata read-only is added by GitHub).</li>
          <li>Click <strong>Generate token</strong>, copy it (it starts with <code>github_pat_</code>) and paste it below with your repository name.</li>
        </ol>
        <form className="am-kn-form" onSubmit={saveToken}>
          <label>Repository<input value={form.repo} onChange={(event) => setForm({ ...form, repo: event.target.value })} placeholder={'your-username/' + status.repo_name} autoComplete="off" spellCheck={false}/></label>
          <label>Fine-grained token<input type="password" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} placeholder="github_pat_…" autoComplete="off" spellCheck={false}/></label>
          <button className="am-pill" type="submit" disabled={busy || !form.token || !form.repo}>{busy ? 'Checking…' : 'Check and save token'}</button>
          <small>The token is checked once, then stored privately on this server. It is never shown again, written to the repository, logged or exported. Remove it any time, or revoke it on GitHub.</small>
        </form>
      </details>
      <ul className="am-kn-agents" aria-label="Last sync per agent">{status.agents.map((item) => <li key={item.id}>
        <span><strong>{item.name}</strong><small>Rulebook v{item.version} · {item.reflections} reflection{item.reflections === 1 ? '' : 's'}</small></span>
        <span>{item.last ? <>{item.last.status === 'error' ? <span className="am-learned-sync is-error">Failed: {item.last.error}</span> : <>Last sync {when(item.last.checked_at || item.last.at)}{item.last.url && <> · <a href={item.last.url} target="_blank" rel="noopener noreferrer">commit {item.last.commit?.slice(0, 7)}</a></>}</>}
          {item.last.message && <small>{item.last.message}</small>}</> : <span className="am-dim">Not synced yet</span>}</span>
      </li>)}</ul>
    </section>
  </div>
}
