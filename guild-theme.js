export const GUILD_CSS = `
.am-guild-page { min-height:80vh; padding:40px clamp(16px,3.4vw,48px) 100px; max-width:1480px; margin:auto; }
.am-guild-head { max-width:780px; margin-bottom:26px; }
.am-guild-head > .am-mono { color:#d6af62; }
.am-guild-head h1 { font-family:var(--serif); font-size:clamp(40px,4.2vw,58px); line-height:1; font-weight:400; letter-spacing:-.03em; margin:10px 0 12px; }
.am-guild-head h1 em { color:#f0cf8b; }
.am-guild-head p { color:var(--ink2); max-width:640px; margin:0; font-size:clamp(15px,1.2vw,17px); line-height:1.55; }
.am-guild-counters { display:flex; gap:10px; margin-top:16px; flex-wrap:wrap; }
.am-guild-counters span { display:inline-flex; align-items:center; gap:9px; padding:8px 14px; border:1px solid var(--line2); border-radius:999px; background:rgba(255,255,255,.03); color:#e3d3b2; font-size:11px; letter-spacing:.06em; text-transform:uppercase; }
.am-guild-counters i { width:8px; height:8px; background:#5a4d5a; box-shadow:0 0 0 2px #2a222b; }
.am-guild-counters i.is-work { background:#7bd88f; box-shadow:0 0 10px #7bd88f; }
.am-guild-counters i.is-wait { background:#ffcf69; box-shadow:0 0 10px #ffcf69; }

.am-guild-layout { display:grid; grid-template-columns:minmax(0,1fr); gap:24px; align-items:start; }
.am-guild-stage { min-width:0; }
.am-guild-layout.has-panel { grid-template-columns:minmax(0,1fr) 430px; }
.am-gq-scrim { display:none; }

/* ---------- the room ---------- */
.am-guild-room { position:relative; width:100%; height:740px; overflow:hidden; isolation:isolate; border:6px solid #3b2a2a; border-radius:6px;
  box-shadow:0 0 0 2px #b08a58 inset, 0 0 0 7px #17101a, 0 30px 60px -18px #000, 0 0 90px -30px #f0a95a55; background:#1d1620; image-rendering:pixelated; }
.am-guild-wall { position:absolute; inset:0 0 auto; height:84px; z-index:3; border-bottom:8px solid #0e0b15;
  background:
    linear-gradient(180deg,#00000040,transparent 40%,#00000055),
    repeating-linear-gradient(90deg,transparent 0 62px,#0000003a 62px 64px),
    repeating-linear-gradient(0deg,transparent 0 20px,#00000030 20px 22px),
    linear-gradient(90deg,#3c2b3a,#4a3340 50%,#3c2b3a);
  box-shadow:0 6px 0 #8a6849, 0 18px 30px #000a; }
.am-guild-title { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); text-align:center; padding:8px 22px 7px; border:3px solid #c89a5d; background:linear-gradient(#5a4048,#432f3a); box-shadow:4px 4px 0 #1b1019, 0 0 0 2px #17101a; white-space:nowrap; }
.am-guild-title span { display:block; color:#f6dba3; letter-spacing:.22em; font-size:12px; text-shadow:2px 2px #1b1019; }
.am-guild-title small { display:block; margin-top:3px; color:#c9a672; font-size:10px; letter-spacing:.12em; }
.am-guild-window { position:absolute; top:13px; width:34px; height:50px; border:4px solid #17101a; border-radius:17px 17px 2px 2px; outline:2px solid #9a7550;
  background:radial-gradient(circle at 3px 8px,#fff 0 1px,transparent 1.5px) 0 0/12px 14px, linear-gradient(#1a2152,#3c4486 70%,#5a5a95); }
.am-guild-window::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg,transparent 46%,#17101a 46% 54%,transparent 54%),linear-gradient(0deg,transparent 40%,#17101a 40% 47%,transparent 47%); }
.am-guild-window.is-a { left:17%; } .am-guild-window.is-b { left:27%; } .am-guild-window.is-c { right:27%; } .am-guild-window.is-d { right:17%; }
.am-guild-window.is-b { background:radial-gradient(circle at 22px 12px,#fff3c4 0 5px,transparent 6px), linear-gradient(#1a2152,#3c4486 70%,#5a5a95); }
.am-guild-banner { position:absolute; top:-2px; width:30px; height:64px; background:linear-gradient(#a53f4d,#7a2b3f); clip-path:polygon(0 0,100% 0,100% 100%,50% 82%,0 100%); box-shadow:inset 0 -14px 0 #0003; }
.am-guild-banner::after { content:'✦'; position:absolute; left:0; right:0; top:14px; text-align:center; color:#f6d36a; font-size:15px; text-shadow:0 0 6px #f6d36a99; }
.am-guild-banner.is-l { left:8%; } .am-guild-banner.is-r { right:8%; }
.am-guild-torch { position:absolute; top:22px; width:8px; height:26px; background:#4b3226; box-shadow:2px 2px 0 #140d12; }
.am-guild-torch::before { content:''; position:absolute; left:-4px; right:-4px; bottom:100%; height:16px; background:radial-gradient(ellipse at 50% 80%,#fff2b0 0 20%,#ffa13a 40%,#e0452f 75%,transparent 76%); border-radius:50% 50% 30% 30%; animation:am-guild-flame .5s steps(2,end) infinite alternate; }
.am-guild-torch::after { content:''; position:absolute; left:-70px; top:-70px; width:150px; height:150px; border-radius:50%; background:radial-gradient(circle,#ffb25a55,transparent 65%); animation:am-guild-flicker 2.4s ease-in-out infinite; }
.am-guild-torch.is-l { left:3.2%; } .am-guild-torch.is-r { right:3.2%; }

.am-guild-floor { position:absolute; inset:84px 0 0; z-index:0; overflow:hidden;
  background:
    linear-gradient(180deg,#0000007a,transparent 24%),
    repeating-conic-gradient(#3a2e37 0 25%,#42343b 0 50%) 0 0/56px 56px; }
.am-guild-floor::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 80% 70% at 50% 52%,transparent 30%,#0a06119c 100%); }
.am-guild-shaft { position:absolute; top:-10px; height:130%; width:62px; background:linear-gradient(180deg,#9aa6ff2e,transparent 85%); transform:skewX(-24deg); transform-origin:top; animation:am-guild-shaft 7s ease-in-out infinite alternate; }
.am-guild-shaft.is-a { left:19%; } .am-guild-shaft.is-b { right:27%; animation-delay:-3s; }
.am-guild-rug { position:absolute; z-index:1; left:50%; top:calc(51% + 42px); transform:translate(-50%,-50%); width:min(66%,560px); aspect-ratio:2.5/1; border-radius:50%; max-height:260px;
  background:radial-gradient(ellipse,#5d2733 0 38%,#7a3441 38% 52%,#5d2733 52% 60%,#c89a5d 60% 63%,#4a1f2b 63% 100%); box-shadow:0 0 0 4px #1b1019, 0 14px 0 #00000045; opacity:.9; }
.am-guild-hearth { position:absolute; z-index:1; top:calc(51% + 24px); left:50%; transform:translate(-50%,-50%); width:176px; height:96px; display:grid; place-items:center; border:8px solid #16101a; outline:4px solid #7a5642;
  background:repeating-linear-gradient(90deg,#4f3c43 0 16px,#664549 16px 32px); box-shadow:8px 9px 0 #150f19, 0 0 80px 18px #ff8f3a38; }
.am-guild-fire { width:58px; height:58px; background:radial-gradient(ellipse at 50% 75%,#fff0a8 0 14%,#ffa13a 30%,#e0452f 55%,transparent 56%); border-radius:50% 50% 40% 40%; filter:drop-shadow(0 0 10px #ff8a3a); animation:am-guild-flame .6s steps(2,end) infinite alternate; }
.am-guild-hearth i { position:absolute; bottom:70%; width:3px; height:3px; background:#ffd27a; box-shadow:0 0 6px #ffa13a; opacity:0; animation:am-guild-ember 3.6s linear infinite; }
.am-guild-hearth i:nth-of-type(1) { left:34%; } .am-guild-hearth i:nth-of-type(2) { left:46%; animation-delay:-1.1s; } .am-guild-hearth i:nth-of-type(3) { left:56%; animation-delay:-2s; } .am-guild-hearth i:nth-of-type(4) { left:64%; animation-delay:-2.8s; } .am-guild-hearth i:nth-of-type(5) { left:40%; animation-delay:-.5s; }
.am-guild-light { position:absolute; inset:0; z-index:7; pointer-events:none; background:radial-gradient(ellipse 60% 55% at 50% 56%,#ffb06a1c,transparent 70%), radial-gradient(ellipse 100% 100% at 50% 50%,transparent 55%,#05030b99 100%); animation:am-guild-flicker 3.6s ease-in-out infinite; }

/* ---------- rooms (stations) ---------- */
.am-guild-station { position:absolute; z-index:2; left:var(--sx); top:var(--sy); width:20%; min-width:132px; height:170px; transform:translate(-50%,-50%); padding:0; cursor:pointer; overflow:visible;
  border:4px solid #17101a; border-radius:4px; color:inherit; text-align:center;
  background:
    linear-gradient(180deg,transparent 0 44%,#0000004d 44% 47%,transparent 47%),
    repeating-linear-gradient(90deg,transparent 0 22px,#0000002e 22px 24px) 0 0/100% 44% no-repeat,
    linear-gradient(180deg,#5a4147 0 44%,#40303b 44% 100%);
  box-shadow:0 0 0 2px #7e6045, 7px 9px 0 #150f19, inset 0 -26px 30px -12px #00000070;
  transition:transform .35s cubic-bezier(.2,.8,.2,1), box-shadow .35s; }
.am-guild-station::before { content:''; position:absolute; inset:0; border-radius:2px; pointer-events:none; background:repeating-linear-gradient(0deg,transparent 0 18px,#00000026 18px 20px) 0 46%/100% 54% no-repeat; }
.am-guild-station:hover:not(:disabled) { transform:translate(-50%,-52%); box-shadow:0 0 0 2px var(--accent), 7px 13px 0 #150f19, 0 0 34px -4px var(--accent); }
.am-guild-station:focus-visible { outline:3px solid #fff; outline-offset:5px; }
.am-guild-station.is-selected { box-shadow:0 0 0 3px var(--accent), 7px 9px 0 #150f19, 0 0 42px -2px var(--accent); }
.am-guild-station.is-running, .am-guild-station.is-queued { box-shadow:0 0 0 2px var(--accent), 7px 9px 0 #150f19, 0 0 44px -6px var(--accent); }
.am-guild-sign { position:absolute; z-index:2; left:50%; top:-13px; transform:translateX(-50%); max-width:92%; padding:4px 10px; border:3px solid #17101a; background:linear-gradient(#6a4c3a,#4a3329); color:#f2d79b; font-size:10px; letter-spacing:.1em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-shadow:1px 1px #17101a; box-shadow:3px 3px 0 #150f19, inset 0 0 0 1px #c89a5d66; }
.am-guild-lamp { position:absolute; z-index:2; right:9px; top:12px; width:10px; height:10px; background:#5a4d5a; box-shadow:0 0 0 2px #17101a; }
.am-guild-station.is-running .am-guild-lamp, .am-guild-station.is-queued .am-guild-lamp { background:#7bd88f; box-shadow:0 0 0 2px #17101a, 0 0 12px 2px #7bd88f; animation:am-guild-pulse 1.2s ease-in-out infinite; }
.am-guild-station.is-waiting .am-guild-lamp { background:#ffcf69; box-shadow:0 0 0 2px #17101a, 0 0 12px 2px #ffcf69; animation:am-guild-blink 1.1s steps(2,end) infinite; }
.am-guild-mat { position:absolute; left:12%; right:12%; bottom:10px; height:30px; border-radius:50%; background:radial-gradient(ellipse,var(--accent) 0,transparent 0), repeating-radial-gradient(ellipse,#00000040 0 3px,transparent 3px 7px), #3a2631; border:3px solid #1b1019; box-shadow:0 0 0 2px #00000030; opacity:.85; }
.am-guild-station.is-running .am-guild-mat, .am-guild-station.is-queued .am-guild-mat { background:repeating-radial-gradient(ellipse,#0003 0 3px,transparent 3px 7px), color-mix(in srgb,var(--accent) 35%,#3a2631); }

.am-guild-prop { zoom:1.18; position:absolute; z-index:1; top:24px; left:50%; transform:translateX(-50%); width:84px; height:68px; }
.am-guild-prop i { position:absolute; display:block; }
/* library: shelves of books */
.is-books .am-guild-prop { border:4px solid #17101a; background:
  repeating-linear-gradient(90deg,#9a4f4f 0 6px,#d8b365 6px 9px,#4b5f9a 9px 16px,#5f9a64 16px 19px,#8a6bb0 19px 24px) 2px 4px/calc(100% - 4px) 16px no-repeat,
  repeating-linear-gradient(90deg,#4b5f9a 0 7px,#9a4f4f 7px 11px,#d8b365 11px 17px,#5f9a64 17px 21px) 2px 26px/calc(100% - 4px) 16px no-repeat, #5b3f2e; box-shadow:4px 5px 0 #150f19; }
.is-books .am-guild-prop i:nth-child(1) { left:-6px; right:-6px; top:20px; height:5px; background:#8a6340; border:2px solid #17101a; }
.is-books .am-guild-prop i:nth-child(2) { left:-6px; right:-6px; top:42px; height:5px; background:#8a6340; border:2px solid #17101a; }
.is-books .am-guild-prop i:nth-child(3) { right:6px; top:-12px; width:6px; height:10px; background:#ffd96e; box-shadow:0 0 10px 2px #ffd96e88; }
/* guardhouse: shield and sword */
.is-guard .am-guild-prop { width:60px; background:linear-gradient(90deg,#b8c4d2 50%,#8393a4 50%); clip-path:polygon(50% 0,100% 14%,100% 62%,50% 100%,0 62%,0 14%); height:70px; filter:drop-shadow(4px 5px 0 #150f19); }
.is-guard .am-guild-prop i:nth-child(1) { left:46%; top:8px; width:8%; height:50px; background:#e9d27a; }
.is-guard .am-guild-prop i:nth-child(2) { left:26%; top:22px; width:48%; height:8px; background:#e9d27a; }
.is-guard .am-guild-prop i:nth-child(3) { inset:3px; clip-path:polygon(50% 0,100% 14%,100% 62%,50% 100%,0 62%,0 14%); background:none; box-shadow:inset 0 0 0 3px #17101a88; }
/* studio: easel */
.is-easel .am-guild-prop { width:64px; border:4px solid #17101a; height:52px; background:linear-gradient(125deg,#f2c677 0 30%,#d6607a 30% 55%,#5f88b0 55% 80%,#58b09a 80%); box-shadow:4px 5px 0 #150f19; transform:translateX(-50%) skewX(-4deg); }
.is-easel .am-guild-prop i:nth-child(1) { left:8px; top:50px; width:5px; height:26px; background:#6a4a33; transform:rotate(10deg); border:1px solid #17101a; }
.is-easel .am-guild-prop i:nth-child(2) { right:8px; top:50px; width:5px; height:26px; background:#6a4a33; transform:rotate(-10deg); border:1px solid #17101a; }
.is-easel .am-guild-prop i:nth-child(3) { left:-18px; top:44px; width:12px; height:12px; border-radius:50%; background:#e07a95; box-shadow:12px 6px 0 #ffd96e, 26px -4px 0 #5f88b0; }
/* interview room: round table */
.is-interview .am-guild-prop { width:86px; height:52px; top:32px; border:4px solid #17101a; border-radius:50%; background:radial-gradient(ellipse,#d3ab78 0 50%,#8a6244 51%); box-shadow:4px 5px 0 #150f19; }
.is-interview .am-guild-prop i:nth-child(1) { left:-18px; top:10px; width:14px; height:26px; background:#7a3441; border:3px solid #17101a; border-radius:6px 6px 2px 2px; }
.is-interview .am-guild-prop i:nth-child(2) { right:-18px; top:10px; width:14px; height:26px; background:#7a3441; border:3px solid #17101a; border-radius:6px 6px 2px 2px; }
.is-interview .am-guild-prop i:nth-child(3) { left:50%; top:6px; width:10px; height:16px; margin-left:-5px; background:#fff2c6; border:2px solid #17101a; }
/* brief desk: scroll and papers */
.is-brief .am-guild-prop { width:86px; height:46px; top:36px; border:4px solid #17101a; background:linear-gradient(#a2745a,#7c5646); box-shadow:4px 5px 0 #150f19; }
.is-brief .am-guild-prop i:nth-child(1) { left:8px; top:-18px; width:30px; height:28px; background:repeating-linear-gradient(0deg,#f1dcb4 0 6px,#a98462 6px 7px); border:3px solid #17101a; transform:rotate(-6deg); }
.is-brief .am-guild-prop i:nth-child(2) { right:10px; top:-12px; width:24px; height:22px; background:repeating-linear-gradient(0deg,#e8d0a8 0 5px,#a98462 5px 6px); border:3px solid #17101a; transform:rotate(7deg); }
.is-brief .am-guild-prop i:nth-child(3) { left:42px; top:-8px; width:3px; height:18px; background:#d94f4f; transform:rotate(25deg); }
/* writing room: lectern with glowing star */
.is-launch .am-guild-prop { width:64px; height:44px; top:46px; border:4px solid #17101a; background:linear-gradient(#c19868,#8e6844); box-shadow:4px 5px 0 #150f19; }
.is-launch .am-guild-prop i:nth-child(1) { left:50%; top:-34px; margin-left:-16px; width:32px; height:32px; background:radial-gradient(circle,#fff6c2 0 20%,#f6d36a 21% 55%,transparent 56%); filter:drop-shadow(0 0 8px #f6d36a); animation:am-guild-pulse 2s ease-in-out infinite; clip-path:polygon(50% 0,62% 36%,100% 38%,70% 60%,80% 100%,50% 76%,20% 100%,30% 60%,0 38%,38% 36%); }
/* SEO radar: sweeping dish */
.is-seo .am-guild-prop { width:72px; height:72px; top:20px; border:4px solid #17101a; border-radius:50%; background:radial-gradient(circle,#17353a 0 18%,#1f4a4e 19% 40%,#17353a 41% 62%,#1f4a4e 63%); box-shadow:4px 5px 0 #150f19, 0 0 22px -2px #5fd0b488; overflow:hidden; }
.is-seo .am-guild-prop i:nth-child(1) { inset:0; background:conic-gradient(from 0deg,#5fd0b4cc,transparent 28%); animation:am-guild-sweep 3.2s linear infinite; }
.is-seo .am-guild-prop i:nth-child(2) { left:44px; top:16px; width:6px; height:6px; background:#bffbe8; box-shadow:0 0 6px #5fd0b4; }
.is-seo .am-guild-prop i:nth-child(3) { left:20px; top:42px; width:5px; height:5px; background:#bffbe8; box-shadow:0 0 6px #5fd0b4; }
/* triage bay: first-aid cabinet */
.is-triage .am-guild-prop { width:62px; height:64px; border:4px solid #17101a; background:linear-gradient(#ece0cc,#cdbba0); box-shadow:4px 5px 0 #150f19; }
.is-triage .am-guild-prop i:nth-child(1) { left:50%; top:50%; width:10px; height:34px; margin:-17px 0 0 -5px; background:#d04f55; }
.is-triage .am-guild-prop i:nth-child(2) { left:50%; top:50%; width:34px; height:10px; margin:-5px 0 0 -17px; background:#d04f55; }
.is-triage .am-guild-prop i:nth-child(3) { left:-10px; top:46px; width:14px; height:18px; background:#6aa8d8; border:3px solid #17101a; }

/* ---------- characters ---------- */
.am-guild-person { position:absolute; z-index:4; left:var(--px); top:var(--py); transform:translate(-50%,-50%); transition:left 1.25s steps(14,end),top 1.25s steps(14,end); pointer-events:none; }
.am-guild-person > * { pointer-events:auto; }
.am-guild-person.is-running, .am-guild-person.is-queued, .am-guild-person.is-waiting { z-index:6; }
.am-guild-character { position:relative; min-width:96px; padding:0; display:flex; flex-direction:column; align-items:center; border:0; background:transparent; color:#fff; cursor:pointer; text-align:center; }
.am-guild-drift { display:block; animation:am-guild-drift var(--dur) ease-in-out var(--d) infinite alternate; }
.am-guild-body { display:block; transform-origin:50% 100%; }
.am-guild-body.is-left { transform:scaleX(-1); }
.am-guild-person.is-walking .am-guild-drift { animation:am-guild-walk .32s steps(2,end) infinite; }
.am-guild-person.is-running .am-guild-drift, .am-guild-person.is-queued .am-guild-drift { animation:none; }
.am-guild-shadow { display:block; width:46px; height:10px; margin-top:-8px; border-radius:50%; background:radial-gradient(ellipse,#000b,transparent 70%); }
.am-guild-plate { margin-top:2px; font:600 10.5px/1.1 var(--mono); letter-spacing:.03em; white-space:nowrap; max-width:128px; overflow:hidden; text-overflow:ellipsis; background:#1b1520e6; padding:3px 7px; border:1px solid #b08a58; border-radius:2px; text-shadow:1px 1px #000; }
.am-guild-character:hover .am-guild-plate, .am-guild-person.is-selected .am-guild-plate { background:#f0cf8b; color:#1b1019; border-color:#fff2c4; text-shadow:none; }
.am-guild-person.is-selected .am-guild-shadow { background:radial-gradient(ellipse,#f0cf8bcc,transparent 70%); width:60px; }
.am-guild-character:hover .am-guild-body { filter:brightness(1.18); }
.am-guild-character:focus-visible, .am-guild-alert:focus-visible { outline:3px solid #fff; outline-offset:4px; }
.am-guild-bubble { position:absolute; z-index:3; bottom:calc(100% - 4px); left:50%; transform:translateX(-50%); width:max-content; max-width:min(170px,40vw); padding:7px 9px; border:3px solid #eee2c5; background:#17151e; color:#fff5dc; box-shadow:4px 4px 0 #131017; font:11px/1.35 var(--mono); overflow-wrap:anywhere; }
.am-guild-bubble::after { content:''; position:absolute; left:50%; top:100%; margin-left:-5px; border:5px solid transparent; border-top-color:#eee2c5; }
.am-guild-alert { position:absolute; z-index:6; right:10px; top:-22px; width:27px; height:30px; padding:0; border:3px solid #261822; background:#ffcf69; color:#23161a; font:900 19px/24px var(--mono); box-shadow:3px 3px 0 #171018; animation:am-guild-blink 1.15s steps(2,end) infinite; cursor:pointer; }
.am-guild-xp { position:absolute; bottom:90%; left:70%; color:#ffda6e; font-weight:700; text-shadow:2px 2px #281416; white-space:nowrap; animation:am-guild-rise 1.5s ease-out both; z-index:8; }

@keyframes am-guild-blink { 50% { opacity:.35; } }
@keyframes am-guild-rise { to { transform:translateY(-32px); opacity:0; } }
@keyframes am-guild-drift { from { transform:translateX(-7px); } to { transform:translateX(7px); } }
@keyframes am-guild-walk { 0% { transform:translateY(0); } 100% { transform:translateY(-5px); } }
@keyframes am-guild-flame { from { transform:scale(1) translateY(0); } to { transform:scale(.9,1.08) translateY(-1px); } }
@keyframes am-guild-flicker { 0%,100% { opacity:.85; } 40% { opacity:1; } 62% { opacity:.7; } }
@keyframes am-guild-shaft { from { opacity:.55; transform:skewX(-24deg) translateX(0); } to { opacity:1; transform:skewX(-24deg) translateX(18px); } }
@keyframes am-guild-ember { 0% { transform:translateY(0); opacity:0; } 15% { opacity:1; } 100% { transform:translateY(-70px) translateX(8px); opacity:0; } }
@keyframes am-guild-pulse { 50% { opacity:.55; } }
@keyframes am-guild-sweep { to { transform:rotate(360deg); } }

/* ---------- worklist ---------- */
.am-guild-footer { display:grid; grid-template-columns:minmax(210px,.5fr) 1fr; gap:28px; margin-top:30px; }
.am-guild-footer p { color:var(--muted); margin:9px 0 0; }
.am-guild-worklist { border-top:1px solid var(--line); }
.am-guild-worklist > div { display:flex; align-items:center; flex-wrap:wrap; gap:12px; padding:12px 0; border-bottom:1px solid var(--line); }
.am-guild-worklist > div > span:nth-of-type(2) { color:var(--muted); flex:1; min-width:130px; }
.am-guild-workdot { width:8px; height:8px; background:#7bd88f; box-shadow:0 0 10px #7bd88f; flex:none; }
.am-guild-worklist > .am-dim { display:block; padding-top:14px; }

/* ---------- send on quest panel ---------- */
.am-gq { position:sticky; top:76px; max-height:calc(100vh - 100px); overflow:auto; border-radius:18px; padding:18px 18px 20px; display:flex; flex-direction:column; gap:14px; animation:am-gq-in .35s cubic-bezier(.2,.8,.2,1) both; }
.am-gq-head { display:flex; align-items:center; gap:14px; }
.am-gq-head > div { flex:1; min-width:0; }
.am-gq-head h2 { margin:2px 0 0; font-family:var(--serif); font-weight:400; font-size:30px; line-height:1.05; letter-spacing:-.02em; }
.am-gq-head .am-mono { color:#d6af62; font-size:10.5px; letter-spacing:.08em; }
.am-gq-head small { display:block; color:var(--muted); margin-top:3px; }
.am-gq-live { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid #7bd88f55; border-radius:12px; background:#7bd88f12; }
.am-gq-live > div { flex:1; min-width:0; } .am-gq-live strong { display:block; font-size:14px; } .am-gq-live span:not(.am-guild-workdot) { display:block; color:var(--ink2); font-size:12.5px; overflow-wrap:anywhere; }
.am-gq-body { display:flex; flex-direction:column; gap:12px; }
.am-gq-body .am-quest-go { margin-top:2px; }
.am-gq-foot { display:flex; gap:8px; flex-wrap:wrap; border-top:1px solid var(--line); padding-top:14px; }
.am-gq-foot .am-ghost { min-height:38px; padding:0 14px; font-size:13px; }
@keyframes am-gq-in { from { opacity:0; transform:translateX(18px); } to { opacity:1; transform:none; } }

/* narrower than a docked panel: the panel becomes a bottom sheet */
@media (max-width:1180px) {
  .am-guild-layout.has-panel { grid-template-columns:minmax(0,1fr); }
  .am-gq-scrim { display:block; position:fixed; inset:0; z-index:40; border:0; background:rgba(0,0,0,.55); backdrop-filter:blur(3px); }
  .am-gq { position:fixed; z-index:41; left:0; right:0; bottom:0; top:auto; max-height:88vh; border-radius:22px 22px 0 0; padding-bottom:calc(20px + env(safe-area-inset-bottom)); background:#121012f2; animation:am-gq-up .35s cubic-bezier(.2,.8,.2,1) both; }
  @keyframes am-gq-up { from { transform:translateY(40px); opacity:0; } to { transform:none; opacity:1; } }
}

/* ---------- phone: two columns of rooms with a hallway ---------- */
@media (max-width:820px) {
  .am-guild-page { padding-top:46px; }
  .am-guild-head h1 { font-size:46px; }
  .am-guild-footer { grid-template-columns:1fr; }
  .am-guild-room.is-portrait { height:880px; border-width:5px; }
  .is-portrait .am-guild-wall { height:64px; }
  .is-portrait .am-guild-floor { inset-block-start:64px; }
  .is-portrait .am-guild-title { padding:6px 12px 5px; } .is-portrait .am-guild-title span { font-size:10px; letter-spacing:.14em; } .is-portrait .am-guild-title small { font-size:9px; }
  .is-portrait .am-guild-window { top:9px; width:24px; height:36px; border-width:3px; border-radius:12px 12px 2px 2px; }
  .is-portrait .am-guild-window.is-a { left:12%; } .is-portrait .am-guild-window.is-d { right:12%; } .is-portrait .am-guild-window.is-b, .is-portrait .am-guild-window.is-c { display:none; }
  .is-portrait .am-guild-banner { display:none; }
  .is-portrait .am-guild-torch { top:14px; } .is-portrait .am-guild-torch.is-l { left:4%; } .is-portrait .am-guild-torch.is-r { right:4%; }
  .is-portrait .am-guild-hearth { display:none; }
  .is-portrait .am-guild-rug { top:calc(50% + 32px); width:20%; height:86%; max-height:none; aspect-ratio:auto; border-radius:3px; background:repeating-linear-gradient(0deg,#5d2733 0 26px,#6e2f3c 26px 28px); box-shadow:0 0 0 3px #c89a5d55, 0 0 0 6px #1b1019; }
  .is-portrait .am-guild-shaft { display:none; }
  .is-portrait .am-guild-station { width:38%; min-width:0; height:158px; }
  .is-portrait .am-guild-prop { zoom:.9; }
  .is-portrait .am-guild-sign { font-size:9px; padding:3px 7px; }
  .is-portrait .am-guild-plate { font-size:9.5px; max-width:108px; padding:2px 5px; }
  .is-portrait .am-guild-character { min-width:72px; }
  .is-portrait .am-guild-bubble { max-width:132px; font-size:10px; padding:5px 7px; }
  .is-portrait .am-guild-drift { animation-name:am-guild-drift-s; }
  .is-portrait .am-guild-person.is-walking .am-guild-drift { animation-name:am-guild-walk; }
  .is-portrait .am-guild-person.is-running .am-guild-drift, .is-portrait .am-guild-person.is-queued .am-guild-drift { animation:none; }
  @keyframes am-guild-drift-s { from { transform:translateX(-3px); } to { transform:translateX(3px); } }
  .am-gq { max-height:90vh; padding:16px 14px 20px; }
}
@media (prefers-reduced-motion:reduce) {
  .am-guild-person { transition:none; }
  .am-guild-drift, .am-guild-person .am-guild-drift, .am-guild-alert, .am-guild-xp, .am-guild-shaft, .am-guild-light, .am-guild-torch::before, .am-guild-torch::after, .am-guild-fire, .am-guild-hearth i, .am-guild-lamp, .am-guild-prop i, .am-gq { animation:none !important; }
  .am-guild-xp { transform:translateY(-16px); }
  .am-guild-hearth i { display:none; }
}
`
