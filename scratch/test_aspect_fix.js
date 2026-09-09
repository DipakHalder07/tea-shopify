const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9545;
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

  const testFix = await send('Runtime.evaluate', {
    expression: `(() => {
      const cookieBanner = document.querySelector('.cookie-banner, #cookie-bar, [class*="cookie"]');
      if (cookieBanner) cookieBanner.style.display = 'none';

      const style = document.createElement('style');
      style.id = 'test-aspect-fix';
      style.innerHTML = \`
        .main-product_info.grid {
          align-items: flex-start !important;
        }
        .main-product_info .product__media-wrapper {
          align-self: flex-start !important;
          height: auto !important;
        }
        .main-product_info .product__media-gallery {
          align-self: flex-start !important;
          height: auto !important;
          position: sticky !important;
          top: 90px !important;
        }
        .main-product_info .pdp-gallery-viewer-wrap {
          height: auto !important;
          flex: 1 1 auto !important;
          position: relative !important;
        }
        .main-product_info .product__media-list {
          height: auto !important;
        }
        .main-product_info .product__media-item {
          height: auto !important;
          align-self: flex-start !important;
        }
        .main-product_info .product__media-item .product__media {
          aspect-ratio: 1 / 1 !important;
          height: auto !important;
          width: 100% !important;
          padding-top: 0 !important;
          position: relative !important;
        }
        .main-product_info .product__media-item .product__media img {
          position: absolute !important;
          inset: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
          padding: 24px !important;
          z-index: 3 !important;
        }
        .main-product_info .pdp-floating-botanicals {
          height: 100% !important;
          z-index: 45 !important;
        }
      \`;
      document.head.appendChild(style);

      const gallery = document.querySelector('.product__media-gallery');
      if (gallery) gallery.scrollIntoView({ behavior: 'instant', block: 'center' });

      const img = document.querySelector('.product__media-item.is-active img');
      const r = img ? img.getBoundingClientRect() : null;
      return {
        imgRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null
      };
    })()`,
    returnByValue: true
  });

  console.log('Image rect with aspect-ratio:', JSON.stringify(testFix.result.value, null, 2));

  await wait(1000);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\test_aspect_snap.png`, Buffer.from(shot.data, 'base64'));
  console.log('Saved test_aspect_snap.png');

  ws.close();
  child.kill();
}
run().catch(e => { console.error(e); child.kill(); });
