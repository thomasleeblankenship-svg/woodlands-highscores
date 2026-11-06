// ==UserScript==
// @name         Barebones Woodlands — Highscores Collector
// @namespace    woodlands-highscores
// @version      1.0.0
// @description  Save a read-only snapshot of the game's public leaderboard. No credentials collected.
// @match        https://barebones-woodlands.brandondawson101.workers.dev/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  'use strict';
  if (window.__woodlandsHighscoresCollector) return;
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const label = document.createElement('button');
  label.textContent = 'Export Highscores';
  label.setAttribute('aria-label', 'Export public Woodlands high scores to JSON');
  Object.assign(label.style, {position:'fixed',right:'14px',bottom:'14px',zIndex: '2147483646',padding:'12px 17px',border:'1px solid #53cfc0',borderRadius:'12px',background:'#102c34',color:'#dcfff6',font:'700 13px system-ui',cursor:'pointer',boxShadow:'0 8px 26px #0008'});
  function display(s){ label.textContent=s; }
  function captureRows(panel){
    // Preserve text as rendered by the game's leaderboard. Do not guess score/name boundaries.
    return [...panel.querySelectorAll('.lbl li')].slice(0,50).map((el,i)=>({rank:i+1,text:(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim()})).filter(x=>x.text);
  }
  async function waitForPanel(timeout=10000){
    const end=Date.now()+timeout;
    while(Date.now()<end){const p=document.getElementById('lbp');if(p?.querySelector('.lbl li, .lbt button'))return p;await delay(150)}
    throw Error('Leaderboard did not open. Try again after game finishes loading.');
  }
  function save(data){
    const file = new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(file),a=document.createElement('a');
    a.href=url;a.download='highscores.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  async function collect(){
    if(!window.__g?.send)throw Error('Log into the game first.');
    if(document.querySelector('#bm') && window.__miner?.running) throw Error('Press Stop on the skill bot first so it does not close the leaderboard.');
    const panelOpen=document.getElementById('lbp');
    if(!panelOpen)window.__g.send({t:'lboard'});
    const panel=await waitForPanel();
    const tabs=[...panel.querySelectorAll('.lbt button')];
    if(tabs.length<5)throw Error('The leaderboard UI changed; expected five leaderboard tabs.');
    const sub=panel.querySelector('.sub')?.textContent||'';
    const count=/of ([\d,]+) adventurers/i.exec(sub);
    const data={schema:'woodlands-highscores-v1',source:'game-leaderboard-dom',capturedAt:new Date().toISOString(),reportedAdventurers:count?count[1]:null,boards:{}};
    const fixed=['Overall','Monsters','Bosses','Quests'];
    for(let i=0;i<4;i++){
      tabs[i].click();await delay(130);
      data.boards[fixed[i]]=captureRows(panel);
    }
    tabs[4].click();await delay(130);
    const select=panel.querySelector('.lbsel select');
    if(select){
      for(const option of [...select.options]){
        select.value=option.value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        if(typeof select.onchange==='function' && !select.getAttribute('onchange')){
          // Most game versions attach a direct onchange handler; dispatchEvent already invokes it.
        }
        await delay(130);
        const title=(option.textContent||option.value).trim();
        data.boards['skill:'+title]=captureRows(panel);
      }
    }
    tabs[0].click();
    save(data);
    return {boards:Object.keys(data.boards).length,rows:Object.values(data.boards).reduce((a,b)=>a+b.length,0)};
  }
  let busy=false;
  label.addEventListener('click',async()=>{
    if(busy)return;busy=true;label.disabled=true;display('Collecting...');
    try{const info=await collect();display(`Saved ${info.rows} entries`);}
    catch(err){display('Export failed');alert('Woodlands highscores: '+(err.message||err));}
    finally{busy=false;label.disabled=false;setTimeout(()=>display('Export Highscores'),4000);}
  });
  document.body.appendChild(label);
  window.__woodlandsHighscoresCollector={collect};
})();
