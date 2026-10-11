import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Copy, ExternalLink, Plus, ThumbDown, ThumbUp, X } from '@openai/apps-sdk-ui/components/Icon'
import { CATEGORIES, TOOL_CHOICES, makeManifest } from './domain.mjs'
import { CSS } from './theme.js'
import { FONT_FILES } from './fonts.js'
import { Markdown, section } from './markdown.jsx'
import { Emblem, Sprite } from './characters.jsx'
import { characterFor } from './sprites.js'
import { PartyHero } from './partyhero.jsx'
import { RecruiterDesk } from './recruiter.jsx'
import { AgentReply } from './reply.jsx'
import { GuildHall } from './guild.jsx'
import { GUILD_CSS } from './guild-theme.js'
import { LaunchVideo, LAUNCH_VIDEO_CSS, LAUNCH_VIDEO_FILE, PlayGlyph } from './launchvideo.jsx'
import { ExperienceBadge, ExperienceExport, ExperienceImport, RuleLineage } from './experience.jsx'
import { EXPERIENCE_CSS } from './experience-theme.js'
import { AGENT_CSS } from './agent-theme.js'
import { KnowledgeSettings, LearnedCard } from './learned.jsx'
import { LEARNED_CSS } from './learned-theme.js'
import EXAMPLE_MANIFEST from './agent.json'
import AGENT_SCHEMA from './agent.schema.json'

const NAV = [
  { id: 'home', label: 'Party' },
  { id: 'activity', label: 'Quest log' },
  { id: 'guild', label: 'Guild Hall' },
  { id: 'create', label: 'Forge' },
  { id: 'spec', label: 'Spec' },
  { id: 'settings', label: 'Settings' },
]
const INITIAL_DRAFT = {
  name: '', author: '', description: '', category: 'Personal Assistant',
  tags: '', prompt: '', playbook: '', tools: [],
}
const INITIAL_INPUT = {
  source_kind: 'installed', app_id: '', repo_url: '', code: '', bug_report: '',
  topic: '', task: '',
  critic_kind: 'installed', critic_app_id: '', url: '', html: '', focus: '',
  shots: { desktop: null, phone: null },
  triage_kind: 'text', reports: '', triage_app_id: '',
  launch_kind: 'installed', launch_app_id: '', description: '', voice: null,
  seo_kind: 'url', seo_url: '', seo_html: '',
  message: '',
}
const BUILT_IN = ['sentinel', 'researcher', 'design-critic', 'bug-triage', 'launch-writer', 'seo-scout', 'brief-builder', 'recruiter']
const RUNNABLE = ['claude', 'codex']
const PROVIDER_NAMES = { claude: 'Claude', codex: 'Codex' }
const SHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const SHOT_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const INTRO = {
  sentinel: 'Inspect a real installed app, a public App Store repository, or pasted code against a bug report.',
  researcher: 'Retrieves scholarly abstracts and writes a sourced Markdown report with honest evidence limits.',
  'design-critic': 'An Awwwards-level critique of an installed app, a public page, or pasted HTML/CSS. Add screenshots so it judges what people see.',
  'bug-triage': 'Paste messy bug reports or copy a Social thread. Get deduplicated, GitHub-ready issues with severity and a fix plan.',
  'launch-writer': 'From an installed app or a short description: listing copy, a Social post, a changelog and a 30-second demo script, in your voice.',
  'seo-scout': 'Audits a public page or pasted HTML from measured tags, headings, schema and crawl files, then ranks fixes.',
  'brief-builder': 'Turns a messy client message into a structured studio brief with open budget and timeline questions.',
  recruiter: 'Screens groups of CVs against the rules you approve, then checks every lesson against all your own decisions.',
}
const COPY = {
  sentinel: { label: 'Copy Bug Report', done: 'Bug report copied.' },
  researcher: { label: 'Copy Markdown report', done: 'Markdown report copied.' },
  'design-critic': { label: 'Copy as design brief', done: 'Design brief copied.' },
  'bug-triage': { label: 'Copy GitHub issues', done: 'GitHub issues copied.' },
  'launch-writer': { label: 'Copy launch kit', done: 'Launch kit copied.' },
  'seo-scout': { label: 'Copy ranked fixes', done: 'SEO report copied.' },
  'brief-builder': { label: 'Copy brief', done: 'Brief copied.' },
}
const EASE = 'cubic-bezier(.16,1,.3,1)'

function randomHex() {
  const bytes = new Uint8Array(16)
  window.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
function readPreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read that image.'))
    reader.readAsDataURL(file)
  })
}
function decodeFont(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
const modelKey = (choice) => choice ? choice.provider + ':' + choice.model : ''
const scopeNames = (manifest) => (manifest?.capabilities?.permissions || []).map((item) => item.scope)
const dateLabel = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Not started'
const duration = (seconds) => seconds == null ? '—' : seconds < 60 ? Math.round(seconds) + 's' : Math.floor(seconds / 60) + 'm ' + String(Math.round(seconds % 60)).padStart(2, '0') + 's'
const money = (value) => value == null ? '—' : 'US$' + value.toFixed(2)
const pad2 = (n) => String(n).padStart(2, '0')

function superpowers(manifest) {
  const declared = manifest?.character?.superpowers
  if (declared?.length) return declared
  return (manifest?.capabilities?.permissions || []).map((item) => ({
    name: item.scope.split('.').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '),
    scope: item.scope, description: item.reason || 'Declared permission.',
  }))
}

// Eased scroll reveals. A data attribute (not a class React re-renders) marks
// revealed elements; anything already on screen reveals on the next frame.
function useReveal(deps) {
  useEffect(() => {
    const items = [...document.querySelectorAll('[data-reveal]:not([data-revealed])')]
    if (!items.length) return undefined
    const show = (item) => item.setAttribute('data-revealed', '')
    let observer = null
    const raf = requestAnimationFrame(() => {
      const pending = []
      for (const item of items) {
        if (item.getBoundingClientRect().top < window.innerHeight * 0.95) show(item)
        else pending.push(item)
      }
      if (typeof IntersectionObserver !== 'function') { pending.forEach(show); return }
      observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { show(entry.target); observer.unobserve(entry.target) }
      }), { rootMargin: '0px 0px -6% 0px', threshold: 0.08 })
      pending.forEach((item) => observer.observe(item))
    })
    return () => { cancelAnimationFrame(raf); observer?.disconnect() }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function App({ appId, token }) {
  const [tab, setTab] = useState('home')
  const [category, setCategory] = useState('All agents')
  const [data, setData] = useState(null)
  const [installedApps, setInstalledApps] = useState([])
  const [registry, setRegistry] = useState(null)
  const [selectedId, setSelectedId] = useState('sentinel')
  const [sheetId, setSheetId] = useState('')
  const [input, setInput] = useState(INITIAL_INPUT)
  const [activeId, setActiveId] = useState('')
  const [hallOpen, setHallOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const [result, setResult] = useState(null)
  const [details, setDetails] = useState({})
  const [celebrate, setCelebrate] = useState('')
  const [levelUp, setLevelUp] = useState(null)
  const [featured, setFeatured] = useState(0)
  const [confirm, setConfirm] = useState(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [draft, setDraft] = useState(INITIAL_DRAFT)
  const [formError, setFormError] = useState('')
  const [scheduleTime, setScheduleTime] = useState('08:00')
  const [scheduleZone, setScheduleZone] = useState('UTC')
  const [copyFallback, setCopyFallback] = useState('')
  const [requestedInboxId, setRequestedInboxId] = useState('')
  const copyFallbackRef = useRef(null)
  const heroTextRef = useRef(null)
  const questRef = useRef(null)
  const partyRef = useRef(null)
  const didSignal = useRef(false)
  const levelsRef = useRef(null)

  // Self-hosted fonts from bundled bytes: the opaque frame makes no font request.
  useEffect(() => {
    if (!window.FontFace || !document.fonts) return
    for (const font of FONT_FILES) {
      try {
        const face = new FontFace(font.family, decodeFont(font.data), { weight: font.weight, style: font.style, unicodeRange: font.unicodeRange, display: 'swap' })
        document.fonts.add(face)
        face.load().catch(() => {})
      } catch { /* the system fallback stack stays readable */ }
    }
  }, [])

  const call = useCallback(async (path, body) => {
    const response = await fetch('/api/apps/' + appId + '/service/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const value = await response.json().catch(() => null)
    if (!response.ok) throw new Error(value?.detail || 'Marketplace service unavailable (' + response.status + ').')
    return value
  }, [appId, token])

  // Level-ups are announced against the levels this device last showed.
  const noticeLevels = useCallback(async (next) => {
    const current = Object.fromEntries(next.agents.map((item) => [item.manifest.id, item.stats.level]))
    let seen = levelsRef.current
    if (!seen) {
      seen = await window.mobius.storage.get('seen-levels.json').catch(() => null)
      if (!seen || typeof seen !== 'object') {
        levelsRef.current = current
        await window.mobius.storage.set('seen-levels.json', current).catch(() => {})
        return
      }
    }
    const risen = next.agents.find((item) => (seen[item.manifest.id] || 1) < item.stats.level)
    levelsRef.current = { ...seen, ...current }
    if (risen) {
      setLevelUp({ id: risen.manifest.id, name: risen.manifest.name, level: risen.stats.level })
      await window.mobius.storage.set('seen-levels.json', levelsRef.current).catch(() => {})
    }
  }, [])

  const refresh = useCallback(async () => {
    const next = await call('state')
    setData(next)
    if (!didSignal.current) {
      didSignal.current = true
      window.mobius.signal('app_ready', { item_count: next.agents.length })
    }
    const running = next.runs.find((item) => item.status === 'queued' || item.status === 'running')
    if (running) setActiveId(running.id)
    noticeLevels(next).catch(() => {})
    return next
  }, [call, noticeLevels])

  useEffect(() => {
    let live = true
    refresh().catch((failure) => {
      if (live) setError(failure.message)
      window.mobius.signal('error', { message: failure.message, source: 'load' })
    })
    const headers = { Authorization: 'Bearer ' + token }
    fetch('/api/apps/', { headers }).then((r) => r.ok ? r.json() : []).then((items) => { if (live) setInstalledApps(items) }).catch(() => {})
    Promise.all([
      fetch('/api/models', { headers }).then((r) => r.ok ? r.json() : null),
      fetch('/api/owner/model-prefs', { headers }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([models, prefs]) => {
      if (!live || !models) return
      const hidden = new Set(prefs?.hidden_ids || [])
      setRegistry(RUNNABLE.map((provider) => ({
        provider,
        models: (models.providers?.[provider] || []).filter((item) => item.available !== false).map((item) => ({ ...item, hidden: hidden.has(item.id) })),
      })))
    }).catch(() => { if (live) setRegistry([]) })
    return () => { live = false }
  }, [refresh, token])

  useEffect(() => {
    if (!activeId) return undefined
    let stopped = false
    const check = async () => {
      try {
        const value = await call('runs/' + activeId)
        if (stopped) return
        const run = { ...value.run, feedback: value.feedback }
        setResult(run)
        if (['completed', 'failed', 'stopped'].includes(run.status)) {
          setDetails((current) => ({ ...current, [run.id]: run }))
          setActiveId('')
          if (run.status === 'completed') setCelebrate(run.agent_id)
          await refresh()
        }
      } catch (failure) {
        if (!stopped) setError(failure.message)
      }
    }
    check()
    // The service route allows 120 requests a minute; 2s keeps polling well inside it.
    const timer = window.setInterval(check, 2000)
    return () => { stopped = true; window.clearInterval(timer) }
  }, [activeId, call, refresh])

  // Requests can arrive while the owner watches the room, even without a run
  // started by this browser tab. Poll only while Guild Hall is visible.
  useEffect(() => {
    if (tab !== 'guild') return undefined
    const timer = window.setInterval(() => refresh().catch(() => {}), 2000)
    return () => window.clearInterval(timer)
  }, [tab, refresh])

  useEffect(() => { if (copyFallback) copyFallbackRef.current?.select() }, [copyFallback])
  useEffect(() => {
    if (!confirm && !sheetId) return undefined
    const onKey = (event) => { if (event.key === 'Escape') { setConfirm(null); setSheetId('') } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirm, sheetId])

  const agents = data?.agents || []
  const selected = agents.find((item) => item.manifest.id === selectedId) || agents[0]
  const manifest = selected?.manifest
  const agentId = manifest?.id
  const workflowId = selected?.workflow || agentId
  const config = selected?.config || {}
  const agentModel = selected?.model
  const runningAgent = result && (result.status === 'queued' || result.status === 'running') ? result.agent_id : ''
  const latest = result?.agent_id === agentId ? result : data?.runs.find((item) => item.agent_id === agentId)
  const shown = latest ? (details[latest.id] && latest.status === details[latest.id].status ? { ...details[latest.id], feedback: latest.feedback ?? details[latest.id].feedback } : latest) : null
  const featuredAgent = agents.length ? agents[featured % agents.length] : null
  const totals = useMemo(() => agents.reduce((sum, item) => ({
    quests: sum.quests + item.stats.completed, lessons: sum.lessons + item.stats.lessons,
    xp: sum.xp + item.stats.xp,
  }), { quests: 0, lessons: 0, xp: 0 }), [agents])
  const classes = useMemo(() => {
    const seen = new Map()
    agents.forEach((item) => { const c = characterFor(item.manifest).class; if (!seen.has(c)) seen.set(c, item.manifest) })
    return [...seen.entries()]
  }, [agents])

  useReveal([tab, data ? 1 : 0, agents.length])

  // Report bodies are fetched per run; state carries only summaries.
  useEffect(() => {
    if (!latest || latest.output != null || details[latest.id]?.status === latest.status) return
    if (!['completed', 'failed', 'stopped'].includes(latest.status)) return
    let live = true
    call('runs/' + latest.id).then((value) => {
      if (live) setDetails((current) => ({ ...current, [latest.id]: { ...value.run, feedback: value.feedback } }))
    }).catch(() => {})
    return () => { live = false }
  }, [latest?.id, latest?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setScheduleTime(config.time || '08:00')
    setScheduleZone(config.timezone || 'UTC')
  }, [agentId, config.time, config.timezone])

  useEffect(() => {
    if (agents.length < 2 || tab !== 'home') return undefined
    const timer = window.setInterval(() => setFeatured((n) => n + 1), 7000)
    return () => window.clearInterval(timer)
  }, [agents.length, tab])

  function notice(message) {
    setToast(message)
    window.setTimeout(() => setToast((current) => current === message ? '' : current), 4500)
  }
  function setField(field, value) {
    setInput((current) => ({ ...current, [field]: value }))
    setError('')
  }
  function selectedRequest(id = agentId) {
    const kind = agents.find(item => item.manifest.id === id)?.workflow || id
    if (kind === 'sentinel') {
      const bug_report = input.bug_report.trim()
      if (input.source_kind === 'installed') {
        if (!input.app_id) throw new Error('Choose an installed app to review.')
        return { source_kind: 'installed', app_id: Number(input.app_id), bug_report }
      }
      if (input.source_kind === 'store_repo') {
        if (!input.repo_url.trim()) throw new Error('Enter a public App Store repository URL.')
        return { source_kind: 'store_repo', repo_url: input.repo_url.trim(), bug_report }
      }
      if (!input.code.trim()) throw new Error('Paste code to review.')
      return { source_kind: 'code', code: input.code, bug_report }
    }
    if (kind === 'design-critic') {
      const focus = input.focus.trim()
      if (input.critic_kind === 'installed') {
        if (!input.critic_app_id) throw new Error('Choose an installed app to critique.')
        return { source_kind: 'installed', app_id: Number(input.critic_app_id), focus }
      }
      if (input.critic_kind === 'url') {
        if (!/^https:\/\/\S+$/.test(input.url.trim())) throw new Error('Enter a public https:// page URL.')
        return { source_kind: 'url', url: input.url.trim(), focus }
      }
      if (!input.html.trim()) throw new Error('Paste the HTML/CSS to critique.')
      return { source_kind: 'html', code: input.html, focus }
    }
    if (kind === 'bug-triage') {
      if (!input.reports.trim()) throw new Error(input.triage_kind === 'social' ? 'Paste the copied Social thread.' : 'Paste the bug reports.')
      return { source_kind: input.triage_kind, reports: input.reports, ...(input.triage_app_id ? { app_id: Number(input.triage_app_id) } : {}) }
    }
    if (kind === 'launch-writer') {
      const voice = (input.voice ?? config.voice ?? '').trim()
      if (input.launch_kind === 'installed') {
        if (!input.launch_app_id) throw new Error('Choose an installed app to launch.')
        return { source_kind: 'installed', app_id: Number(input.launch_app_id), voice }
      }
      if (!input.description.trim()) throw new Error('Describe the product in a few sentences.')
      return { source_kind: 'description', description: input.description.trim(), voice }
    }
    if (kind === 'seo-scout') {
      if (input.seo_kind === 'url') {
        if (!/^https:\/\/\S+$/.test(input.seo_url.trim())) throw new Error('Enter a public https:// page URL.')
        return { source_kind: 'url', url: input.seo_url.trim() }
      }
      if (!input.seo_html.trim()) throw new Error('Paste the HTML to audit.')
      return { source_kind: 'html', code: input.seo_html }
    }
    if (kind === 'brief-builder') {
      if (!input.message.trim()) throw new Error('Paste the client message.')
      return { message: input.message }
    }
    if (kind === 'researcher') {
      if (!input.topic.trim()) throw new Error('Enter a research topic.')
      return { topic: input.topic.trim() }
    }
    if (!input.task.trim()) throw new Error('Describe the task for this agent.')
    return { task: input.task.trim() }
  }
  function startConfirmation() {
    try {
      const request = selectedRequest()
      setError('')
      setAcknowledged(false)
      setConfirm({ type: 'run', request, agentId, from: tab })
    } catch (failure) { setError(failure.message) }
  }
  function reviewMention(item) {
    setError('')
    setAcknowledged(false)
    setConfirm({ type: 'run', request: { mention_id: item.id }, agentId: item.agent_id, target: item.target })
  }
  function reviewGuildRequest(item) {
    if (item.kind === 'cv') {
      setRequestedInboxId(item.id)
      sendOnQuest(item.agent_id)
      return
    }
    reviewMention(item)
  }
  async function uploadShots() {
    const shots = []
    for (const label of ['desktop', 'phone']) {
      const shot = input.shots[label]
      if (!shot) continue
      const path = 'uploads/' + randomHex() + '.' + SHOT_EXT[shot.file.type]
      await window.mobius.storage.setBlob(path, shot.file)
      shots.push({ label, path })
    }
    return shots
  }
  async function attachShot(label, file) {
    if (!file) return
    if (!SHOT_TYPES.includes(file.type)) { setError('Screenshots must be PNG, JPEG, or WebP.'); return }
    if (file.size > 6 * 1024 * 1024) { setError('Each screenshot must be 6 MB or smaller.'); return }
    try {
      const preview = await readPreview(file)
      setInput((current) => ({ ...current, shots: { ...current.shots, [label]: { file, preview, name: file.name } } }))
      setError('')
    } catch (failure) { setError(failure.message) }
  }
  async function chooseModel(id, value) {
    const [provider, ...rest] = value.split(':')
    const model = rest.join(':')
    const entry = registry?.find((group) => group.provider === provider)?.models.find((item) => item.id === model)
    const effort = entry?.effort_levels?.includes('high') ? 'high' : ''
    try {
      await call('model', { agent_id: id, provider, model, effort })
      await refresh()
      notice((agents.find((item) => item.manifest.id === id)?.manifest.name || 'Agent') + ' will now run on ' + (entry?.label || model) + '.')
    } catch (failure) { setError(failure.message) }
  }
  async function confirmAction() {
    if (!confirm || !acknowledged || busy) return
    setBusy(true)
    try {
      if (confirm.type === 'run') {
        const agent = agents.find((item) => item.manifest.id === confirm.agentId)
        const request = { ...confirm.request }
        if (agent?.workflow === 'design-critic' && !request.mention_id) request.screenshots = await uploadShots()
        const body = { agent_id: confirm.agentId, ...request, confirm_cost: true, confirmed_permissions: scopeNames(agent.manifest),
          confirmed_tools: agent.run_tools, confirmed_limits: agent.run_limits }
        let response
        try { response = await call('runs', body) } catch (failure) {
          // A just-written screenshot can take a moment to reach server storage.
          if (!/finished uploading/.test(failure.message)) throw failure
          await new Promise((resolve) => window.setTimeout(resolve, 1500))
          response = await call('runs', body)
        }
        setResult(response.run)
        setActiveId(response.run.id)
        setSelectedId(confirm.agentId)
        const fromHall = confirm.from === 'guild'
        setTab(fromHall ? 'guild' : 'home')
        await refresh()
        window.mobius.signal('item_created', { type: 'agent_run' })
        notice(fromHall ? 'Quest started. Watch the character walk to its station.' : 'Quest started. Progress appears on the quest board.')
        if (!fromHall) window.requestAnimationFrame(() => questRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      } else {
        const updated = await call('config', { ...confirm.request, confirm_automatic_cost: true })
        await refresh()
        notice(updated.config.cron ? 'Daily schedule enabled.' : '@mention requests enabled.')
      }
      setConfirm(null)
    } catch (failure) {
      setError(failure.message)
      window.mobius.signal('error', { message: failure.message, source: 'run-or-config' })
    } finally { setBusy(false) }
  }
  async function setTrigger(field, enabled) {
    if (!manifest) return
    try {
      if (field === 'bug_inbox') {
        await call('config', { agent_id: agentId, bug_inbox: enabled })
        await refresh()
        notice(enabled ? 'New bug reports now create unpaid review requests.' : 'Bug inbox trigger is off.')
        return
      }
      const request = {
        agent_id: agentId,
        mention: field === 'mention' ? enabled : Boolean(config.mention),
        cron: field === 'cron' ? enabled : Boolean(config.cron),
        time: scheduleTime, timezone: scheduleZone,
      }
      if (field === 'cron' && enabled) {
        const chosen = selectedRequest()
        if (chosen.source_kind === 'code') throw new Error('Scheduled code reviews must select an installed app or public repository.')
        request.scheduled_request = chosen
      }
      if (enabled) {
        setAcknowledged(false)
        setConfirm({ type: 'config', request, agentId })
      } else {
        await call('config', request)
        await refresh()
        notice(field === 'cron' ? 'Scheduled runs are off.' : '@mention requests are off.')
      }
    } catch (failure) { setError(failure.message) }
  }
  async function addBugToInbox() {
    try {
      const request = selectedRequest()
      if (!request.bug_report?.trim()) throw new Error('Write the bug report first.')
      await call('inbox/bug', { agent_id: agentId, ...request })
      await refresh()
      notice(config.bug_inbox ? 'Bug report saved as an unpaid request. Review it in Quest log.' : 'Bug report saved. The inbox trigger remains off.')
    } catch (failure) { setError(failure.message) }
  }
  async function saveFeedback(runId, rating, note) {
    try {
      await call('feedback', { run_id: runId, rating, note: note.trim() })
      await refresh()
      setDetails((current) => current[runId] ? { ...current, [runId]: { ...current[runId], feedback: { rating, note: note.trim() } } } : current)
      notice('Feedback saved. It becomes a lesson for the next quest.')
    } catch (failure) { setError(failure.message) }
  }
  async function stopRun(runId) {
    try {
      const response = await call('runs/stop', { run_id: runId })
      setResult(response.run)
      await refresh()
      notice('Stop requested. The provider process is being terminated.')
    } catch (failure) { setError(failure.message) }
  }
  async function copyText(value, message) {
    const ok = await window.mobius.clipboard.writeText(value)
    if (ok) notice(message)
    else { setCopyFallback(value); notice('Copy unavailable. Select the text below and press ⌘/Ctrl+C.') }
  }
  async function publishLocal() {
    try {
      const created = makeManifest(draft)
      await call('install', { manifest: created })
      await refresh()
      setSelectedId(created.id)
      setTab('home')
      setDraft(INITIAL_DRAFT)
      setFormError('')
      window.mobius.signal('item_created', { type: 'agent_install' })
      notice(created.name + ' joined your party at Level 1. Triggers remain off.')
    } catch (failure) { setFormError(failure.message) }
  }
  async function importedAgent(result) {
    await refresh()
    setSelectedId(result.install_id)
    setTab('home')
    window.mobius.signal('item_created', { type: 'agent_import' })
    notice(result.agent.manifest.name + ' was hired with inherited experience. Triggers are off.')
    window.requestAnimationFrame(() => partyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  function sendOnQuest(id) {
    setSelectedId(id)
    setResult((current) => current && (current.status === 'queued' || current.status === 'running') ? current : null)
    setSheetId('')
    setTab('home')
    window.requestAnimationFrame(() => questRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  function goto(id) {
    setSheetId('')
    setTab(id)
    window.scrollTo({ top: 0 })
  }

  const sheet = agents.find((item) => item.manifest.id === sheetId)
  const tabsFor = (field, options, label) => <div className="am-seg" role="group" aria-label={label}>
    {options.map(([kind, text]) => <button key={kind} className={input[field] === kind ? 'is-active' : ''} aria-pressed={input[field] === kind} onClick={() => setField(field, kind)}>{text}</button>)}
  </div>
  const appSelect = (field, label, optional) => <label className="am-field">{label}<select className="am-input" value={input[field]} onChange={(event) => setField(field, event.target.value)}><option value="">{optional ? 'None' : 'Choose an app…'}</option>{installedApps.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>

  function pickInHall(id) {
    setSelectedId(id)
    setResult((current) => current && (current.status === 'queued' || current.status === 'running') ? current : null)
    setHallOpen(true)
  }
  const hallPanel = () => {
    if (!selected) return null
    const live = data?.runs.find((item) => item.agent_id === agentId && ['queued', 'running'].includes(item.status))
    const last = data?.runs.find((item) => item.agent_id === agentId && !['queued', 'running'].includes(item.status))
    const step = live?.status === 'running' ? live.timeline?.at(-1)?.description : ''
    const recruiter = workflowId === 'recruiter'
    return <>
      <div className="am-gq-head">
        <Sprite manifest={manifest} size={78} shadow={false} mode={live ? 'cast' : 'idle'}/>
        <div><span className="am-mono">/ Send on quest</span><h2>{manifest.name}</h2><small className="am-mono">{characterFor(manifest).class} · Lv {selected.stats.level}</small></div>
        <button className="am-icon" aria-label="Close quest panel" onClick={() => setHallOpen(false)}><X width={18}/></button>
      </div>
      {live && <div className="am-gq-live" role="status">
        <span className="am-guild-workdot"/>
        <div><strong>{live.status === 'queued' ? 'Queued' : 'Working at its station'}</strong><span>{step || 'Waiting for the first recorded step…'}</span></div>
        <button className="am-ghost" onClick={() => stopRun(live.id)}>Stop</button>
      </div>}
      {recruiter ? <div className="am-gq-body">
        <p className="am-note">The Recruiter works from CVs and the rulebook it has learned, so its quest lives at its own desk.</p>
        <button className="am-pill" onClick={() => sendOnQuest(agentId)}>Open Recruiter desk<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={14}/></span></button>
      </div> : <div className="am-gq-body">
        <ModelPicker registry={registry} choice={agentModel} onChange={(value) => chooseModel(agentId, value)}/>
        {questFields()}
        <div className="am-quest-go">
          <button className="am-pill" onClick={startConfirmation} disabled={Boolean(activeId) || Boolean(live)}>{activeId || live ? 'Quest in progress' : 'Review cost & send'}<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={14}/></span></button>
          <span className="am-mono am-dim">Nothing starts until you confirm</span>
        </div>
      </div>}
      <div className="am-gq-foot">
        {last && <button className="am-ghost" onClick={() => sendOnQuest(agentId)}>Open last report · {last.status}</button>}
        <button className="am-ghost" onClick={() => setSheetId(agentId)}>Character sheet</button>
      </div>
    </>
  }

  const questFields = () => <>
      {workflowId === 'sentinel' && <>
        {tabsFor('source_kind', [['installed', 'Installed app'], ['store_repo', 'Store repo'], ['code', 'Pasted code']], 'Review source')}
        {input.source_kind === 'installed' && appSelect('app_id', 'Installed app')}
        {input.source_kind === 'store_repo' && <label className="am-field">Public GitHub URL from the App Store<input className="am-input" type="url" value={input.repo_url} onChange={(event) => setField('repo_url', event.target.value)} placeholder="Paste the public repository link"/></label>}
        {input.source_kind === 'code' && <label className="am-field">Code to review<textarea className="am-input am-code" value={input.code} onChange={(event) => setField('code', event.target.value)} placeholder="Paste the code here…"/></label>}
        <label className="am-field">Bug report<textarea className="am-input" value={input.bug_report} onChange={(event) => setField('bug_report', event.target.value)} placeholder="What broke? Expected vs actual."/></label>
      </>}
      {workflowId === 'design-critic' && <>
        {tabsFor('critic_kind', [['installed', 'Installed app'], ['url', 'Web page'], ['html', 'HTML / CSS']], 'Design source')}
        {input.critic_kind === 'installed' && appSelect('critic_app_id', 'Installed app')}
        {input.critic_kind === 'url' && <label className="am-field">Public page URL<input className="am-input" type="url" inputMode="url" value={input.url} onChange={(event) => setField('url', event.target.value)} placeholder="https://"/></label>}
        {input.critic_kind === 'html' && <label className="am-field">HTML / CSS<textarea className="am-input am-code" value={input.html} onChange={(event) => setField('html', event.target.value)} placeholder="Paste markup and styles…"/></label>}
        <div className="am-shots" role="group" aria-label="Screenshots (optional)">
          {['desktop', 'phone'].map((label) => {
            const shot = input.shots[label]
            return <div className={'am-shot am-shot-' + label + (shot ? ' has-image' : '')} key={label}>
              {shot ? <><img src={shot.preview} alt={label + ' screenshot preview'}/><button className="am-icon" aria-label={'Remove ' + label + ' screenshot'} onClick={() => setInput((current) => ({ ...current, shots: { ...current.shots, [label]: null } }))}><X width={16}/></button></>
                : <label className="am-shot-pick"><input type="file" accept="image/png,image/jpeg,image/webp" aria-label={'Add ' + label + ' screenshot'} onChange={(event) => { attachShot(label, event.target.files?.[0]); event.target.value = '' }}/><Plus width={18}/><span className="am-mono">{label} screenshot</span><small>Optional</small></label>}
            </div>
          })}
        </div>
        <label className="am-field">Focus (optional)<textarea className="am-input am-short" value={input.focus} onChange={(event) => setField('focus', event.target.value)} placeholder="e.g. Does the hero feel premium on a phone?"/></label>
      </>}
      {workflowId === 'bug-triage' && <>
        {tabsFor('triage_kind', [['text', 'Bug reports'], ['social', 'Social thread']], 'Report source')}
        <label className="am-field">{input.triage_kind === 'social' ? 'Copied Social thread' : 'Bug reports'}<textarea className="am-input am-code" value={input.reports} onChange={(event) => setField('reports', event.target.value)} placeholder={input.triage_kind === 'social' ? 'Copy the thread from Social and paste it here…' : 'Paste one or many reports, in any shape…'}/></label>
        {input.triage_kind === 'social' && <p className="am-note">Social threads can include private messages, so this agent never reads Social directly. It only sees what you paste.</p>}
        {appSelect('triage_app_id', 'Locate components in (optional)', true)}
      </>}
      {workflowId === 'launch-writer' && <>
        {tabsFor('launch_kind', [['installed', 'Installed app'], ['description', 'Description']], 'Product source')}
        {input.launch_kind === 'installed' ? appSelect('launch_app_id', 'Installed app') : <label className="am-field">Product description<textarea className="am-input" value={input.description} onChange={(event) => setField('description', event.target.value)} placeholder="What it is, who it's for, what changed…"/></label>}
        <label className="am-field"><span>Your voice <span className="am-dim">· remembered</span></span><textarea className="am-input am-short" value={input.voice ?? config.voice ?? ''} onChange={(event) => setField('voice', event.target.value)} placeholder="Default: direct, fluff-free, function-first. No hype, no unvalidated claims."/></label>
      </>}
      {workflowId === 'seo-scout' && <>
        {tabsFor('seo_kind', [['url', 'Web page'], ['html', 'HTML']], 'Audit source')}
        {input.seo_kind === 'url' ? <label className="am-field">Public page URL<input className="am-input" type="url" inputMode="url" value={input.seo_url} onChange={(event) => setField('seo_url', event.target.value)} placeholder="https://"/></label>
          : <label className="am-field">HTML<textarea className="am-input am-code" value={input.seo_html} onChange={(event) => setField('seo_html', event.target.value)} placeholder="Paste the full page HTML…"/></label>}
      </>}
      {workflowId === 'brief-builder' && <label className="am-field">Client message<textarea className="am-input am-code" value={input.message} onChange={(event) => setField('message', event.target.value)} placeholder="Paste the email, DM or voice-note transcript…"/></label>}
      {workflowId === 'researcher' && <label className="am-field">Research topic<input className="am-input" value={input.topic} onChange={(event) => setField('topic', event.target.value)} placeholder="What would you like to understand?"/></label>}
      {!BUILT_IN.includes(workflowId) && <label className="am-field">Task<textarea className="am-input" value={input.task} onChange={(event) => setField('task', event.target.value)} placeholder="Describe the outcome you want…"/></label>}
  </>

  return <div className="am-root">
    <style>{CSS + EXPERIENCE_CSS + AGENT_CSS + GUILD_CSS + LEARNED_CSS + LAUNCH_VIDEO_CSS}</style>
    {videoOpen && <LaunchVideo src={'/app-assets/by-id/' + appId + '/' + LAUNCH_VIDEO_FILE} onClose={() => setVideoOpen(false)}/>}
    <header className="am-top">
      <button className="am-brand" onClick={() => goto('home')} aria-label="Agent Hub home"><span className="am-brand-mark" aria-hidden="true"/><span>Möbius</span><span className="am-mono am-brand-sub">/ Agent Hub</span></button>
      <nav className="am-nav" aria-label="Agent Hub sections">
        {NAV.map((item) => <button key={item.id} className={'am-nav-link' + (tab === item.id ? ' is-active' : '')} aria-current={tab === item.id ? 'page' : undefined} onClick={() => goto(item.id)}>{item.label}</button>)}
      </nav>
      <button className="am-pill am-top-cta" onClick={() => sendOnQuest(agentId || 'sentinel')}>Send on quest<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={14}/></span></button>
    </header>

    {!data && !error && <div className="am-loading" role="status"><span className="am-mono">/ Summoning your party…</span></div>}
    {error && <div className="am-alert am-global-error" role="alert"><span>{error}</span><button className="am-ghost" onClick={() => { setError(''); refresh().catch((failure) => setError(failure.message)) }}>Retry</button></div>}

    {data && tab === 'home' && <main>
      <section className="am-hero">
        <PartyHero agents={agents} runningAgent={runningAgent} onOpen={setSheetId} textRef={heroTextRef}/>
        <div className="am-hero-inner" ref={heroTextRef}>
          <div className="am-hero-labels am-mono" data-reveal><span>/ Agent Hub</span><span>{pad2(agents.length)} agents · real runs only</span></div>
          <h1 data-reveal style={{ '--d': '80ms' }}>Hire agents that <em>ascend</em> your work.</h1>
          <p className="am-hero-lede" data-reveal style={{ '--d': '160ms' }}>A party of specialised agents that read real evidence, ask before they spend, and level up only from work they actually finished.</p>
          <div className="am-hero-actions" data-reveal style={{ '--d': '240ms' }}>
            <button className="am-pill" onClick={() => partyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Meet the party<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={14}/></span></button>
            <button className="am-ghost am-video-play" onClick={() => setVideoOpen(true)}><PlayGlyph/>Watch launch video</button>
            <button className="am-ghost" onClick={() => goto('spec')}>Read the open spec</button>
          </div>
          <dl className="am-hero-stats am-mono" data-reveal style={{ '--d': '320ms' }}>
            <div><dt>Quests completed</dt><dd>{pad2(totals.quests)}</dd></div>
            <div><dt>Lessons learned</dt><dd>{pad2(totals.lessons)}</dd></div>
            <div><dt>Party XP</dt><dd>{totals.xp}</dd></div>
          </dl>
        </div>
        {featuredAgent && <aside className="am-talk am-glass" aria-label={'Talk with ' + featuredAgent.manifest.name} key={featuredAgent.manifest.id}>
          <div className="am-talk-portrait"><Sprite manifest={featuredAgent.manifest} size={76} shadow={false} mode={runningAgent === featuredAgent.manifest.id ? 'cast' : 'idle'}/></div>
          <div className="am-talk-body">
            <span className="am-mono am-dim">/ Talk with</span>
            <strong>{featuredAgent.manifest.name}</strong>
            <span className="am-mono am-talk-class">{characterFor(featuredAgent.manifest).class} · Lv {featuredAgent.stats.level}</span>
            <button className="am-pill am-pill-sm" onClick={() => sendOnQuest(featuredAgent.manifest.id)}>Send on quest<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={12}/></span></button>
          </div>
        </aside>}
      </section>

      <section className="am-strip" aria-label="Agent classes">
        {classes.map(([name, owner], index) => <button key={name} className="am-strip-cell" data-reveal style={{ '--d': index * 60 + 'ms' }} onClick={() => setSheetId(owner.id)}>
          <Emblem name={name}/><span className="am-mono">{name}</span><small>{owner.name}</small>
        </button>)}
      </section>

      <section className="am-section" ref={partyRef} id="party">
        <div className="am-section-head" data-reveal>
          <span className="am-mono">/ 01 — Party</span>
          <h2>Your party, levelled by <em>real</em> work.</h2>
          <p>Every level, accuracy score and lesson below comes from quests run on this Möbius. Tap a character to open its sheet.</p>
        </div>
        <div className="am-filters am-mono" role="group" aria-label="Filter by category" data-reveal>
          {CATEGORIES.filter((item) => item !== 'Installed Agents').map((item) => <button key={item} className={category === item ? 'is-active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>/ {item}</button>)}
        </div>
        <div className="am-party">
          {[...agents].sort((a, b) => b.stats.xp - a.stats.xp || a.manifest.name.localeCompare(b.manifest.name)).map((item, index) => {
            const agent = item.manifest
            const ch = characterFor(agent)
            const dim = category !== 'All agents' && agent.category !== category
            const progress = (item.stats.xp - item.stats.level_floor_xp) / Math.max(1, item.stats.next_level_xp - item.stats.level_floor_xp)
            return <button key={agent.id} className={'am-hero-tile' + (dim ? ' is-dim' : '') + (agent.id === agentId ? ' is-selected' : '')} data-reveal style={{ '--d': index * 70 + 'ms' }} onClick={() => setSheetId(agent.id)} aria-label={`${agent.name}, ${ch.class}, level ${item.stats.level}. Open character sheet`}>
              <span className="am-tile-level am-mono">Lv {item.stats.level}</span>
              <Sprite manifest={agent} size={104} mode={runningAgent === agent.id ? 'cast' : celebrate === agent.id ? 'celebrate' : 'idle'} onDone={() => setCelebrate('')}/>
              <span className="am-platform" aria-hidden="true"/>
              <strong>{agent.name}</strong>
              <span className="am-mono am-dim">{ch.class}{runningAgent === agent.id ? ' · on quest' : ''}</span>
              <ExperienceBadge experience={item.experience}/>
              <span className="am-xp" aria-hidden="true"><i style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, progress))})` }}/></span>
            </button>
          })}
          <button className="am-hero-tile am-recruit" onClick={() => goto('create')} data-reveal><span className="am-recruit-plus" aria-hidden="true"><Plus width={22}/></span><strong>Recruit</strong><span className="am-mono am-dim">Forge a new agent</span></button>
        </div>
      </section>

      <section className="am-section am-quest" ref={questRef} id="quest">
        <div className="am-section-head" data-reveal>
          <span className="am-mono">/ 02 — Quest board</span>
          <h2>{workflowId === 'recruiter' ? <>A Recruiter that learns <em>with you</em>.</> : <>Send {manifest?.name || 'an agent'} on a <em>quest</em>.</>}</h2>
          <p>{INTRO[workflowId] || 'Give this agent a task. Its saved playbook guides the run.'}</p>
        </div>
        {workflowId === 'recruiter' ? <RecruiterDesk key={agentId} call={call} agentId={agentId} name={manifest?.name} stats={selected?.stats} model={agentModel} config={config}
          requestedInboxId={requestedInboxId} onInboxHandled={() => setRequestedInboxId('')}
          modelPicker={<ModelPicker registry={registry} choice={agentModel} onChange={(value) => chooseModel(agentId, value)}/>}
          scopes={scopeNames(manifest)} runs={data.runs} refreshGlobal={refresh}/> : <div className="am-quest-grid">
          <div className="am-quest-form am-glass" data-reveal>
            <div className="am-quest-who">
              {manifest && <Sprite manifest={manifest} size={84} mode={runningAgent === agentId ? 'cast' : celebrate === agentId ? 'celebrate' : 'idle'} onDone={() => setCelebrate('')}/>}
              <div>
                <span className="am-mono am-dim">{manifest ? characterFor(manifest).class + ' · Lv ' + selected.stats.level : ''}</span>
                <label className="am-field am-field-tight">Agent<select className="am-input" value={agentId || ''} onChange={(event) => { setSelectedId(event.target.value); setResult((current) => current && (current.status === 'queued' || current.status === 'running') ? current : null) }}>{agents.map((item) => <option value={item.manifest.id} key={item.manifest.id}>{item.manifest.name}</option>)}</select></label>
              </div>
            </div>
            <ModelPicker registry={registry} choice={agentModel} onChange={(value) => chooseModel(agentId, value)}/>
            {questFields()}
            <div className="am-quest-go">
              <button className="am-pill" onClick={startConfirmation} disabled={Boolean(activeId)}>{activeId ? 'Quest in progress' : 'Review cost & send'}<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={14}/></span></button>
              <span className="am-mono am-dim">Nothing starts until you confirm</span>
            </div>
            {workflowId === 'sentinel' && <button className="am-ghost" onClick={addBugToInbox}>Save bug report to inbox</button>}
            <details className="am-triggers">
              <summary className="am-mono">/ Optional triggers · {config.mention || config.cron ? 'on' : 'off'}</summary>
              <div className="am-trigger"><div><strong>@mention requests</strong><small>Model-mediated in newly started chats; each request still needs your confirmation.</small></div><button className="am-ghost" onClick={() => setTrigger('mention', !config.mention)}>{config.mention ? 'Turn off' : 'Enable'}</button></div>
              {workflowId === 'sentinel' && <div className="am-trigger"><div><strong>New bug report in this inbox</strong><small>Creates an unpaid review request; a model run still needs your approval.</small></div><button className="am-ghost" onClick={() => setTrigger('bug_inbox', !config.bug_inbox)}>{config.bug_inbox ? 'Turn off' : 'Enable'}</button></div>}
              <div className="am-trigger"><div><strong>Daily schedule requests</strong><small>{config.cron ? 'On · ' + (config.time || '08:00') + ' ' + (config.timezone || 'UTC') : 'Off · no requests scheduled'}</small></div><button className="am-ghost" onClick={() => setTrigger('cron', !config.cron)}>{config.cron ? 'Turn off' : 'Enable'}</button></div>
              <div className="am-two"><label className="am-field">Time<input className="am-input" type="time" value={scheduleTime} onChange={(event) => setScheduleTime(event.target.value)}/></label><label className="am-field">Time zone<input className="am-input" value={scheduleZone} onChange={(event) => setScheduleZone(event.target.value)} placeholder="Europe/Sarajevo"/></label></div>
              {config.cron && <button className="am-ghost" onClick={() => setTrigger('cron', true)}>Save schedule</button>}
              <p className="am-note">A harmless scheduler tick may remain after you turn schedules off; it never starts a run while the trigger is off.</p>
            </details>
          </div>
          <div className="am-report am-glass" data-reveal style={{ '--d': '90ms' }}>
            {shown ? <><RunReport run={shown} workflow={workflowId} onCopy={copyText} onFeedback={saveFeedback} onStop={stopRun}/>
                {shown.status === 'completed' && workflowId !== 'recruiter' && <AgentReply key={shown.id} call={call} run={shown}
                  model={agentModel} scopes={scopeNames(manifest)} refreshGlobal={refresh}/>}</>
              : <div className="am-empty"><span className="am-mono">/ No quest yet</span><strong>The report appears here, live.</strong><span className="am-dim">Confirm a quest to watch the agent write it.</span></div>}
          </div>
        </div>}
      </section>
      <footer className="am-foot am-mono"><span>/ Möbius Agent Hub</span><span>Characters are drawn from code · stats come from real runs</span></footer>
    </main>}

    {data && tab === 'guild' && <GuildHall agents={agents} runs={data.runs}
      pending={[...(data.pending_mentions || []), ...(data.pending_inbox || [])]}
      recruiterVersion={agents.find(item => item.workflow === 'recruiter')?.experience?.version}
      onOpen={setSheetId} onReview={reviewGuildRequest} onReport={sendOnQuest}
      selectedId={hallOpen ? agentId : ''} onSelect={pickInHall} onClose={() => setHallOpen(false)} panel={hallOpen ? hallPanel() : null}/>}

    {data && tab === 'activity' && <main className="am-page">
      <div className="am-section-head" data-reveal><span className="am-mono">/ Quest log</span><h2>Every quest, and what it <em>taught</em>.</h2><p>The 40 most recent real runs. Notes you leave become lessons injected into that agent's next quest.</p></div>
      {!!data.pending_mentions?.length && <div className="am-log"><h3 className="am-mono">/ Awaiting your confirmation</h3>{data.pending_mentions.map((item) => {
        const owner = agents.find((agent) => agent.manifest.id === item.agent_id)
        return <article className="am-log-row" key={item.id}>{owner && <Sprite manifest={owner.manifest} size={44} shadow={false}/>}<div><strong>{owner?.manifest.name || item.agent_id}</strong><span className="am-mono am-dim">{item.kind === 'schedule' ? 'Schedule' : item.kind === 'bug_inbox' ? 'Bug inbox' : '@mention'} · {dateLabel(item.created_at)} · unpaid</span><p>{item.target}</p></div><button className="am-pill am-pill-sm" onClick={() => reviewMention(item)}>Review<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={12}/></span></button></article>
      })}</div>}
      {data.runs.length ? <div className="am-log">{data.runs.map((item) => {
        const owner = agents.find((agent) => agent.manifest.id === item.agent_id)
        return <article className="am-log-row" key={item.id}>{owner && <Sprite manifest={owner.manifest} size={44} shadow={false}/>}<div><strong>{owner?.manifest.name || item.agent_id}</strong><span className="am-mono am-dim">{dateLabel(item.started_at || item.created_at)} · {item.model_label || item.model} · {item.status}{typeof item.score === 'number' ? ' · ' + item.score + '/' + (item.score_scale || 100) : ''}</span><p>{item.target}</p></div><div className="am-log-side"><span className="am-mono am-dim">{item.feedback?.rating ? (item.feedback.rating === 'up' ? '▲ helpful' : '▼ not helpful') : 'no feedback'}</span><button className="am-ghost" onClick={() => { setResult(null); sendOnQuest(item.agent_id) }}>Open report</button></div></article>
      })}</div> : <div className="am-empty"><strong>No quests yet</strong><button className="am-pill" onClick={() => goto('home')}>Meet the party<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={14}/></span></button></div>}
    </main>}

    {data && tab === 'create' && <main className="am-page">
      <div className="am-section-head" data-reveal><span className="am-mono">/ Forge</span><h2>Forge a new agent, or hire one with <em>experience</em>.</h2><p>A new agent starts at Level 1; an imported agent keeps approved rules and XP. Every trigger stays off.</p></div>
      <div className="am-forge">
        <form className="am-glass am-forge-form" onSubmit={(event) => { event.preventDefault(); publishLocal() }}>
          <div className="am-two">
            <label className="am-field">Agent name<input required className="am-input" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Release Watch"/></label>
            <label className="am-field">Author<input className="am-input" value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} placeholder="Your name or studio"/></label>
            <label className="am-field">Category<select className="am-input" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{CATEGORIES.filter((item) => !['All agents', 'Installed Agents'].includes(item)).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="am-field">Tags<input className="am-input" value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="release, QA"/></label>
          </div>
          <label className="am-field">Description<textarea className="am-input am-short" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label>
          <label className="am-field">System prompt<textarea required className="am-input" value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} placeholder="You are a careful agent that…"/></label>
          <label className="am-field">Playbook steps<textarea required className="am-input am-short" value={draft.playbook} onChange={(event) => setDraft({ ...draft, playbook: event.target.value })} placeholder={'One step per line'}/></label>
          <fieldset className="am-tools"><legend className="am-mono">/ Requested powers</legend>{TOOL_CHOICES.map((choice) => <label className="am-check" key={choice.name}><input type="checkbox" checked={draft.tools.includes(choice.name)} onChange={() => setDraft({ ...draft, tools: draft.tools.includes(choice.name) ? draft.tools.filter((name) => name !== choice.name) : [...draft.tools, choice.name] })}/><span><strong>{choice.label}</strong><small>{choice.purpose}</small></span></label>)}</fieldset>
          {formError && <div className="am-alert" role="alert">{formError}</div>}
          <div className="am-quest-go"><button className="am-pill" type="submit">Forge & install<span className="am-pill-dot" aria-hidden="true"><Plus width={14}/></span></button><button className="am-ghost" type="button" onClick={() => { try { copyText(JSON.stringify(makeManifest(draft), null, 2) + '\n', 'agent.json copied.') } catch (failure) { setFormError(failure.message) } }}><Copy width={15}/> Copy agent.json</button></div>
        </form>
        <aside className="am-forge-preview am-glass" aria-label="Character preview">
          {(() => { try { const preview = makeManifest({ ...draft, name: draft.name || 'New agent', prompt: draft.prompt || 'x', playbook: draft.playbook || 'x' }); return <><Sprite manifest={preview} size={150}/><span className="am-platform" aria-hidden="true"/><strong>{draft.name || 'New agent'}</strong><span className="am-mono am-dim">{preview.character.class} · Lv 1 · 0 XP</span></> } catch { return null } })()}
        </aside>
      </div>
      <ExperienceImport call={call} onImported={importedAgent}/>
    </main>}

    {data && tab === 'settings' && <main className="am-page"><KnowledgeSettings call={call}/></main>}

    {data && tab === 'spec' && <main className="am-page">
      <div className="am-section-head" data-reveal><span className="am-mono">/ Open contract · v1.0.0</span><h2>The <em>agent.json</em> specification.</h2><p>Identity, playbook, requested permissions, triggers, feedback, optional learning rules and an optional character. A manifest requests authority; it never grants it.</p></div>
      <div className="am-spec-grid">{[['01', 'Identity', 'ID, version, author, description, tags and icon.'], ['02', 'Persona', 'System prompt, playbook and skill references.'], ['03', 'Capabilities', 'Named permissions with reasons. Requests never grant authority.'], ['04', 'Triggers', 'Manual, @mention, cron and event declarations.'], ['05', 'Execution', 'Input mode, timeout and concurrency limit.'], ['06', 'Feedback', 'Ratings and short-term notes.'], ['07', 'Character', 'Class, palette and sprite seed. Superpowers must name a declared scope or none.'], ['08', 'Learning', 'Versioned rules, owner decisions and one-call replay; only owner approval changes the rulebook.']].map(([n, title, body]) => <div className="am-spec-item am-glass" key={n} data-reveal><span className="am-mono">/ {n}</span><strong>{title}</strong><p>{body}</p></div>)}</div>
      <div className="am-spec-actions"><button className="am-pill" onClick={() => copyText(JSON.stringify(EXAMPLE_MANIFEST, null, 2) + '\n', 'Example JSON copied.')}>Copy example<span className="am-pill-dot" aria-hidden="true"><Copy width={12}/></span></button><button className="am-ghost" onClick={() => copyText(JSON.stringify(AGENT_SCHEMA, null, 2) + '\n', 'Schema JSON copied.')}>Copy JSON Schema</button></div>
      <pre className="am-codeblock" tabIndex="0">{JSON.stringify(EXAMPLE_MANIFEST, null, 2)}</pre>
    </main>}

    {toast && <div className="am-toast am-glass" role="status">{toast}</div>}
    {levelUp && (() => {
      const owner = agents.find((item) => item.manifest.id === levelUp.id)
      return owner ? <div className="am-levelup" role="status" onClick={() => setLevelUp(null)}>
        <div className="am-levelup-card am-glass"><Sprite manifest={owner.manifest} size={150} mode="levelup" onDone={() => window.setTimeout(() => setLevelUp(null), 1400)}/><span className="am-mono">/ Level up</span><strong>{levelUp.name} reached Lv {levelUp.level}</strong></div>
      </div> : null
    })()}
    {copyFallback && <div className="am-copy-fallback am-glass" role="dialog" aria-modal="true" aria-label="Copy text"><button className="am-icon" aria-label="Close copy panel" onClick={() => setCopyFallback('')}><X width={18}/></button><strong>Copy this text</strong><textarea ref={copyFallbackRef} readOnly value={copyFallback}/></div>}
    {sheet && <CharacterSheet item={sheet} runs={data.runs} registry={registry} call={call} onCopy={copyText} running={runningAgent === sheet.manifest.id} onModel={(value) => chooseModel(sheet.manifest.id, value)} onClose={() => setSheetId('')} onQuest={() => sendOnQuest(sheet.manifest.id)}/>}
    {confirm && <div className="am-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirm(null) }}>
      <section className="am-confirm am-glass" role="dialog" aria-modal="true" aria-label="Confirm quest">
        <div className="am-confirm-head"><span className="am-mono">/ Permission & cost check</span><button className="am-icon" aria-label="Cancel" onClick={() => setConfirm(null)}><X width={18}/></button></div>
        {(() => {
          const owner = agents.find((item) => item.manifest.id === confirm.agentId)
          const choice = owner?.model
          const entry = registry?.find((group) => group.provider === choice?.provider)?.models.find((item) => item.id === choice?.model)
          return <>
            <div className="am-confirm-who">{owner && <Sprite manifest={owner.manifest} size={64} shadow={false}/>}<h2>{confirm.type === 'run' ? 'Start a real provider run?' : 'Enable automatic requests?'}</h2></div>
            <p>{confirm.type === 'run' ? 'This sends the task and its evidence to your chosen provider. Source reviews can include up to 120 KB of excerpts; the exact charge depends on your plan and model. After the report the agent makes one short extra call to reflect on the run (inside the same cost cap shown below) and writes a “What I learned” note; rules only change if a replay of your earlier feedback shows nothing gets worse.' : 'Triggers create unpaid requests. Every provider run needs a separate cost confirmation.'}</p>
            {confirm.target && <p><strong>Requested:</strong> {confirm.target}</p>}
            {owner?.workflow === 'design-critic' && !confirm.request.mention_id && confirm.type === 'run' && <p><strong>Screenshots:</strong> {['desktop', 'phone'].filter((label) => input.shots[label]).join(' and ') || (input.critic_kind === 'url' ? 'captured by the agent from the public page (desktop + 390×844 phone)' : 'none — source only')}</p>}
            <dl className="am-facts"><div><dt>Agent</dt><dd>{owner?.manifest.name}</dd></div><div><dt>Model</dt><dd>{choice ? PROVIDER_NAMES[choice.provider] + ' · ' + (entry?.label || choice.model) : 'Unavailable'}</dd></div><div><dt>Permissions</dt><dd>{scopeNames(owner?.manifest).join(', ') || 'None'}</dd></div><div><dt>Tools</dt><dd>{owner?.run_tools?.join(', ') || 'None'}</dd></div><div><dt>Limits</dt><dd>{owner?.run_limits ? `${owner.run_limits.max_steps} steps · ${owner.run_limits.timeout_seconds}s · ≈ US$${owner.run_limits.max_estimated_cost_usd.toFixed(2)} estimated cap` : '—'}</dd></div><div><dt>Energy</dt><dd>{owner?.stats.avg_cost_usd != null ? '≈ ' + money(owner.stats.avg_cost_usd) + ' per quest (provider estimate)' : 'No completed quests yet'}</dd></div></dl>
            {confirm.type === 'run' && <div className="am-lessons"><span className="am-mono">/ Lessons injected into this quest</span>{owner?.lessons?.length ? <ul>{owner.lessons.map((item) => <li key={item.from_run}>{item.rating === 'up' ? '▲' : '▼'} {item.note || 'No note'}</li>)}</ul> : <p className="am-dim">No previous feedback lessons.</p>}</div>}
          </>
        })()}
        <label className="am-ack"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)}/><span>I understand this may use my provider account and the permissions shown above.</span></label>
        <div className="am-confirm-actions"><button className="am-ghost" onClick={() => setConfirm(null)}>Cancel</button><button className="am-pill" disabled={!acknowledged || busy} onClick={confirmAction}>{busy ? 'Working…' : confirm.type === 'run' ? 'Confirm & send' : 'Confirm & enable'}<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={14}/></span></button></div>
      </section>
    </div>}
  </div>
}

function ModelPicker({ registry, choice, onChange }) {
  const current = modelKey(choice)
  const known = registry?.some((group) => group.models.some((item) => group.provider + ':' + item.id === current))
  return <label className="am-field"><span>Model <span className="am-dim">· remembered for this agent</span></span><select className="am-input" value={current} disabled={!registry?.length} onChange={(event) => onChange(event.target.value)}>
    {!registry && <option value={current}>Loading models…</option>}
    {registry && !known && choice && <option value={current}>{choice.model} (not in registry)</option>}
    {registry?.map((group) => <optgroup key={group.provider} label={PROVIDER_NAMES[group.provider]}>{group.models.filter((item) => !item.hidden || group.provider + ':' + item.id === current).map((item) => <option key={item.id} value={group.provider + ':' + item.id}>{item.label}</option>)}</optgroup>)}
  </select></label>
}

function CharacterSheet({ item, runs, registry, call, onCopy, running, onModel, onClose, onQuest }) {
  const agent = item.manifest
  const ch = characterFor(agent)
  const s = item.stats
  const span = Math.max(1, s.next_level_xp - s.level_floor_xp)
  const progress = Math.min(1, (s.xp - s.level_floor_xp) / span)
  const energy = s.avg_cost_usd == null ? 0 : Math.min(1, s.avg_cost_usd / 1.0)
  const powers = superpowers(agent)
  return <div className="am-scrim am-sheet-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="am-sheet" role="dialog" aria-modal="true" aria-label={agent.name + ' character sheet'}>
      <div className="am-sheet-top"><span className="am-mono">/ Character sheet</span><button className="am-icon" onClick={onClose} aria-label="Close character sheet"><X width={19}/></button></div>
      <div className="am-sheet-hero">
        <div className="am-sheet-stage"><Sprite manifest={agent} size={168} mode={running ? 'cast' : 'idle'}/><span className="am-platform am-platform-lg" aria-hidden="true"/></div>
        <div className="am-sheet-id">
          <span className="am-mono am-dim">{ch.class} · {agent.category}</span>
          <h2>{agent.name}</h2>
          <ExperienceBadge experience={item.experience}/>
          <p>{agent.description}</p>
          <div className="am-level"><span className="am-level-badge am-mono">Lv {s.level}</span><div className="am-level-bar" role="progressbar" aria-label="Experience toward next level" aria-valuemin={s.level_floor_xp} aria-valuemax={s.next_level_xp} aria-valuenow={s.xp}><i style={{ transform: `scaleX(${Math.max(0.015, progress)})` }}/></div><span className="am-mono am-dim">{s.xp} / {s.next_level_xp} XP</span></div>
        </div>
      </div>
      <dl className="am-stats">
        <div><dt className="am-mono">Quests</dt><dd>{s.completed}<small>{s.failed ? ' · ' + s.failed + ' failed' : ''}</small></dd></div>
        <div><dt className="am-mono">Accuracy</dt><dd>{s.accuracy == null ? '—' : Math.round(s.accuracy * 100) + '%'}<small>{s.upvotes + s.downvotes ? ` ${s.upvotes}▲ ${s.downvotes}▼` : ' no ratings yet'}</small></dd></div>
        <div><dt className="am-mono">Speed</dt><dd>{duration(s.avg_seconds)}<small> avg quest</small></dd></div>
        <div><dt className="am-mono">Lessons</dt><dd>{s.lessons}<small> learned</small></dd></div>
      </dl>
      <p className="am-note am-mono">{item.workflow === 'recruiter' ? 'Recruiter XP follows the net improvement in agreement, not the number of runs.' : 'XP = 100 per completed task + 50 per ▲ + 25 per note.'}{item.experience?.inherited_xp ? ` ${item.experience.inherited_xp} XP inherited.` : ''}</p>
      {(item.experience?.rules?.length > 0 || item.experience?.inherited_from) && <section className="am-exp-sheet"><span className="am-mono">/ Rulebook</span><p>Inherited rules: {item.experience.inherited_count} · own: {item.experience.own_count}</p><RuleLineage rules={item.experience.rules}/></section>}
      <ExperienceExport key={agent.id + ':' + (item.experience?.version || 0) + ':' + s.xp} call={call} item={item} onCopy={onCopy}/>
      <div className="am-powers-head"><span className="am-mono">/ Superpowers</span><div className="am-energy" title="Average provider-reported cost per completed quest"><span className="am-mono am-dim">Energy</span><span className="am-energy-bar" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < Math.ceil(energy * 10) ? 'is-on' : ''}/>)}</span><span className="am-mono">{s.avg_cost_usd == null ? 'no data' : '≈ ' + money(s.avg_cost_usd) + '/quest'}</span></div></div>
      <div className="am-powers">{powers.map((power, index) => <article className="am-power" key={power.name} style={{ '--d': index * 70 + 'ms' }}>
        <span className="am-power-glyph" aria-hidden="true" style={{ background: [ch.palette.primary, ch.palette.accent, ch.palette.secondary][index % 3] }}/>
        <div><strong>{power.name}</strong><p>{power.description}</p><span className="am-mono am-dim">{power.scope ? 'Uses ' + power.scope : 'Output · no extra access'}</span></div>
      </article>)}</div>
      <ModelPicker registry={registry} choice={item.model} onChange={onModel}/>
      <div className="am-sheet-meta am-mono am-dim">Triggers: manual on · @mention {item.config.mention ? 'on' : 'off'} · schedule {item.config.cron ? 'on' : 'off'}</div>
      <div className="am-sheet-log"><span className="am-mono">/ Recent quests</span>{runs.filter((run) => run.agent_id === agent.id).slice(0, 3).map((run) => <div key={run.id}><strong>{run.target}</strong><span className="am-mono am-dim">{dateLabel(run.started_at || run.created_at)} · {run.status}{typeof run.score === 'number' ? ' · ' + run.score + '/' + (run.score_scale || 100) : ''}</span></div>)}{!runs.some((run) => run.agent_id === agent.id) && <p className="am-dim">No local tasks yet.{item.experience?.inherited_from ? ' The inherited level and XP are kept.' : ''}</p>}</div>
      {(() => { const latestRun = runs.find(run => run.agent_id === agent.id); return latestRun?.timeline?.length ? <div className="am-sheet-log"><span className="am-mono">/ Najnovija vremenska linija · {latestRun.steps_used || 0} koraka</span>{latestRun.timeline.map((event, index) => <div key={index}><strong>{event.tool} · {event.status}</strong><span className="am-mono am-dim">{event.description} · {event.duration_seconds}s</span></div>)}</div> : null })()}
      <div className="am-sheet-actions"><button className="am-pill" onClick={onQuest}>Send on quest<span className="am-pill-dot" aria-hidden="true"><ArrowRight width={14}/></span></button><button className="am-ghost" onClick={onClose}>Close</button></div>
    </aside>
  </div>
}

// Hide leading score/verdict lines the score card already shows.
function reportBody(run) {
  if (typeof run.score !== 'number') return run.output
  return run.output.replace(/^\s*(?:\**\s*(?:Overall(?:\s+score)?|Score|Verdict)\s*\**\s*:.*\n)+/i, '')
}

function EvidenceImages({ files }) {
  const [images, setImages] = useState([])
  useEffect(() => {
    let live = true
    let urls = []
    Promise.all(files.map(async (file) => {
      const blob = await window.mobius.storage.getBlob(file.path)
      return { label: file.label, url: URL.createObjectURL(blob) }
    })).then((items) => {
      urls = items.map((item) => item.url)
      if (live) setImages(items)
      else urls.forEach((url) => URL.revokeObjectURL(url))
    }).catch(() => {})
    return () => { live = false; urls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [JSON.stringify(files)]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="am-evidence-images"><span className="am-mono">/ Captured evidence</span><div>{images.map((item) => <figure key={item.label}><img src={item.url} alt={item.label + ' screenshot captured during this run'}/><figcaption>{item.label}</figcaption></figure>)}</div></div>
}

function RunReport({ run, workflow, onCopy, onFeedback, onStop }) {
  const [rating, setRating] = useState(run.feedback?.rating || '')
  const [note, setNote] = useState(run.feedback?.note || '')
  useEffect(() => { setRating(run.feedback?.rating || ''); setNote(run.feedback?.note || '') }, [run.id, run.feedback?.rating, run.feedback?.note])
  const complete = run.status === 'completed'
  const critic = workflow === 'design-critic'
  const copy = COPY[workflow] || { label: 'Copy Markdown report', done: 'Report copied.' }
  function copyReport() {
    if (workflow === 'bug-triage') {
      const issues = section(run.output, 'GitHub')
      return onCopy((issues || run.output || '') + '\n', copy.done)
    }
    if (!critic) return onCopy(run.output || '', copy.done)
    const brief = section(run.output, 'Design brief')
    const fixes = section(run.output, 'Five highest-impact fixes')
    return onCopy('# Design brief — ' + run.target + '\n\n' + (brief || run.output || '') + (fixes ? '\n\n## Highest-impact fixes\n\n' + fixes : '') + '\n', copy.done)
  }
  return <>
    <div className="am-report-head"><div><span className="am-mono am-dim">/ Report</span><h3>{run.target}</h3></div><span className={'am-status am-mono is-' + run.status}>{run.status}</span></div>
    <div className="am-mono am-dim am-run-meta">{run.model_label || run.model || run.provider} · {run.started_at ? dateLabel(run.started_at) : 'Queued'}{run.screenshots?.length ? ' · ' + run.screenshots.join(' + ') + ' screenshots' : ''}{typeof run.cost_usd === 'number' ? ' · est. ' + money(run.cost_usd) + ' (provider estimate)' : ''}</div>
    {typeof run.score === 'number' && <div className="am-score"><div className="am-score-num"><strong>{run.score}</strong><span className="am-mono">/{run.score_scale || 100}</span></div><div><strong>{critic ? 'Overall design score' : workflow === 'seo-scout' ? 'SEO score' : 'Health score'}</strong>{run.verdict && <span className={'am-verdict am-mono is-' + run.verdict.toLowerCase()}>{run.verdict}</span>}<p className="am-dim">{critic ? 'A critic’s judgment against the six-part rubric.' : 'A reviewer’s judgment, not a certification.'}</p></div></div>}
    {critic && run.rubric?.length > 0 && <ul className="am-rubric" aria-label="Rubric scores">{run.rubric.map((item) => <li key={item.area}><span>{item.area}</span><span className="am-rubric-bar" aria-hidden="true"><i style={{ transform: `scaleX(${item.score / 10})` }}/></span><strong>{item.score}</strong></li>)}</ul>}
    {(run.status === 'queued' || run.status === 'running') && <div className="am-progress am-mono" role="status"><span className="am-progress-dot"/>{run.status_detail || 'Waiting for the supervised job…'}{run.output ? ' · ' + run.output.length.toLocaleString() + ' characters' : ''}</div>}
    {(run.status === 'queued' || run.status === 'running') && <button className="am-ghost" onClick={() => onStop(run.id)}>Stop run</button>}
    {!!run.timeline?.length && <div className="am-timeline"><span className="am-mono">/ Real tool timeline · {run.steps_used || 0}/{run.limits?.max_steps || '?'} steps</span><ol>{run.timeline.map((event, index) => <li key={index} className={'is-' + event.status}><strong>{event.tool}</strong><span>{event.description}</span><small>{event.status} · {event.duration_seconds}s</small></li>)}</ol></div>}
    {!!run.evidence_files?.length && <EvidenceImages files={run.evidence_files}/>}
    {run.diff_proposal && <details className="am-diff"><summary>Proposed patch (copied source only)</summary><pre>{run.diff_proposal}</pre></details>}
    {run.error && <div className="am-alert" role="alert">{run.error}</div>}
    <div className="am-output" aria-label="Provider report">{run.output ? <Markdown text={reportBody(run)}/> : <p className="am-dim">{run.status === 'completed' ? 'Loading the report…' : 'The provider has not produced report text yet.'}</p>}</div>
    {complete && <LearnedCard learned={run.learned} sync={run.sync}/>}
    {run.sources?.length > 0 && <div className="am-sources"><span className="am-mono">/ Retrieved sources</span><ol>{run.sources.map((item) => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || item.url} <ExternalLink width={12}/></a><small className="am-mono am-dim">{item.year || 'Public source'}</small></li>)}</ol></div>}
    <div className="am-lessons"><span className="am-mono">/ Lessons used in this quest</span>{run.lessons_used?.length ? <ul>{run.lessons_used.map((item) => <li key={item.from_run}>{item.rating === 'up' ? '▲' : '▼'} {item.note || 'No note'}</li>)}</ul> : <p className="am-dim">None yet. Your feedback below becomes the next lesson.</p>}</div>
    {complete && <>
      <button className="am-pill" onClick={copyReport}>{copy.label}<span className="am-pill-dot" aria-hidden="true"><Copy width={12}/></span></button>
      {workflow === 'researcher' && <p className="am-note">Review the cited evidence before copying claims into Möbius Memory; nothing is saved there automatically.</p>}
      <div className="am-feedback"><span className="am-mono">/ Was this useful?</span><div className="am-rate"><button className={rating === 'up' ? 'is-active' : ''} aria-pressed={rating === 'up'} onClick={() => setRating('up')}><ThumbUp width={15}/> Helpful</button><button className={rating === 'down' ? 'is-active' : ''} aria-pressed={rating === 'down'} onClick={() => setRating('down')}><ThumbDown width={15}/> Not helpful</button></div><label className="am-field">Lesson for the next quest<textarea className="am-input am-short" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="What should this agent repeat or change?"/></label><button className="am-ghost" disabled={!rating} onClick={() => onFeedback(run.id, rating, note)}>Save feedback</button></div>
    </>}
  </>
}
