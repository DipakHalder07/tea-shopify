const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9611;

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
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Page.navigate', { url: 'http://127.0.0.1:9292/collections/all' });
  await wait(3500);

  const summary = await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });

  await wait(600);

  const layoutInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const elements = [
        ['menu-drawer', document.querySelector('.mobile-facets__wrapper')],
        ['details', document.querySelector('.mobile-facets__disclosure')],
        ['facet-filters-form', document.querySelector('.mobile-facets__disclosure facet-filters-form')],
        ['expanded-view', document.querySelector('.facet-filters-form-expanded-view')],
        ['form.mobile-facets', document.querySelector('#FacetFiltersFormMobile')],
        ['inner', document.querySelector('.mobile-facets__inner')]
      ];

      return elements.map(([name, el]) => {
        if (!el) return { name, exists: false };
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          name,
          position: cs.position,
          left: cs.left,
          right: cs.right,
          top: cs.top,
          width: cs.width,
          transform: cs.transform,
          rect: { left: r.left, right: r.right, top: r.top, width: r.width, height: r.height }
        };
      });
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(layoutInfo.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
