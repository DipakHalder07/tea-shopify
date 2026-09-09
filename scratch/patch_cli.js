const fs = require('fs');
const file = 'C:/Users/USER/AppData/Roaming/npm/node_modules/@shopify/cli/dist/chunk-7EUIO4ZO.js';
let content = fs.readFileSync(file, 'utf8');

const target = 'function Ht(e,t){let s=new Response(t.body,t);s.headers.delete("content-length")';
const repl = 'function Ht(e,t){let s;try{s=new Response(t.bodyUsed?null:t.body,t)}catch(_){s=new Response(null,t)}s.headers.delete("content-length")';

if (!content.includes(target)) {
  console.log('Target NOT found');
} else {
  content = content.replace(target, repl);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully patched chunk-7EUIO4ZO.js');
}
