const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9623;

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
  await wait(3000);

  await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('ALLOW COOKIES'));
      if (b) b.click();
    })()`
  });
  await wait(300);

  // Click summary
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });

  // Wait 1500ms for 1s transition to completely finish
  await wait(1500);

  let s2 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/after_settled_1500ms.png', Buffer.from(s2.data, 'base64'));

  // Inspect header z-index, inner rect, close button rect
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const headerSection = document.querySelector('.header-wrapper') || document.querySelector('header');
      const headerCs = headerSection ? window.getComputedStyle(headerSection) : null;

      const inner = document.querySelector('.mobile-facets__inner');
      const innerRect = inner ? inner.getBoundingClientRect() : null;

      const drawerHeader = document.querySelector('.mobile-facets__header');
      const drawerHeaderRect = drawerHeader ? drawerHeader.getBoundingClientRect() : null;

      const closeBtn = document.querySelector('.mobile-facets__close');
      const closeBtnRect = closeBtn ? closeBtn.getBoundingClientRect() : null;

      const footer = document.querySelector('.mobile-facets__footer');
      const footerRect = footer ? footer.getBoundingClientRect() : null;
      const footerCs = footer ? window.getComputedStyle(footer) : null;

      const sortLabel = document.querySelector('.mobile-facets__sort label');
      const sortSelect = document.querySelector('.mobile-facets__sort select');

      return {
        headerZIndex: headerCs ? headerCs.zIndex : null,
        innerRect,
        drawerHeaderRect,
        closeBtnRect,
        footerRect,
        footerBg: footerCs ? footerCs.backgroundColor : null,
        sortLabelColor: sortLabel ? window.getComputedStyle(sortLabel).color : null,
        sortSelectBg: sortSelect ? window.getComputedStyle(sortSelect).backgroundColor : null,
        sortSelectColor: sortSelect ? window.getComputedStyle(sortSelect).color : null
      };
    })()`,
    returnByValue: true
  });

  console.log('SETTLED INSPECT:', JSON.stringify(res.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
