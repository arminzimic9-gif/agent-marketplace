import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Sprite } from './characters.jsx'
import { GUILD_STATIONS, guildActivity } from './guild-state.mjs'

// Idle spots between the rooms (desktop: around the hearth).
const COMMONS = [
  [30, 47], [40, 57], [43, 43], [54, 57],
  [57, 43], [70, 57], [31, 60], [69, 46],
]
// Phone layout: two columns of rooms with a hallway between them.
const HALL_COMMONS = [
  [47, 14], [53, 24], [47, 34], [53, 44], [47, 54], [53, 64], [47, 74], [53, 84],
]
const HALL_STATIONS = [
  [21, 19.1], [79, 19.1], [21, 40], [79, 40], [21, 60.9], [79, 60.9], [21, 81.8], [79, 81.8],
]
const ACCENT = {
  books: '#c88a5a', guard: '#8fb4d8', easel: '#e07a95', interview: '#f0b45a',
  brief: '#e6cf9d', launch: '#f6d36a', seo: '#5fd0b4', triage: '#e0645f',
}
const stationFor = id => GUILD_STATIONS.find(item => item.id === id)
const SHORT_NAME = {
  researcher: 'Researcher', sentinel: 'Sentinel', 'design-critic': 'Design Critic',
  recruiter: 'Recruiter', 'brief-builder': 'Brief Builder',
  'launch-writer': 'Launch Writer', 'seo-scout': 'SEO Scout', 'bug-triage': 'Bug Triage',
}
const STATUS_TEXT = { running: 'working', queued: 'queued', waiting: 'awaiting your confirmation', idle: 'resting' }

function useHallLayout() {
  const query = '(max-width: 820px)'
  const [portrait, setPortrait] = useState(() => window.matchMedia?.(query).matches || false)
  useEffect(() => {
    const media = window.matchMedia?.(query)
    if (!media) return undefined
    const update = () => setPortrait(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])
  return portrait
}

function Person({ agent, activity, pos, size, mode, selected, index, onSelect, onReview, cheering, onCheerDone }) {
  const id = agent.manifest.id
  const last = useRef(pos)
  const [walk, setWalk] = useState({ on: false, left: false })
  useEffect(() => {
    const [px, py] = last.current
    if (px === pos[0] && py === pos[1]) return undefined
    setWalk({ on: true, left: pos[0] < px })
    last.current = pos
    const timer = window.setTimeout(() => setWalk(current => ({ ...current, on: false })), 1300)
    return () => window.clearTimeout(timer)
  }, [pos[0], pos[1]])
  const working = ['running', 'queued'].includes(activity.status)
  return <div className={'am-guild-person is-' + activity.status + (walk.on ? ' is-walking' : '') + (selected ? ' is-selected' : '')}
    style={{ '--px': `${pos[0]}%`, '--py': `${pos[1]}%`, '--d': `${(index % 5) * 0.9}s`, '--dur': `${6 + (index % 4) * 1.3}s` }}>
    {activity.bubble && <span className="am-guild-bubble" role="status">{activity.bubble}</span>}
    {activity.status === 'waiting' && <button className="am-guild-alert" aria-label={`Review request for ${agent.manifest.name}`} onClick={() => onReview(activity.request)}>!</button>}
    {cheering?.id === id && <span className="am-guild-xp am-mono">{cheering.levelUp ? `LEVEL ${cheering.level}!` : 'XP +'}</span>}
    <button className="am-guild-character" onClick={() => onSelect(id)} aria-pressed={selected}
      aria-label={`${agent.manifest.name}: ${STATUS_TEXT[activity.status]}. Send on quest`}>
      <span className="am-guild-drift">
        <span className={'am-guild-body' + (walk.left ? ' is-left' : '')}>
          <Sprite manifest={agent.manifest} size={size} mode={mode} shadow={false} onDone={onCheerDone}/>
        </span>
      </span>
      <span className="am-guild-shadow" aria-hidden="true"/>
      <span className="am-guild-plate">{SHORT_NAME[id] || agent.manifest.name}{working ? ' ·' : ''}</span>
    </button>
  </div>
}

export function GuildHall({ agents, runs, pending, onOpen, onReview, onReport, recruiterVersion, selectedId, onSelect, onClose, panel }) {
  const prior = useRef(null)
  const portrait = useHallLayout()
  const [cheering, setCheering] = useState(null)
  const state = useMemo(() => agents.map((agent, index) => ({
    agent, index, activity: guildActivity(agent.manifest.id, runs, pending),
  })), [agents, runs, pending])

  // Celebrate only a transition observed while this room is open; old results
  // never masquerade as a new event on page load.
  useEffect(() => {
    const next = new Map()
    for (const { agent, activity } of state) {
      const id = agent.manifest.id
      const latest = runs.find(item => item.agent_id === id)
      next.set(id, { run: latest?.id, status: latest?.status, level: agent.stats.level })
      const before = prior.current?.get(id)
      if (before && latest && before.run === latest.id && before.status === 'running' && latest.status === 'completed') {
        setCheering({ id, levelUp: agent.stats.level > before.level, level: agent.stats.level })
      }
    }
    prior.current = next
  }, [state, runs])

  const active = state.filter(item => item.activity.status === 'running' || item.activity.status === 'queued')
  const waiting = state.filter(item => item.activity.status === 'waiting')
  const rest = agents.length - active.length - waiting.length
  const stationPos = (station, index) => portrait ? (HALL_STATIONS[index] || [50, 50]) : [station.x, station.y]
  const commons = portrait ? HALL_COMMONS : COMMONS

  return <main className="am-guild-page">
    <div className="am-guild-head">
      <span className="am-mono">/ Guild Hall · live from the quest log</span>
      <h1>The room where they <em>work</em>.</h1>
      <p>Click a character or its room to send it on a quest, right here. It walks to its station only while a real run is live, and its speech bubble quotes the recorded step.</p>
      <div className="am-guild-counters am-mono">
        <span><i className="is-work"/>{active.length} working</span>
        <span><i className="is-wait"/>{waiting.length} awaiting you</span>
        <span><i className="is-rest"/>{rest} resting</span>
      </div>
    </div>
    <div className={'am-guild-layout' + (panel ? ' has-panel' : '')}>
      <div className="am-guild-stage">
        <div className={'am-guild-room' + (portrait ? ' is-portrait' : '')}>
          <div className="am-guild-floor" aria-hidden="true"><i className="am-guild-shaft is-a"/><i className="am-guild-shaft is-b"/></div>
          <div className="am-guild-wall">
            <i className="am-guild-torch is-l" aria-hidden="true"/><i className="am-guild-torch is-r" aria-hidden="true"/>
            <i className="am-guild-banner is-l" aria-hidden="true"/><i className="am-guild-banner is-r" aria-hidden="true"/>
            <i className="am-guild-window is-a" aria-hidden="true"/><i className="am-guild-window is-b" aria-hidden="true"/>
            <i className="am-guild-window is-c" aria-hidden="true"/><i className="am-guild-window is-d" aria-hidden="true"/>
            <div className="am-guild-title"><span className="am-mono">AGENT GUILD / MÖBIUS</span><small className="am-mono">Rulebook {recruiterVersion ? `v${recruiterVersion}` : '· awaiting v1'}</small></div>
          </div>
          <div className="am-guild-rug" aria-hidden="true"/>
          <div className="am-guild-hearth" aria-hidden="true"><span className="am-guild-fire"/><i/><i/><i/><i/><i/></div>
          {GUILD_STATIONS.map((station, index) => {
            const agent = agents.find(item => item.manifest.id === station.id)
            const activity = state.find(item => item.agent.manifest.id === station.id)?.activity
            const [sx, sy] = stationPos(station, index)
            const status = activity?.status || 'idle'
            return <button key={station.id} disabled={!agent} onClick={() => onSelect(station.id)}
              className={'am-guild-station is-' + station.prop + ' is-' + status + (selectedId === station.id ? ' is-selected' : '')}
              aria-label={`${station.label}, ${agent?.manifest.name || station.id}: ${STATUS_TEXT[status]}. Send on quest`}
              style={{ '--sx': `${sx}%`, '--sy': `${sy}%`, '--accent': ACCENT[station.prop] }}>
              <span className="am-guild-lamp" aria-hidden="true"/>
              <span className="am-guild-sign am-mono">{station.label}</span>
              <span className="am-guild-prop" aria-hidden="true"><i/><i/><i/><i/></span>
              <span className="am-guild-mat" aria-hidden="true"/>
            </button>
          })}
          {state.map(({ agent, index, activity }) => {
            const id = agent.manifest.id
            const stationIndex = GUILD_STATIONS.findIndex(item => item.id === id)
            const station = stationFor(id)
            const working = ['running', 'queued'].includes(activity.status)
            const base = station ? stationPos(station, stationIndex) : null
            const pos = working && base ? [base[0], base[1] + (portrait ? 4.8 : 6)] : commons[index % commons.length]
            const mode = cheering?.id === id ? (cheering.levelUp ? 'levelup' : 'celebrate') : working ? 'cast' : 'idle'
            return <Person key={id} agent={agent} activity={activity} pos={pos} size={portrait ? 54 : 70} mode={mode}
              index={index} selected={selectedId === id} onSelect={onSelect} onReview={onReview}
              cheering={cheering} onCheerDone={() => setCheering(null)}/>
          })}
          <div className="am-guild-light" aria-hidden="true"/>
        </div>
      </div>
      {panel && <>
        <button className="am-gq-scrim" aria-label="Close quest panel" onClick={onClose}/>
        <aside className="am-gq am-glass" aria-label="Send on quest">{panel}</aside>
      </>}
    </div>
    <div className="am-guild-footer">
      <div><span className="am-mono">/ Stations</span><p>Every working step comes from the real run timeline. Nothing is animated as “work” while an agent is only queued or before the model has called a tool.</p></div>
      <div className="am-guild-worklist">
        {(active.length || waiting.length) ? [...active, ...waiting].map(({ agent, activity }) => <div key={agent.manifest.id}>
          <span className="am-guild-workdot"/><strong>{agent.manifest.name}</strong><span>{activity.bubble || (activity.status === 'waiting' ? 'Awaiting confirmation' : 'Task is queued')}</span>
          <button className="am-ghost" onClick={() => activity.request ? onReview(activity.request) : onReport(agent.manifest.id)}>{activity.request ? 'Review' : 'Open result'}</button>
        </div>) : <span className="am-dim">No active steps or pending confirmations right now.</span>}
      </div>
    </div>
  </main>
}
