import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@openai/apps-sdk-ui/components/Icon'
import { REPLY_CSS } from './reply-theme.js'
import { LearnedCard } from './learned.jsx'

const label = decision => decision.target || 'Earlier result'

export function AgentReply({ call, run, model, scopes, refreshGlobal }) {
  const [reply, setReply] = useState('')
  const [confirmed, setConfirmed] = useState(null)
  const [book, setBook] = useState(null)
  const [estimate, setEstimate] = useState(null)
  const [queued, setQueued] = useState('')
  const [runStatus, setRunStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [regressionAck, setRegressionAck] = useState(false)

  async function load() {
    const result = await call('learning/' + run.agent_id)
    setBook(result.learning)
    return result.learning
  }
  useEffect(() => {
    let live = true
    call('learning/' + run.agent_id).then(result => { if (live) setBook(result.learning) })
      .catch(failure => { if (live) setError(failure.message) })
    return () => { live = false }
  }, [call, run.agent_id, run.feedback?.rating, run.feedback?.note])
  useEffect(() => {
    if (!queued) return undefined
    let live = true
    const check = async () => {
      try {
        const value = await call('runs/' + queued)
        if (!live) return
        setRunStatus(value.run.status_detail || value.run.status)
        if (['completed', 'failed', 'stopped'].includes(value.run.status)) {
          setQueued('')
          if (value.run.status !== 'completed') setError(value.run.error || 'Proposing a lesson did not succeed.')
          else { await load(); await refreshGlobal(); setNotice('The agent proposed a lesson. It has not remembered anything yet.') }
        }
      } catch (failure) { if (live) setError(failure.message) }
    }
    check()
    const timer = setInterval(check, 2000)
    return () => { live = false; clearInterval(timer) }
  }, [queued, call, run.agent_id, refreshGlobal])

  function fail(failure) { setError(failure.message || String(failure)); setBusy(false) }
  async function plan() {
    setError(''); setNotice('')
    try {
      const request = { action: 'reply', run_id: run.id, reply: reply.trim() }
      const value = await call('learning/estimate', { agent_id: run.agent_id, ...request })
      setEstimate({ request, value, ack: false })
    } catch (failure) { fail(failure) }
  }
  async function confirmRun() {
    if (!estimate?.ack || busy) return
    setBusy(true); setError('')
    try {
      const result = await call('learning/run', { agent_id: run.agent_id, ...estimate.request,
        confirm_cost: true, confirmed_permissions: scopes,
        confirmed_tools: estimate.value.tools, confirmed_limits: estimate.value.limits })
      setQueued(result.run.id); setRunStatus('Waiting for the supervised job…')
      setEstimate(null); setNotice('Your reply was sent to the model. Wait for the lesson proposal.')
    } catch (failure) { fail(failure) } finally { setBusy(false) }
  }
  async function settle(accept) {
    setBusy(true); setError('')
    try {
      const result = await call(accept ? 'learning/accept' : 'learning/decline',
        { agent_id: run.agent_id, proposal_id: book.proposal.id })
      setBook(result.learning); setRegressionAck(false)
      setConfirmed(accept ? { learned: result.learned, sync: result.sync } : null)
      await refreshGlobal()
      setNotice(accept ? 'The lesson is confirmed in a new rulebook version.' : 'The proposal was not remembered.')
    } catch (failure) { fail(failure) } finally { setBusy(false) }
  }

  const proposal = book?.proposal
  const current = book?.versions.at(-1)
  const replay = proposal?.replay
  const targetFor = id => label(book?.decisions.find(decision => decision.id === id) || {})
  return <section className="am-reply"><style>{REPLY_CSS}</style>
    <div className="am-reply-head"><span className="am-mono">/ Reply to agent</span><h3>Say what to do differently.</h3><p>The agent proposes a lesson from your reply; only your confirmation puts it into the versioned rulebook. Existing ratings and notes remain short-term feedback.</p></div>
    {error && <div className="am-alert" role="alert"><span>{error}</span><button className="am-ghost" onClick={() => setError('')}>Close</button></div>}
    {notice && <p className="am-reply-notice" role="status">{notice}</p>}
    <label className="am-field">Your reply<textarea className="am-input am-short" value={reply} maxLength={600} onChange={event => setReply(event.target.value)} placeholder="E.g. Next time cite the exact source lines, not just a general conclusion."/></label>
    <div className="am-reply-actions"><button className="am-ghost" disabled={busy || !!queued || reply.trim().length < 3} onClick={plan}>Send reply and check cost</button><span className="am-mono am-dim">A reply becomes a rule only after you confirm it</span></div>
    {queued && <p className="am-reply-running" role="status">The agent is considering your reply · {runStatus}</p>}

    {proposal && <div className="am-reply-proposal"><span className="am-mono">/ Proposal</span><h4>What I learned: <em>{proposal.changes[0]?.text || proposal.rules.at(-1)?.text}</em></h4><p>Shall I remember it?</p>
      {replay?.total ? <div className="am-reply-replay"><span>Replay of earlier ratings · a model assessment, not proof of future performance</span><div><strong>Before {replay.before}/{replay.total}</strong><strong>After {replay.after}/{replay.total}</strong></div><p>Fixed {replay.fixed.length}: {replay.fixed.map(targetFor).join(', ') || '—'}</p><p>Broken {replay.broken.length}: {replay.broken.map(targetFor).join(', ') || '—'}</p></div> : <p className="am-dim">There are no earlier ratings yet; replay has nothing to compare.</p>}
      {!!replay?.warnings.length && <div className="am-alert">{replay.warnings.join(' ')}</div>}
      {!!replay?.broken.length && <label className="am-reply-ack"><input type="checkbox" checked={regressionAck} onChange={event => setRegressionAck(event.target.checked)}/> I understand the regression in earlier ratings.</label>}
      <div className="am-reply-actions"><button className="am-pill" disabled={busy || (!!replay?.broken.length && !regressionAck)} onClick={() => settle(true)}>Yes, remember as v{(book?.versions.length || 0) + 1}</button><button className="am-ghost" disabled={busy} onClick={() => settle(false)}>Do not remember</button></div>
    </div>}

    {confirmed && <LearnedCard learned={confirmed.learned} sync={confirmed.sync}/>}

    <details className="am-reply-book"><summary>Confirmed rulebook · {current ? 'v' + current.version : 'still empty'}</summary>{current ? <><ul>{current.rules.map(rule => { const origin = book.lineage?.[rule.id]; return <li key={rule.id}><code>{rule.id}</code> {rule.text}<small style={{display:'block',color:'var(--muted)'}}>{origin?.author_handle ? `Inherited from ${origin.author_handle} · v${origin.version}` : `Own rule · v${origin?.version || current.version}`}</small></li> })}</ul><p>Versions: {book.versions.map(item => 'v' + item.version).join(' · ')}</p></> : <p>The first confirmed lesson will create v1.</p>}</details>

    {estimate && createPortal(<div className="am-scrim" onMouseDown={event => { if (event.target === event.currentTarget) setEstimate(null) }}><section className="am-confirm am-glass" role="dialog" aria-modal="true" aria-label="Confirm reply cost"><div className="am-confirm-head"><span className="am-mono">/ Cost and permissions</span><button className="am-icon" onClick={() => setEstimate(null)} aria-label="Close"><X width={18}/></button></div><h2>Propose a lesson and replay?</h2><p>One call to the selected model. The agent will read your reply and, if any exist, all earlier ratings for itself.</p><dl className="am-facts"><div><dt>Model</dt><dd>{estimate.value.model.label}</dd></div><div><dt>Permissions</dt><dd>{scopes.join(', ') || 'None'}</dd></div><div><dt>Tools</dt><dd>{estimate.value.tools.join(', ') || 'None'}</dd></div><div><dt>Limits</dt><dd>{estimate.value.limits.max_steps} steps · {estimate.value.limits.timeout_seconds}s · ≈ US${estimate.value.limits.max_estimated_cost_usd.toFixed(2)}</dd></div><div><dt>Estimate</dt><dd>{estimate.value.estimate_usd == null ? 'No money estimate is available for this model' : '≈ US$' + estimate.value.estimate_usd.toFixed(3)} · ~{estimate.value.input_tokens.toLocaleString()} input + up to {estimate.value.output_tokens.toLocaleString()} output tokens</dd></div></dl><p className="am-dim">{estimate.value.basis}</p><label className="am-ack"><input type="checkbox" checked={estimate.ack} onChange={event => setEstimate(state => ({ ...state, ack: event.target.checked }))}/> I approve this one model call and the permissions shown.</label><div className="am-confirm-actions"><button className="am-ghost" onClick={() => setEstimate(null)}>Not now</button><button className="am-pill" disabled={!estimate.ack || busy} onClick={confirmRun}>Confirm and send</button></div></section></div>, document.querySelector('.am-root'))}
  </section>
}
