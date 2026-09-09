const http = require('http');
const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9540;

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
      const wrapper = document.querySelector('.product__media-wrapper');
      const gallery = document.querySelector('.product__media-gallery');
      const viewer = document.querySelector('.pdp-gallery-viewer-wrap');
      const list = document.querySelector('.product__media-list');
      const item = document.querySelector('.product__media-item.is-active');
      const media = item ? item.querySelector('.product__media') : null;
      const botanicals = document.querySelector('.pdp-floating-botanicals');
      const infoWrap = document.querySelector('.product__info-wrapper');

      function info(el) {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          class: el.className,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          display: cs.display,
          flex: cs.flex,
          height: cs.height,
          paddingTop: cs.paddingTop,
          paddingBottom: cs.paddingBottom,
          alignSelf: cs.alignSelf,
          position: cs.position,
          zIndex: cs.zIndex
        };
      }

      return {
        wrapper: info(wrapper),
        gallery: info(gallery),
        viewer: info(viewer),
        list: info(list),
        item: info(item),
        media: info(media),
        botanicals: info(botanicals),
        infoWrap: info(infoWrap)
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.value, null, 2));
  ws.close();
  child.kill();
}
run().catch(e => { console.error(e); child.kill(); });
