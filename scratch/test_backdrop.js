const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9634;

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
  let loadResolver;
  const loadPromise = new Promise(r => loadResolver = r);

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Page.loadEventFired') {
      if (loadResolver) loadResolver();
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
  await loadPromise;
  await wait(2000);

  // Backdrop click listener + CSS
  await send('Runtime.evaluate', {
    expression: `(() => {
      const form = document.getElementById('FacetFiltersFormMobile');
      if (form) {
        form.addEventListener('click', (e) => {
          if (e.target === form) {
            const summary = document.querySelector('.mobile-facets__open-wrapper');
            if (summary) summary.click();
          }
        });
      }
    })()`
  });

  // Open drawer
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });
  await wait(600);

  // Click on backdrop at coordinate (25, 200) (which is on the dark backdrop outside the 360px drawer)
  console.log('Clicking backdrop at (25, 200)...');
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: 25,
    y: 200,
    button: 'left',
    clickCount: 1
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: 25,
    y: 200,
    button: 'left',
    clickCount: 1
  });

  await wait(600);

  const checkClosed = await send('Runtime.evaluate', {
    expression: `(() => {
      const details = document.querySelector('.mobile-facets__disclosure');
      return { open: details.hasAttribute('open') };
    })()`,
    returnByValue: true
  });

  console.log('Is open after backdrop click?', checkClosed.result.value);

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
