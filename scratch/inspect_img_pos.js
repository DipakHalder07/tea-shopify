const http = require('http');
const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9544;

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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const item = document.querySelector('.product__media-item.is-active');
      const media = item ? item.querySelector('.product__media') : null;
      const img = media ? media.querySelector('img') : null;
      const allImgs = item ? Array.from(item.querySelectorAll('img')).map(i => ({
        src: i.src.split('?')[0].split('/').pop(),
        w: i.offsetWidth,
        h: i.offsetHeight,
        pos: window.getComputedStyle(i).position,
        top: window.getComputedStyle(i).top,
        left: window.getComputedStyle(i).left,
        display: window.getComputedStyle(i).display,
        zIndex: window.getComputedStyle(i).zIndex
      })) : [];

      function getInfo(el) {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          position: cs.position,
          top: cs.top,
          left: cs.left,
          width: cs.width,
          height: cs.height,
          zIndex: cs.zIndex,
          opacity: cs.opacity,
          visibility: cs.visibility
        };
      }

      return {
        item: getInfo(item),
        media: getInfo(media),
        allImgs,
        innerHtml: media ? media.innerHTML.slice(0, 400) : null
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.value, null, 2));
  ws.close();
  child.kill();
}
run().catch(e => { console.error(e); child.kill(); });
