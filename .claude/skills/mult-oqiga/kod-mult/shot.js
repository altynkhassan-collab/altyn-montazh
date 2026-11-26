const { chromium } = require('playwright');
(async()=>{const [,,file,out,w,h]=process.argv;const b=await chromium.launch();const p=await b.newPage({viewport:{width:+w,height:+h}});
p.on('console',m=>console.log('console:',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+require('path').resolve(file));await p.waitForTimeout(400);await p.screenshot({path:out});await b.close();})();
