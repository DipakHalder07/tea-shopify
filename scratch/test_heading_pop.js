const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9605;

const child = spawn(chromePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,900',
  'about:blank'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await wait(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();
  let loadFired = false;

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Page.loadEventFired') {
      loadFired = true;
    }
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://127.0.0.1:9292/' });

  while (!loadFired) {
    await wait(50);
  }

  const outDir = 'c:\\Users\\Ayushman\\Downloads\\my-shopify-theme\\my-shopify-theme\\scratch';

  // The preloader runs for ~3.5 seconds
  // Let's sample every 200ms from 2500ms to 4500ms to capture the exact heading pop entrance!
  await wait(2400);

  for (let i = 0; i <= 8; i++) {
    const snap = await send('Page.captureScreenshot');
    if (snap && snap.data) {
      fs.writeFileSync(path.join(outDir, `heading_frame_${2400 + i * 250}ms.png`), Buffer.from(snap.data, 'base64'));
    }
    const state = await send('Runtime.evaluate', {
      expression: `(() => {
        const titleEl = document.getElementById('heroTitle');
        const chars = titleEl ? Array.from(titleEl.querySelectorAll('.char')) : [];
        const subtitle = document.querySelector('#heroSubtitle');
        return {
          loaderExists: !!document.getElementById('loader'),
          charsCount: chars.length,
          sampleChars: chars.slice(0, 3).map(c => ({
            text: c.textContent,
            transform: c.style.transform,
            opacity: window.getComputedStyle(c).opacity
          })),
          subtitle: subtitle ? { opacity: window.getComputedStyle(subtitle).opacity, transform: subtitle.style.transform } : null
        };
      })()`,
      returnByValue: true
    });
    console.log(`[${2400 + i * 250}ms]`, JSON.stringify(state.result.value));
    await wait(250);
  }

  child.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); child.kill(); process.exit(1); });
