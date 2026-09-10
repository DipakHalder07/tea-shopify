const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9622;

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

  // Accept cookies to get it out of the way
  await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('ALLOW COOKIES'));
      if (b) b.click();
    })()`
  });
  await wait(300);

  // Take screenshot of collection page before clicking
  let s1 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/before_open.png', Buffer.from(s1.data, 'base64'));

  // Click the Filter and Sort summary button
  await send('Runtime.evaluate', {
    expression: `(() => {
      const summary = document.querySelector('.mobile-facets__open-wrapper');
      summary.click();
    })()`
  });

  await wait(600);

  let s2 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/after_open_600ms.png', Buffer.from(s2.data, 'base64'));

  // Inspect what is visible on the screen right now
  const inspectData = await send('Runtime.evaluate', {
    expression: `(() => {
      const drawer = document.querySelector('.mobile-facets__wrapper');
      const details = document.querySelector('.mobile-facets__disclosure');
      const inner = document.querySelector('.mobile-facets__inner');
      const closeBtn = document.querySelector('.mobile-facets__close');

      const innerRect = inner ? inner.getBoundingClientRect() : null;
      const innerCs = inner ? window.getComputedStyle(inner) : null;

      return {
        detailsOpen: details ? details.hasAttribute('open') : false,
        detailsClasses: details ? details.className : null,
        innerRect: innerRect ? { left: innerRect.left, top: innerRect.top, width: innerRect.width, height: innerRect.height } : null,
        innerTransform: innerCs ? innerCs.transform : null,
        innerBg: innerCs ? innerCs.backgroundColor : null,
        innerColor: innerCs ? innerCs.color : null,
        closeVisible: closeBtn ? window.getComputedStyle(closeBtn).display : null,
        closeOpacity: closeBtn ? window.getComputedStyle(closeBtn).opacity : null
      };
    })()`,
    returnByValue: true
  });

  console.log('INSPECT:', JSON.stringify(inspectData.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
