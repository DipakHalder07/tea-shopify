const http = require('http');

http.get('http://127.0.0.1:9292/', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const regex = /\/cdn\/shop\/t\/12\/assets\/[^"'\s>]+/g;
    const matches = d.match(regex) || [];
    const unique = [...new Set(matches)];
    const targets = unique.filter(u => u.includes('isolated') || u.includes('honey') || u.includes('logo'));
    console.log('Found loader targets:', targets.length);
    targets.forEach(u => {
      http.get('http://127.0.0.1:9292' + u, r => {
        console.log('Status', r.statusCode, 'for', u.split('?')[0]);
      });
    });
  });
});
