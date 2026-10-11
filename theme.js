// Monochrome, moody, premium. The 8-bit characters are the only saturated colour.
export const CSS = `
.am-root {
  --bg:#050505; --bg2:#0b0b0b; --ink:#f3f2ef; --ink2:#c9c8c3; --muted:#86857f; --faint:#4a4945;
  --line:rgba(255,255,255,.09); --line2:rgba(255,255,255,.16);
  --glass:rgba(20,20,20,.52); --glass2:rgba(255,255,255,.035);
  --sans:'Inter Tight', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --serif:'Instrument Serif', 'Times New Roman', Georgia, serif;
  --mono:'Geist Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
  --ease:cubic-bezier(.16,1,.3,1); --ease-q:cubic-bezier(.25,1,.5,1);
  min-height:100%; background:var(--bg); color:var(--ink); font-family:var(--sans);
  font-size:15px; line-height:1.55; letter-spacing:-.005em; -webkit-font-smoothing:antialiased; overflow-x:clip;
}
.am-root *, .am-root *::before, .am-root *::after { box-sizing:border-box; }
:where(.am-root) :where(button, input, select, textarea) { font:inherit; color:inherit; }
:where(.am-root) button { cursor:pointer; }
.am-root :focus-visible { outline:1px solid var(--ink); outline-offset:3px; border-radius:inherit; }
.am-mono { font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; font-weight:400; }
.am-dim { color:var(--muted); }
.am-root em { font-family:var(--serif); font-style:italic; font-weight:400; letter-spacing:-.01em; }
.am-glass { background:var(--glass); border:1px solid var(--line); backdrop-filter:blur(22px) saturate(120%); -webkit-backdrop-filter:blur(22px) saturate(120%); }

/* Pills and ghosts */
.am-pill { display:inline-flex; align-items:center; gap:12px; min-height:46px; padding:6px 6px 6px 20px; border:0; border-radius:999px; background:var(--ink); color:#0a0a0a; font-weight:500; font-size:14px; letter-spacing:-.01em; transition:transform .5s var(--ease), background .3s var(--ease-q); white-space:nowrap; }
.am-pill:hover:not(:disabled) { transform:translateY(-1px); background:#fff; }
.am-pill:hover:not(:disabled) .am-pill-dot { transform:rotate(-45deg); }
.am-pill:disabled { opacity:.42; cursor:not-allowed; }
.am-pill-dot { width:34px; height:34px; border-radius:50%; display:grid; place-items:center; background:#0a0a0a; color:var(--ink); transition:transform .6s var(--ease); flex:none; }
.am-pill-sm { min-height:40px; font-size:13px; padding-left:16px; gap:10px; }
.am-pill-sm .am-pill-dot { width:28px; height:28px; }
.am-ghost { display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:44px; padding:0 18px; border:1px solid var(--line2); border-radius:999px; background:transparent; font-size:14px; color:var(--ink2); transition:border-color .3s var(--ease-q), color .3s var(--ease-q), background .3s var(--ease-q); }
.am-ghost:hover:not(:disabled) { border-color:rgba(255,255,255,.4); color:var(--ink); background:rgba(255,255,255,.03); }
.am-ghost:disabled { opacity:.4; cursor:not-allowed; }
.am-icon { width:44px; height:44px; display:grid; place-items:center; border:1px solid var(--line); border-radius:50%; background:rgba(10,10,10,.6); color:var(--ink); }

/* Top bar */
.am-top { position:sticky; top:0; z-index:30; display:flex; align-items:center; gap:24px; padding:14px clamp(18px,4vw,48px); border-bottom:1px solid var(--line); background:rgba(5,5,5,.9); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); }
.am-brand { display:flex; align-items:center; gap:10px; min-height:44px; border:0; background:none; padding:0; font-weight:600; font-size:16px; letter-spacing:-.02em; }
.am-brand-mark { width:22px; height:22px; border-radius:50%; border:1.5px solid var(--ink); position:relative; }
.am-brand-mark::after { content:''; position:absolute; inset:4px 2px; border:1.5px solid var(--ink); border-radius:50%; transform:rotate(35deg) scaleY(.45); }
.am-brand-sub { color:var(--muted); }
.am-nav { display:flex; gap:4px; margin-left:auto; }
.am-nav-link { min-height:44px; padding:0 14px; border:0; background:none; color:var(--muted); font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; border-radius:999px; transition:color .3s var(--ease-q), background .3s var(--ease-q); }
.am-nav-link:hover, .am-nav-link.is-active { color:var(--ink); }
.am-nav-link.is-active { background:rgba(255,255,255,.06); }

/* Hero */
.am-hero { position:relative; min-height:min(940px, max(640px, 100vh)); display:flex; align-items:flex-end; overflow:hidden; border-bottom:1px solid var(--line); background:radial-gradient(120% 80% at 70% 20%, #2a2a2a 0%, #0c0c0c 55%, #050505 100%); }
.am-scene { position:absolute; inset:0; overflow:hidden; background:#080808; }
.am-scene-canvas { display:block; image-rendering:pixelated; image-rendering:crisp-edges; }
.am-scene-party { position:absolute; inset:0; pointer-events:none; }
.am-scene-hit { position:absolute; padding:0; border:0; background:transparent; pointer-events:auto; cursor:pointer; border-radius:6px; -webkit-tap-highlight-color:transparent; }
.am-scene-hit:focus-visible { outline:1px solid var(--ink); outline-offset:2px; }
.am-scene-bubble { position:absolute; z-index:4; transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center; gap:2px; padding:7px 11px 8px; background:#0b0b0b; color:var(--ink); border:2px solid var(--ink); box-shadow:3px 3px 0 #000; font-family:var(--mono); text-transform:uppercase; letter-spacing:.06em; white-space:nowrap; pointer-events:none; animation:am-bubble .22s steps(3, end) both; }
.am-scene-bubble strong { font-size:11px; font-weight:500; }
.am-scene-bubble span { font-size:9.5px; color:var(--muted); }
.am-scene-bubble::after { content:''; position:absolute; left:50%; bottom:-5px; width:8px; height:8px; margin-left:-4px; background:#0b0b0b; border-right:2px solid var(--ink); border-bottom:2px solid var(--ink); transform:rotate(45deg); }
@keyframes am-bubble { from { opacity:0; transform:translate(-50%, calc(-100% + 6px)); } }
.am-hero::after { content:''; position:absolute; inset:auto 0 0 0; height:42%; background:linear-gradient(to bottom, transparent, rgba(5,5,5,.86)); pointer-events:none; }
.am-hero-inner { position:relative; z-index:2; width:100%; padding:0 clamp(18px,4vw,48px) clamp(36px,6vw,72px); max-width:1240px; }
.am-hero-labels { display:flex; gap:28px; color:var(--ink2); margin-bottom:22px; flex-wrap:wrap; }
.am-hero h1 { margin:0; max-width:8.6em; font-size:clamp(46px, 7.4vw, 112px); line-height:.94; font-weight:500; letter-spacing:-.045em; }
.am-hero h1 em { font-size:1.06em; letter-spacing:-.02em; }
.am-hero-lede { max-width:32em; margin:26px 0 0; color:var(--ink2); font-size:clamp(15px,1.25vw,17px); }
.am-hero-actions { display:flex; gap:12px; flex-wrap:wrap; margin-top:30px; }
.am-hero-stats { display:flex; gap:0; margin:44px 0 0; padding:0; border-top:1px solid var(--line); max-width:560px; }
.am-hero-stats div { flex:1; padding:14px 18px 0 0; display:flex; flex-direction:column; justify-content:space-between; }
.am-hero-stats div + div { padding-left:18px; border-left:1px solid var(--line); }
.am-hero-stats dt { color:var(--muted); font-size:10px; }
.am-hero-stats dd { margin:6px 0 0; font-family:var(--sans); font-size:28px; letter-spacing:-.03em; text-transform:none; color:var(--ink); }
.am-talk { position:absolute; z-index:3; right:clamp(18px,4vw,48px); bottom:clamp(36px,6vw,72px); display:flex; gap:14px; align-items:center; padding:12px 16px 12px 12px; border-radius:22px; width:min(330px, calc(100% - 36px)); animation:am-talk-in .9s var(--ease) both; }
.am-talk-portrait { width:86px; height:86px; flex:none; display:grid; place-items:center; border-radius:16px; background:radial-gradient(circle at 50% 70%, rgba(255,255,255,.08), rgba(255,255,255,0) 70%), #0a0a0a; border:1px solid var(--line); overflow:hidden; }
.am-talk-body { display:flex; flex-direction:column; gap:3px; min-width:0; }
.am-talk-body strong { font-size:17px; font-weight:500; letter-spacing:-.02em; }
.am-talk-class { color:var(--ink2); margin-bottom:8px; }
@keyframes am-talk-in { from { opacity:0; transform:translateY(14px) scale(.98); } to { opacity:1; transform:none; } }

/* Class strip */
.am-strip { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); border-bottom:1px solid var(--line); }
.am-strip-cell { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-height:128px; padding:20px 10px; border:0; border-right:1px solid var(--line); background:transparent; color:var(--ink2); transition:background .4s var(--ease-q), color .4s var(--ease-q); }
.am-strip-cell:last-child { border-right:0; }
.am-strip-cell:hover { background:rgba(255,255,255,.025); color:var(--ink); }
.am-strip-cell small { color:var(--muted); font-size:12px; }
.am-emblem { image-rendering:pixelated; opacity:.92; }

/* Sections */
.am-section { scroll-margin-top:72px; }
.am-section, .am-page { padding:clamp(64px,9vw,128px) clamp(18px,4vw,48px); max-width:1320px; margin:0 auto; }
.am-page { min-height:80vh; }
.am-section-head { max-width:760px; margin-bottom:42px; }
.am-section-head .am-mono { color:var(--muted); }
.am-section-head h2 { margin:14px 0 14px; font-size:clamp(34px,4.6vw,64px); line-height:1; font-weight:500; letter-spacing:-.04em; }
.am-section-head p { margin:0; color:var(--ink2); max-width:36em; }
.am-filters { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:26px; }
.am-filters button { min-height:40px; padding:0 14px; border:1px solid var(--line); border-radius:999px; background:transparent; color:var(--muted); transition:all .3s var(--ease-q); }
.am-filters button:hover { color:var(--ink); border-color:var(--line2); }
.am-filters button.is-active { color:#0a0a0a; background:var(--ink); border-color:var(--ink); }

/* Party */
.am-party { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); border-top:1px solid var(--line); border-left:1px solid var(--line); }
.am-hero-tile { position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; min-height:300px; padding:46px 16px 22px; border:0; border-right:1px solid var(--line); border-bottom:1px solid var(--line); background:transparent; text-align:center; transition:background .5s var(--ease-q), opacity .5s var(--ease-q); }
.am-hero-tile:hover { background:radial-gradient(70% 60% at 50% 45%, rgba(255,255,255,.06), rgba(255,255,255,0) 70%); }
.am-hero-tile:hover .am-sprite { transform:translateY(-4px); }
.am-hero-tile.is-selected { background:rgba(255,255,255,.025); }
.am-hero-tile.is-dim { opacity:.22; }
.am-hero-tile strong { margin-top:12px; font-weight:500; font-size:16px; letter-spacing:-.02em; }
.am-tile-level { position:absolute; top:16px; left:16px; color:var(--ink2); }
.am-sprite { image-rendering:pixelated; display:block; transition:transform .6s var(--ease); }
.am-platform { display:block; width:118px; height:14px; margin-top:-6px; background:
  linear-gradient(#5a5a5a 0 2px, transparent 2px) top/100% 100% no-repeat,
  repeating-linear-gradient(90deg, #2e2e2e 0 14px, #1f1f1f 14px 16px) 0 2px/100% 6px no-repeat,
  repeating-linear-gradient(90deg, #1b1b1b 0 7px, #151515 7px 9px, #1b1b1b 9px 16px) 0 8px/100% 6px no-repeat;
  box-shadow:0 2px 0 #0a0a0a; image-rendering:pixelated; }
.am-platform-lg { width:190px; }
.am-xp { display:block; width:96px; height:3px; margin-top:12px; background:rgba(255,255,255,.08); overflow:hidden; }
.am-xp i { display:block; height:100%; background:var(--ink); transform-origin:left; transition:transform 1.1s var(--ease); }
.am-recruit { justify-content:center; color:var(--muted); }
.am-recruit-plus { width:64px; height:64px; display:grid; place-items:center; border:1px dashed var(--line2); border-radius:50%; margin-bottom:6px; }

/* Quest board */
.am-quest-grid { display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr); gap:18px; align-items:start; }
.am-quest-form, .am-report { border-radius:24px; padding:clamp(18px,2.4vw,30px); min-width:0; }
.am-quest-who { display:flex; gap:16px; align-items:center; margin-bottom:6px; }
.am-quest-who > div { flex:1; min-width:0; }
.am-field { display:flex; flex-direction:column; gap:7px; margin:14px 0 0; font-size:13px; color:var(--ink2); }
.am-field-tight { margin-top:6px; }
.am-input { width:100%; min-height:46px; padding:11px 14px; border:1px solid var(--line); border-radius:12px; background:rgba(0,0,0,.35); color:var(--ink); font-size:15px; transition:border-color .3s var(--ease-q), background .3s var(--ease-q); }
.am-input:focus { outline:none; border-color:rgba(255,255,255,.42); background:rgba(0,0,0,.5); }
textarea.am-input { min-height:118px; resize:vertical; line-height:1.5; }
.am-input.am-short { min-height:82px; }
.am-input.am-code { min-height:160px; font-family:var(--mono); font-size:12.5px; }
select.am-input { appearance:none; background-image:linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%); background-position:calc(100% - 20px) 50%, calc(100% - 15px) 50%; background-size:5px 5px; background-repeat:no-repeat; padding-right:38px; }
.am-seg { display:flex; gap:4px; padding:4px; margin-top:16px; border:1px solid var(--line); border-radius:999px; }
.am-seg button { flex:1; min-height:40px; border:0; border-radius:999px; background:transparent; color:var(--muted); font-size:13px; transition:all .35s var(--ease-q); }
.am-seg button.is-active { background:var(--ink); color:#0a0a0a; }
.am-two { display:grid; grid-template-columns:1fr 1fr; gap:0 12px; }
.am-note { margin:10px 0 0; font-size:12.5px; color:var(--muted); }
p.am-note.am-mono { font-size:10px; }
.am-quest-go { display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin-top:22px; }
.am-triggers { margin-top:24px; border-top:1px solid var(--line); padding-top:14px; }
.am-triggers summary { min-height:44px; display:flex; align-items:center; cursor:pointer; color:var(--muted); list-style:none; }
.am-triggers summary::-webkit-details-marker { display:none; }
.am-trigger { display:flex; justify-content:space-between; gap:14px; align-items:center; padding:12px 0; border-bottom:1px solid var(--line); }
.am-trigger small { display:block; color:var(--muted); font-size:12.5px; }
.am-shots { display:grid; grid-template-columns:1.6fr 1fr; gap:10px; margin-top:14px; }
.am-shot { position:relative; min-height:128px; border:1px dashed var(--line2); border-radius:14px; overflow:hidden; background:rgba(0,0,0,.3); transition:border-color .3s var(--ease-q); }
.am-shot:hover, .am-shot:focus-within { border-color:rgba(255,255,255,.4); }
.am-shot.has-image { border-style:solid; }
.am-shot img { width:100%; height:100%; max-height:180px; object-fit:cover; object-position:top; display:block; filter:grayscale(.15); }
.am-shot .am-icon { position:absolute; top:6px; right:6px; }
.am-shot-pick { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:var(--ink2); cursor:pointer; text-align:center; padding:10px; }
.am-shot-pick input { position:absolute; inset:0; opacity:0; cursor:pointer; }
.am-shot-pick small { color:var(--muted); }

/* Report */
.am-report { min-height:420px; }
.am-report-head { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
.am-report-head h3 { margin:6px 0 0; font-size:20px; font-weight:500; letter-spacing:-.02em; overflow-wrap:anywhere; }
.am-status { padding:6px 10px; border:1px solid var(--line2); border-radius:999px; color:var(--ink2); white-space:nowrap; font-size:10px; }
.am-status.is-completed { color:var(--ink); border-color:rgba(255,255,255,.5); }
.am-status.is-failed { color:#ff9b9b; border-color:rgba(255,120,120,.4); }
.am-run-meta { margin:10px 0 16px; font-size:10px; line-height:1.6; }
.am-score { display:flex; gap:18px; align-items:center; padding:16px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); margin-bottom:14px; }
.am-score-num { display:flex; align-items:baseline; gap:4px; }
.am-score-num strong { font-size:56px; line-height:1; font-weight:500; letter-spacing:-.05em; }
.am-score p { margin:3px 0 0; font-size:13px; }
.am-verdict { margin-left:10px; padding:3px 9px; border:1px solid var(--line2); border-radius:999px; font-size:10px; }
.am-verdict.is-premium { border-color:rgba(255,255,255,.6); color:#fff; }
.am-rubric { list-style:none; margin:0 0 16px; padding:0; display:grid; gap:10px; }
.am-rubric li { display:grid; grid-template-columns:minmax(120px,150px) 1fr 32px; align-items:center; gap:12px; font-size:13px; color:var(--ink2); }
.am-rubric strong { text-align:right; font-weight:500; font-variant-numeric:tabular-nums; color:var(--ink); }
.am-rubric-bar { height:2px; background:rgba(255,255,255,.1); overflow:hidden; }
.am-rubric-bar i { display:block; height:100%; background:var(--ink); transform-origin:left; animation:am-grow 1.1s var(--ease) both; }
@keyframes am-grow { from { transform:scaleX(0); } }
.am-progress { display:flex; align-items:center; gap:10px; margin:6px 0 14px; color:var(--ink2); font-size:10px; }
.am-progress-dot { width:7px; height:7px; border-radius:50%; background:var(--ink); animation:am-pulse 1.4s var(--ease-q) infinite; }
@keyframes am-pulse { 50% { opacity:.25; transform:scale(.7); } }
.am-output { max-height:680px; overflow:auto; padding:4px 4px 4px 0; margin:6px 0 18px; overscroll-behavior:contain; }
.am-md { font-size:14.5px; line-height:1.65; color:var(--ink2); }
.am-md > :first-child { margin-top:0; }
.am-md h3, .am-md h4, .am-md h5, .am-md h6 { color:var(--ink); font-weight:500; letter-spacing:-.02em; line-height:1.2; margin:26px 0 10px; }
.am-md h3 { font-size:22px; } .am-md h4 { font-size:17px; } .am-md h5, .am-md h6 { font-size:15px; }
.am-md p { margin:0 0 12px; } .am-md ul, .am-md ol { margin:0 0 14px; padding-left:20px; } .am-md li { margin:5px 0; }
.am-md strong { color:var(--ink); font-weight:600; }
.am-md a { color:var(--ink); text-underline-offset:3px; text-decoration-color:rgba(255,255,255,.35); overflow-wrap:anywhere; }
.am-md code { padding:1px 5px; border-radius:5px; background:rgba(255,255,255,.07); color:var(--ink); font-family:var(--mono); font-size:12.5px; }
.am-md blockquote { margin:0 0 14px; padding:4px 0 4px 16px; border-left:1px solid var(--line2); color:var(--ink2); font-family:var(--serif); font-style:italic; font-size:17px; line-height:1.45; }
.am-md-code { margin:8px 0 16px; padding:14px; border:1px solid var(--line); border-radius:12px; background:rgba(0,0,0,.45); overflow:auto; }
.am-md-code code { padding:0; background:none; white-space:pre; font-size:12px; line-height:1.6; }
.am-md-table { overflow-x:auto; margin:8px 0 16px; border:1px solid var(--line); border-radius:12px; }
.am-md table { width:100%; border-collapse:collapse; font-size:13px; }
.am-md th, .am-md td { padding:9px 11px; text-align:left; vertical-align:top; border-bottom:1px solid var(--line); }
.am-md th { font-family:var(--mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:400; }
.am-md tr:last-child td { border-bottom:0; }
.am-md th:not(:last-child), .am-md td:not(:last-child) { white-space:nowrap; }
.am-md td:last-child { min-width:220px; }
.am-sources { margin:0 0 16px; } .am-sources ol { margin:10px 0 0; padding-left:20px; }
.am-sources li { margin:7px 0; } .am-sources a { color:var(--ink); text-underline-offset:3px; } .am-sources small { display:block; font-size:10px; }
.am-lessons { margin:0 0 18px; padding:14px 16px; border:1px solid var(--line); border-radius:14px; background:var(--glass2); font-size:13.5px; }
.am-lessons > .am-mono { color:var(--muted); } .am-lessons ul { margin:8px 0 0; padding-left:0; list-style:none; } .am-lessons li { margin:5px 0; } .am-lessons p { margin:8px 0 0; }
.am-feedback { margin-top:22px; padding-top:18px; border-top:1px solid var(--line); }
.am-feedback > .am-mono { color:var(--muted); }
.am-rate { display:flex; gap:8px; margin:12px 0 2px; flex-wrap:wrap; }
.am-rate button { display:inline-flex; align-items:center; gap:7px; min-height:44px; padding:0 16px; border:1px solid var(--line2); border-radius:999px; background:transparent; color:var(--ink2); transition:all .3s var(--ease-q); }
.am-rate button.is-active { background:var(--ink); color:#0a0a0a; border-color:var(--ink); }
.am-feedback .am-ghost { margin-top:12px; }
.am-empty { display:flex; flex-direction:column; gap:10px; align-items:flex-start; justify-content:center; min-height:360px; padding:20px; }
.am-empty strong { font-size:24px; font-weight:500; letter-spacing:-.03em; }

/* Quest log */
.am-log { border-top:1px solid var(--line); margin-bottom:36px; }
.am-log h3 { margin:18px 0 6px; color:var(--muted); }
.am-log-row { display:grid; grid-template-columns:auto 1fr auto; gap:18px; align-items:center; padding:16px 0; border-bottom:1px solid var(--line); }
.am-log-row strong { font-weight:500; display:block; }
.am-log-row p { margin:4px 0 0; color:var(--ink2); font-size:14px; overflow-wrap:anywhere; }
.am-log-row .am-mono { font-size:10px; }
.am-log-side { display:flex; flex-direction:column; align-items:flex-end; gap:8px; }

/* Forge & spec */
.am-forge { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(260px,.6fr); gap:18px; align-items:start; }
.am-forge-form { border-radius:24px; padding:clamp(18px,2.4vw,30px); }
.am-forge-preview { position:sticky; top:96px; border-radius:24px; min-height:360px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:30px; }
.am-forge-preview strong { margin-top:12px; font-weight:500; font-size:20px; letter-spacing:-.02em; }
.am-tools { border:0; padding:0; margin:20px 0 0; display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.am-tools legend { color:var(--muted); margin-bottom:10px; padding:0; }
.am-check { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border:1px solid var(--line); border-radius:14px; cursor:pointer; }
.am-check input { margin-top:4px; accent-color:#f3f2ef; width:18px; height:18px; }
.am-check small { display:block; color:var(--muted); font-size:12.5px; }
.am-spec-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:12px; }
.am-spec-item { border-radius:18px; padding:20px; }
.am-spec-item .am-mono { color:var(--muted); }
.am-spec-item strong { display:block; margin:12px 0 6px; font-weight:500; font-size:18px; }
.am-spec-item p { margin:0; color:var(--ink2); font-size:14px; }
.am-spec-actions { display:flex; gap:12px; flex-wrap:wrap; margin:28px 0 14px; }
.am-codeblock { margin:0; padding:20px; max-height:520px; overflow:auto; border:1px solid var(--line); border-radius:18px; background:rgba(0,0,0,.5); font:12px/1.6 var(--mono); color:var(--ink2); }

/* Character sheet */
.am-scrim { position:fixed; inset:0; z-index:60; background:rgba(0,0,0,.6); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:grid; place-items:center; padding:18px; animation:am-fade .4s var(--ease-q) both; }
.am-sheet-scrim { place-items:stretch end; padding:0; }
.am-sheet { width:min(620px, 100%); height:100%; overflow:auto; padding:22px clamp(18px,3vw,34px) 34px; background:#0c0c0c; border-left:1px solid var(--line); animation:am-slide .7s var(--ease) both; overscroll-behavior:contain; }
@keyframes am-fade { from { opacity:0; } }
@keyframes am-slide { from { transform:translateX(40px); opacity:0; } }
.am-sheet-top { display:flex; justify-content:space-between; align-items:center; color:var(--muted); }
.am-sheet-hero { display:grid; grid-template-columns:auto 1fr; gap:24px; align-items:center; margin:18px 0 22px; }
.am-sheet-stage { display:flex; flex-direction:column; align-items:center; padding:22px 18px 18px; border:1px solid var(--line); border-radius:22px; background:radial-gradient(70% 60% at 50% 55%, rgba(255,255,255,.07), rgba(255,255,255,0) 72%), #080808; }
.am-sheet-id h2 { margin:6px 0 8px; font-size:clamp(30px,4vw,42px); line-height:1; font-weight:500; letter-spacing:-.04em; }
.am-sheet-id p { margin:0 0 16px; color:var(--ink2); font-size:14px; }
.am-level { display:grid; grid-template-columns:auto 1fr; gap:6px 12px; align-items:center; }
.am-level .am-mono.am-dim { grid-column:2; font-size:10px; }
.am-level-badge { grid-row:span 2; padding:8px 12px; border:1px solid var(--ink); border-radius:10px; color:var(--ink); font-size:13px; }
.am-level-bar { height:4px; background:rgba(255,255,255,.1); overflow:hidden; border-radius:2px; }
.am-level-bar i { display:block; height:100%; background:var(--ink); transform-origin:left; animation:am-grow 1.2s var(--ease) both; }
.am-stats { display:grid; grid-template-columns:repeat(4,1fr); margin:0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.am-stats div { padding:14px 12px 14px 0; }
.am-stats div + div { padding-left:12px; border-left:1px solid var(--line); }
.am-stats dt { color:var(--muted); font-size:10px; }
.am-stats dd { margin:6px 0 0; font-size:24px; letter-spacing:-.03em; line-height:1.1; }
.am-stats small { display:block; font-size:11.5px; color:var(--muted); letter-spacing:0; }
.am-powers-head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin:26px 0 12px; color:var(--muted); }
.am-energy { display:flex; align-items:center; gap:10px; }
.am-energy .am-mono { font-size:10px; }
.am-energy-bar { display:flex; gap:2px; }
.am-energy-bar i { width:6px; height:12px; background:rgba(255,255,255,.1); }
.am-energy-bar i.is-on { background:var(--ink); }
.am-powers { display:grid; gap:10px; }
.am-power { display:grid; grid-template-columns:auto 1fr; gap:14px; padding:14px 16px; border:1px solid var(--line); border-radius:16px; background:var(--glass2); animation:am-rise .8s var(--ease) both; animation-delay:var(--d,0ms); }
.am-power strong { font-weight:500; font-size:16px; letter-spacing:-.01em; }
.am-power p { margin:3px 0 6px; color:var(--ink2); font-size:13.5px; }
.am-power .am-mono { font-size:10px; }
.am-power-glyph { width:14px; height:14px; margin-top:5px; image-rendering:pixelated; box-shadow:4px 4px 0 rgba(255,255,255,.08); }
@keyframes am-rise { from { opacity:0; transform:translateY(10px); } }
.am-sheet-meta { margin-top:16px; font-size:10px; }
.am-sheet-log { margin-top:22px; border-top:1px solid var(--line); padding-top:14px; }
.am-sheet-log > .am-mono { color:var(--muted); }
.am-sheet-log div { padding:10px 0; border-bottom:1px solid var(--line); }
.am-sheet-log strong { display:block; font-weight:500; font-size:14px; overflow-wrap:anywhere; }
.am-sheet-log .am-mono { font-size:10px; }
.am-sheet-actions { display:flex; gap:10px; margin-top:24px; flex-wrap:wrap; }

/* Confirm, toast, level-up, copy */
.am-confirm { width:min(560px,100%); max-height:calc(100vh - 36px); overflow:auto; border-radius:24px; padding:22px; background:rgba(14,14,14,.92); animation:am-rise .6s var(--ease) both; }
.am-confirm-head { display:flex; justify-content:space-between; align-items:center; color:var(--muted); }
.am-confirm-who { display:flex; align-items:center; gap:12px; margin-top:8px; }
.am-confirm h2 { margin:0; font-size:26px; font-weight:500; letter-spacing:-.03em; line-height:1.1; }
.am-confirm p { color:var(--ink2); font-size:14px; }
.am-facts { margin:12px 0; border-top:1px solid var(--line); }
.am-facts div { display:grid; grid-template-columns:110px 1fr; gap:12px; padding:10px 0; border-bottom:1px solid var(--line); font-size:13.5px; }
.am-facts dt { color:var(--muted); font-family:var(--mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; padding-top:3px; }
.am-facts dd { margin:0; overflow-wrap:anywhere; }
.am-ack { display:flex; gap:10px; align-items:flex-start; margin:8px 0 16px; font-size:13.5px; color:var(--ink2); cursor:pointer; }
.am-ack input { width:20px; height:20px; margin-top:1px; accent-color:#f3f2ef; flex:none; }
.am-confirm-actions { display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
.am-toast { position:fixed; z-index:80; left:50%; bottom:22px; transform:translateX(-50%); padding:12px 18px; border-radius:999px; font-size:13.5px; max-width:calc(100% - 32px); animation:am-rise .5s var(--ease) both; }
.am-levelup { position:fixed; inset:0; z-index:90; display:grid; place-items:center; background:rgba(0,0,0,.55); animation:am-fade .4s var(--ease-q) both; }
.am-levelup-card { display:flex; flex-direction:column; align-items:center; gap:8px; padding:30px 40px; border-radius:26px; animation:am-pop .8s var(--ease) both; }
.am-levelup-card strong { font-size:24px; font-weight:500; letter-spacing:-.03em; }
@keyframes am-pop { from { opacity:0; transform:scale(.92) translateY(10px); } }
.am-copy-fallback { position:fixed; z-index:85; inset:auto 16px 16px 16px; max-width:560px; margin:auto; border-radius:18px; padding:16px; }
.am-copy-fallback textarea { width:100%; min-height:160px; margin-top:10px; background:rgba(0,0,0,.4); border:1px solid var(--line); border-radius:12px; color:var(--ink); padding:10px; font:12px var(--mono); }
.am-copy-fallback .am-icon { float:right; }
.am-alert { display:flex; justify-content:space-between; align-items:center; gap:12px; margin:14px 0; padding:12px 14px; border:1px solid rgba(255,140,140,.35); border-radius:12px; color:#ffc2c2; background:rgba(80,10,10,.25); font-size:14px; }
.am-global-error { margin:18px clamp(18px,4vw,48px); }
.am-loading { min-height:70vh; display:grid; place-items:center; color:var(--muted); }
.am-foot { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:26px clamp(18px,4vw,48px) 40px; border-top:1px solid var(--line); color:var(--muted); font-size:10px; }

/* Scroll reveals: expo-out, never linear. */
[data-reveal] { opacity:0; transform:translateY(24px); transition:opacity 1s var(--ease), transform 1.1s var(--ease); transition-delay:var(--d,0ms); }
[data-reveal][data-revealed] { opacity:1; transform:none; }

@media (max-width:1100px) {
  .am-party { grid-template-columns:repeat(3, minmax(0,1fr)); }
  .am-quest-grid, .am-forge { grid-template-columns:1fr; }
  .am-forge-preview { position:static; min-height:280px; }
}
@media (max-width:760px) {
  .am-root { font-size:15px; }
  .am-top { flex-wrap:wrap; gap:6px 12px; padding:10px 16px; }
  .am-top-cta { display:none; }
  .am-section { scroll-margin-top:118px; padding-top:48px; }
  .am-nav { order:3; width:100%; margin:0; display:grid; grid-template-columns:repeat(4,1fr); gap:2px; }
  .am-nav-link { padding:0 4px; font-size:10px; letter-spacing:.05em; }
  .am-hero { min-height:auto; flex-direction:column; align-items:stretch; padding-top:min(78vw, 360px); }
  .am-scene { height:min(100vw, 460px); bottom:auto; }
  .am-hero::after { height:100%; background:linear-gradient(to bottom, transparent 0, transparent 34%, rgba(5,5,5,.92) 62%, #050505 100%); }
  .am-hero-inner { padding:0 18px 22px; }
  .am-hero-labels { gap:14px; margin-bottom:14px; font-size:10px; }
  .am-hero h1 { font-size:clamp(42px, 12.5vw, 60px); }
  .am-hero-actions .am-pill { flex:1 1 100%; justify-content:space-between; }
  .am-hero-actions .am-ghost { flex:1 1 calc(50% - 6px); padding:0 12px; white-space:nowrap; }
  .am-hero-stats { margin-top:30px; }
  .am-hero-stats dd { font-size:22px; }
  .am-hero-stats div { padding-right:10px; } .am-hero-stats div + div { padding-left:12px; }
  .am-talk { position:relative; right:auto; bottom:auto; margin:0 18px 28px; width:auto; }
  .am-strip { grid-template-columns:repeat(2,1fr); }
  .am-strip-cell { min-height:104px; border-bottom:1px solid var(--line); }
  .am-strip-cell:nth-child(2n) { border-right:0; }
  .am-party { grid-template-columns:repeat(2, minmax(0,1fr)); }
  .am-hero-tile { min-height:250px; padding:40px 8px 18px; }
  .am-hero-tile .am-sprite { width:86px !important; height:auto !important; }
  .am-platform { width:96px; }
  .am-quest-form, .am-report { border-radius:20px; padding:16px; }
  .am-two, .am-tools { grid-template-columns:1fr; }
  .am-shots { grid-template-columns:1fr 1fr; }
  .am-quest-go .am-pill { width:100%; justify-content:space-between; }
  .am-score-num strong { font-size:44px; }
  .am-rubric li { grid-template-columns:1fr 32px; }
  .am-rubric-bar { grid-column:1 / -1; grid-row:2; }
  .am-log-row { grid-template-columns:auto 1fr; }
  .am-log-side { grid-column:1 / -1; flex-direction:row; justify-content:space-between; align-items:center; }
  .am-sheet { padding:16px 16px 28px; border-left:0; }
  .am-sheet-hero { grid-template-columns:1fr; gap:14px; }
  .am-sheet-stage { padding:16px; }
  .am-stats { grid-template-columns:repeat(2,1fr); }
  .am-stats div:nth-child(3) { padding-left:0; border-left:0; }
  .am-stats div:nth-child(n+3) { border-top:1px solid var(--line); }
  .am-confirm { padding:18px; }
  .am-facts div { grid-template-columns:1fr; gap:4px; }
  .am-confirm-actions .am-pill { flex:1; justify-content:space-between; }
}
@media (prefers-reduced-motion: reduce) {
  .am-root *, .am-root *::before, .am-root *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
  [data-reveal] { opacity:1; transform:none; }
}
`
