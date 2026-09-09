const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9532;
const baseDir = 'C:\\Users\\USER\\.gemini\\antigravity-ide\\brain\\1d3733de-0999-4f7a-b949-7a34875be1e5';

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
  await wait(4500);

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

  // Check botanicals and media background in DOM
  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const botanicals = Array.from(document.querySelectorAll('.pdp-botanical-item')).map(b => ({
        class: b.className,
        rect: { x: b.getBoundingClientRect().x, y: b.getBoundingClientRect().y, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height },
        imgSrc: b.querySelector('img')?.src
      }));
      const activeMedia = document.querySelector('.product__media-item.is-active .product__media');
      const activeMediaStyle = activeMedia ? {
        bg: window.getComputedStyle(activeMedia).backgroundColor,
        bgImg: window.getComputedStyle(activeMedia).backgroundImage,
        radius: window.getComputedStyle(activeMedia).borderRadius,
        w: activeMedia.offsetWidth,
        h: activeMedia.offsetHeight
      } : null;
      return { botanicals, activeMediaStyle };
    })()`,
    returnByValue: true
  });

  console.log('Botanicals & Media Style:', JSON.stringify(check.result.value, null, 2));

  // Take full screenshot
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_botanicals_slide1.png`, Buffer.from(shot1.data, 'base64'));
  console.log('Saved pdp_botanicals_slide1.png');

  // Click on the 2nd thumbnail (jar)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const thumbBtns = document.querySelectorAll('.thumbnail-list__item button.thumbnail');
      if (thumbBtns.length > 1) {
        thumbBtns[1].click();
      }
    })()`
  });

  await wait(1000);

  // Take screenshot with 2nd thumbnail active
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_botanicals_slide2_jar.png`, Buffer.from(shot2.data, 'base64'));
  console.log('Saved pdp_botanicals_slide2_jar.png');

  ws.close();
  child.kill();
}

run().catch(err => {
  console.error(err);
  child.kill();
});
