const http = require('http');
const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9528;

const child = spawn(edgePath, [
  '--headless=new',
  '--disable-blink-features=AutomationControlled',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1080',
  'http://127.0.0.1:9292/products/premium-darjeeling-tea'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await wait(4000);

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

  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const pInfo = document.querySelector('.main-product_info');
      const mediaWrap = document.querySelector('.product__media-wrapper');
      const gallery = document.querySelector('.product__media-gallery');
      const activeSlide = document.querySelector('.product__media-item.is-active');
      const activeMedia = activeSlide ? activeSlide.querySelector('.product__media') : null;
      const activeImg = activeSlide ? activeSlide.querySelector('img') : null;
      const thumbs = document.querySelector('.thumbnail-slider');

      const getOverflow = sel => {
        const el = document.querySelector(sel);
        return el ? { sel, overflow: window.getComputedStyle(el).overflow, overflowX: window.getComputedStyle(el).overflowX, overflowY: window.getComputedStyle(el).overflowY } : null;
      };

      return {
        overflows: [
          getOverflow('.product__media-wrapper'),
          getOverflow('.product__media-gallery'),
          getOverflow('slider-component:not(.thumbnail-slider)'),
          getOverflow('.product__media-list'),
          getOverflow('.product__media-item.is-active'),
          getOverflow('.product__media-item.is-active .product__media')
        ]
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(info.result.value, null, 2));

  ws.close();
  child.kill();
}

run().catch(err => {
  console.error(err);
  child.kill();
});
