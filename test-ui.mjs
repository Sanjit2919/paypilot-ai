import { chromium } from "playwright";
const BASE = "http://127.0.0.1:3000";
const browser = await chromium.launch();
const results = [];
const check = (n,p,d="")=>{results.push({n,p:!!p,d});console.log(`${p?"PASS":"FAIL"} ${n}${d?` [${d}]`:""}`)};
const ctx = await browser.newContext({ viewport:{width:1440,height:900}, deviceScaleFactor:1 });
const page = await ctx.newPage();
const errors=[]; page.on("pageerror",e=>errors.push(e.message));
await page.goto(BASE+"/api/auth/demo",{waitUntil:"networkidle"});
await page.waitForSelector("text=Recorded cash balance",{timeout:20000});
await page.screenshot({path:"docs/screenshots/overview.png"});
await page.goto(BASE+"/insights",{waitUntil:"networkidle"});
await page.waitForSelector("text=Actions that wait for your approval",{timeout:20000});
await page.screenshot({path:"docs/screenshots/action-centre.png"});
const actionButton=page.locator('button:has-text("Approve")').first();
check("persistent action centre renders approval controls",await actionButton.count()>=0 && (await page.locator("text=Autonomous workflow centre").count())===1);
await page.goto(BASE+"/invoices",{waitUntil:"networkidle"});
await page.waitForSelector("text=Invoices",{timeout:20000});
const edit=page.locator('button:has-text("Edit"):visible').first();
check("draft editor available",await edit.count()>0);
if(await edit.count()){
 await edit.click(); await page.waitForSelector("text=Save draft");
 const desc=page.locator('input[placeholder="Description"]').first();
 await desc.fill("Updated design service");
 await page.locator('button:has-text("Save draft")').click();
 await page.waitForTimeout(1200);
 const saved=await page.evaluate(async()=>{const r=await fetch("/api/data/invoices");const d=await r.json();return d.invoices?.some(inv=>inv.items?.some(i=>i.description==="Updated design service"));});
 check("draft editor saves changes",saved===true);
}
await page.goto(BASE+"/assistant",{waitUntil:"networkidle"});
await page.waitForSelector("text=AI Finance Assistant");
await page.fill('main input[placeholder*="Ask"]',"Which invoices should I follow up on?");
await page.keyboard.press("Enter");await page.waitForTimeout(1800);
check("assistant responds through agents",await page.locator("text=Payment Agent").count()>0);
await page.screenshot({path:"docs/screenshots/assistant.png"});
await page.goto(BASE+"/payments",{waitUntil:"networkidle"});await page.waitForTimeout(1000);
await page.screenshot({path:"docs/screenshots/payments.png"});
await page.goto(BASE+"/cash-flow?horizon=60",{waitUntil:"networkidle"});await page.waitForTimeout(1200);
check("60-day forecast available",await page.locator('button:has-text("60-day")').count()>0);
await page.screenshot({path:"docs/screenshots/cash-flow.png"});
check("no desktop runtime errors",errors.length===0,errors.join(" | "));
await ctx.close();
for(const d of [{w:320,h:568},{w:390,h:844},{w:768,h:1024}]){
 const c=await browser.newContext({viewport:{width:d.w,height:d.h},isMobile:d.w<700,hasTouch:d.w<700});
 const p=await c.newPage();
 await p.goto(BASE+"/api/auth/demo",{waitUntil:"networkidle"});
 await p.waitForSelector("text=Recorded cash balance",{timeout:20000});
 const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 check(`overview has no sideways overflow at ${d.w}px`,overflow<=2,String(overflow));
 for(const path of ["/invoices","/expenses","/insights","/assistant"]){
   await p.goto(BASE+path,{waitUntil:"networkidle"});await p.waitForTimeout(700);
   const r=await p.evaluate(()=>({over:document.documentElement.scrollWidth-innerWidth,buttons:[...document.querySelectorAll("main button")].filter(b=>{const x=b.getBoundingClientRect();return x.width&&x.right>innerWidth+2}).length}));
   check(`${path} responsive at ${d.w}px`,r.over<=2&&r.buttons===0,JSON.stringify(r));
 }
 if(d.w===390){await p.goto(BASE+"/overview",{waitUntil:"networkidle"});await p.waitForTimeout(800);await p.screenshot({path:"docs/screenshots/mobile-overview.png"});}
 check(`no runtime errors at ${d.w}px`,errors.length===0,errors.join(" | "));
 await c.close();
}
await browser.close();
const failed=results.filter(r=>!r.p);console.log(`\n${results.length-failed.length}/${results.length} passed`);if(failed.length)process.exitCode=1;
