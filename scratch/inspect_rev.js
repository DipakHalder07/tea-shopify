const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9548;

const child = spawn(chromePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,900',
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

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      callbacks.set(msgId, resolve);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      cb(msg.result);
    }
  };

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://127.0.0.1:9292/' });

  await wait(1000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      return Array.from(document.querySelectorAll('.pl-revealer')).map(r => ({
        cls: r.className,
        clipPath: window.getComputedStyle(r).clipPath,
        bg: window.getComputedStyle(r).backgroundColor,
        display: window.getComputedStyle(r).display,
        zIndex: window.getComputedStyle(r).zIndex,
        w: r.offsetWidth,
        h: r.offsetHeight
      }));
    })()`,
    returnByValue: true
  });

  console.log('REVEALERS at 1000ms:', JSON.stringify(res.result.value, null, 2));

  child.kill();
  process.exit(0);
}

run().catch(e => { console.error(e); child.kill(); process.exit(1); });
