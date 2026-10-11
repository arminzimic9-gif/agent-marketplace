import React, { useEffect, useState } from 'react'

export function ExperienceBadge({ experience }) {
  return experience?.inherited_from ? <span className="am-exp-badge">Experienced · inherited from {experience.inherited_from}</span> : null
}

export function RuleLineage({ rules }) {
  if (!rules?.length) return <p className="am-dim">No confirmed rules yet.</p>
  return <ul className="am-exp-rules">{rules.map(rule => <li key={rule.id}>
    <code>{rule.id}</code><span>{rule.text}<small>{rule.origin?.author_handle
      ? `Inherited from ${rule.origin.author_handle} · v${rule.origin.version}`
      : `Own rule · v${rule.origin?.version || 1}`}</small></span>
  </li>)}</ul>
}

export function ExperienceExport({ call, item, onCopy }) {
  const [handle, setHandle] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setHandle(''); setPreview(null); setError('') }, [item.manifest.id])

  async function prepare() {
    setBusy(true); setError(''); setPreview(null)
    try {
      const result = await call('experience/export-preview', {
        agent_id: item.manifest.id, author_handle: handle.trim(),
      })
      setPreview(result)
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  const json = preview ? JSON.stringify(preview.package, null, 2) + '\n' : ''
  return <details className="am-exp-export">
    <summary>Export agent with experience</summary>
    <p>One portable package: agent.json, playbook, approved rule versions, level/XP, the numeric learning curve and provenance. No CVs, candidate names, individual decisions or personal reasons.</p>
    <label className="am-field">Your public @handle for provenance<input className="am-input" value={handle} onChange={event => { setHandle(event.target.value); setPreview(null) }} placeholder="@your-handle" maxLength={41}/></label>
    {error && <p className="am-exp-error" role="alert">{error}</p>}
    <button className="am-ghost" disabled={busy || !handle.trim()} onClick={prepare}>{busy ? 'Preparing…' : 'Review the exact contents'}</button>
    {preview && <div className="am-exp-preview">
      <div className="am-exp-preview-head"><strong>Exactly this package will be copied</strong><span>{preview.summary.versions} versions · {preview.summary.rules} rules · Lv {preview.summary.level} · {preview.summary.xp} XP</span></div>
      <p>Provenance: {preview.summary.author_handle} · {preview.summary.decision_count} decisions the local rules were learned from · final agreement {preview.summary.final_agreement.correct}/{preview.summary.final_agreement.total}.</p>
      <p className="am-exp-warning">The @handle is the author's declaration and is not verified. Also review the free text of rules and instructions before sharing.</p>
      <textarea className="am-exp-json" readOnly aria-label="Exact JSON contents of the package" value={json}/>
      <button className="am-pill" onClick={() => onCopy(json, 'The agent experience package was copied.')}>Copy the reviewed package</button>
    </div>}
  </details>
}

export function ExperienceImport({ call, onImported }) {
  const [text, setText] = useState('')
  const [inspected, setInspected] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [repo, setRepo] = useState(null)

  function change(value) { setText(value); setInspected(null); setAccepted(false); setError('') }
  async function fileChosen(file) {
    if (!file) return
    if (file.size > 400_000) { setError('The file is too large (400 KB at most).'); return }
    try { change(await file.text()) } catch { setError('The file could not be read.') }
  }
  async function openRepo() {
    setBusy(true); setError('')
    try { setRepo((await call('knowledge/repo-agents')).agents) } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  async function fromRepo(agentId) {
    setBusy(true); setError('')
    try { change(JSON.stringify((await call('knowledge/fetch', { agent_id: agentId })).package, null, 2)); setRepo(null) }
    catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  async function inspect() {
    setBusy(true); setError(''); setInspected(null)
    try {
      const parsed = JSON.parse(text)
      const result = await call('experience/inspect', { package: parsed })
      setInspected({ ...result, package: parsed })
    } catch (failure) { setError(failure instanceof SyntaxError ? 'The package is not valid JSON.' : failure.message) }
    finally { setBusy(false) }
  }
  async function install() {
    if (!inspected || !accepted || busy) return
    setBusy(true); setError('')
    try {
      const result = await call('experience/import', {
        package: inspected.package, fingerprint: inspected.fingerprint,
        mode: inspected.required_mode, install_id: inspected.install_id, confirm: true,
      })
      await onImported(result)
      change('')
    } catch (failure) { setError(failure.message); setInspected(null) }
    finally { setBusy(false) }
  }

  return <section className="am-exp-import am-glass" aria-label="Hire an experienced agent">
    <span className="am-mono">/ Experience transfer</span><h3>Hire an experienced agent.</h3>
    <p>Paste a package or open a JSON file. Before import we check the schema, every rule and any ID conflict. No model is run.</p>
    <label className="am-field">Agent package<textarea className="am-input am-exp-paste" value={text} onChange={event => change(event.target.value)} placeholder="Paste a JSON experience package…"/></label>
    <div className="am-kn-pick"><button className="am-ghost" disabled={busy} onClick={openRepo}>Load from my private knowledge repository</button></div>
    {repo && (repo.length ? <div className="am-kn-pick" role="group" aria-label="Agents in your private repository">{repo.map(id => <button key={id} className="am-ghost" disabled={busy} onClick={() => fromRepo(id)}>{id}</button>)}</div> : <p className="am-dim">Your private repository has no agent folders yet.</p>)}
    <label className="am-exp-file">Open a JSON file<input type="file" accept=".json,application/json" onChange={event => { fileChosen(event.target.files?.[0]); event.target.value = '' }}/></label>
    {error && <div className="am-alert" role="alert">{error}</div>}
    <button className="am-ghost" disabled={busy || !text.trim()} onClick={inspect}>{busy ? 'Checking…' : 'Review the import'}</button>
    {inspected && <div className="am-exp-inspect">
      <ExperienceBadge experience={{ inherited_from: inspected.summary.author_handle }}/>
      <h4>{inspected.summary.name}</h4>
      <p>Versions: {inspected.summary.versions} · approved rules: {inspected.summary.rules} · Lv {inspected.summary.level} · {inspected.summary.xp} XP · groups in the curve: {inspected.summary.curve_groups}.</p>
      <p>Experience author: {inspected.summary.author_handle} · {inspected.summary.decision_count} decisions · final agreement {inspected.summary.final_agreement.correct}/{inspected.summary.final_agreement.total}.</p>
      {inspected.conflict && <div className="am-exp-conflict">ID <code>{inspected.summary.agent_id}</code> already exists. Nothing will be overwritten; the new agent gets ID <code>{inspected.install_id}</code>.</div>}
      <details><summary>Review the rules and package contents</summary><pre>{JSON.stringify(inspected.package, null, 2)}</pre></details>
      <p className="am-exp-warning">Provenance and level are claims in the package, not independent confirmation. Triggers stay off; model work is confirmed separately.</p>
      <label className="am-exp-check"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/> I have reviewed the package and want to {inspected.conflict ? 'explicitly import a copy' : 'hire this agent'}.</label>
      <button className="am-pill" disabled={!accepted || busy} onClick={install}>{inspected.conflict ? 'Import as a copy' : 'Hire the experienced agent'}</button>
    </div>}
  </section>
}
