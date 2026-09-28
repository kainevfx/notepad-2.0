// Regenerates interactive-master-document.html from the .md files in this folder.
// Run: node build-master.mjs   (uses the marked copy in the Claudette repo)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire('/root/claudette-agentic-os/package.json');
const { marked } = require('marked');
const dir = dirname(fileURLToPath(import.meta.url));

const docs = [
  ['readme-master-plan.md', 'Master plan'],
  ['task-at-hand-summary.md', 'Task at hand'],
  ['questions-approvals-and-decisions.md', 'Decisions for Kaine'],
  ['sub-plan-breakdown-item-01.md', '01 Scaffold + parity'],
  ['sub-plan-breakdown-item-02.md', '02 Vertical tabs + groups'],
  ['sub-plan-breakdown-item-03.md', '03 Paper modes'],
  ['sub-plan-breakdown-item-04.md', '04 Markdown'],
  ['sub-plan-breakdown-item-05.md', '05 Save model'],
  ['sub-plan-breakdown-item-06.md', '06 Tray + Quick Note'],
  ['sub-plan-breakdown-item-07.md', '07 Windows integration'],
  ['current-and-existing-audit.md', 'Existing audit'],
  ['file-structure-logic-integration.md', 'File structure'],
  ['verification-feature-test.md', 'Verification'],
  ['kaine-action-items-to-complete.md', 'Kaine action items'],
  ['agent-suggested-improvements.md', 'Suggested improvements'],
  ['dossier-feature-development-memory-record.md', 'Dossier'],
];

const pages = docs.map(([file, title]) => ({
  file, title, html: marked.parse(readFileSync(join(dir, file), 'utf8')),
}));
const json = JSON.stringify(pages).replace(/</g, '\\u003c');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Notepad 2.0 plan</title>
<style>
:root{--bg:#1f1f1f;--panel:#272727;--line:#3a3a3a;--fg:#e6e6e6;--mut:#a0a0a0;--acc:#60a5fa}
*{box-sizing:border-box}body{margin:0;font:15px/1.6 "Segoe UI Variable","Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--fg);display:flex;height:100vh}
nav{width:250px;flex:none;background:var(--panel);border-right:1px solid var(--line);overflow:auto;padding:12px 8px}
nav h1{font-size:14px;margin:4px 8px 12px;color:var(--mut);font-weight:600}
nav button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--fg);padding:7px 10px;border-radius:6px;font:inherit;font-size:14px;cursor:pointer;border-left:3px solid transparent}
nav button:hover{background:#333}nav button.on{background:#333;border-left-color:var(--acc)}
main{flex:1;overflow:auto;padding:28px 40px 80px}article{max-width:900px}
.bar{display:flex;gap:8px;justify-content:space-between;align-items:center;max-width:900px;margin-bottom:8px;color:var(--mut);font-size:13px}
.bar button{background:#333;color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:5px 12px;cursor:pointer;font:inherit}
h1,h2,h3{line-height:1.25}h1{font-size:26px}h2{font-size:20px;margin-top:28px;border-bottom:1px solid var(--line);padding-bottom:4px}
a{color:var(--acc)}code{font-family:Consolas,monospace;background:#2e2e2e;padding:1px 5px;border-radius:4px;font-size:13px}
pre{background:#2a2a2a;border:1px solid var(--line);padding:12px;border-radius:8px;overflow:auto}pre code{background:none;padding:0}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:14px}th,td{border:1px solid var(--line);padding:6px 9px;text-align:left;vertical-align:top}th{background:#2c2c2c}
@media(max-width:760px){body{flex-direction:column}nav{width:auto;max-height:36vh}main{padding:18px}}
</style></head><body>
<nav><h1>Notepad 2.0 plan</h1><div id="nav"></div></nav>
<main><div class="bar"><span id="pos"></span><span><button id="prev">Prev</button> <button id="next">Next</button></span></div><article id="doc"></article></main>
<script>
var P=${json};var i=0;var nav=document.getElementById('nav');
P.forEach(function(p,k){var b=document.createElement('button');b.textContent=p.title;b.onclick=function(){show(k)};nav.appendChild(b)});
function show(k){i=Math.max(0,Math.min(P.length-1,k));document.getElementById('doc').innerHTML=P[i].html;
document.getElementById('pos').textContent=(i+1)+' / '+P.length+'  ·  '+P[i].file;
Array.prototype.forEach.call(nav.children,function(b,n){b.className=n===i?'on':''});document.querySelector('main').scrollTop=0}
document.getElementById('prev').onclick=function(){show(i-1)};document.getElementById('next').onclick=function(){show(i+1)};
document.addEventListener('keydown',function(e){if(e.key==='ArrowRight')show(i+1);if(e.key==='ArrowLeft')show(i-1)});
show(0);
</script></body></html>`;
writeFileSync(join(dir, 'interactive-master-document.html'), html);
console.log('wrote', pages.length, 'pages');
