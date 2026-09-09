const http = require('http');
const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9533;

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

  // Click on 2nd thumbnail
  await send('Runtime.evaluate', {
    expression: `document.querySelectorAll('.thumbnail-list__item button.thumbnail')[1].click()`
  });

  await wait(1000);

  const details = await send('Runtime.evaluate', {
    expression: `(() => {
      const activeSlide = document.querySelector('.product__media-item.is-active');
      const media = activeSlide.querySelector('.product__media');
      const img = activeSlide.querySelector('img');
      const opener = activeSlide.querySelector('.product__modal-opener');
      return {
        slideRect: { w: activeSlide.offsetWidth, h: activeSlide.offsetHeight },
        openerRect: opener ? { w: opener.offsetWidth, h: opener.offsetHeight } : null,
        mediaStyle: {
          paddingTop: media.style.paddingTop,
          paddingBottom: media.style.paddingBottom,
          w: media.offsetWidth,
          h: media.offsetHeight,
          computedHeight: window.getComputedStyle(media).height,
          computedPaddingTop: window.getComputedStyle(media).paddingTop
        },
        imgDetails: {
          src: img.src,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          w: img.offsetWidth,
          h: img.offsetHeight,
          computedHeight: window.getComputedStyle(img).height,
          computedObjectFit: window.getComputedStyle(img).objectFit,
          computedTop: window.getComputedStyle(img).top
        }
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(details.result.value, null, 2));

  ws.close();
  child.kill();
}

run().catch(err => {
  console.error(err);
  child.kill();
});
