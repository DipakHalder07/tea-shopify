const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9534;
const baseDir = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\brain\\1d3733de-0999-4f7a-b949-7a34875be1e5';

const child = spawn(edgePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1080',
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

  // Dismiss cookie banner and scroll to product
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Hide cookie banner
      const cookieBanner = document.querySelector('.cookie-banner, #cookie-bar, [class*="cookie"]');
      if (cookieBanner) cookieBanner.style.display = 'none';

      // Scroll gallery into view with comfortable breathing room
      const gallery = document.querySelector('.product__media-gallery');
      if (gallery) {
        gallery.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    })()`
  });

  await wait(1000);

  // Capture clean view
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_botanicals_full_clean.png`, Buffer.from(shot1.data, 'base64'));
  console.log('Saved pdp_botanicals_full_clean.png');

  // Now switch to slide 2 (the large jar)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const mg = document.querySelector('media-gallery');
      const thumbs = document.querySelectorAll('[data-target]');
      if (mg && thumbs.length > 1) {
        const targetId = thumbs[1].getAttribute('data-target');
        mg.setActiveMedia(targetId, false);
      }
    })()`
  });

  await wait(1000);

  // Capture slide 2
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_botanicals_slide2_full.png`, Buffer.from(shot2.data, 'base64'));
  console.log('Saved pdp_botanicals_slide2_full.png');

  ws.close();
  child.kill();
}

run().catch(err => {
  console.error(err);
  child.kill();
});
