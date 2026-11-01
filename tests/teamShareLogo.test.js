import test from 'node:test';
import assert from 'node:assert/strict';
import {readShareLogo} from '../server/teamShareLogo.js';
test('logo reader allows only FACEIT HTTPS CDN and never follows redirects',async()=>{
 let calls=0;const fake=async()=>{calls++;return new Response('',{status:302,headers:{location:'http://127.0.0.1'}});};
 assert.equal(await readShareLogo('http://127.0.0.1/logo',fake),null);
 assert.equal(await readShareLogo('https://distribution.faceit-cdn.net.evil.test/logo',fake),null);
 assert.equal(calls,0);assert.equal(await readShareLogo('https://distribution.faceit-cdn.net/images/logo.png',fake),null);assert.equal(calls,1);
});
test('logo reader verifies raster magic and caps response size',async()=>{
 const url='https://distribution.faceit-cdn.net/images/logo.png';
 const png=new Uint8Array([137,80,78,71,13,10,26,10]);
 const image=await readShareLogo(url,async()=>new Response(png));assert.equal(image.type,'image/png');
 assert.equal(await readShareLogo(url,async()=>new Response('<html>no</html>',{headers:{'Content-Type':'image/png'}})),null);
 assert.equal(await readShareLogo(url,async()=>new Response(png,{headers:{'Content-Length':'9000000'}})),null);
});
