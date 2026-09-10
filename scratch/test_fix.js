const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9631;

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

  // Apply complete fix via CSS
  await send('Runtime.evaluate', {
    expression: `(() => {
      const style = document.createElement('style');
      style.id = 'fix-mobile-facets';
      style.textContent = \`
        /* 1. Prevent global menu-drawer summary::before from dimming over mobile filter drawer */
        .mobile-facets__wrapper > details > summary::before {
          all: unset !important;
          display: none !important;
        }

        /* 2. Elevate section stacking context when mobile facets are open */
        body:has(.mobile-facets__disclosure[open]) .shopify-section:has(.product-collection),
        body:has(.mobile-facets__disclosure[open]) .product-collection,
        .shopify-section:has(.mobile-facets__disclosure[open]),
        .product-collection:has(.mobile-facets__disclosure[open]) {
          z-index: 9999999 !important;
          position: relative !important;
        }

        /* 3. Backdrop overlay for mobile filter drawer */
        .mobile-facets {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important;
          background: rgba(10, 6, 3, 0.7) !important;
          backdrop-filter: blur(4px) !important;
          -webkit-backdrop-filter: blur(4px) !important;
          z-index: 99999999 !important;
          pointer-events: all !important;
        }

        /* 4. Luxury Filter Drawer Panel */
        .mobile-facets__inner {
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          left: auto !important;
          width: min(88vw, 360px) !important;
          height: 100vh !important;
          height: 100dvh !important;
          background: linear-gradient(180deg, #181109 0%, #100a04 100%) !important;
          border-left: 1px solid rgba(245, 228, 199, 0.16) !important;
          box-shadow: -12px 0 40px rgba(0, 0, 0, 0.85) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          margin: 0 !important;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
          z-index: 999999999 !important;
          pointer-events: auto !important;
        }

        .menu-opening .mobile-facets__inner {
          transform: translateX(0) !important;
        }

        .js .disclosure-has-popup:not(.menu-opening) .mobile-facets__inner {
          transform: translateX(105%) !important;
        }

        /* 5. Header */
        .mobile-facets__header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 16px 18px !important;
          background: rgba(24, 16, 8, 0.98) !important;
          border-bottom: 1px solid rgba(245, 228, 199, 0.12) !important;
          position: sticky !important;
          top: 0 !important;
          z-index: 10 !important;
          min-height: 56px !important;
        }

        .mobile-facets__header-inner {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          flex: 1 !important;
        }

        .mobile-facets__heading {
          font-family: inherit !important;
          font-size: 15px !important;
          font-weight: 700 !important;
          letter-spacing: 1.5px !important;
          text-transform: uppercase !important;
          color: #f5e4c7 !important;
          margin: 0 !important;
        }

        .mobile-facets__count {
          font-size: 11px !important;
          color: #c5a880 !important;
          background: rgba(197, 168, 128, 0.12) !important;
          border: 1px solid rgba(197, 168, 128, 0.25) !important;
          border-radius: 20px !important;
          padding: 2px 8px !important;
          margin: 0 !important;
        }

        /* Close Button */
        .mobile-facets__close {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: fixed !important;
          top: 10px !important;
          right: 12px !important;
          width: 36px !important;
          height: 36px !important;
          border-radius: 50% !important;
          background: rgba(245, 228, 199, 0.08) !important;
          border: 1px solid rgba(245, 228, 199, 0.2) !important;
          color: #f5e4c7 !important;
          z-index: 9999999999 !important;
          cursor: pointer !important;
          opacity: 1 !important;
        }

        .mobile-facets__close svg {
          width: 14px !important;
          height: 14px !important;
          stroke: #f5e4c7 !important;
          color: #f5e4c7 !important;
          stroke-width: 2.2px !important;
        }

        /* 6. Scrollable Content */
        .mobile-facets__main {
          flex: 1 1 auto !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          padding: 14px 16px 20px !important;
          background: transparent !important;
          position: relative !important;
        }

        /* Filter Sections */
        .mobile-facets__details {
          background: rgba(245, 228, 199, 0.03) !important;
          border: 1px solid rgba(245, 228, 199, 0.08) !important;
          border-radius: 12px !important;
          margin-bottom: 10px !important;
          overflow: hidden !important;
        }

        .mobile-facets__summary {
          padding: 14px 16px !important;
          cursor: pointer !important;
          list-style: none !important;
        }

        .mobile-facets__summary::-webkit-details-marker {
          display: none !important;
        }

        .mobile-facets__summary > div {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          width: 100% !important;
          color: #f5e4c7 !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          letter-spacing: 0.5px !important;
        }

        .mobile-facets__summary .mobile-facets__arrow svg {
          stroke: #c5a880 !important;
          width: 12px !important;
          height: 12px !important;
        }

        /* Sort By Section */
        .mobile-facets__sort {
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
          width: 100% !important;
          padding: 4px 0 !important;
        }

        .mobile-facets__sort label {
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          color: #c5a880 !important;
        }

        .mobile-facets__sort .select {
          position: relative !important;
          width: 100% !important;
        }

        .mobile-facets__sort .select__select {
          width: 100% !important;
          background: #1e140b !important;
          border: 1px solid rgba(245, 228, 199, 0.22) !important;
          border-radius: 10px !important;
          color: #f5e4c7 !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          padding: 11px 36px 11px 14px !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          cursor: pointer !important;
          outline: none !important;
        }

        .mobile-facets__sort .select .icon-caret {
          position: absolute !important;
          right: 14px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          pointer-events: none !important;
          width: 11px !important;
          height: 11px !important;
          color: #c5a880 !important;
          stroke: #c5a880 !important;
        }

        /* Submenus */
        .js .mobile-facets__submenu {
          background: #150d06 !important;
          z-index: 15 !important;
          padding: 0 !important;
        }

        .mobile-facets__close-button {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          padding: 15px 18px !important;
          background: rgba(24, 16, 8, 0.98) !important;
          border-bottom: 1px solid rgba(245, 228, 199, 0.12) !important;
          color: #c5a880 !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          width: 100% !important;
          margin: 0 !important;
        }

        .mobile-facets__close-button svg {
          stroke: #c5a880 !important;
          transform: rotate(180deg) !important;
          width: 13px !important;
          height: 13px !important;
        }

        .mobile-facets__list {
          padding: 10px 14px !important;
          list-style: none !important;
        }

        .mobile-facets__item {
          padding: 4px 0 !important;
        }

        .mobile-facets__label {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          color: #f5e4c7 !important;
          font-size: 13.5px !important;
          cursor: pointer !important;
          padding: 8px 10px !important;
          border-radius: 8px !important;
        }

        .mobile-facets__label input[type="checkbox"] {
          accent-color: #c5a880 !important;
          width: 18px !important;
          height: 18px !important;
          border-radius: 4px !important;
          cursor: pointer !important;
          position: static !important;
        }

        .mobile-facets__label .product-count {
          color: #c5a880 !important;
          font-size: 11.5px !important;
          margin-left: auto !important;
        }

        /* Price Range */
        .mobile-facets__info {
          padding: 12px 18px 4px !important;
          color: #c5a880 !important;
          font-size: 12px !important;
          margin: 0 !important;
        }

        .facets__price {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 12px 18px !important;
        }

        .facets__price .field {
          flex: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 4px !important;
        }

        .facets__price .field__label {
          font-size: 11px !important;
          color: #c5a880 !important;
          text-transform: uppercase !important;
          display: block !important;
        }

        .facets__price .field__input {
          background: #1e140b !important;
          border: 1px solid rgba(245, 228, 199, 0.25) !important;
          border-radius: 8px !important;
          color: #f5e4c7 !important;
          padding: 9px 12px !important;
          font-size: 13.5px !important;
          outline: none !important;
          width: 100% !important;
        }

        .facets__price .field-currency {
          color: #c5a880 !important;
          font-weight: 700 !important;
          font-size: 15px !important;
        }

        /* 7. Footer */
        .mobile-facets__footer {
          position: sticky !important;
          bottom: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          padding: 14px 16px !important;
          background: rgba(18, 12, 6, 0.98) !important;
          border-top: 1px solid rgba(245, 228, 199, 0.15) !important;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.65) !important;
          z-index: 20 !important;
          margin-top: auto !important;
          visibility: visible !important;
        }

        .mobile-facets__clear-wrapper {
          flex: 1 !important;
          display: flex !important;
        }

        .mobile-facets__clear {
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 11px 14px !important;
          background: transparent !important;
          border: 1px solid rgba(245, 228, 199, 0.35) !important;
          border-radius: 30px !important;
          color: #f5e4c7 !important;
          font-size: 11.5px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          text-decoration: none !important;
        }

        .mobile-facets__footer button.button--primary {
          flex: 1.3 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 11px 16px !important;
          background: linear-gradient(135deg, #c5a880 0%, #8C6239 100%) !important;
          border: none !important;
          border-radius: 30px !important;
          color: #100b06 !important;
          font-size: 11.5px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 1.2px !important;
          cursor: pointer !important;
          box-shadow: 0 4px 14px rgba(197, 168, 128, 0.35) !important;
        }
      \`;
      document.head.appendChild(style);
    })()`
  });

  // Click summary
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });

  await wait(600);

  let s = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/luxury_drawer_fixed.png', Buffer.from(s.data, 'base64'));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
