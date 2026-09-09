const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9526;

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
      const thumbs = Array.from(document.querySelectorAll('.thumbnail-list__item, .thumbnail, .product__thumb-item')).map(t => {
        const btn = t.querySelector('button') || t;
        const img = t.querySelector('img');
        const style = window.getComputedStyle(btn);
        return {
          tag: t.tagName,
          className: t.className,
          bg: style.backgroundColor,
          radius: style.borderRadius,
          border: style.border,
          imgSrc: img?.src
        };
      });

      const mediaItems = Array.from(document.querySelectorAll('.product__media-item')).map(m => {
        const media = m.querySelector('.product__media');
        const img = m.querySelector('img');
        const mStyle = window.getComputedStyle(m);
        const mediaStyle = media ? window.getComputedStyle(media) : null;
        return {
          id: m.id,
          className: m.className,
          mBg: mStyle.backgroundColor,
          mediaBg: mediaStyle?.backgroundColor,
          imgNaturalW: img?.naturalWidth,
          imgNaturalH: img?.naturalHeight,
          rect: m.getBoundingClientRect()
        };
      });

      const gallery = document.querySelector('.product__media-gallery');
      const galleryRect = gallery ? gallery.getBoundingClientRect() : null;

      return { thumbs, mediaItems, galleryRect };
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
