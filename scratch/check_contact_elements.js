(async () => {
  const res = await fetch('http://127.0.0.1:9292/pages/contact?view=wishlist');
  const text = await res.text();
  const idx = text.indexOf('wishlist-page-wrapper');
  const before = text.substring(Math.max(0, idx - 1500), idx);
  console.log(before);
})();
