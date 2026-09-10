const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9613;

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

  // Directly open the drawer by adding class and attribute to see exact layout
  await send('Runtime.evaluate', {
    expression: `(() => {
      const details = document.querySelector('.mobile-facets__disclosure');
      const drawer = document.querySelector('.mobile-facets__wrapper');
      details.setAttribute('open', '');
      details.classList.add('menu-opening');
      if (drawer) drawer.classList.add('menu-opening');
    })()`
  });

  await wait(500);

  const ss = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/mobile_facets_forced_open.png', Buffer.from(ss.data, 'base64'));

  // Get full computed styles of every visible text element in mobile-facets
  const details = await send('Runtime.evaluate', {
    expression: `(() => {
      const form = document.querySelector('.mobile-facets');
      const inner = document.querySelector('.mobile-facets__inner');
      const header = document.querySelector('.mobile-facets__header');
      const footer = document.querySelector('.mobile-facets__footer');
      const close = document.querySelector('.mobile-facets__close');

      function info(el) {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          cls: el.className,
          rect: { top: r.top, left: r.left, width: r.width, height: r.height },
          bg: cs.backgroundColor,
          color: cs.color,
          fontSize: cs.fontSize,
          display: cs.display,
          opacity: cs.opacity,
          transform: cs.transform,
          zIndex: cs.zIndex
        };
      }

      const summaries = Array.from(document.querySelectorAll('.mobile-facets__summary')).map(s => ({
        text: s.innerText,
        info: info(s)
      }));

      return {
        form: info(form),
        inner: info(inner),
        header: info(header),
        footer: info(footer),
        close: info(close),
        summaries
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(details.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
