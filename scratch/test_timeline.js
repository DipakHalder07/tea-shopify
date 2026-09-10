const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9619;

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

  await send('Runtime.evaluate', {
    expression: `(() => {
      const md = document.querySelector('menu-drawer');
      const details = md.querySelector('details');
      const summary = md.querySelector('summary');
      const inner = md.querySelector('.mobile-facets__inner');

      summary.click();

      [100, 300, 500, 800, 1200].forEach(ms => {
        setTimeout(() => {
          const r = inner.getBoundingClientRect();
          console.log(\`[\${ms}ms] open=\${details.hasAttribute('open')} cls=\${details.className} transform=\${window.getComputedStyle(inner).transform} rectLeft=\${r.left} rectWidth=\${r.width} activeEl=\${document.activeElement ? document.activeElement.tagName + '.' + document.activeElement.className : 'null'}\`);
        }, ms);
      });
    })()`
  });

  await wait(1800);

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
