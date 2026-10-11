import React, { useEffect, useMemo, useState } from 'react'
import { X } from '@openai/apps-sdk-ui/components/Icon'
import { RECRUITER_CSS } from './recruiter-theme.js'
import { ExperienceBadge } from './experience.jsx'
import { LearnedCard } from './learned.jsx'

const QUESTIONS = [
  ['role', 'Role', 'What job needs doing? E.g. web designer in a small studio.'],
  ['requirements', 'Must have', 'Which verifiable skills and deliverables are essential?'],
  ['preferences', 'Nice to have', 'What is a plus but not a requirement?'],
  ['deal_breakers', 'Deal breakers', 'Which job-relevant gap rules out an invitation?'],
  ['team_style', 'Way of working', 'How does the team collaborate, give feedback and hand over work?'],
]
const EXAMPLE = {
  role: 'Web designer for a small creative studio: from brief to responsive prototype and handoff to developers.',
  requirements: 'A portfolio with at least two published responsive web projects, Figma, a readable handoff and accessibility basics.',
  preferences: 'Experience with small clients, basic HTML/CSS and proof that a design improved after testing.',
  deal_breakers: 'Do not invite on visual concepts alone when there is no shown web work or no mobile version of a project.',
  team_style: 'A small team that gives direct feedback, iterates fast and expects clear communication with developers and clients.',
}
const newId = () => 'r' + Array.from(crypto.getRandomValues(new Uint8Array(4)), n => n.toString(16).padStart(2, '0')).join('')
const percent = (right, total) => total ? Math.round(100 * right / total) : 0
const opposite = (value) => value === 'Invite' ? 'Reject' : 'Invite'

export function RecruiterDesk({ call, agentId, name, stats, model, modelPicker, scopes, runs, refreshGlobal, config = {}, requestedInboxId = '', onInboxHandled }) {
  const [book, setBook] = useState(null)
  const [groups, setGroups] = useState([])
  const [answers, setAnswers] = useState({ role: '', requirements: '', preferences: '', deal_breakers: '', team_style: '' })
  const [source, setSource] = useState({ kind: 'demo', group: 'demo-1', text: '' })
  const [roundId, setRoundId] = useState('')
  const [draft, setDraft] = useState([])
  const [editing, setEditing] = useState(false)
  const [reasons, setReasons] = useState({})
  const [disagree, setDisagree] = useState({})
  const [estimate, setEstimate] = useState(null)
  const [queued, setQueued] = useState('')
  const [runStatus, setRunStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastRun, setLastRun] = useState(null)
  const [regressionAck, setRegressionAck] = useState(false)
  const [inheritedRemovalAck, setInheritedRemovalAck] = useState(false)
  const [inbox, setInbox] = useState([])
  useEffect(() => { setRegressionAck(false); setInheritedRemovalAck(false) }, [book?.proposal?.id])

  async function load() {
    const result = await call('learning/' + agentId)
    setBook(result.learning)
    setRoundId(result.learning.rounds.at(-1)?.id || '')
    setDraft(result.learning.versions.at(-1)?.rules || [])
    return result.learning
  }
  useEffect(() => {
    let live = true
    Promise.all([call('learning/' + agentId), call('learning/demo')]).then(([result, demo]) => {
      if (!live) return
      setBook(result.learning)
      setGroups(demo.groups || [])
      setRoundId(result.learning.rounds.at(-1)?.id || '')
      setDraft(result.learning.versions.at(-1)?.rules || [])
    }).catch(failure => { if (live) setError(failure.message) })
    call('inbox').then(result => { if (live) setInbox((result.items || []).filter(item => item.agent_id === agentId && item.kind === 'cv')) }).catch(() => {})
    const active = runs.find(item => item.agent_id === agentId && ['queued', 'running'].includes(item.status))
    if (active) setQueued(active.id)
    return () => { live = false }
  }, [call, agentId])
  useEffect(() => {
    if (!queued) return undefined
    let live = true
    const check = async () => {
      try {
        const { run } = await call('runs/' + queued)
        if (!live) return
        setRunStatus(run.status_detail || run.status)
        if (['completed', 'failed', 'stopped'].includes(run.status)) {
          setQueued('')
          if (run.status !== 'completed') setError(run.error || 'The provider run did not finish.')
          else { setLastRun(run); await load(); await refreshGlobal(); const items = await call('inbox'); setInbox((items.items || []).filter(item => item.agent_id === agentId && item.kind === 'cv')); setNotice('The model has finished. Review the results and decide for yourself.') }
        }
      } catch (failure) { if (live) setError(failure.message) }
    }
    check()
    const timer = setInterval(check, 2000)
    return () => { live = false; clearInterval(timer) }
  }, [queued, call, refreshGlobal])

  const current = book?.versions.at(-1)
  useEffect(() => {
    if (!requestedInboxId || !current || queued) return
    onInboxHandled?.()
    plan({ action: 'screen', source: { kind: 'inbox', id: requestedInboxId } })
  }, [requestedInboxId, current?.version, queued]) // eslint-disable-line react-hooks/exhaustive-deps
  const round = book?.rounds.find(item => item.id === roundId) || book?.rounds.at(-1)
  const decisionByCandidate = useMemo(() => new Map((book?.decisions || []).map(item => [item.candidate_id, item])), [book])
  const candidateById = useMemo(() => new Map((book?.rounds || []).flatMap(item => item.candidates).map(item => [item.id, item])), [book])
  const resultList = useMemo(() => (round?.results || []).slice().sort((a, b) => a.confidence - b.confidence), [round])
  const readyForReplay = !!book?.rounds.length && book.rounds.every(group => group.candidates.every(item => decisionByCandidate.has(item.id)))
  const usedDemo = new Set((book?.rounds || []).map(item => item.source_group))
  const importedFrom = book?.provenance?.at(-1)?.author_handle
  const inheritedRemoved = (current?.rules || []).filter(item =>
    book?.lineage?.[item.id]?.author_handle && book?.proposal &&
    !book.proposal.rules.some(rule => rule.id === item.id))

  function reportError(failure) { setError(failure.message || String(failure)); setBusy(false) }
  async function saveIntake() {
    setBusy(true); setError('')
    try {
      const result = await call('learning/intake', { agent_id: agentId, answers })
      setBook(result.learning); setDraft(result.learning.versions.at(-1).rules)
      await refreshGlobal(); setNotice('Rulebook v1 saved. No CV has been sent to a model yet.')
    } catch (failure) { reportError(failure) } finally { setBusy(false) }
  }
  async function plan(request) {
    setError(''); setNotice('')
    try {
      const value = await call('learning/estimate', { agent_id: agentId, ...request })
      setEstimate({ request, value, ack: false })
    } catch (failure) { reportError(failure) }
  }
  async function confirmRun() {
    if (!estimate?.ack || busy) return
    setBusy(true); setError('')
    try {
      const result = await call('learning/run', { agent_id: agentId, ...estimate.request,
        confirm_cost: true, confirmed_permissions: scopes,
        confirmed_tools: estimate.value.tools, confirmed_limits: estimate.value.limits })
      setQueued(result.run.id); setRunStatus('Waiting for the supervised job…'); setEstimate(null)
      setNotice('The run was sent to the selected model. Decisions about candidates stay yours.')
    } catch (failure) { reportError(failure) } finally { setBusy(false) }
  }
  async function addCvToInbox() {
    setBusy(true); setError('')
    try {
      await call('inbox/cv', { agent_id: agentId, text: source.text })
      const result = await call('inbox')
      setInbox((result.items || []).filter(item => item.agent_id === agentId && item.kind === 'cv'))
      setNotice(config.cv_inbox ? 'The CV is in the inbox; screening waits for your cost confirmation.' : 'The CV is saved in the inbox. The trigger is off.')
    } catch (failure) { reportError(failure) } finally { setBusy(false) }
  }
  async function toggleInbox() {
    try {
      await call('config', { agent_id: agentId, cv_inbox: !config.cv_inbox })
      await refreshGlobal()
      setNotice(config.cv_inbox ? 'The CV inbox trigger is off.' : 'New CVs now open an unpaid request, not a model run.')
    } catch (failure) { setError(failure.message) }
  }
  async function decide(item, choice) {
    setBusy(true); setError('')
    try {
      const result = await call('learning/decision', { agent_id: agentId, round_id: round.id,
        candidate_id: item.candidate_id, choice, reason: reasons[item.candidate_id] || '' })
      setBook(result.learning); setDisagree(state => ({ ...state, [item.candidate_id]: false }))
      setNotice('Decision recorded; the rules were not changed automatically.')
    } catch (failure) { reportError(failure) } finally { setBusy(false) }
  }
  async function accept() {
    setBusy(true); setError('')
    try {
      const result = await call('learning/accept', { agent_id: agentId, proposal_id: book.proposal.id,
        confirm_inherited_removal: inheritedRemoved.length > 0 && inheritedRemovalAck })
      setBook(result.learning); setDraft(result.learning.versions.at(-1).rules); setLastRun({ learned: result.learned, sync: result.sync })
      setEditing(false); setRegressionAck(false); setInheritedRemovalAck(false); await refreshGlobal()
      setNotice('The new rule version is accepted. XP follows the change in agreement, not the number of runs.')
    } catch (failure) { reportError(failure) } finally { setBusy(false) }
  }

  if (!book) return <div className="am-learn am-glass" role="status">Loading the Recruiter desk…</div>
  return <div className="am-learn"><style>{RECRUITER_CSS}</style>
    <div className="am-learn-banner"><span className="am-mono">/ {name || 'Recruiter'} · the owner decides</span><p>The verdict is advice, and the model's confidence is a subjective rating, not a measured probability. It must not use age, sex, ethnicity, religion, a photo or family status.</p></div>
    {importedFrom && <div className="am-learn-inherited"><ExperienceBadge experience={{ inherited_from: importedFrom }}/><span>Inherited rules: {Object.values(book.lineage || {}).filter(item => item.author_handle).length} · own: {current?.rules.filter(item => !book.lineage?.[item.id]?.author_handle).length || 0} · Lv {stats?.level || 1}</span><small>Old decisions were not transferred. Replay starts from your own new decisions.</small></div>}
    {error && <div className="am-alert" role="alert"><span>{error}</span><button className="am-ghost" onClick={() => setError('')}>Close</button></div>}
    {notice && <p className="am-learn-notice" role="status">{notice}</p>}
    {(lastRun?.learned || book.reflections?.length > 0) && <LearnedCard learned={lastRun?.learned || book.reflections.at(-1)} sync={lastRun?.sync}/>}
    {queued && <div className="am-learn-running am-glass" role="status"><span className="am-learn-pulse"/> Model is working · {runStatus || 'waiting for the result'} <span>This step can take a while.</span><button className="am-ghost" onClick={() => call('runs/stop', { run_id: queued }).then(() => setRunStatus('Stopping…')).catch(failure => setError(failure.message))}>Stop</button></div>}
    <div className="am-learn-inbox"><div><strong>CV inbox</strong><span className="am-dim">New CV · trigger {config.cv_inbox ? 'on' : 'off'}; no model screening starts on its own.</span><button className="am-ghost" onClick={toggleInbox}>{config.cv_inbox ? 'Turn trigger off' : 'Turn trigger on'}</button></div>{inbox.filter(item => item.status !== 'screened').map(item => <div key={item.id}><span>{item.label} · {item.status === 'awaiting_confirmation' ? 'awaiting confirmation' : item.status}</span><button className="am-ghost" disabled={!current || !!queued || item.status === 'screening'} onClick={() => plan({ action: 'screen', source: { kind: 'inbox', id: item.id } })}>Estimate and screen</button></div>)}</div>
    <div className="am-learn-grid">
      <div className="am-learn-main">
        {!current ? <section className="am-learn-card am-glass">
          <div className="am-learn-card-head"><span className="am-mono">/ 1 · Intake before the first screening</span><h3>First tell me how you choose.</h3><p>These five answers become the first version of the rules. The example is for a fictional web designer role in a small studio.</p></div>
          {QUESTIONS.map(([key, label, hint]) => <label className="am-field" key={key}>{label}<textarea className="am-input am-short" value={answers[key]} onChange={event => setAnswers(state => ({ ...state, [key]: event.target.value }))} placeholder={hint} maxLength={800}/></label>)}
          <div className="am-learn-actions"><button className="am-ghost" onClick={() => setAnswers(EXAMPLE)}>Fill in the fictional example</button><button className="am-pill" disabled={busy} onClick={saveIntake}>Save rulebook v1</button></div>
        </section> : <>
          <section className="am-learn-card am-glass">
            <div className="am-learn-card-head"><span className="am-mono">/ 1 · Approved rulebook · v{current.version}</span><h3>The rules the agent may use.</h3><p>{book.intake?.role || 'Owner-approved rules'}</p></div>
            <ol className="am-learn-rules">{current.rules.map(item => { const origin = book.lineage?.[item.id]; const gap = book.inherited_gaps?.[item.id]; return <li key={item.id}><code>{item.id}</code><span>{item.text}<small>{origin?.author_handle ? `Inherited from ${origin.author_handle} · v${origin.version}` : `Own rule · v${origin?.version || current.version}`}{gap?.total ? ` · Did not match you in ${gap.disagree}/${gap.total} decisions where it was cited` : ''}</small></span></li> })}</ol>
            <div className="am-learn-actions"><button className="am-ghost" onClick={() => { setDraft(current.rules.map(item => ({ ...item }))); setEditing(!editing) }}>{editing ? 'Close editing' : 'Edit rules'}</button><span className="am-mono am-dim">Changes wait for replay and your acceptance</span></div>
            {editing && <div className="am-learn-editor"><h4>Working draft</h4>{draft.map((item, index) => <div className="am-learn-editrow" key={item.id}><label className="am-field"><code>{item.id}</code><textarea className="am-input am-short" value={item.text} onChange={event => setDraft(rows => rows.map((rule, n) => n === index ? { ...rule, text: event.target.value } : rule))}/></label><button className="am-ghost" onClick={() => setDraft(rows => rows.filter(rule => rule.id !== item.id))}>Remove</button></div>)}<div className="am-learn-actions"><button className="am-ghost" onClick={() => setDraft(rows => [...rows, { id: newId(), text: '', sources: [] }])}>Add rule</button><button className="am-pill" disabled={busy || !!queued} onClick={() => plan({ action: 'replay', mode: 'edit', rules: draft })}>Replay the edit</button></div></div>}
            <details className="am-learn-history"><summary>Version history ({book.versions.length})</summary>{book.versions.slice().reverse().map(item => <div key={item.version}><span><strong>v{item.version}</strong> · {item.reason} · {new Date(item.created_at).toLocaleDateString()}</span>{item.version !== current.version && <button className="am-ghost" disabled={!!queued} onClick={() => plan({ action: 'replay', mode: 'restore', version: item.version })}>Restore via replay</button>}</div>)}</details>
          </section>

          <section className="am-learn-card am-glass">
            <div className="am-learn-card-head"><span className="am-mono">/ 2 · Candidate group</span><h3>Screen one group at a time.</h3><p>Three groups of eight candidates are clearly marked as fictional. Real CVs go to a model only after a separate cost and permission confirmation.</p></div>
            <div className="am-learn-choice"><button className={source.kind === 'demo' ? 'is-active' : ''} onClick={() => setSource(state => ({ ...state, kind: 'demo' }))}>Fictional demo</button><button className={source.kind === 'pasted' ? 'is-active' : ''} onClick={() => setSource(state => ({ ...state, kind: 'pasted' }))}>Paste real CVs</button></div>
            {source.kind === 'demo' ? <><label className="am-field">Group<select className="am-input" value={source.group} onChange={event => setSource(state => ({ ...state, group: event.target.value }))}>{groups.map(group => <option key={group.id} value={group.id} disabled={usedDemo.has(group.id)}>{group.label}{usedDemo.has(group.id) ? ' · screened' : ''}</option>)}</select></label><div className="am-learn-preview">{groups.find(group => group.id === source.group)?.candidates.map((item, index) => <div key={item.name}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong><small>FICTIONAL</small></div>)}</div></>
              : <><label className="am-field">CVs (1–8; separate with a --- CV --- line)<textarea className="am-input am-code" value={source.text} onChange={event => setSource(state => ({ ...state, text: event.target.value }))} placeholder={'First CV…\n--- CV ---\nSecond CV…'} maxLength={48000}/></label><button className="am-ghost" disabled={busy || !source.text.trim()} onClick={addCvToInbox}>Save CV to inbox</button></>}
            <div className="am-learn-actions"><button className="am-pill" disabled={busy || !!queued || (source.kind === 'demo' && usedDemo.has(source.group))} onClick={() => plan({ action: 'screen', source })}>Estimate cost and screen</button><span className="am-mono am-dim">Model: {model?.model || 'not selected'}</span></div>
          </section>

          {!!book.rounds.length && <section className="am-learn-card am-glass">
            <div className="am-learn-card-head"><span className="am-mono">/ 3 · Your decisions</span><h3>Hardest cases first.</h3><p>Ordered from the least to the most confident verdict. Invite/Reject is a suggestion, not an automatic decision.</p></div>
            <div className="am-learn-rounds" role="group" aria-label="Screened groups">{book.rounds.map((item, index) => <button key={item.id} className={round?.id === item.id ? 'is-active' : ''} onClick={() => setRoundId(item.id)}>Group {index + 1}</button>)}</div>
            <div className="am-learn-candidates">{resultList.map(item => {
              const person = round.candidates.find(candidate => candidate.id === item.candidate_id)
              const decision = decisionByCandidate.get(item.candidate_id)
              const rules = book.versions.find(version => version.version === round.rulebook_version)?.rules || []
              return <article className="am-learn-candidate" key={item.candidate_id}>
                <div className="am-learn-candidate-top"><div><span className="am-mono">{person?.fictional ? 'FICTIONAL CV' : 'Owner CV'}</span><h4>{person?.name}</h4></div><span className="am-learn-confidence">{item.confidence}% <small>model confidence</small></span></div>
                <div className="am-learn-verdict"><strong>{item.verdict}</strong><span>{item.rationale}</span></div>
                <div className="am-learn-cites"><span className="am-mono">Rules used</span>{item.rule_ids.map(id => <small key={id} title={rules.find(rule => rule.id === id)?.text}>{id} · {rules.find(rule => rule.id === id)?.text}</small>)}</div>
                {decision ? <p className="am-learn-owner">Your decision: <strong>{decision.choice}</strong>{decision.reason ? ' · ' + decision.reason : ''} <button onClick={() => setDisagree(state => ({ ...state, [item.candidate_id]: true }))}>Change</button></p> : <div className="am-learn-actions"><button className="am-ghost" disabled={busy} onClick={() => decide(item, item.verdict)}>I agree</button><button className="am-ghost" onClick={() => setDisagree(state => ({ ...state, [item.candidate_id]: true }))}>I disagree</button></div>}
                {disagree[item.candidate_id] && <div className="am-learn-reason"><label className="am-field">Why {opposite(item.verdict)}? One sentence.<textarea className="am-input am-short" value={reasons[item.candidate_id] || ''} onChange={event => setReasons(state => ({ ...state, [item.candidate_id]: event.target.value }))} maxLength={500}/></label><button className="am-pill" disabled={busy || !reasons[item.candidate_id]?.trim()} onClick={() => decide(item, opposite(item.verdict))}>Save my decision</button></div>}
              </article>
            })}</div>
            <div className="am-learn-actions"><button className="am-pill" disabled={!readyForReplay || busy || !!queued} onClick={() => plan({ action: 'replay', mode: 'propose' })}>Propose rules + replay all decisions</button><span className="am-mono am-dim">{book.decisions.length} / {book.rounds.reduce((sum, item) => sum + item.candidates.length, 0)} decisions</span></div>
          </section>}

          {book.proposal && <section className="am-learn-card am-glass am-learn-proposal">
            <div className="am-learn-card-head"><span className="am-mono">/ 4 · A proposal, not a change</span><h3>Check it before it learns.</h3><p>Replay is one model assessment of all your earlier decisions. The comparison is not proof of future accuracy.</p></div>
            <div className="am-learn-compare"><div><span>Before</span><strong>{book.proposal.replay.before}/{book.proposal.replay.total}</strong><small>{percent(book.proposal.replay.before, book.proposal.replay.total)}% agreement</small></div><div><span>After</span><strong>{book.proposal.replay.after}/{book.proposal.replay.total}</strong><small>{percent(book.proposal.replay.after, book.proposal.replay.total)}% agreement</small></div></div>
            <div className="am-learn-deltas"><p>Fixed: <strong>{book.proposal.replay.fixed.length}</strong> {book.proposal.replay.fixed.map(id => candidateById.get(book.decisions.find(d => d.id === id)?.candidate_id)?.name).filter(Boolean).join(', ')}</p><p>Broken: <strong>{book.proposal.replay.broken.length}</strong> {book.proposal.replay.broken.map(id => candidateById.get(book.decisions.find(d => d.id === id)?.candidate_id)?.name).filter(Boolean).join(', ')}</p></div>
            {book.proposal.changes.length ? <ul className="am-learn-changes">{book.proposal.changes.map((item, index) => <li key={index}><strong>{item.action === 'add' ? 'Add' : item.action === 'edit' ? 'Edit' : 'Remove'}</strong> {item.text || item.rule_id}<small>From decisions: {(item.source_decision_ids || []).map(id => candidateById.get(book.decisions.find(d => d.id === id)?.candidate_id)?.name || id).join(', ') || 'owner reply'}</small></li>)}</ul> : <p>The working rules are shown in the editor or an earlier version.</p>}
            {Object.entries(book.inherited_gaps || {}).filter(([, gap]) => gap.total && gap.disagree).map(([id, gap]) => <p className="am-learn-inherited-gap" key={id}>Inherited rule <code>{id}</code> did not match you in {gap.disagree}/{gap.total} decisions where it was cited. That is a signal to review, not an automatic deletion.</p>)}
            {!!inheritedRemoved.length && <label className="am-learn-check"><input type="checkbox" checked={inheritedRemovalAck} onChange={event => setInheritedRemovalAck(event.target.checked)}/> I explicitly confirm removing the inherited rules: {inheritedRemoved.map(item => item.id).join(', ')}.</label>}
            {!!book.proposal.replay.warnings.length && <div className="am-alert">{book.proposal.replay.warnings.join(' ')}</div>}
            {!!book.proposal.replay.broken.length && <label className="am-learn-check"><input type="checkbox" checked={regressionAck} onChange={event => setRegressionAck(event.target.checked)}/> I understand this version would break earlier agreement.</label>}
            <div className="am-learn-actions"><button className="am-pill" disabled={busy || (!!book.proposal.replay.broken.length && !regressionAck) || (!!inheritedRemoved.length && !inheritedRemovalAck)} onClick={accept}>Accept v{book.versions.length + 1}</button><span className="am-mono am-dim">Without this click the rules stay at v{current.version}</span></div>
          </section>}
        </>}
      </div>
      <aside className="am-learn-side">
        <section className="am-learn-card am-glass"><span className="am-mono">/ Learning progress</span><h3>Agreement, not run count.</h3><div className="am-learn-xp"><strong>{book.agreement.xp} XP</strong><span>{book.agreement.inherited_xp ? `${book.agreement.inherited_xp} XP inherited. ` : ''}+100 for each of your decisions fixed net; lost on regression.</span></div>
          {(book.agreement.total || book.inherited_curve?.length) ? <><p>{book.agreement.total ? `Your decisions: now ${book.agreement.current}/${book.agreement.total} · initial ${book.agreement.initial}/${book.agreement.total}` : 'Your decisions have not been entered yet.'}</p><div className="am-learn-curve">{book.inherited_curve?.map((point, index) => <div key={'inherited-' + index}><span>Inh. {index + 1}</span><i style={{ width: percent(point.correct, point.total) + '%' }}/><strong>{percent(point.correct, point.total)}%</strong></div>)}{book.agreement.total > 0 && <div><span>Initial</span><i style={{ width: percent(book.agreement.initial, book.agreement.total) + '%' }}/><strong>{percent(book.agreement.initial, book.agreement.total)}%</strong></div>}{book.versions.filter(item => item.replay?.total).map(item => <div key={item.version}><span>G{item.round_count || 0}/v{item.version}</span><i style={{ width: percent(item.replay.after, item.replay.total) + '%' }}/><strong>{percent(item.replay.after, item.replay.total)}%</strong></div>)}</div>{book.inherited_curve?.length > 0 && <p className="am-dim">Inherited groups: aggregate agreement only, no old decisions.</p>}</> : <p className="am-dim">The curve starts when you rate the first group. No run earns XP by itself.</p>}
          {book.rounds.map((item, index) => { const done = book.decisions.filter(decision => decision.round_id === item.id); const correct = done.filter(decision => decision.choice === decision.agent_verdict); return <p className="am-learn-group" key={item.id}>Group {index + 1} · {correct.length}/{done.length} initial agreement</p> })}
        </section>
        <section className="am-learn-card am-glass"><span className="am-mono">/ Model per group</span>{modelPicker}<p className="am-dim">Before every screening or replay we show the cost estimate and ask for confirmation. There is no automatic hiring and no active trigger.</p></section>
      </aside>
    </div>
    {estimate && <div className="am-scrim" onMouseDown={event => { if (event.target === event.currentTarget) setEstimate(null) }}><section className="am-confirm am-glass" role="dialog" aria-modal="true" aria-label="Confirm Recruiter cost"><div className="am-confirm-head"><span className="am-mono">/ Cost and permissions</span><button className="am-icon" onClick={() => setEstimate(null)} aria-label="Close"><X width={18}/></button></div><h2>{estimate.value.kind === 'recruiter_screen' ? 'Send the group to the model?' : 'Replay all decisions?'}</h2><p>{estimate.value.kind === 'recruiter_screen' ? 'One call to the selected model, plus one short reflection call afterwards (inside the same cost cap) that may propose rule changes from your earlier decisions; they only become active if a replay of all your decisions shows nothing gets worse. ' : 'One call to the selected model. '}Real CVs, if entered, are sent to the chosen provider.</p><dl className="am-facts"><div><dt>Model</dt><dd>{estimate.value.model.label}</dd></div><div><dt>Permissions</dt><dd>{scopes.join(', ') || 'None'}</dd></div><div><dt>Tools</dt><dd>{estimate.value.tools.join(', ') || 'None'}</dd></div><div><dt>Limits</dt><dd>{estimate.value.limits.max_steps} steps · {estimate.value.limits.timeout_seconds}s · ≈ US${estimate.value.limits.max_estimated_cost_usd.toFixed(2)}</dd></div><div><dt>Estimate</dt><dd>{estimate.value.estimate_usd == null ? 'No money estimate is available for this model' : '≈ US$' + estimate.value.estimate_usd.toFixed(3)} · ~{estimate.value.input_tokens.toLocaleString()} input + up to {estimate.value.output_tokens.toLocaleString()} output tokens</dd></div></dl><p className="am-dim">{estimate.value.basis}</p><label className="am-ack"><input type="checkbox" checked={estimate.ack} onChange={event => setEstimate(state => ({ ...state, ack: event.target.checked }))}/> I understand the cost estimate, model and permissions; I approve this one call.</label><div className="am-confirm-actions"><button className="am-ghost" onClick={() => setEstimate(null)}>Not now</button><button className="am-pill" disabled={!estimate.ack || busy} onClick={confirmRun}>Confirm and send</button></div></section></div>}
  </div>
}
