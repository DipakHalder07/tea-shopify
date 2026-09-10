const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9628;

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

  // Inject Luxury Mobile Drawer Styles
  await send('Runtime.evaluate', {
    expression: `(() => {
      const style = document.createElement('style');
      style.id = 'luxury-mobile-drawer-styles';
      style.textContent = \`
        /* Elevate Stacking Context Above Header & Bottom Toolbar */
        body:has(.mobile-facets__disclosure[open]),
        body.overflow-hidden-mobile {
          overflow: hidden !important;
        }
        body:has(.mobile-facets__disclosure[open]) .shopify-section:has(.product-collection),
        body:has(.mobile-facets__disclosure[open]) .product-collection,
        .shopify-section:has(.mobile-facets__disclosure[open]),
        .product-collection:has(.mobile-facets__disclosure[open]) {
          z-index: 9999999 !important;
          position: relative !important;
        }

        /* Backdrop Overlay */
        .mobile-facets {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          height: 100dvh !important;
          background: rgba(8, 5, 2, 0.72) !important;
          backdrop-filter: blur(6px) !important;
          -webkit-backdrop-filter: blur(6px) !important;
          z-index: 99999999 !important;
          pointer-events: all !important;
        }

        /* Drawer Slide-in Container */
        .mobile-facets__inner {
          position: fixed !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          left: auto !important;
          width: min(92vw, 380px) !important;
          height: 100vh !important;
          height: 100dvh !important;
          background: linear-gradient(180deg, #181109 0%, #100a04 100%) !important;
          border-left: 1px solid rgba(245, 228, 199, 0.18) !important;
          box-shadow: -10px 0 40px rgba(0, 0, 0, 0.85) !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
          margin: 0 !important;
          transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1) !important;
          z-index: 999999999 !important;
        }

        .menu-opening .mobile-facets__inner {
          transform: translateX(0) !important;
        }

        .js .disclosure-has-popup:not(.menu-opening) .mobile-facets__inner {
          transform: translateX(105%) !important;
        }

        /* Drawer Header */
        .mobile-facets__header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 16px 20px !important;
          background: rgba(24, 16, 8, 0.98) !important;
          border-bottom: 1px solid rgba(245, 228, 199, 0.12) !important;
          position: sticky !important;
          top: 0 !important;
          z-index: 10 !important;
          min-height: 60px !important;
        }

        .mobile-facets__header-inner {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          flex: 1 !important;
        }

        .mobile-facets__heading {
          font-family: inherit !important;
          font-size: 16px !important;
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
          padding: 3px 9px !important;
          margin: 0 !important;
        }

        /* Close Button in Header */
        .mobile-facets__close {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: fixed !important;
          top: 10px !important;
          right: 14px !important;
          width: 38px !important;
          height: 38px !important;
          border-radius: 50% !important;
          background: rgba(245, 228, 199, 0.08) !important;
          border: 1px solid rgba(245, 228, 199, 0.2) !important;
          color: #f5e4c7 !important;
          z-index: 9999999999 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          opacity: 1 !important;
        }

        .mobile-facets__close:active {
          transform: scale(0.92) !important;
          background: rgba(197, 168, 128, 0.25) !important;
        }

        .mobile-facets__close svg {
          width: 14px !important;
          height: 14px !important;
          stroke: #f5e4c7 !important;
          color: #f5e4c7 !important;
          stroke-width: 2.5px !important;
        }

        /* Scrollable Main Section */
        .mobile-facets__main {
          flex: 1 1 auto !important;
          overflow-y: auto !important;
          -webkit-overflow-scrolling: touch !important;
          padding: 14px 16px 20px !important;
          background: transparent !important;
          position: relative !important;
        }

        /* Filter Accordion Items */
        .mobile-facets__details {
          background: rgba(245, 228, 199, 0.03) !important;
          border: 1px solid rgba(245, 228, 199, 0.08) !important;
          border-radius: 12px !important;
          margin-bottom: 10px !important;
          overflow: hidden !important;
          transition: border-color 0.2s ease, background-color 0.2s ease !important;
        }

        .mobile-facets__details:hover,
        .mobile-facets__details:focus-within {
          border-color: rgba(197, 168, 128, 0.3) !important;
          background: rgba(245, 228, 199, 0.05) !important;
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
          transition: transform 0.2s ease !important;
        }

        /* Sort By Section inside Drawer */
        .mobile-facets__sort {
          padding: 4px 0 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
          width: 100% !important;
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
          border: 1px solid rgba(245, 228, 199, 0.2) !important;
          border-radius: 10px !important;
          color: #f5e4c7 !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          padding: 10px 36px 10px 14px !important;
          appearance: none !important;
          -webkit-appearance: none !important;
          cursor: pointer !important;
          outline: none !important;
        }

        .mobile-facets__sort .select__select:focus {
          border-color: #c5a880 !important;
          box-shadow: 0 0 0 2px rgba(197, 168, 128, 0.2) !important;
        }

        .mobile-facets__sort .select .icon-caret {
          position: absolute !important;
          right: 14px !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          pointer-events: none !important;
          width: 10px !important;
          height: 10px !important;
          color: #c5a880 !important;
          stroke: #c5a880 !important;
        }

        /* Submenus (Filter Values) */
        .js .mobile-facets__submenu {
          background: #140d06 !important;
          z-index: 15 !important;
          padding: 0 !important;
        }

        .mobile-facets__close-button {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          padding: 16px 20px !important;
          background: rgba(24, 16, 8, 0.95) !important;
          border-bottom: 1px solid rgba(245, 228, 199, 0.12) !important;
          color: #c5a880 !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          width: 100% !important;
          margin: 0 !important;
        }

        .mobile-facets__close-button svg {
          stroke: #c5a880 !important;
          transform: rotate(180deg) !important;
          width: 14px !important;
          height: 14px !important;
        }

        .mobile-facets__list {
          padding: 12px 16px !important;
          list-style: none !important;
        }

        .mobile-facets__item {
          padding: 6px 0 !important;
        }

        .mobile-facets__label {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          color: #f5e4c7 !important;
          font-size: 14px !important;
          cursor: pointer !important;
          padding: 8px 12px !important;
          border-radius: 8px !important;
          transition: background-color 0.2s ease !important;
        }

        .mobile-facets__label:hover {
          background: rgba(245, 228, 199, 0.05) !important;
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
          font-size: 12px !important;
          margin-left: auto !important;
        }

        /* Price Range */
        .mobile-facets__info {
          padding: 12px 20px 4px !important;
          color: #c5a880 !important;
          font-size: 12px !important;
          margin: 0 !important;
        }

        .facets__price {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 12px 20px !important;
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
          padding: 10px 12px !important;
          font-size: 14px !important;
          outline: none !important;
          width: 100% !important;
        }

        .facets__price .field-currency {
          color: #c5a880 !important;
          font-weight: 700 !important;
          font-size: 15px !important;
        }

        /* Fixed Luxury Footer */
        .mobile-facets__footer {
          position: sticky !important;
          bottom: 0 !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 14px 18px !important;
          background: rgba(18, 12, 6, 0.98) !important;
          border-top: 1px solid rgba(245, 228, 199, 0.15) !important;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.6) !important;
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
          padding: 11px 16px !important;
          background: transparent !important;
          border: 1px solid rgba(245, 228, 199, 0.35) !important;
          border-radius: 30px !important;
          color: #f5e4c7 !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
          text-decoration: none !important;
          transition: all 0.2s ease !important;
        }

        .mobile-facets__clear:active {
          background: rgba(245, 228, 199, 0.1) !important;
          transform: scale(0.97) !important;
        }

        .mobile-facets__footer button.button--primary {
          flex: 1.4 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 12px 18px !important;
          background: linear-gradient(135deg, #c5a880 0%, #8C6239 100%) !important;
          border: none !important;
          border-radius: 30px !important;
          color: #100b06 !important;
          font-size: 12px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 1.2px !important;
          cursor: pointer !important;
          box-shadow: 0 4px 14px rgba(197, 168, 128, 0.35) !important;
          transition: all 0.2s ease !important;
        }

        .mobile-facets__footer button.button--primary:active {
          transform: scale(0.97) !important;
          filter: brightness(1.1) !important;
        }
      \`;
      document.head.appendChild(style);
    })()`
  });

  // Click summary to open drawer
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.mobile-facets__open-wrapper').click()`
  });

  await wait(600);

  let s = await send('Page.captureScreenshot');
  fs.writeFileSync('scratch/luxury_drawer_preview.png', Buffer.from(s.data, 'base64'));

  ws.close();
  child.kill();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  if (child) child.kill();
  process.exit(1);
});
