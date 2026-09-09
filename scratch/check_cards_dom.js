const http = require('http');

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  try {
    const list = await getJson('http://127.0.0.1:9222/json');
    const page = list.find(t => t.type === 'page' && t.url.includes('127.0.0.1:9292'));
    if (!page) {
      console.log('No page found');
      return;
    }
    const ws = new (require('ws'))(page.webSocketDebuggerUrl);
    ws.on('open', () => {
      let id = 1;
      function send(method, params = {}) {
        return new Promise((resolve) => {
          const reqId = id++;
          const handler = (msg) => {
            const data = JSON.parse(msg);
            if (data.id === reqId) {
              ws.off('message', handler);
              resolve(data.result);
            }
          };
          ws.on('message', handler);
          ws.send(JSON.stringify({ id: reqId, method, params }));
        });
      }

      (async () => {
        const evalRes = await send('Runtime.evaluate', {
          expression: `(() => {
            const tab = document.querySelector('.product-tab-wrapper');
            const cards = tab ? tab.querySelectorAll('.card-wrapper, .card, [class*="card"]') : [];
            const cardSamples = Array.from(cards).slice(0, 5).map(c => ({
              className: c.className,
              tagName: c.tagName,
              computedBorder: window.getComputedStyle(c).border,
              boxShadow: window.getComputedStyle(c).boxShadow,
              outerHTMLSnippet: c.outerHTML.substring(0, 150)
            }));
            
            // Also check all elements with class containing 'card'
            const allCards = Array.from(document.querySelectorAll('[class*="product-card"], [class*="card-product"], [class*="card__inner"], .card-wrapper')).map(c => ({
              className: c.className,
              tagName: c.tagName
            }));

            return {
              tabExists: !!tab,
              cardSamples,
              allCards: allCards.slice(0, 10)
            };
          })()`,
          returnByValue: true
        });

        console.log(JSON.stringify(evalRes.result.value, null, 2));
        ws.close();
      })();
    });
  } catch (err) {
    console.error(err);
  }
})();
