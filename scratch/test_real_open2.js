const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9615;

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

  // Poll until loader is gone
  for (let i = 0; i < 40; i++) {
    await wait(300);
    const hasLoader = await send('Runtime.evaluate', {
      expression: `!!document.getElementById('loader')`,
      returnByValue: true
    });
    if (!hasLoader.result.value) {
      console.log(`Loader finished at step ${i}`);
      break;
    }
  }

  await wait(500);

  // Accept cookies
  await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('ALLOW COOKIES'));
      if (b) b.click();
    })()`
  });

  await wait(500);

  // Take screenshot of page before filter click
  const shotBefore = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/mobile_filter_before_click.png', Buffer.from(shotBefore.data, 'base64'));

  // Find and click filter button
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const summary = document.querySelector('.mobile-facets__open-wrapper') || document.querySelector('summary.mobile-facets__open-wrapper');
      if (!summary) return { found: false, html: document.body.innerHTML.slice(0, 500) };
      summary.click();
      return { found: true };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', clickRes.result.value);

  await wait(800);

  const shotAfter = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/mobile_filter_after_click.png', Buffer.from(shotAfter.data, 'base64'));

  const details = await send('Runtime.evaluate', {
    expression: `(() => {
      const disclosure = document.querySelector('.mobile-facets__disclosure');
      const inner = document.querySelector('.mobile-facets__inner');
      const form = document.querySelector('#FacetFiltersFormMobile');
      const closeBtn = document.querySelector('.mobile-facets__close');

      function dump(el) {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          id: el.id,
          class: el.className,
          rect: { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom, right: r.right },
          position: cs.position,
          zIndex: cs.zIndex,
          bg: cs.backgroundColor,
          color: cs.color,
          transform: cs.transform,
          display: cs.display,
          opacity: cs.opacity,
          visibility: cs.visibility
        };
      }

      return {
        disclosure: dump(disclosure),
        form: dump(form),
        inner: dump(inner),
        closeBtn: dump(closeBtn),
        headings: Array.from(document.querySelectorAll('.mobile-facets__heading, .mobile-facets__summary, .mobile-facets__sort, .mobile-facets__footer')).map(dump)
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
