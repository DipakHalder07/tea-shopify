const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9536;
const baseDir = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\brain\\1d3733de-0999-4f7a-b949-7a34875be1e5';

const child = spawn(edgePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=390,844',
  'http://127.0.0.1:9292/products/premium-darjeeling-tea'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await wait(4000);

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

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Runtime.evaluate', {
    expression: `(() => {
      const cookieBanner = document.querySelector('.cookie-banner, #cookie-bar, [class*="cookie"]');
      if (cookieBanner) cookieBanner.style.display = 'none';
      const gallery = document.querySelector('.product__media-gallery');
      if (gallery) gallery.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`
  });

  await wait(1000);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_mobile_clean.png`, Buffer.from(shot.data, 'base64'));
  console.log('Saved pdp_mobile_clean.png');

  ws.close();
  child.kill();
}

run().catch(err => {
  console.error(err);
  child.kill();
});
