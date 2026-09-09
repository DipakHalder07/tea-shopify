(async () => {
  const res = await fetch('http://127.0.0.1:9292/pages/contact?view=wishlist');
  const t = await res.text();
  let pos = 0;
  while ((pos = t.indexOf('Contact', pos)) !== -1) {
    console.log('--- FOUND at', pos);
    console.log(t.substring(Math.max(0, pos - 100), Math.min(t.length, pos + 150)));
    pos += 7;
  }
})();
