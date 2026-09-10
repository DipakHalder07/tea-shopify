const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9625;

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

  // Click summary
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });

  await wait(1500);

  const data = await send('Runtime.evaluate', {
    expression: `(() => {
      function g(selector) {
        const el = document.querySelector(selector);
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          selector,
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          bottom: r.bottom,
          bg: cs.backgroundColor,
          color: cs.color,
          zIndex: cs.zIndex,
          position: cs.position,
          display: cs.display,
          opacity: cs.opacity,
          visibility: cs.visibility
        };
      }

      const elements = [
        '#shopify-section-header',
        '.header-wrapper',
        '.mobile-facets',
        '.mobile-facets__inner',
        '.mobile-facets__header',
        '.mobile-facets__heading',
        '.mobile-facets__close',
        '.mobile-facets__close-button',
        '.mobile-facets__main',
        '.mobile-facets__summary',
        '.mobile-facets__sort',
        '.mobile-facets__footer',
        '.mobile-facets__footer .button--primary'
      ];

      return elements.map(g);
    })()`,
    returnByValue: true
  });

  console.log('MEASUREMENTS:\n', JSON.stringify(data.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
