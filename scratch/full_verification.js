const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9635;

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
  let loadResolver;
  const loadPromise = new Promise(r => loadResolver = r);

  ws.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.method === 'Page.loadEventFired') {
      if (loadResolver) loadResolver();
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

  console.log('1. Navigating to /collections/all...');
  await send('Page.navigate', { url: 'http://127.0.0.1:9292/collections/all' });
  await loadPromise;
  await wait(2000);

  // Accept cookies
  await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button, a')).find(el => el.textContent.includes('ALLOW COOKIES'));
      if (b) b.click();
    })()`
  });
  await wait(400);

  // Screenshot 1: Collections page
  const s1 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/step1_collections_page.png', Buffer.from(s1.data, 'base64'));
  console.log('Saved step1_collections_page.png');

  // Screenshot 2: Click Filter And Sort
  console.log('2. Clicking Filter and Sort button...');
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });
  await wait(600);

  const s2 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/step2_drawer_opened.png', Buffer.from(s2.data, 'base64'));
  console.log('Saved step2_drawer_opened.png');

  // Verify open state
  const stateOpen = await send('Runtime.evaluate', {
    expression: `(() => {
      const details = document.querySelector('.mobile-facets__disclosure');
      const inner = document.querySelector('.mobile-facets__inner');
      const closeBtn = document.querySelector('.mobile-facets__close-icon-btn');
      return {
        isOpen: details.hasAttribute('open'),
        menuOpening: details.classList.contains('menu-opening'),
        innerLeft: inner.getBoundingClientRect().left,
        innerWidth: inner.getBoundingClientRect().width,
        closeBtnVisible: !!closeBtn && window.getComputedStyle(closeBtn).display !== 'none'
      };
    })()`,
    returnByValue: true
  });
  console.log('Open state:', stateOpen.result.value);

  // Screenshot 3: Click Availability
  console.log('3. Clicking Availability submenu...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const summaries = Array.from(document.querySelectorAll('.mobile-facets__summary'));
      const avail = summaries.find(s => s.innerText.includes('Availability'));
      if (avail) avail.click();
    })()`
  });
  await wait(500);

  const s3 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/step3_availability_submenu.png', Buffer.from(s3.data, 'base64'));
  console.log('Saved step3_availability_submenu.png');

  // Screenshot 4: Click back button
  console.log('4. Clicking back button...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('.mobile-facets__close-button')).find(b => b.innerText.includes('Availability'));
      if (btn) btn.click();
    })()`
  });
  await wait(500);

  // Screenshot 5: Click Close button
  console.log('5. Clicking close (✕) button...');
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__close-icon-btn').click()`
  });
  await wait(600);

  const s5 = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/step5_drawer_closed.png', Buffer.from(s5.data, 'base64'));
  console.log('Saved step5_drawer_closed.png');

  const stateClosed = await send('Runtime.evaluate', {
    expression: `(() => {
      const details = document.querySelector('.mobile-facets__disclosure');
      return {
        isOpen: details.hasAttribute('open')
      };
    })()`,
    returnByValue: true
  });
  console.log('Closed state:', stateClosed.result.value);

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
