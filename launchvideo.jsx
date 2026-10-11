import React, { useEffect, useRef, useState } from 'react'
import { X } from '@openai/apps-sdk-ui/components/Icon'

export const LAUNCH_VIDEO_FILE = 'launch-video.mp4'
export const LAUNCH_VIDEO_CREDIT = 'By Via Creativa Studio for Möbius · Music: Gregor Quendel, CC BY 4.0'

export const LAUNCH_VIDEO_CSS = `
.am-video { position:fixed; inset:0; z-index:70; display:grid; grid-template-rows:auto minmax(0,1fr) auto; background:#020202; color:var(--ink); outline:none; animation:am-fade .4s var(--ease-q) both; }
.am-video-bar { display:flex; align-items:center; gap:14px; padding:12px clamp(14px,3vw,32px); border-bottom:1px solid var(--line); }
.am-video-bar .am-mono { flex:1; color:var(--ink2); }
.am-video video { width:100%; height:100%; min-height:0; object-fit:contain; background:#000; }
.am-video-foot { padding:10px clamp(14px,3vw,32px) 14px; border-top:1px solid var(--line); color:var(--muted); font-size:12px; line-height:1.5; }
.am-video-foot em { color:var(--ink2); }
.am-video-play { gap:10px; }
.am-video-play svg { width:12px; height:12px; flex:none; }
@media (max-width:760px) { .am-video-bar .am-mono { font-size:10px; } .am-video-foot { font-size:11px; } }
@media (prefers-reduced-motion:reduce) { .am-video { animation:none; } }
`

export function PlayGlyph() {
  return <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1v10l9-5z" fill="currentColor"/></svg>
}

/**
 * The <video> only exists while this dialog is mounted, so the 6.8 MB file is
 * never requested until someone presses "Watch launch video" and is dropped
 * again on close.
 */
export function LaunchVideo({ src, onClose }) {
  const box = useRef(null)
  const video = useRef(null)
  const [problem, setProblem] = useState('')
  useEffect(() => {
    const el = video.current
    const previous = document.activeElement
    box.current.focus({ preventScroll: true })
    const key = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', key, true)
    el.play().catch(() => {}) // Controls stay visible when the browser wants a tap.
    return () => {
      window.removeEventListener('keydown', key, true)
      el.pause()
      el.removeAttribute('src')
      el.load() // Drop the download as well.
      if (previous?.isConnected) previous.focus?.({ preventScroll: true })
    }
  }, [])
  return <div className="am-video" ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Agent Marketplace launch video">
    <div className="am-video-bar">
      <span className="am-mono">/ Official launch video</span>
      <button className="am-ghost" onClick={onClose} aria-label="Close launch video">Close<X width={14}/></button>
    </div>
    <video ref={video} src={src} controls playsInline preload="auto" controlsList="nodownload"
      onError={() => setProblem('The launch video could not be loaded. Check your connection and try again.')}/>
    <div className="am-video-foot">{problem ? <em>{problem}</em> : LAUNCH_VIDEO_CREDIT} · Esc closes.</div>
  </div>
}
