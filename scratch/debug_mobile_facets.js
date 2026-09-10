const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9607;

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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Page.navigate', { url: 'http://127.0.0.1:9292/collections/all' });
  await wait(3500);

  // Click mobile filter button
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('.mobile-facets__open-wrapper');
      if (btn) btn.click();
    })()`
  });

  await wait(1000);

  const debug = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('.mobile-facets__inner');
      if (!el) return 'No inner';
      
      const elements = el.querySelectorAll('*');
      const sample = [];
      for (const item of elements) {
        if (item.children.length === 0 && item.textContent.trim()) {
          const cs = window.getComputedStyle(item);
          sample.push({
            tag: item.tagName,
            cls: item.className,
            text: item.textContent.trim(),
            color: cs.color,
            fontSize: cs.fontSize,
            bg: cs.backgroundColor,
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity
          });
        }
      }

      const csInner = window.getComputedStyle(el);
      const header = el.querySelector('.mobile-facets__header');
      const footer = el.querySelector('.mobile-facets__footer');
      const closeBtn = document.querySelector('.mobile-facets__close');

      return {
        innerBg: csInner.backgroundColor,
        innerColor: csInner.color,
        headerBg: header ? window.getComputedStyle(header).backgroundColor : null,
        footerBg: footer ? window.getComputedStyle(footer).backgroundColor : null,
        closeBtnVisible: closeBtn ? window.getComputedStyle(closeBtn).display : null,
        closeBtnColor: closeBtn ? window.getComputedStyle(closeBtn).color : null,
        sample: sample.slice(0, 20)
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(debug.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
