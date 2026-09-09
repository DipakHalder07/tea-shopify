const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9348;
const outPath = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\brain\\1d3733de-0999-4f7a-b949-7a34875be1e5\\accordion_open_snap.png';

const child = spawn(edgePath, [
  '--headless',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1100',
  'http://127.0.0.1:9292/products/royal-tea'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await wait(2500);
  const targets = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${port}/json`, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const cbs = new Map();
  function send(m, p = {}) {
    return new Promise(res => {
      const i = id++;
      cbs.set(i, res);
      ws.send(JSON.stringify({ id: i, method: m, params: p }));
    });
  }
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && cbs.has(d.id)) {
      const cb = cbs.get(d.id);
      cbs.delete(d.id);
      cb(d.result);
    }
  };
  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await wait(3000);
  
  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const details = document.querySelector('.main-product-template details');
      if (details) details.open = true;
      const summaries = Array.from(document.querySelectorAll('details summary')).map(s => ({
        text: s.innerText.trim(),
        color: window.getComputedStyle(s).color
      }));
      const accordions = Array.from(document.querySelectorAll('.accordion__content')).map(c => ({
        text: c.innerText.trim().slice(0, 100),
        color: window.getComputedStyle(c).color,
        pColor: c.querySelector('p') ? window.getComputedStyle(c.querySelector('p')).color : 'none'
      }));
      return { summaries, accordions };
    })()`,
    returnByValue: true
  });
  console.log('Accordion info:', JSON.stringify(evalRes.result.value, null, 2));

  await send('Runtime.evaluate', {
    expression: `
      const cookies = document.querySelectorAll('.cookie-disclaimer, .cookie-bar, #shopify-section-cookie-banner, .dt-cookie-disclaimer');
      cookies.forEach(c => c.style.display = 'none');
      window.scrollBy(0, 700);
    `
  });
  await wait(500);

  const result = await send('Page.captureScreenshot', { format: 'png' });
  if (result && result.data) {
    fs.writeFileSync(outPath, Buffer.from(result.data, 'base64'));
    console.log('Saved snap to:', outPath);
  }

  ws.close();
  child.kill();
}
run().catch(e => { console.error(e); child.kill(); });
