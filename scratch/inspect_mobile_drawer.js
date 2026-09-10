const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9606;

const child = spawn(chromePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=400,850',
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
  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  function send(method, params = {}) {
    return new Promise(resolve => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  console.log('Navigating to /collections/all...');
  await send('Page.navigate', { url: 'http://127.0.0.1:9292/collections/all' });
  await wait(3500);

  // Take screenshot before click
  const ss1 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/mobile_coll_before.png', Buffer.from(ss1.data, 'base64'));

  // Click mobile filter button
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.mobile-facets__open-wrapper') || document.querySelector('.mobile-facets__open') || document.querySelector('menu-drawer summary');
      if (btn) {
        btn.click();
        return { clicked: true, tag: btn.tagName, class: btn.className };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', clickRes.result.value);

  await wait(800);

  // Inspect drawer
  const inspectRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const inner = document.querySelector('.mobile-facets__inner');
      const drawer = document.querySelector('.mobile-facets__wrapper');
      const details = document.querySelector('.mobile-facets__disclosure');
      if (!inner) return { error: 'No inner found' };
      const cs = window.getComputedStyle(inner);
      return {
        isOpen: details ? details.hasAttribute('open') : false,
        menuOpening: drawer ? drawer.classList.contains('menu-opening') : false,
        bg: cs.backgroundColor,
        color: cs.color,
        transform: cs.transform,
        opacity: cs.opacity,
        visibility: cs.visibility,
        zIndex: cs.zIndex,
        rect: inner.getBoundingClientRect(),
        html: inner.outerHTML.slice(0, 1000)
      };
    })()`,
    returnByValue: true
  });
  console.log('Drawer inspect:', inspectRes.result.value);

  const ss2 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/mobile_coll_open.png', Buffer.from(ss2.data, 'base64'));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
