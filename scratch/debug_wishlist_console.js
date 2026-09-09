const http = require('http');
const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9527;

const child = spawn(edgePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1080',
  'http://127.0.0.1:9292/pages/contact?view=wishlist'
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
  if (!page) { child.kill(); return; }

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
    const data = JSON.parse(event.data);
    if (data.method === 'Console.messageAdded') {
      console.log('CONSOLE:', data.params.message.text);
    }
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('EXCEPTION:', data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
    }
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      cb(data.result);
    }
  };

  await new Promise((resolve) => { ws.onopen = resolve; });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  await send('Runtime.evaluate', {
    expression: `localStorage.setItem('shopify-wishlist', 'royal-tea');`
  });

  await send('Page.reload');
  await wait(4000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const grid = document.querySelector('dtx-wishlist-grid');
      const table = document.querySelector('.dtx-table');
      const rows = document.querySelectorAll('.dtx-table tbody tr');
      return {
        hasGrid: !!grid,
        tableHtml: table ? table.outerHTML : null,
        rowsLength: rows.length,
        ls: localStorage.getItem('shopify-wishlist')
      };
    })()`,
    returnByValue: true
  });

  console.log('DOM RES:', JSON.stringify(res.result.value, null, 2));

  ws.close();
  child.kill();
}

run().catch(e => {
  console.error(e);
  child.kill();
});
