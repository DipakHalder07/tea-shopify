const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9537;
const baseDir = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\brain\\1d3733de-0999-4f7a-b949-7a34875be1e5';

const child = spawn(edgePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1080',
  'http://127.0.0.1:9292'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await wait(4500);

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

  // Click quick buy button on first card
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.quick-add-btn, [id^="quick-add"] button, .card button[id*="quick"]');
      if (btn) btn.click();
    })()`
  });

  await wait(2500);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\quick_buy_with_product_bg.png`, Buffer.from(shot.data, 'base64'));
  console.log('Saved quick_buy_with_product_bg.png');

  ws.close();
  child.kill();
}

run().catch(err => {
  console.error(err);
  child.kill();
});
