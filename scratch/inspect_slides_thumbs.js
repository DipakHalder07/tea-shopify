const http = require('http');
const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9546;

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
      const slides = Array.from(document.querySelectorAll('.product__media-item')).map((s, idx) => ({
        idx,
        id: s.id,
        mediaId: s.getAttribute('data-media-id'),
        colorAttr: s.getAttribute('data-color-index'),
        isActive: s.classList.contains('is-active'),
        imgSrc: s.querySelector('img') ? s.querySelector('img').src.split('?')[0].split('/').pop() : null
      }));

      const thumbs = Array.from(document.querySelectorAll('.thumbnail-list__item')).map((t, idx) => {
        const btn = t.querySelector('button.thumbnail');
        return {
          idx,
          id: t.id,
          target: t.getAttribute('data-target'),
          colorAttr: t.getAttribute('data-color-index'),
          isCurrent: btn ? btn.getAttribute('aria-current') : null,
          imgSrc: t.querySelector('img') ? t.querySelector('img').src.split('?')[0].split('/').pop() : null
        };
      });

      const slickArrows = Array.from(document.querySelectorAll('.slick-arrow')).map(a => ({
        tag: a.tagName,
        class: a.className,
        parentClass: a.parentElement ? a.parentElement.className : null
      }));

      return { slides, thumbs, slickArrows };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result.value, null, 2));
  ws.close();
  child.kill();
}
run().catch(e => { console.error(e); child.kill(); });
