import React, { useEffect, useMemo, useRef, useState } from 'react'
import { buildSprite, characterFor, hashSeed, SPRITE_H, SPRITE_W } from './sprites.js'

// Pixel-art hero: parallax sky, far mountains, near hills and a stone ground,
// with the real installed agents standing as an RPG party. Monochrome scene,
// so the characters stay the only saturated colour on the page.

const SKY = ['#050505', '#070707', '#090909', '#0c0c0c', '#0f0f0f', '#131313']
const FAR = { body: '#1b1b1b', ridge: '#2e2e2e' }
const NEAR = { body: '#121212', ridge: '#232323' }
const STONE = { top: '#5a5a5a', brick: '#2e2e2e', mortar: '#1f1f1f', deep: '#1b1b1b', deep2: '#151515' }
const EARTH = '#080808'
const BREATH_MS = 1500

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  return c
}

function spriteCanvas(pixels, color) {
  const c = canvas(SPRITE_W, SPRITE_H)
  const ctx = c.getContext('2d')
  pixels.forEach((row, y) => row.forEach((value, x) => {
    if (!value) return
    ctx.fillStyle = color || value
    ctx.fillRect(x, y, 1, 1)
  }))
  return c
}

// A 1-D ridge: a few seeded sine octaves, quantised to whole pixels.
function ridge(width, seed, base, amp, scale) {
  const r = rng(seed)
  const waves = [0, 1, 2].map((i) => ({ f: (0.6 + r() * 0.8) * scale * (i + 1) ** 1.6, p: r() * 6.28, a: amp / (i + 1) ** 1.3 }))
  return Array.from({ length: width }, (_, x) => Math.round(base - waves.reduce((sum, w) => sum + Math.sin(x * w.f + w.p) * w.a, 0)))
}

// Static layers are pre-rendered once per size; frames only composite them.
function buildLayers(w, h, ground, pad) {
  const W = w + pad * 2
  const sky = canvas(W, h)
  let ctx = sky.getContext('2d')
  const band = Math.max(1, Math.floor(ground / SKY.length))
  for (let y = 0; y < ground; y++) {
    const i = Math.min(SKY.length - 1, Math.floor(y / band))
    ctx.fillStyle = SKY[i]
    ctx.fillRect(0, y, W, 1)
    // Two dithered rows soften each band edge, as in old console skies.
    if (i < SKY.length - 1 && y % band >= band - 2) {
      ctx.fillStyle = SKY[i + 1]
      for (let x = (y % 2); x < W; x += 2) ctx.fillRect(x, y, 1, 1)
    }
  }
  const moonX = Math.round(W * 0.2)
  const moonY = Math.max(6, Math.round(ground * 0.22))
  ctx.fillStyle = '#cfcdc5'
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 18) ctx.fillRect(moonX + x, moonY + y, 1, 1)
  ctx.fillStyle = '#a9a79f'
  ;[[-1, -1], [2, 1], [0, 2], [-2, 2]].forEach(([x, y]) => ctx.fillRect(moonX + x, moonY + y, 1, 1))

  const far = canvas(W, h)
  ctx = far.getContext('2d')
  const farLine = ridge(W, 41, Math.round(ground * 0.66), Math.max(6, ground * 0.2), 0.045)
  farLine.forEach((top, x) => {
    ctx.fillStyle = FAR.body
    ctx.fillRect(x, top, 1, ground - top)
    ctx.fillStyle = FAR.ridge
    ctx.fillRect(x, top, 1, 1)
    if (top < ground * 0.55) ctx.fillRect(x, top + 1, 1, 1) // pale caps on the tallest peaks
  })

  const near = canvas(W, h)
  ctx = near.getContext('2d')
  const nearLine = ridge(W, 97, Math.round(ground * 0.86), Math.max(3, ground * 0.08), 0.09)
  nearLine.forEach((top, x) => {
    ctx.fillStyle = NEAR.body
    ctx.fillRect(x, top, 1, ground - top)
    ctx.fillStyle = NEAR.ridge
    ctx.fillRect(x, top, 1, 1)
  })

  const floor = canvas(W, h)
  ctx = floor.getContext('2d')
  ctx.fillStyle = STONE.top
  ctx.fillRect(0, ground, W, 1)
  for (let row = 0; row < 2; row++) {
    const y = ground + 1 + row * 3
    ctx.fillStyle = STONE.brick
    ctx.fillRect(0, y, W, 3)
    ctx.fillStyle = STONE.mortar
    for (let x = (row ? 4 : 0); x < W; x += 8) ctx.fillRect(x, y, 1, 3)
    ctx.fillRect(0, y + 2, W, 1)
  }
  for (let y = ground + 7; y < ground + 10; y++) {
    ctx.fillStyle = y % 2 ? STONE.deep : STONE.deep2
    ctx.fillRect(0, y, W, 1)
  }
  // Dark earth under the stage, with sparse pebbles, dithered into the page black.
  const r = rng(7)
  for (let y = ground + 10; y < h; y++) {
    ctx.fillStyle = EARTH
    ctx.fillRect(0, y, W, 1)
  }
  for (let i = 0; i < W * 0.6; i++) {
    const y = ground + 10 + Math.floor(r() * Math.max(1, Math.min(40, h - ground - 10)))
    ctx.fillStyle = r() < 0.5 ? '#111111' : '#0d0d0d'
    ctx.fillRect(Math.floor(r() * W), y, r() < 0.3 ? 2 : 1, 1)
  }
  return { sky, far, near, floor, pad }
}

const CLOUDS = [
  [[0, 1, 9, 2], [2, 0, 4, 1], [3, 3, 5, 1]],
  [[0, 1, 13, 2], [3, 0, 6, 1], [1, 3, 9, 1]],
  [[0, 0, 6, 2], [2, 2, 5, 1]],
]

export function PartyHero({ agents, runningAgent, onOpen, textRef }) {
  const sceneRef = useRef(null)
  const canvasRef = useRef(null)
  const [layout, setLayout] = useState(null)
  const [active, setActive] = useState(null)
  const [pinned, setPinned] = useState(false)
  const pointerType = useRef('mouse')
  const stateRef = useRef({ active: null, running: runningAgent, px: 0, tx: 0 })
  stateRef.current.active = active
  stateRef.current.running = runningAgent

  // Highest-level agents lead the formation, matching the party grid below.
  const party = useMemo(() => [...agents]
    .sort((a, b) => b.stats.xp - a.stats.xp || a.manifest.name.localeCompare(b.manifest.name))
    .map((item) => {
      const character = characterFor(item.manifest)
      return {
        id: item.manifest.id, name: item.manifest.name, cls: character.class, level: item.stats.level,
        accent: character.palette.accent,
        open: spriteCanvas(buildSprite(character)),
        blink: spriteCanvas(buildSprite(character, { blink: true })),
        glow: spriteCanvas(buildSprite(character), '#f3f2ef'),
        phase: hashSeed(item.manifest.id) % BREATH_MS,
        blinkEvery: 3600 + (hashSeed(item.manifest.id + 'b') % 2400),
      }
    }), [agents])

  // Size the pixel grid to the scene and keep the stage above the headline.
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return undefined
    const measure = () => {
      const rect = scene.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const scale = rect.width < 560 ? 3 : rect.width < 1100 ? 4 : 5
      const w = Math.ceil(rect.width / scale)
      const h = Math.ceil(rect.height / scale)
      const textTop = textRef?.current ? textRef.current.getBoundingClientRect().top - rect.top : rect.height
      const groundPx = Math.max(rect.height * 0.3, Math.min(rect.height * 0.8, textTop - 14))
      const ground = Math.floor(groundPx / scale) - 10
      // Up to four stand in one row; larger parties form a front and a back row.
      const frontCount = party.length > 4 ? Math.ceil(party.length / 2) : party.length
      const spacing = SPRITE_W + 6
      const centre = Math.round(w * (rect.width < 760 ? 0.5 : 0.7))
      const slots = party.map((member, index) => {
        const back = index >= frontCount
        const n = back ? party.length - frontCount : frontCount
        const i = back ? index - frontCount : index
        const x = Math.round(centre - ((n - 1) * spacing) / 2 + i * spacing) - SPRITE_W / 2
        const y = ground - SPRITE_H - (back ? 9 : 0)
        return { id: member.id, x, y, back }
      })
      setLayout({ scale, w, h, ground, slots, layers: buildLayers(w, h, ground, 8) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scene)
    if (textRef?.current) observer.observe(textRef.current)
    document.fonts?.ready?.then(measure).catch(() => {})
    return () => observer.disconnect()
  }, [party, textRef])

  useEffect(() => {
    const el = canvasRef.current
    if (!el || !layout) return undefined
    const ctx = el.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const { w, h, layers, slots } = layout
    const still = reducedMotion()
    const byId = Object.fromEntries(party.map((member) => [member.id, member]))
    const star = rng(3)
    const stars = Array.from({ length: Math.round(w * 0.18) }, () => ({
      x: Math.floor(star() * w), y: Math.floor(star() * layout.ground * 0.55),
      c: star() < 0.25 ? '#8a8a86' : star() < 0.6 ? '#4a4945' : '#2f2f2c', p: star() * 9000,
    }))
    const cloudRng = rng(11)
    const clouds = Array.from({ length: Math.max(3, Math.round(w / 90)) }, (_, i) => ({
      shape: CLOUDS[i % CLOUDS.length], x: cloudRng() * (w + 40), y: 4 + Math.floor(cloudRng() * layout.ground * 0.4),
      speed: 0.6 + cloudRng() * 0.9, c: cloudRng() < 0.5 ? '#1a1a1a' : '#161616',
    }))
    let raf = 0
    let visible = true
    let last = ''
    const started = performance.now()

    const paint = (now) => {
      const t = still ? 0 : now - started
      const state = stateRef.current
      state.px += (state.tx - state.px) * 0.06
      const shift = (k) => Math.round(state.px * k)
      const key = [Math.floor(t / 120), shift(1), shift(2), shift(3), state.active, state.running].join('|')
      if (key === last) return
      last = key
      ctx.drawImage(layers.sky, -layers.pad, 0)
      for (const s of stars) {
        if (!still && (t + s.p) % 9000 < 500) continue // a slow, occasional twinkle
        ctx.fillStyle = s.c
        ctx.fillRect(s.x, s.y, 1, 1)
      }
      for (const c of clouds) {
        const x = Math.round(((c.x - (t / 1000) * c.speed) % (w + 40) + w + 40) % (w + 40)) - 20
        ctx.fillStyle = c.c
        for (const [dx, dy, cw, ch] of c.shape) ctx.fillRect(x + dx, c.y + dy, cw, ch)
      }
      ctx.drawImage(layers.far, -layers.pad + shift(1), 0)
      ctx.drawImage(layers.near, -layers.pad + shift(2), 0)
      ctx.drawImage(layers.floor, -layers.pad + shift(3), 0)
      const order = [...slots].sort((a, b) => Number(b.back) - Number(a.back))
      for (const slot of order) {
        const member = byId[slot.id]
        if (!member) continue
        const x = slot.x + shift(3)
        // Two-frame breathing with each member on its own phase, plus a blink.
        const dy = still ? 0 : Math.floor(((t + member.phase) % BREATH_MS) / (BREATH_MS / 2))
        const blink = !still && (t + member.phase) % member.blinkEvery < 130
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(x + 3, slot.y + SPRITE_H, SPRITE_W - 6, 1)
        if (state.active === slot.id) {
          for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(member.glow, x + ox, slot.y + dy + oy)
        }
        ctx.drawImage(blink ? member.blink : member.open, x, slot.y + dy)
        if (state.running === slot.id && !still) {
          for (let i = 0; i < 4; i++) {
            const a = t / 600 + (i * Math.PI) / 2
            ctx.fillStyle = i % 2 ? member.accent : '#ffffff'
            ctx.fillRect(Math.round(x + 8 + Math.cos(a) * 11), Math.round(slot.y + 10 + Math.sin(a) * 6), 1, 1)
          }
        }
      }
    }
    const loop = (now) => {
      if (!visible || document.hidden) { raf = 0; return }
      paint(now)
      raf = requestAnimationFrame(loop)
    }
    const kick = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop) }
    if (still) paint(performance.now())
    else kick()
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (still) paint(performance.now()); else kick() })
    observer.observe(el)
    const onVisibility = () => { if (!still) kick() }
    document.addEventListener('visibilitychange', onVisibility)
    const onPointer = (event) => { stateRef.current.tx = (event.clientX / window.innerWidth - 0.5) * 2 }
    if (!still) window.addEventListener('pointermove', onPointer, { passive: true })
    const repaint = () => { if (still) { last = ''; paint(performance.now()) } }
    const timer = still ? window.setInterval(repaint, 250) : 0
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pointermove', onPointer)
      window.clearInterval(timer)
    }
  }, [layout, party])

  useEffect(() => {
    if (!pinned) return undefined
    const close = (event) => { if (!sceneRef.current?.contains(event.target)) { setActive(null); setPinned(false) } }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [pinned])

  const activeMember = party.find((member) => member.id === active)
  const activeSlot = layout?.slots.find((slot) => slot.id === active)
  const s = layout?.scale || 1

  return <div className="am-scene" ref={sceneRef} onClick={(event) => { if (event.target === event.currentTarget || event.target === canvasRef.current) { setActive(null); setPinned(false) } }}>
    <canvas ref={canvasRef} className="am-scene-canvas" width={layout?.w || 1} height={layout?.h || 1}
      style={layout ? { width: layout.w * s, height: layout.h * s } : undefined} aria-hidden="true"/>
    {layout && <div className="am-scene-party" role="group" aria-label="Your agent party">
      {layout.slots.map((slot) => {
        const member = party.find((item) => item.id === slot.id)
        return <button key={slot.id} className="am-scene-hit" type="button"
          style={{ left: slot.x * s - 4, top: slot.y * s - 4, width: SPRITE_W * s + 8, height: SPRITE_H * s + 8, zIndex: slot.back ? 1 : 2 }}
          aria-label={`${member.name}, ${member.cls}, level ${member.level}`}
          aria-describedby={active === slot.id ? 'am-scene-bubble' : undefined}
          onPointerDown={(event) => { pointerType.current = event.pointerType }}
          onMouseEnter={() => { if (!pinned) setActive(slot.id) }}
          onMouseLeave={() => { if (!pinned) setActive(null) }}
          onFocus={() => setActive(slot.id)}
          onBlur={() => { if (!pinned) setActive(null) }}
          onClick={() => {
            // Touch: first tap shows the bubble, a second tap opens the sheet.
            if (pointerType.current === 'touch' && !(pinned && active === slot.id)) { setActive(slot.id); setPinned(true); return }
            setPinned(false)
            onOpen(slot.id)
          }}/>
      })}
    </div>}
    {activeMember && activeSlot && <div id="am-scene-bubble" className="am-scene-bubble" role="tooltip"
      style={{ left: (activeSlot.x + SPRITE_W / 2) * s, top: activeSlot.y * s - 10 }}>
      <strong>{activeMember.name}</strong>
      <span>{activeMember.cls} · Lv {activeMember.level}</span>
    </div>}
  </div>
}
