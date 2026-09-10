const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9626;

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

  await send('Page.navigate', { url: 'http://127.0.0.1:9292/collections/all' });
  await loadPromise;
  await wait(2000);

  // Click summary
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });

  await wait(1200);

  const debugCSS = await send('Runtime.evaluate', {
    expression: `(() => {
      // Find bottom nav
      const bottomNav = document.querySelector('.footer__bottom') || document.querySelector('.bottom-navigation') || document.querySelector('.mobile-bottom-nav') || document.querySelector('[class*="bottom"]');
      
      // Check footers
      const allFooters = Array.from(document.querySelectorAll('.mobile-facets__footer')).map(f => {
        return {
          parent: f.parentElement.className,
          display: window.getComputedStyle(f).display,
          visibility: window.getComputedStyle(f).visibility,
          bg: window.getComputedStyle(f).backgroundColor,
          color: window.getComputedStyle(f).color,
          rect: f.getBoundingClientRect()
        };
      });

      // Find bottom navigation bar on mobile (Home, Shop, Wishlist, Log In)
      const bottomBar = Array.from(document.querySelectorAll('*')).find(el => {
        const text = el.textContent || '';
        return text.includes('Home') && text.includes('Shop') && text.includes('Wishlist') && el.children.length >= 3 && window.getComputedStyle(el).position === 'fixed';
      });

      return {
        bottomBar: bottomBar ? { tag: bottomBar.tagName, cls: bottomBar.className, zIndex: window.getComputedStyle(bottomBar).zIndex, height: bottomBar.offsetHeight } : 'not found',
        allFooters
      };
    })()`,
    returnByValue: true
  });

  console.log('DEBUG CSS:', JSON.stringify(debugCSS.result.value, null, 2));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
