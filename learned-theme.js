export const LEARNED_CSS = `
.am-learned { display:grid; gap:10px; margin:18px 0; padding:16px 18px; border:1px solid rgba(233,187,102,.3); border-radius:16px; background:rgba(233,187,102,.045); }
.am-learned-head { display:flex; gap:10px; justify-content:space-between; align-items:baseline; flex-wrap:wrap; }
.am-learned-head > .am-mono { color:#e9bb66; }
.am-learned h4 { margin:0; font-size:18px; font-weight:500; letter-spacing:-.02em; }
.am-learned-sum { margin:0; color:var(--ink2); font-size:13px; line-height:1.5; }
.am-learned-sum b { color:var(--ink); font-weight:500; }
.am-learned-list { list-style:none; margin:0; padding:0; display:grid; gap:8px; }
.am-learned-list li { display:grid; grid-template-columns:96px 1fr; gap:10px; padding-top:8px; border-top:1px solid var(--line); font-size:13px; line-height:1.45; color:var(--ink2); }
.am-learned-kind { align-self:start; width:max-content; max-width:100%; padding:3px 8px; border-radius:999px; border:1px solid var(--line2); font:10px var(--mono); color:var(--muted); }
.am-learned-kind.is-added,.am-learned-kind.is-changed,.am-learned-kind.is-removed { border-color:rgba(233,187,102,.5); color:#e9bb66; }
.am-learned-list small { display:block; margin-top:3px; color:var(--muted); font-size:12px; }
.am-learned-foot { display:flex; gap:6px 14px; flex-wrap:wrap; color:var(--muted); font:11px var(--mono); }
.am-learned-foot a { color:#e9bb66; }
.am-learned-sync.is-error { color:#ffc2c2; }
.am-kn { display:grid; gap:18px; max-width:880px; }
.am-kn-card { padding:clamp(18px,2vw,26px); border-radius:22px; display:grid; gap:12px; }
.am-kn-card > .am-mono { color:#e9bb66; }
.am-kn-card h3 { margin:0; font-size:clamp(22px,2.4vw,30px); font-weight:500; letter-spacing:-.03em; }
.am-kn-card p { margin:0; color:var(--ink2); font-size:13px; line-height:1.55; }
.am-kn-toggle { display:flex; gap:12px; align-items:center; min-height:44px; cursor:pointer; font-size:14px; }
.am-kn-toggle input { width:22px; height:22px; flex:none; }
.am-kn-state { display:flex; gap:8px; flex-wrap:wrap; }
.am-kn-chip { padding:5px 10px; border-radius:999px; border:1px solid var(--line2); font:11px var(--mono); color:var(--ink2); }
.am-kn-chip.is-ok { border-color:rgba(233,187,102,.5); color:#e9bb66; }
.am-kn-chip.is-bad { border-color:rgba(255,150,150,.45); color:#ffc2c2; }
.am-kn-agents { list-style:none; margin:0; padding:0; border-top:1px solid var(--line); }
.am-kn-agents li { display:grid; grid-template-columns:minmax(120px,1fr) 2fr; gap:6px 14px; padding:11px 0; border-bottom:1px solid var(--line); font-size:13px; color:var(--ink2); }
.am-kn-agents small { display:block; color:var(--muted); font:11px var(--mono); margin-top:2px; }
.am-kn-agents a { color:#e9bb66; }
.am-kn-actions { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
.am-kn-steps { border-top:1px solid var(--line); padding-top:12px; }
.am-kn-steps summary { cursor:pointer; font:12px var(--mono); letter-spacing:.06em; text-transform:uppercase; color:#e9bb66; min-height:32px; display:flex; align-items:center; }
.am-kn-steps ol { margin:10px 0 14px; padding-left:20px; display:grid; gap:8px; color:var(--ink2); font-size:13px; line-height:1.55; }
.am-kn-steps a { color:#e9bb66; }
.am-kn-steps code, .am-kn-card code { font:12px var(--mono); }
.am-kn-form { display:grid; gap:12px; max-width:560px; }
.am-kn-form label { display:grid; gap:6px; font:11px var(--mono); letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
.am-kn-form input { min-height:44px; padding:0 14px; border-radius:12px; border:1px solid var(--line2); background:rgba(255,255,255,.04); color:var(--ink); font:14px var(--mono); }
.am-kn-form small { color:var(--muted); font-size:12px; line-height:1.5; }
.am-kn-pick { display:flex; gap:8px; flex-wrap:wrap; }
@media(max-width:760px) { .am-learned-list li { grid-template-columns:1fr; gap:4px; } .am-kn-agents li { grid-template-columns:1fr; } }
`
