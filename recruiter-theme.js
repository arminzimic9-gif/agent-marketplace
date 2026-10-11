export const RECRUITER_CSS = `
.am-learn { width:100%; color:var(--ink); }
.am-learn-banner { display:flex; gap:30px; align-items:baseline; justify-content:space-between; margin:0 0 20px; padding:18px 22px; border:1px solid rgba(233,187,102,.28); border-radius:16px; background:linear-gradient(100deg,rgba(233,187,102,.08),rgba(233,187,102,.015)); }
.am-learn-banner .am-mono { color:#e9bb66; white-space:nowrap; }
.am-learn-banner p { max-width:680px; margin:0; color:var(--ink2); font-size:13px; }
.am-learn-inherited { display:flex; align-items:center; flex-wrap:wrap; gap:8px 14px; margin:-2px 0 18px; color:var(--ink2); font-size:12px; }
.am-learn-inherited small { width:100%; color:var(--muted); }
.am-learn-notice { padding:11px 15px; border:1px solid rgba(143,205,165,.22); background:rgba(41,91,60,.17); border-radius:12px; color:#b9dfc4; }
.am-learn-running { display:flex; align-items:center; gap:12px; padding:16px 18px; border-radius:14px; margin:0 0 20px; color:#e9bb66; }
.am-learn-running span:last-child { margin-left:auto; color:var(--muted); font-size:12px; }
.am-learn-pulse { flex:none; width:9px; height:9px; border-radius:50%; background:#e9bb66; box-shadow:0 0 0 6px rgba(233,187,102,.12); animation:am-learn-pulse 1.4s infinite; }
@keyframes am-learn-pulse { 50% { box-shadow:0 0 0 10px rgba(233,187,102,0) } }
.am-learn-grid { display:grid; grid-template-columns:minmax(0,1.65fr) minmax(260px,.75fr); gap:18px; align-items:start; }
.am-learn-main,.am-learn-side { display:grid; gap:18px; min-width:0; }
.am-learn-card { min-width:0; padding:clamp(18px,2.2vw,28px); border-radius:22px; }
.am-learn-card-head { margin-bottom:18px; }
.am-learn-card-head > .am-mono, .am-learn-card > .am-mono { color:#e9bb66; }
.am-learn-card h3 { font-size:clamp(23px,2.3vw,32px); font-weight:500; line-height:1.14; letter-spacing:-.035em; margin:8px 0 9px; }
.am-learn-card h4 { font-size:16px; font-weight:500; margin:0; }
.am-learn-card p { color:var(--ink2); font-size:13.5px; margin:6px 0; }
.am-learn-card-head p { max-width:56em; }
.am-learn-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:20px; }
.am-learn-actions .am-mono { line-height:1.4; }
.am-learn-inbox { margin-top:18px; border-top:1px solid var(--line); padding-top:10px; display:grid; gap:7px; }
.am-learn-inbox > div { display:flex; gap:12px; align-items:center; justify-content:space-between; flex-wrap:wrap; padding:5px 0; }
.am-learn-inbox strong { color:#e9bb66; }
.am-learn-inbox span { font-size:12px; color:var(--ink2); }
.am-learn-rules { list-style:none; margin:0; padding:0; border-top:1px solid var(--line); }
.am-learn-rules li { display:grid; grid-template-columns:86px 1fr; gap:14px; padding:13px 0; border-bottom:1px solid var(--line); font-size:13.5px; }
.am-learn-rules code, .am-learn-editrow code { color:#e9bb66; font:10px var(--mono); }
.am-learn-rules small { display:block; margin-top:6px; color:var(--muted); font:10px/1.4 var(--mono); }
.am-learn-inherited-gap { margin:9px 0 !important; padding:10px 12px; border:1px solid rgba(233,187,102,.2); border-radius:9px; color:#e9bb66 !important; }
.am-learn-editor { margin-top:18px; padding-top:16px; border-top:1px solid var(--line); }
.am-learn-editor h4 { margin-bottom:10px; }
.am-learn-editrow { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:end; }
.am-learn-editrow .am-field { margin-top:8px; }
.am-learn-history { margin-top:20px; border-top:1px solid var(--line); padding-top:14px; color:var(--ink2); font-size:13px; }
.am-learn-history summary { cursor:pointer; min-height:36px; }
.am-learn-history > div { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-top:1px solid var(--line); }
.am-learn-history .am-ghost { min-height:36px; font-size:12px; }
.am-learn-choice,.am-learn-rounds { display:flex; gap:6px; flex-wrap:wrap; margin:8px 0 18px; }
.am-learn-choice button,.am-learn-rounds button { min-height:42px; padding:7px 14px; border:1px solid var(--line2); border-radius:999px; color:var(--ink2); background:transparent; font-size:13px; }
.am-learn-choice button.is-active,.am-learn-rounds button.is-active { color:#0a0a0a; background:var(--ink); border-color:var(--ink); }
.am-learn-preview { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:16px; }
.am-learn-preview > div { min-width:0; padding:13px 12px; border:1px solid var(--line); border-radius:12px; background:rgba(255,255,255,.02); }
.am-learn-preview span,.am-learn-preview small { display:block; color:var(--muted); font:10px var(--mono); }
.am-learn-preview strong { display:block; font-size:14px; font-weight:500; margin:5px 0 6px; }
.am-learn-candidates { display:grid; gap:10px; }
.am-learn-candidate { padding:17px; border:1px solid var(--line); border-radius:16px; background:rgba(255,255,255,.018); }
.am-learn-candidate-top { display:flex; align-items:start; justify-content:space-between; gap:12px; }
.am-learn-candidate-top .am-mono { color:var(--muted); font-size:9px; }
.am-learn-candidate h4 { font-size:19px; margin:2px 0 0; }
.am-learn-confidence { color:#e9bb66; font:23px var(--sans); white-space:nowrap; text-align:right; }
.am-learn-confidence small { display:block; color:var(--muted); font:10px var(--mono); text-transform:uppercase; }
.am-learn-verdict { display:flex; align-items:baseline; gap:12px; margin-top:13px; }
.am-learn-verdict strong { font-size:15px; white-space:nowrap; }
.am-learn-verdict span { color:var(--ink2); font-size:13px; }
.am-learn-cites { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; margin-top:12px; }
.am-learn-cites .am-mono { color:var(--muted); }
.am-learn-cites small { padding:4px 8px; border:1px solid var(--line); border-radius:8px; color:var(--ink2); font-size:11px; }
.am-learn-owner { padding-top:9px; border-top:1px solid var(--line); }
.am-learn-owner strong { color:#b9dfc4; }
.am-learn-owner button { margin-left:8px; padding:4px 0; color:#e9bb66; background:transparent; border:0; text-decoration:underline; }
.am-learn-reason { margin-top:14px; padding-top:4px; border-top:1px solid var(--line); }
.am-learn-reason .am-pill { margin-top:10px; }
.am-learn-proposal { border-color:rgba(233,187,102,.28); }
.am-learn-compare { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.am-learn-compare > div { padding:16px; border:1px solid var(--line); border-radius:14px; }
.am-learn-compare span,.am-learn-compare small { display:block; color:var(--muted); font-size:11px; }
.am-learn-compare strong { display:block; font-size:32px; font-weight:500; line-height:1.2; }
.am-learn-compare > div:last-child strong { color:#e9bb66; }
.am-learn-deltas { margin:12px 0; }
.am-learn-deltas p { padding:7px 0; border-bottom:1px solid var(--line); }
.am-learn-changes { list-style:none; margin:15px 0; padding:0; }
.am-learn-changes li { padding:11px 0; border-bottom:1px solid var(--line); font-size:13px; }
.am-learn-changes strong { color:#e9bb66; text-transform:uppercase; font:10px var(--mono); margin-right:10px; }
.am-learn-changes small { display:block; margin-top:5px; color:var(--muted); }
.am-learn-check { display:flex; align-items:center; gap:8px; font-size:13px; color:#ffc2c2; margin-top:14px; }
.am-learn-check input { width:20px; height:20px; }
.am-learn-xp { display:grid; gap:2px; padding:14px 0; margin:8px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.am-learn-xp strong { font-size:32px; font-weight:500; color:#e9bb66; }
.am-learn-xp span { color:var(--muted); font-size:12px; }
.am-learn-curve { display:grid; gap:12px; margin:20px 0; }
.am-learn-curve > div { display:grid; grid-template-columns:74px 1fr 42px; gap:8px; align-items:center; font:10px var(--mono); color:var(--muted); }
.am-learn-curve i { display:block; height:7px; background:#e9bb66; border-radius:99px; min-width:2px; }
.am-learn-curve strong { text-align:right; color:var(--ink2); font-weight:400; }
.am-learn-group { border-top:1px solid var(--line); padding-top:9px; }
.am-learn-side .am-field { margin-top:10px; }
@media (max-width:1050px) { .am-learn-grid { grid-template-columns:1fr; } .am-learn-side { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width:760px) { .am-learn-banner { display:block; padding:14px; } .am-learn-banner p { margin-top:8px; } .am-learn-side { grid-template-columns:1fr; } .am-learn-preview { grid-template-columns:repeat(2,minmax(0,1fr)); } .am-learn-rules li { grid-template-columns:1fr; gap:3px; } .am-learn-verdict { display:block; } .am-learn-verdict span { display:block; margin-top:4px; } .am-learn-running { flex-wrap:wrap; } .am-learn-running span:last-child { width:100%; margin-left:20px; } }
@media (prefers-reduced-motion:reduce) { .am-learn-pulse { animation:none; } }
`
