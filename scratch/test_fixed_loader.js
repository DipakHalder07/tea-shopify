const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9550;

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

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
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

  const outDir = 'c:\\Users\\Ayushman\\Downloads\\my-shopify-theme\\my-shopify-theme\\scratch';
  
  for (let i = 0; i <= 14; i++) {
    await wait(250);
    const snap = await send('Page.captureScreenshot');
    if (snap && snap.data) {
      fs.writeFileSync(path.join(outDir, `fixed_frame_${i * 250}ms.png`), Buffer.from(snap.data, 'base64'));
    }
    const state = await send('Runtime.evaluate', {
      expression: `(() => {
        const items = Array.from(document.querySelectorAll('.pl-item')).map(it => ({
          transform: it.style.transform,
          rect: it.getBoundingClientRect(),
          opacity: window.getComputedStyle(it).opacity,
          display: window.getComputedStyle(it).display,
          imgTransform: it.querySelector('img') ? it.querySelector('img').style.transform : ''
        }));
        const logo = document.querySelector('.pl-logo');
        const lastRev = document.querySelector('.pl-revealer.pl-last');
        return {
          loader: !!document.getElementById('loader'),
          itemsCount: items.length,
          lastRevClip: lastRev ? lastRev.style.clipPath : null,
          items: items.slice(0, 2),
          logo: logo ? { transform: logo.style.transform, opacity: window.getComputedStyle(logo).opacity } : null
        };
      })()`,
      returnByValue: true
    });
    console.log(`[${i * 250}ms]`, JSON.stringify(state.result.value));
  }

  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  child.kill();
  process.exit(1);
});
