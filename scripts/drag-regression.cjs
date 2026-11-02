const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
exports.dragRegression = async function(page, dir, label='drag') {
  mkdirSync(dir,{recursive:true});
  await page.locator('.react-flow__node[data-id="qa"]').waitFor();
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const nodes=[...document.querySelectorAll('.react-flow__node')];
    const viewport=document.querySelector('.react-flow__viewport');
    const edges=[...document.querySelectorAll('.react-flow__edge-path')];
    const report=window.__dragReport={frames:0,blankFrames:0,replacedFrames:0,viewportChanges:0,edgeMissingFrames:0};
    const transform=viewport.style.transform;
    const visible=n=>{for(let e=n;e;e=e.parentElement){const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return false;}const r=n.getBoundingClientRect();return !!(r.width&&r.height);};
    window.__dragRunning=true;
    const frame=()=>{if(!window.__dragRunning)return;report.frames++;
      if(nodes.some(n=>!n.isConnected)||document.querySelector('.react-flow__viewport')!==viewport)report.replacedFrames++;
      if(nodes.some(n=>{return !visible(n);}))report.blankFrames++;
      if(viewport.style.transform!==transform)report.viewportChanges++;
      if(edges.some(e=>!e.isConnected||!e.getAttribute('d')))report.edgeMissingFrames++;
      requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
  });
  const node=page.locator('.react-flow__node[data-id="qa"]');
  await page.screenshot({path:join(dir,label+'-before.png')});
  for(let i=0;i<13;i++) {
    const box=await node.boundingBox();
    const x=box.x+70,y=box.y+27,dx=i%2?-55:55,dy=i%2?-27:27;
    await page.mouse.move(x,y);await page.mouse.down();
    for(let j=1;j<=24;j++) {
      await page.mouse.move(x+dx*j/24,y+dy*j/24);
      await page.waitForTimeout(8);
      if([0,5,11].includes(i)&&j===12)await page.screenshot({path:join(dir,`${label}-during-${i}.png`)});
    }
    await page.mouse.up();
  }
  await page.waitForTimeout(700);
  const report=await page.evaluate(()=>{window.__dragRunning=false;return window.__dragReport;});
  await page.screenshot({path:join(dir,label+'-after.png')});
  writeFileSync(join(dir,label+'-frames.json'),JSON.stringify(report,null,2));
  return report;
};
