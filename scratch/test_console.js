const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9610;

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
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('EXCEPTION THROWN:', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception.description);
    }
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
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Page.navigate', { url: 'http://127.0.0.1:9292/collections/all' });
  await wait(3500);

  const eval1 = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        const topBar = document.getElementById('shopify-section-top-bar');
        const menuDrawer = document.getElementById('menu-drawer');
        console.log('topBar:', topBar ? 'exists' : 'null', 'menuDrawer:', menuDrawer ? 'exists' : 'null');
        
        const summary = document.querySelector('.mobile-facets__open-wrapper');
        summary.click();
      } catch (e) {
        console.log('Error caught:', e.message);
      }
    })()`
  });

  await wait(500);

  const eval2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const disclosure = document.querySelector('.mobile-facets__disclosure');
      const inner = document.querySelector('.mobile-facets__inner');
      const rect = inner ? inner.getBoundingClientRect() : null;
      return {
        open: disclosure ? disclosure.hasAttribute('open') : false,
        className: disclosure ? disclosure.className : '',
        rect: rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null
      };
    })()`,
    returnByValue: true
  });

  console.log('RESULT:', eval2.result.value);

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
