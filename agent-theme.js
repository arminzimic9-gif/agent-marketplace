export const AGENT_CSS = `
.am-timeline { margin:18px 0; border:1px solid var(--line); border-radius:14px; padding:14px; background:rgba(255,255,255,.025); }
.am-timeline > span { font-size:11px; color:var(--ink2); }
.am-timeline ol { list-style:none; margin:12px 0 0; padding:0; display:grid; gap:8px; max-height:330px; overflow:auto; }
.am-timeline li { display:grid; grid-template-columns:minmax(95px,1fr) minmax(0,2fr) auto; gap:10px; align-items:start; border-left:2px solid var(--line2); padding:6px 0 6px 10px; font-size:12px; }
.am-timeline li.is-running { border-color:#ffd34d; }
.am-timeline li.is-completed { border-color:#79d8a3; }
.am-timeline li.is-rejected { border-color:#f08f84; }
.am-timeline li span { color:var(--ink2); }
.am-timeline li small { color:var(--muted); text-align:right; white-space:nowrap; }
.am-evidence-images { margin:20px 0; }
.am-evidence-images > div { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:10px; }
.am-evidence-images figure { margin:0; min-width:0; }
.am-evidence-images img { display:block; width:100%; border:1px solid var(--line2); border-radius:8px; }
.am-evidence-images figcaption { margin-top:5px; color:var(--muted); font:11px var(--mono); text-transform:uppercase; }
.am-diff pre { overflow:auto; max-height:340px; padding:12px; background:#101518; color:#c5edda; font:11px/1.5 var(--mono); }
@media (max-width:600px) { .am-timeline li { grid-template-columns:1fr auto; } .am-timeline li span { grid-column:1/-1; grid-row:2; } }
`
