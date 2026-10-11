import React, { useEffect, useMemo, useRef } from 'react'
import { buildSprite, characterFor, EFFECT_COLORS, EMBLEMS, SPRITE_H, SPRITE_W } from './sprites.js'

// Canvas grid is larger than the sprite so effects have room around it.
const GRID_W = 26
const GRID_H = 28
const OX = 5
const OY = 5

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function drawSprite(ctx, pixels, dx, dy, tint) {
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      const color = pixels[y][x]
      if (!color) continue
      ctx.fillStyle = tint && color !== '#120e18' ? tint : color
      ctx.fillRect(OX + x + dx, OY + y + dy, 1, 1)
    }
  }
}

// One animated character. mode: idle | cast | celebrate | levelup.
export function Sprite({ manifest, mode = 'idle', size = 96, shadow = true, label, onDone }) {
  const canvasRef = useRef(null)
  const character = useMemo(() => characterFor(manifest), [manifest])
  const frames = useMemo(() => ({
    open: buildSprite(character), blink: buildSprite(character, { blink: true }),
  }), [character])
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')
    const colors = EFFECT_COLORS(character)
    const still = reduceMotion()
    const started = performance.now()
    const once = mode === 'celebrate' || mode === 'levelup'
    const duration = mode === 'levelup' ? 2000 : 1700
    let raf = 0
    let visible = true
    let finished = false

    const paint = (now) => {
      const t = now - started
      ctx.clearRect(0, 0, GRID_W, GRID_H)
      let dy = 0
      let tint = null
      if (!still) {
        if (mode === 'idle') dy = Math.floor(t / 560) % 2
        if (mode === 'cast') dy = -(Math.floor(t / 170) % 2)
        if (mode === 'celebrate') {
          const p = Math.min(1, t / duration)
          dy = -Math.round(Math.abs(Math.sin(p * Math.PI * 2)) * 4 * (1 - p * 0.4))
        }
        if (mode === 'levelup') {
          const p = Math.min(1, t / duration)
          dy = -Math.round(Math.sin(Math.min(1, p * 1.6) * Math.PI) * 3)
          if (Math.floor(t / 90) % 2 === 0 && p < 0.55) tint = '#ffffff'
        }
      }
      if (shadow) {
        ctx.fillStyle = 'rgba(0,0,0,0.42)'
        const w = dy < -1 ? 8 : 10
        ctx.fillRect(OX + 8 - w / 2, OY + SPRITE_H, w, 1)
      }
      if (mode === 'levelup' && !still) {
        const p = Math.min(1, t / duration)
        ctx.globalAlpha = 0.5 * (1 - p)
        ctx.fillStyle = '#ffd447'
        ctx.fillRect(OX + 2, 0, SPRITE_W - 4, GRID_H)
        ctx.globalAlpha = 1
        for (let i = 0; i < 12; i++) {
          const x = (i * 7 + 3) % GRID_W
          const y = GRID_H - ((t / 18 + i * 9) % GRID_H)
          ctx.fillStyle = i % 3 ? '#ffd447' : '#ffffff'
          ctx.fillRect(x, Math.round(y), 1, 1)
        }
      }
      const blink = !still && mode !== 'cast' && t % 3600 > 3460
      drawSprite(ctx, blink ? frames.blink : frames.open, 0, dy, tint)
      if (mode === 'cast' && !still) {
        for (let i = 0; i < 7; i++) {
          const a = t / 520 + (i * Math.PI * 2) / 7
          const r = 10 + Math.sin(t / 300 + i) * 1.5
          const x = Math.round(OX + 8 + Math.cos(a) * r)
          const y = Math.round(OY + 10 + Math.sin(a) * r * 0.62)
          ctx.fillStyle = colors[i % colors.length]
          ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t / 140 + i)
          ctx.fillRect(x, y, 1, 1)
        }
        ctx.globalAlpha = 1
        if (Math.floor(t / 260) % 2 === 0) {
          ctx.fillStyle = character.palette.accent
          ctx.fillRect(OX + 7, 1, 2, 1)
          ctx.fillRect(OX + 7.5 - 0.5, 0, 1, 1)
        }
      }
      if (mode === 'celebrate' && !still) {
        const p = Math.min(1, t / duration)
        for (let i = 0; i < 16; i++) {
          const x = (i * 11 + 4) % GRID_W
          const y = Math.round(((t / 14) * (0.6 + (i % 4) * 0.2) + i * 5) % GRID_H)
          ctx.globalAlpha = 1 - p * 0.8
          ctx.fillStyle = colors[i % colors.length]
          ctx.fillRect(x, y, 1, 1)
        }
        ctx.globalAlpha = 1
      }
      if (once && t >= duration && !finished) {
        finished = true
        doneRef.current?.()
      }
    }

    const loop = (now) => {
      paint(now)
      if (still || !visible) return
      raf = requestAnimationFrame(loop)
    }
    loop(performance.now())
    if (still && once) doneRef.current?.()
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      const was = visible
      visible = entry.isIntersecting
      if (visible && !was && !still) raf = requestAnimationFrame(loop)
    }) : null
    observer?.observe(canvas)
    return () => { cancelAnimationFrame(raf); observer?.disconnect() }
  }, [character, frames, mode, shadow])

  return <canvas ref={canvasRef} className={'am-sprite is-' + mode} width={GRID_W} height={GRID_H}
    style={{ width: size, height: Math.round((size * GRID_H) / GRID_W) }}
    role="img" aria-label={label || `${manifest?.name || 'Agent'}, ${character.class}`}/>
}

// Small monochrome pixel emblem for a class.
export function Emblem({ name, size = 22 }) {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const rows = EMBLEMS[name] || EMBLEMS.Bard
    ctx.clearRect(0, 0, 9, 9)
    ctx.fillStyle = '#f2f2f2'
    rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') ctx.fillRect(x, y, 1, 1) }))
  }, [name])
  return <canvas ref={ref} className="am-emblem" width={9} height={9} style={{ width: size, height: size }} aria-hidden="true"/>
}
