const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9528;
const baseDir = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\brain\\1d3733de-0999-4f7a-b949-7a34875be1e5';

const child = spawn(edgePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1080',
  'http://127.0.0.1:9292/'
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

  // 1. Check header wishlist link
  const headerLink = await send('Runtime.evaluate', {
    expression: `(() => {
      const a = document.querySelector('.header__icon--wishlist');
      return a ? a.href : null;
    })()`,
    returnByValue: true
  });
  console.log('Header wishlist link href:', headerLink.result.value);

  // 2. Click the header wishlist link
  await send('Runtime.evaluate', {
    expression: `(() => {
      const a = document.querySelector('.header__icon--wishlist');
      if (a) a.click();
    })()`
  });
  await wait(4000);

  const afterClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const title = document.querySelector('.wishlist-page-title');
      const empty = document.querySelector('.dtx-grid-empty');
      return {
        href: window.location.href,
        pathname: window.location.pathname,
        title: title ? title.textContent : null,
        emptyVisible: empty ? window.getComputedStyle(empty).display !== 'none' : null
      };
    })()`,
    returnByValue: true
  });
  console.log('After header click:', JSON.stringify(afterClick.result.value, null, 2));

  // 3. Take screenshot of wishlist page
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}/wishlist_after_header_click.png`, Buffer.from(snap1.data, 'base64'));
  console.log('Saved wishlist_after_header_click.png');

  // 4. Test direct navigation to /pages/wishlist (and verify no 502 crash)
  await send('Page.navigate', { url: 'http://127.0.0.1:9292/pages/wishlist' });
  await wait(4000);

  const directNav = await send('Runtime.evaluate', {
    expression: `(() => {
      const title = document.querySelector('.wishlist-page-title');
      return {
        href: window.location.href,
        pathname: window.location.pathname,
        title: title ? title.textContent : null,
        documentTitle: document.title
      };
    })()`,
    returnByValue: true
  });
  console.log('After direct /pages/wishlist nav:', JSON.stringify(directNav.result.value, null, 2));

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}/wishlist_after_direct_nav.png`, Buffer.from(snap2.data, 'base64'));
  console.log('Saved wishlist_after_direct_nav.png');

  ws.close();
  child.kill();
}

run().catch(e => {
  console.error(e);
  child.kill();
});
