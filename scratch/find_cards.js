const http = require('http');
const { spawn } = require('child_process');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9357;

const child = spawn(edgePath, [
  '--headless',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--window-size=1440,1100',
  'http://127.0.0.1:9292/'
]);

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await wait(2500);
  const targets = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${port}/json`, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const cbs = new Map();
  function send(m, p = {}) {
    return new Promise(res => {
      const i = id++;
      cbs.set(i, res);
      ws.send(JSON.stringify({ id: i, method: m, params: p }));
    });
  }
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && cbs.has(d.id)) {
      const cb = cbs.get(d.id);
      cbs.delete(d.id);
      cb(d.result);
    }
  };
  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');
  await wait(3000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const fc = document.querySelector('.section-featured-collection');
      const card = fc ? fc.querySelector('.card') : null;
      if (!card) return null;
      const matched = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && card.matches(rule.selectorText)) {
              if (rule.style.backgroundColor || rule.style.background) {
                matched.push({
                  selector: rule.selectorText,
                  bg: rule.style.background,
                  bgColor: rule.style.backgroundColor
                });
              }
            }
          }
        } catch(e) {}
      }
      return {
        cardClass: card.className,
        computedBg: window.getComputedStyle(card).backgroundColor,
        matched
      };
    })()`,
    returnByValue: true
  });
  console.log('Matched rules:', JSON.stringify(evalRes.result.value, null, 2));

  ws.close();
  child.kill();
}
run().catch(e => { console.error(e); child.kill(); });
