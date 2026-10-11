export const EXPERIENCE_CSS = `
.am-exp-badge { display:inline-flex; width:max-content; max-width:100%; align-items:center; border:1px solid rgba(233,187,102,.38); border-radius:999px; padding:5px 10px; color:#e9bb66; background:rgba(233,187,102,.08); font:10px var(--mono); line-height:1.35; }
.am-exp-rules { list-style:none; margin:10px 0; padding:0; border-top:1px solid var(--line); }
.am-exp-rules li { display:grid; grid-template-columns:90px 1fr; gap:8px; padding:11px 0; border-bottom:1px solid var(--line); color:var(--ink2); font-size:13px; }
.am-exp-rules code { color:#e9bb66; font:10px var(--mono); }
.am-exp-rules small { display:block; margin-top:5px; color:var(--muted); font:10px var(--mono); }
.am-exp-sheet { margin:18px 0 0; padding:16px 0 0; border-top:1px solid var(--line); }
.am-exp-sheet > .am-mono { color:#e9bb66; }
.am-exp-sheet > p { color:var(--muted); font-size:12px; }
.am-exp-export { margin:20px 0; padding:14px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.am-exp-export > summary,.am-exp-inspect summary { cursor:pointer; min-height:44px; display:flex; align-items:center; color:#e9bb66; font-size:14px; }
.am-exp-export p,.am-exp-import p,.am-exp-inspect p { color:var(--ink2); font-size:13px; line-height:1.5; }
.am-exp-export .am-field { margin:14px 0; }
.am-exp-preview { display:grid; gap:10px; margin-top:18px; padding:16px; border:1px solid rgba(233,187,102,.27); border-radius:14px; background:rgba(233,187,102,.045); }
.am-exp-preview-head { display:flex; gap:8px; justify-content:space-between; flex-wrap:wrap; font-size:14px; }
.am-exp-preview-head span { color:#e9bb66; font:11px var(--mono); }
.am-exp-warning { color:#e9bb66 !important; }
.am-exp-json,.am-exp-inspect pre { width:100%; max-height:280px; min-height:180px; resize:vertical; overflow:auto; padding:12px; border:1px solid var(--line); border-radius:10px; color:var(--ink2); background:#080808; font:11px/1.5 var(--mono); white-space:pre; user-select:all; }
.am-exp-error { color:#ffc2c2 !important; }
.am-exp-import { min-width:0; margin-top:24px; padding:clamp(20px,2vw,28px); border-radius:22px; }
.am-exp-import > .am-mono { color:#e9bb66; }
.am-exp-import h3 { margin:8px 0; font-size:clamp(24px,2.5vw,34px); font-weight:500; letter-spacing:-.035em; }
.am-exp-import .am-field { margin:18px 0 8px; }
.am-exp-paste { min-height:160px; font:11px/1.5 var(--mono); }
.am-exp-file { display:inline-flex; align-items:center; min-height:44px; margin:0 8px 8px 0; color:var(--ink2); text-decoration:underline; cursor:pointer; }
.am-exp-file input { position:absolute; width:1px; height:1px; opacity:0; }
.am-exp-file:focus-within { outline:2px solid #e9bb66; outline-offset:4px; }
.am-exp-inspect { margin-top:20px; padding:18px; border:1px solid var(--line2); border-radius:14px; }
.am-exp-inspect h4 { margin:9px 0 3px; font-size:21px; font-weight:500; }
.am-exp-conflict { padding:12px; border:1px solid rgba(233,187,102,.3); border-radius:10px; color:#e9bb66; background:rgba(233,187,102,.06); font-size:13px; }
.am-exp-check { display:flex; gap:9px; align-items:start; margin:15px 0; color:var(--ink2); font-size:13px; line-height:1.4; }
.am-exp-check input { flex:none; width:20px; height:20px; }
@media(max-width:760px) { .am-exp-rules li { grid-template-columns:1fr; gap:3px; } .am-exp-inspect { padding:12px; } }
`
