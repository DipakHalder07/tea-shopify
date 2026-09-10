const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\EdgeCore\\152.0.4191.66\\msedge.exe';
const port = 9555;
const baseDir = 'C:\\Users\\Ayushman\\.gemini\\antigravity-ide\\brain\\459cb419-6c0f-46c2-a487-588639652388';

const child = spawn(edgePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1080',
  'http://127.0.0.1:9292/products/strong-tea'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await wait(3500);

  const targets = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) { console.log('No page target found'); child.kill(); return; }

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
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      cb(data.result);
    }
  };

  await new Promise((resolve) => { ws.onopen = resolve; });
  await send('Page.enable');
  await send('Runtime.enable');
  await wait(2000);

  // Dismiss cookie banner
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cookieBtn = document.querySelector('.cookie-banner button, [class*="cookie"] button');
      if (cookieBtn) cookieBtn.click();
      const cookieBanner = document.querySelector('#cookie-consent, [class*="cookie"]');
      if (cookieBanner) cookieBanner.style.display = 'none';
    })()`,
    returnByValue: true
  });

  await wait(1000);

  // 1. Zoom in on PDP card
  const pdpClip = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.main-product_info .product__media-list') || document.querySelector('.main-product_info .product__media-wrapper');
      if (card) {
        const rect = card.getBoundingClientRect();
        return {
          x: Math.max(0, rect.left + window.scrollX - 40),
          y: Math.max(0, rect.top + window.scrollY - 40),
          width: Math.min(1440, rect.width + 80),
          height: Math.min(1080, rect.height + 80)
        };
      }
      return null;
    })()`,
    returnByValue: true
  });

  const snapPDP = await send('Page.captureScreenshot', {
    format: 'png',
    clip: pdpClip.result.value ? { ...pdpClip.result.value, scale: 1 } : undefined,
    captureBeyondViewport: true
  });
  fs.writeFileSync(`${baseDir}/pdp_micro_dots.png`, Buffer.from(snapPDP.data, 'base64'));
  console.log('Saved pdp_micro_dots.png');

  // 2. Navigate to Homepage
  await send('Page.navigate', { url: 'http://127.0.0.1:9292' });
  await wait(3000);

  // Scroll to cards section
  const evalGrid = await send('Runtime.evaluate', {
    expression: `(() => {
      const sec = document.querySelector('.product-tab-wrapper') || document.querySelector('.card-wrapper')?.closest('section');
      const cards = Array.from(document.querySelectorAll('.product-tab-wrapper .card'));
      const imgs = cards.map(c => {
        const img = c.querySelector('.card__media img');
        return {
          imgFound: !!img,
          src: img ? img.src : null,
          complete: img ? img.complete : null,
          style: img ? img.getAttribute('style') : null,
          computedOpacity: img ? window.getComputedStyle(img).opacity : null,
          computedDisplay: img ? window.getComputedStyle(img).display : null,
          computedVisibility: img ? window.getComputedStyle(img).visibility : null,
          parentComputedZIndex: img ? window.getComputedStyle(img.parentElement).zIndex : null
        };
      });
      
      let clip = null;
      if (sec) {
        const rect = sec.getBoundingClientRect();
        clip = {
          x: Math.max(0, rect.left + window.scrollX),
          y: Math.max(0, rect.top + window.scrollY),
          width: Math.min(1440, rect.width),
          height: Math.min(800, rect.height)
        };
      }
      return { clip, imgs };
    })()`,
    returnByValue: true
  });
  console.log('Homepage card imgs:', JSON.stringify(evalGrid.result.value, null, 2));
  const clip = evalGrid.result.value.clip;

  await wait(1500);

  const snapGrid = await send('Page.captureScreenshot', {
    format: 'png',
    clip: clip ? { ...clip, scale: 1 } : undefined,
    captureBeyondViewport: true
  });
  fs.writeFileSync(`${baseDir}/grid_cards_micro_dots.png`, Buffer.from(snapGrid.data, 'base64'));
  console.log('Saved grid_cards_micro_dots.png');

  ws.close();
  child.kill();
}

run().catch(e => {
  console.error(e);
  child.kill();
});
