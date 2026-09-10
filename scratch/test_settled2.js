const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9624;

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
  console.log('Page loadEventFired!');
  await wait(2000);

  // Accept cookies
  await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('ALLOW COOKIES'));
      if (b) b.click();
    })()`
  });
  await wait(500);

  // Click summary
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });

  // Wait 1.5s for transition
  await wait(1500);

  let s = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/filter_drawer_settled.png', Buffer.from(s.data, 'base64'));

  const data = await send('Runtime.evaluate', {
    expression: `(() => {
      const inner = document.querySelector('.mobile-facets__inner');
      const header = document.querySelector('.mobile-facets__header');
      const closeBtn = document.querySelector('.mobile-facets__close');
      const details = document.querySelector('.mobile-facets__disclosure');
      return {
        open: details ? details.hasAttribute('open') : false,
        cls: details ? details.className : '',
        innerRect: inner ? inner.getBoundingClientRect() : null,
        headerRect: header ? header.getBoundingClientRect() : null,
        closeRect: closeBtn ? closeBtn.getBoundingClientRect() : null,
        innerTransform: inner ? window.getComputedStyle(inner).transform : null
      };
    })()`,
    returnByValue: true
  });

  console.log('DATA:', JSON.stringify(data.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
