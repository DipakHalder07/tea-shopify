const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9629;

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
  await wait(1000);

  // Check what is at (300, 200) (inside the drawer)
  const pointInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.elementFromPoint(300, 200);
      const stack = [];
      let cur = el;
      while (cur) {
        const cs = window.getComputedStyle(cur);
        stack.push({
          tag: cur.tagName,
          id: cur.id,
          cls: cur.className,
          bg: cs.backgroundColor,
          opacity: cs.opacity,
          filter: cs.filter,
          backdropFilter: cs.backdropFilter
        });
        cur = cur.parentElement;
      }
      return { el: el ? el.tagName + '.' + el.className : null, stack };
    })()`,
    returnByValue: true
  });

  console.log('Point (300, 200):', JSON.stringify(pointInfo.result.value, null, 2));

  // Check opacity of mobile-facets__inner and its text color
  const innerInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const inner = document.querySelector('.mobile-facets__inner');
      const cs = window.getComputedStyle(inner);
      const heading = document.querySelector('.mobile-facets__heading');
      const headingCs = heading ? window.getComputedStyle(heading) : null;
      return {
        innerOpacity: cs.opacity,
        innerBg: cs.backgroundColor,
        headingColor: headingCs ? headingCs.color : null,
        headingOpacity: headingCs ? headingCs.opacity : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Inner info:', JSON.stringify(innerInfo.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
