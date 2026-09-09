const http = require('http');

http.get('http://127.0.0.1:9292/products/royal-tea', (res) => {
  console.log('Status royal-tea:', res.statusCode);
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('Length:', d.length, 'Title:', d.match(/<title>([^<]*)<\/title>/i)?.[1]));
}).on('error', console.error);

http.get('http://127.0.0.1:9292/products/nidhi-premium-darjeeling-tea', (res) => {
  console.log('Status nidhi-premium-darjeeling-tea:', res.statusCode);
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('Length:', d.length, 'Title:', d.match(/<title>([^<]*)<\/title>/i)?.[1]));
}).on('error', console.error);
