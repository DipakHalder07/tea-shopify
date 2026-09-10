const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9540;

const child = spawn(chromePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,900',
  'http://127.0.0.1:9292/'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await wait(3000);

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

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER EXCEPTION:', msg.params.exceptionDetails);
    }
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Runtime.enable');

  // Check state of elements
  const evalResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.getElementById('loader');
      const items = Array.from(document.querySelectorAll('.pl-item')).map(it => ({
        transform: it.style.transform,
        computedTransform: window.getComputedStyle(it).transform,
        zIndex: window.getComputedStyle(it).zIndex,
        display: window.getComputedStyle(it).display,
        visibility: window.getComputedStyle(it).visibility,
        opacity: window.getComputedStyle(it).opacity,
        rect: it.getBoundingClientRect()
      }));
      const revealers = Array.from(document.querySelectorAll('.pl-revealer')).map(r => ({
        className: r.className,
        clipPath: window.getComputedStyle(r).clipPath || window.getComputedStyle(r).webkitClipPath,
        zIndex: window.getComputedStyle(r).zIndex,
        bg: window.getComputedStyle(r).backgroundColor
      }));
      return { loaderExists: !!el, items, revealers };
    })()`,
    returnByValue: true
  });

  console.log('INITIAL STATE:', JSON.stringify(evalResult.result.value, null, 2));

  await wait(800);

  const evalResult2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const items = Array.from(document.querySelectorAll('.pl-item')).map(it => ({
        styleTransform: it.style.transform,
        computedTransform: window.getComputedStyle(it).transform,
        opacity: window.getComputedStyle(it).opacity,
        rect: it.getBoundingClientRect()
      }));
      return { items };
    })()`,
    returnByValue: true
  });

  console.log('AT 800ms STATE:', JSON.stringify(evalResult2.result.value, null, 2));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('scratch/loader_screenshot.png', Buffer.from(shot.data, 'base64'));
  console.log('Screenshot saved to scratch/loader_screenshot.png');

  ws.close();
  child.kill();
}

run().catch(err => {
  console.error(err);
  child.kill();
});
