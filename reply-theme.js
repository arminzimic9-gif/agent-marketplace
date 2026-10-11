export const REPLY_CSS = `
.am-reply { margin-top:26px; padding-top:22px; border-top:1px solid var(--line); }
.am-reply-head > .am-mono { color:#e9bb66; }
.am-reply-head h3 { margin:8px 0 6px; font-size:clamp(22px,2vw,28px); line-height:1.1; letter-spacing:-.03em; font-weight:500; }
.am-reply-head p { margin:0; max-width:56em; color:var(--ink2); font-size:13px; }
.am-reply-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:13px; }
.am-reply-actions .am-mono { line-height:1.4; }
.am-reply-notice { color:#b9dfc4; padding:9px 12px; border:1px solid rgba(143,205,165,.22); border-radius:10px; background:rgba(41,91,60,.17); font-size:13px; }
.am-reply-running { color:#e9bb66; font-size:13px; margin-top:16px; }
.am-reply-proposal { margin-top:20px; padding:20px; border:1px solid rgba(233,187,102,.28); border-radius:18px; background:linear-gradient(130deg,rgba(233,187,102,.07),rgba(233,187,102,.012)); }
.am-reply-proposal > .am-mono { color:#e9bb66; }
.am-reply-proposal h4 { margin:8px 0; font-size:21px; font-weight:500; line-height:1.3; letter-spacing:-.025em; }
.am-reply-proposal h4 em { color:#e9bb66; font-family:var(--sans); font-style:normal; }
.am-reply-proposal p { font-size:13px; color:var(--ink2); }
.am-reply-replay { margin-top:16px; padding:13px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
.am-reply-replay > span { color:var(--muted); font:10px var(--mono); text-transform:uppercase; }
.am-reply-replay > div { display:flex; gap:18px; flex-wrap:wrap; margin:12px 0; }
.am-reply-replay strong { font-size:17px; font-weight:500; }
.am-reply-replay strong:last-child { color:#e9bb66; }
.am-reply-replay p { margin:4px 0; overflow-wrap:anywhere; }
.am-reply-ack { display:flex; gap:8px; align-items:center; margin-top:12px; color:#ffc2c2; font-size:13px; }
.am-reply-ack input { width:20px; height:20px; }
.am-reply-book { margin-top:20px; padding-top:12px; border-top:1px solid var(--line); color:var(--ink2); font-size:13px; }
.am-reply-book summary { cursor:pointer; min-height:38px; }
.am-reply-book ul { margin:5px 0; padding-left:18px; }
.am-reply-book li { margin:5px 0; }
.am-reply-book code { color:#e9bb66; font:10px var(--mono); }
@media (max-width:760px) { .am-reply-proposal { padding:15px; } .am-reply-actions .am-pill, .am-reply-actions .am-ghost { width:100%; justify-content:center; } }
`
