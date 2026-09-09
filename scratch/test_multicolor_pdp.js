const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9550;
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

  // Dismiss cookie banner and center gallery
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cookieBanner = document.querySelector('.cookie-banner, #cookie-bar, [class*="cookie"]');
      if (cookieBanner) cookieBanner.style.display = 'none';
      const gallery = document.querySelector('.product__media-gallery');
      if (gallery) gallery.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`
  });

  await wait(1000);

  // Check state of live page
  const debugInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const slides = Array.from(document.querySelectorAll('.product__media-item')).map(s => {
        const m = s.querySelector('.product__media');
        const mr = m ? m.getBoundingClientRect() : null;
        return {
          id: s.id,
          colorAttr: s.getAttribute('data-color-index'),
          isActive: s.classList.contains('is-active'),
          bg: m ? window.getComputedStyle(m).backgroundColor : null,
          rect: mr ? { w: Math.round(mr.width), h: Math.round(mr.height) } : null
        };
      });

      const thumbs = Array.from(document.querySelectorAll('.thumbnail-list__item')).map(t => {
        const btn = t.querySelector('button.thumbnail');
        return {
          target: t.getAttribute('data-target'),
          colorAttr: t.getAttribute('data-color-index'),
          bg: btn ? window.getComputedStyle(btn).backgroundColor : null
        };
      });

      const botanicals = Array.from(document.querySelectorAll('.pdp-botanical-item')).map(b => ({
        class: b.className,
        zIndex: window.getComputedStyle(b).zIndex,
        w: b.offsetWidth,
        h: b.offsetHeight
      }));

      return { slides, thumbs, botanicals };
    })()`,
    returnByValue: true
  });

  console.log('Live PDP Debug Info:', JSON.stringify(debugInfo.result.value, null, 2));

  // Screenshot 1: Desktop Slide 1
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_live_slide1_golden.png`, Buffer.from(shot1.data, 'base64'));
  console.log('Saved pdp_live_slide1_golden.png');

  // Activate Slide 2 (Thumbnail 2)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const mg = document.querySelector('media-gallery');
      const thumbs = document.querySelectorAll('.thumbnail-list__item[data-target]');
      if (mg && thumbs.length > 1) {
        mg.setActiveMedia(thumbs[1].getAttribute('data-target'), false);
      }
    })()`
  });

  await wait(1000);

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_live_slide2_cayenne.png`, Buffer.from(shot2.data, 'base64'));
  console.log('Saved pdp_live_slide2_cayenne.png');

  // Activate Slide 3 (Thumbnail 3)
  await send('Runtime.evaluate', {
    expression: `(() => {
      const mg = document.querySelector('media-gallery');
      const thumbs = document.querySelectorAll('.thumbnail-list__item[data-target]');
      if (mg && thumbs.length > 2) {
        mg.setActiveMedia(thumbs[2].getAttribute('data-target'), false);
      }
    })()`
  });

  await wait(1000);

  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_live_slide3_crimson.png`, Buffer.from(shot3.data, 'base64'));
  console.log('Saved pdp_live_slide3_crimson.png');

  // Test Mobile Viewport
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Runtime.evaluate', {
    expression: `(() => {
      const gallery = document.querySelector('.product__media-gallery');
      if (gallery) gallery.scrollIntoView({ behavior: 'instant', block: 'start' });
    })()`
  });

  await wait(1000);

  const shotMobile = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${baseDir}\\pdp_live_mobile.png`, Buffer.from(shotMobile.data, 'base64'));
  console.log('Saved pdp_live_mobile.png');

  ws.close();
  child.kill();
}
run().catch(e => { console.error(e); child.kill(); });
