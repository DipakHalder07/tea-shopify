const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9618;

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
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('PAGE LOG:', msg.params.args.map(a => a.value || a.description).join(' '));
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

  for (let i = 0; i < 40; i++) {
    await wait(300);
    const hasLoader = await send('Runtime.evaluate', {
      expression: `!!document.getElementById('loader')`,
      returnByValue: true
    });
    if (!hasLoader.result.value) break;
  }
  await wait(500);

  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const md = document.querySelector('menu-drawer');
      const details = md.querySelector('details');
      const summary = md.querySelector('summary');

      // Check constructor
      console.log('customElements.get("menu-drawer"):', customElements.get('menu-drawer'));
      console.log('md instanceof MenuDrawer:', md instanceof customElements.get('menu-drawer'));

      // Check event listeners on summary
      summary.addEventListener('click', (e) => {
        console.log('CUSTOM LISTENER: summary clicked! isOpen before click =', details.hasAttribute('open'));
        setTimeout(() => {
          console.log('CUSTOM TIMEOUT 0ms: isOpen =', details.hasAttribute('open'), 'classes =', details.className);
        }, 0);
        setTimeout(() => {
          console.log('CUSTOM TIMEOUT 150ms: isOpen =', details.hasAttribute('open'), 'classes =', details.className);
        }, 150);
      });

      summary.click();
    })()`
  });

  await wait(1000);

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
