const http = require('http');

http.get('http://127.0.0.1:9292/', (res) => {
  console.log('Status code:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Has #loader?', data.includes('id="loader"'));
    console.log('Has pl-item?', data.includes('pl-item'));
    const loaderIdx = data.indexOf('id="loader"');
    if (loaderIdx !== -1) {
      console.log('Loader HTML chunk:', data.substring(loaderIdx - 50, loaderIdx + 800));
    } else {
      console.log('Loader NOT FOUND in homepage HTML!');
    }
  });
}).on('error', err => console.error(err));
