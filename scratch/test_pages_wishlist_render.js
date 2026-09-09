const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9525;
const baseDir = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\brain\\1d3733de-0999-4f7a-b949-7a34875be1e5';

const child = spawn(edgePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1080',
  'http://127.0.0.1:9292/pages/wishlist'
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
  await wait(3000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const wishlistWrap = document.querySelector('.wishlist-page-wrapper');
      const wishlist404 = document.querySelector('#wishlist-404-container');
      const actual404 = document.querySelector('#actual-404-content');
      const title = document.querySelector('.wishlist-page-title');
      return {
        url: window.location.href,
        wishlistWrapDisplay: wishlistWrap ? window.getComputedStyle(wishlistWrap).display : null,
        wishlist404Display: wishlist404 ? window.getComputedStyle(wishlist404).display : null,
        actual404Display: actual404 ? window.getComputedStyle(actual404).display : null,
        title: title ? title.textContent : null,
        docTitle: document.title
      };
    })()`,
    returnByValue: true
  });

  console.log('Evaluated:', JSON.stringify(evalRes.result.value, null, 2));

  const snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}/wishlist_direct_pages_wishlist.png`, Buffer.from(snap.data, 'base64'));
  console.log('Saved wishlist_direct_pages_wishlist.png');

  ws.close();
  child.kill();
}

run().catch(e => {
  console.error(e);
  child.kill();
});
