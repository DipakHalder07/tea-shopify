const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9608;

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

  await send('Page.navigate', { url: 'http://127.0.0.1:9292/collections/all' });
  await wait(3500);

  // Click mobile filter button
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.mobile-facets__open-wrapper');
      if (btn) btn.click();
    })()`
  });

  await wait(800);

  const elementAtPoint = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.elementFromPoint(200, 200);
      const stack = [];
      let cur = el;
      while (cur) {
        stack.push({
          tag: cur.tagName,
          id: cur.id,
          cls: cur.className,
          zIndex: window.getComputedStyle(cur).zIndex,
          bg: window.getComputedStyle(cur).backgroundColor,
          opacity: window.getComputedStyle(cur).opacity
        });
        cur = cur.parentElement;
      }
      return {
        point: { tag: el ? el.tagName : null, cls: el ? el.className : null, id: el ? el.id : null },
        stack
      };
    })()`,
    returnByValue: true
  });

  console.log('Element at (200, 200):', JSON.stringify(elementAtPoint.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
