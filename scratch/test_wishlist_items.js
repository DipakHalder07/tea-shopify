const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9526;
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
  await wait(3000);

  const targets = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json`, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) { child.kill(); return; }

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

  // Set wishlist item in localStorage
  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('shopify-wishlist', 'royal-tea');`
  });

  // Navigate to /pages/wishlist
  await send('Page.navigate', { url: 'http://127.0.0.1:9292/pages/wishlist' });
  await wait(4000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const table = document.querySelector('.dtx-table');
      const rows = document.querySelectorAll('.dtx-table tbody tr:not([style*="display: none"])');
      const items = Array.from(rows).map(r => ({
        id: r.id,
        title: r.querySelector('.product-name')?.textContent,
        price: r.querySelector('.product-price-cart')?.textContent,
        img: r.querySelector('.product-thumbnail-img img')?.src
      }));
      return {
        url: window.location.href,
        tableDisplay: table ? window.getComputedStyle(table).display : null,
        rowsFound: rows.length,
        items
      };
    })()`,
    returnByValue: true
  });

  console.log('Wishlist populated state:', JSON.stringify(evalRes.result.value, null, 2));

  const snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}/wishlist_populated_pages_wishlist.png`, Buffer.from(snap.data, 'base64'));
  console.log('Saved wishlist_populated_pages_wishlist.png');

  ws.close();
  child.kill();
}

run().catch(e => {
  console.error(e);
  child.kill();
});
