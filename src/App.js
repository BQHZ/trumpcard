import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";

/* ─── TRUMP DEFINITIONS ──────────────────────────────────────────────── */
const TD = {
  card2:{n:"2 Card",sym:"Ⅱ",color:"#1b5e20",glow:"#4caf50",d:"Draw the card valued 2 from the deck. If unavailable, nothing happens."},
  card3:{n:"3 Card",sym:"Ⅲ",color:"#1b5e20",glow:"#4caf50",d:"Draw the card valued 3. If unavailable, nothing happens."},
  card4:{n:"4 Card",sym:"Ⅳ",color:"#1b5e20",glow:"#4caf50",d:"Draw the card valued 4. If unavailable, nothing happens."},
  card5:{n:"5 Card",sym:"Ⅴ",color:"#1b5e20",glow:"#4caf50",d:"Draw the card valued 5. If unavailable, nothing happens."},
  card6:{n:"6 Card",sym:"Ⅵ",color:"#1b5e20",glow:"#4caf50",d:"Draw the card valued 6. If unavailable, nothing happens."},
  card7:{n:"7 Card",sym:"Ⅶ",color:"#1b5e20",glow:"#4caf50",d:"Draw the card valued 7. If unavailable, nothing happens."},
  remove:{n:"Remove",sym:"⌫",color:"#7f0000",glow:"#f44336",d:"Remove the last face-up card your opponent drew. It goes back to the deck."},
  ret:{n:"Return",sym:"↺",color:"#0d47a1",glow:"#2196f3",d:"Return your own last face-up card to the deck."},
  exchange:{n:"Exchange",sym:"⇌",color:"#4a148c",glow:"#9c27b0",d:"Swap your last face-up card with your opponent's last face-up card."},
  switch:{n:"Switch",sym:"⟲",color:"#bf360c",glow:"#ff5722",d:"Discard 2 trump cards at random, draw 3 new ones."},
  switchp:{n:"Switch+",sym:"⟳",color:"#870000",glow:"#e53935",d:"Discard 1 trump card at random, draw 4 new ones."},
  shield:{n:"Shield",sym:"◬",color:"#37474f",glow:"#90a4ae",d:"Place Shield on the table. (No active effect in current rules.)"},
  shieldp:{n:"Shield+",sym:"◭",color:"#263238",glow:"#607d8b",d:"Stronger Shield. (No active effect in current rules.)"},
  destroy:{n:"Destroy",sym:"✦",color:"#880e4f",glow:"#e91e63",d:"Destroy the last trump card your opponent placed on the table."},
  destroyp:{n:"Destroy+",sym:"✧",color:"#560027",glow:"#c2185b",d:"Destroy ALL trump cards your opponent has on the table."},
  destroypp:{n:"Destroy++",sym:"☩",color:"#1a0033",glow:"#7b1fa2",d:"Clear all opponent table trumps AND block their trump use while this stays on the table."},
  pdraw:{n:"Perf. Draw",sym:"⊛",color:"#7a5800",glow:"#ffc107",d:"Draw the single best possible card from the deck."},
  pdrawp:{n:"Perf.Draw+",sym:"⊕",color:"#5a4000",glow:"#ffb300",d:"Draw the best possible card from the deck."},
  udraw:{n:"Ult. Draw",sym:"⊗",color:"#4a3000",glow:"#ff8f00",d:"Draw the best possible card, then draw 2 additional trump cards."},
  go17:{n:"Go for 17",sym:"⑰",color:"#3e2723",glow:"#8d6e63",d:"Change the round target to 17. Replaces any existing Go For card."},
  go24:{n:"Go for 24",sym:"㉔",color:"#004d40",glow:"#26a69a",d:"Change the round target to 24. Replaces any existing Go For card."},
  go27:{n:"Go for 27",sym:"㉗",color:"#1a237e",glow:"#5c6bc0",d:"Change the round target to 27. Replaces any existing Go For card."},
  harvest:{n:"Harvest",sym:"✿",color:"#33691e",glow:"#8bc34a",d:"Place Harvest on table. Draw 1 bonus trump after each trump you play."},
};
const TK = Object.keys(TD);
const TIER = [
  {bg:"#030e1f",acc:"#0a2248",clr:"#90caf9",gw:"#1565c0",lbl:"ICE"},
  {bg:"#021408",acc:"#083020",clr:"#80cbc4",gw:"#00695c",lbl:"JADE"},
  {bg:"#1c0f00",acc:"#402000",clr:"#ffe082",gw:"#f9a825",lbl:"GOLD"},
  {bg:"#180000",acc:"#3e0808",clr:"#ef9a9a",gw:"#c62828",lbl:"RUBY"},
];
const cTier = v => v<=3?0:v<=6?1:v<=9?2:3;

/* ─── UTILS ──────────────────────────────────────────────────────────── */
const shuf = a => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=0|Math.random()*(i+1);[b[i],b[j]]=[b[j],b[i]];} return b; };
const rT   = n => Array.from({length:n},()=>TK[0|Math.random()*TK.length]);
const hSum = h => h.reduce((s,c)=>s+c.v,0);
const getTgt = ps => { for(const p of ps) for(const t of p.tbl){if(t==="go17")return 17;if(t==="go24")return 24;if(t==="go27")return 27;} return 21; };
const lastFU = h => { for(let i=h.length-1;i>=0;i--) if(!h[i].fd) return i; return -1; };
const bestCard = (h,deck,T) => { const s=hSum(h),ok=deck.filter(v=>s+v<=T); return ok.length?ok.reduce((b,v)=>(T-s-v)<(T-s-b)?v:b):deck.length?Math.min(...deck):null; };
const genCode = () => Math.random().toString(36).substring(2,8).toUpperCase();
const winThreshold = maxR => Math.floor(maxR/2)+1;

/* ─── GAME LOGIC ─────────────────────────────────────────────────────── */
const mkRound = (sc,rnd,mode,settings,prevTr) => {
  const d = shuf([1,2,3,4,5,6,7,8,9,10,11]);
  return {
    deck: d.slice(4),
    p: [
      {h:[{v:d[0],fd:true},{v:d[1],fd:false}], tr:[...(prevTr?.[0]||[]),...rT(2)], tbl:[], played:[], std:false, blk:false},
      {h:[{v:d[2],fd:true},{v:d[3],fd:false}], tr:[...(prevTr?.[1]||[]),...rT(2)], tbl:[], played:[], std:false, blk:false},
    ],
    sc, rnd, cur:0,
    log:[`Round ${rnd} — Target: 21`],
    phase: mode==="bot" ? "play" : "play",
    mode, settings, p2joined:false,
  };
};

const applyT = (gs,pid,tid) => {
  const s = JSON.parse(JSON.stringify(gs));
  const me = s.p[pid], op = s.p[1-pid];
  if(me.blk){s.log.push(`P${pid+1} blocked!`);return s;}
  const ix = me.tr.indexOf(tid); if(ix===-1) return s;
  me.tr.splice(ix,1); me.played.push(tid);
  const T=getTgt(s.p), harv=me.tbl.includes("harvest");
  const who = pid===0?(gs.mode==="bot"?"You":"P1"):(gs.mode==="bot"?"Bot":"P2");
  let msg = `${who}: ${TD[tid]?.n}`;
  const nm = tid.match(/^card(\d+)$/);
  if(nm){
    const val=+nm[1], di=s.deck.indexOf(val);
    if(di!==-1){s.deck.splice(di,1);me.h.push({v:val,fd:false});msg+=` → Drew ${val} (${hSum(me.h)})`;}
    else msg+=` → Not in deck`;
  } else {
    switch(tid){
      case"remove":{const fi=lastFU(op.h);if(fi!==-1){const c=op.h.splice(fi,1)[0];s.deck.push(c.v);msg+=` → Removed opp's ${c.v}`;}else msg+=` → No face-up`;break;}
      case"ret":{const fi=lastFU(me.h);if(fi!==-1){const c=me.h.splice(fi,1)[0];s.deck.push(c.v);msg+=` → Returned ${c.v}`;}else msg+=` → No face-up`;break;}
      case"exchange":{const mi=lastFU(me.h),oi=lastFU(op.h);if(mi!==-1&&oi!==-1){const mv=me.h[mi].v,ov=op.h[oi].v;me.h[mi]={v:ov,fd:false};op.h[oi]={v:mv,fd:false};msg+=` → Swapped ${mv}↔${ov}`;}else msg+=` → Need face-up both`;break;}
      case"switch":{const d=Math.min(2,me.tr.length);for(let i=0;i<d;i++)me.tr.splice(0|Math.random()*me.tr.length,1);me.tr.push(...rT(3));msg+=` → -${d}+3`;break;}
      case"switchp":{const d=Math.min(1,me.tr.length);for(let i=0;i<d;i++)me.tr.splice(0|Math.random()*me.tr.length,1);me.tr.push(...rT(4));msg+=` → -${d}+4`;break;}
      case"shield":case"shieldp":me.tbl.push(tid);msg+=` → On table`;break;
      case"destroy":{if(op.tbl.length>0){const r=op.tbl.pop();if(r==="destroypp")op.blk=false;msg+=` → Removed ${TD[r]?.n}`;}else msg+=` → Empty`;break;}
      case"destroyp":{const had=op.tbl.length;op.tbl=[];op.blk=false;msg+=had?` → Cleared ${had}`:` → Empty`;break;}
      case"destroypp":op.tbl=[];op.blk=true;me.tbl.push(tid);msg+=` → Blocked opp!`;break;
      case"pdraw":case"pdrawp":{const bc=bestCard(me.h,s.deck,T);if(bc!==null){s.deck.splice(s.deck.indexOf(bc),1);me.h.push({v:bc,fd:false});msg+=` → Drew ${bc} (${hSum(me.h)})`;}else msg+=` → Deck empty`;break;}
      case"udraw":{const bc=bestCard(me.h,s.deck,T);if(bc!==null){s.deck.splice(s.deck.indexOf(bc),1);me.h.push({v:bc,fd:false});msg+=` → Drew ${bc}`;}else msg+=` → Deck empty`;me.tr.push(...rT(2));msg+=` +2 trumps`;break;}
      case"go17":case"go24":case"go27":{for(const p of s.p)p.tbl=p.tbl.filter(t=>!t.startsWith("go"));me.tbl.push(tid);const nT=tid==="go17"?17:tid==="go24"?24:27;msg+=` → Target ${nT}`;break;}
      case"harvest":me.tbl.push(tid);msg+=` → Active`;break;
      default:break;
    }
  }
  if(harv&&tid!=="harvest"){me.tr.push(...rT(1));msg+=` (Harvest+1)`;}
  s.log.push(msg);
  s.p[0].blk = s.p[1].tbl.includes("destroypp");
  s.p[1].blk = s.p[0].tbl.includes("destroypp");
  s.p[1-pid].std = false;
  return s;
};

const checkEnd = s => {
  if(!s.p[0].std||!s.p[1].std) return s;
  const T=getTgt(s.p),[p0,p1]=s.p,s0=hSum(p0.h),s1=hSum(p1.h),b0=s0>T,b1=s1>T;
  let w,msg;
  if(b0&&b1){w=-1;msg="Both busted — Draw!";}
  else if(b0){w=1;msg=`P2 wins (${s0} vs ${s1})`;}
  else if(b1){w=0;msg=`P1 wins (${s0} vs ${s1})`;}
  else{const d0=Math.abs(T-s0),d1=Math.abs(T-s1);if(d0<d1){w=0;msg=`P1 wins! ${s0} vs ${s1}`;}else if(d1<d0){w=1;msg=`P2 wins! ${s1} vs ${s0}`;}else{w=-1;msg=`Draw! Both ${s0}`;}}
  const ns=JSON.parse(JSON.stringify(s));
  ns.winner=w; ns.phase="reveal";
  if(w>=0) ns.sc[w]++;
  ns.log.push(`— ${msg} —`);
  const maxR=ns.settings?.maxRounds||5;
  if(Math.max(...ns.sc)>=winThreshold(maxR)) ns.matchOver=true;
  return ns;
};

const botAct = gs => {
  const T=getTgt(gs.p),bot=gs.p[1],opp=gs.p[0],sum=hSum(bot.h);
  if(!bot.blk){
    if(sum>T){
      if(bot.tr.includes("ret")){const ns=applyT(gs,1,"ret");ns.p[0].std=false;return ns;}
      const bi=lastFU(bot.h),oi=lastFU(opp.h);
      if(bot.tr.includes("exchange")&&bi!==-1&&oi!==-1&&bot.h[bi].v>opp.h[oi].v){const ns=applyT(gs,1,"exchange");ns.p[0].std=false;return ns;}
    }
    if(sum<T-5&&bot.tr.includes("udraw")&&Math.random()>0.5){const ns=applyT(gs,1,"udraw");ns.p[0].std=false;return ns;}
    if(sum<T-4&&bot.tr.includes("pdraw")&&Math.random()>0.45){const ns=applyT(gs,1,"pdraw");ns.p[0].std=false;return ns;}
    if(Math.random()>0.9&&bot.tr.includes("remove")){const ns=applyT(gs,1,"remove");ns.p[0].std=false;return ns;}
  }
  const ns=JSON.parse(JSON.stringify(gs));
  const s2=hSum(ns.p[1].h);
  const stand=s2>T||gs.deck.length===0||(s2>=T-1)||(s2>=T-2&&Math.random()>0.3)||(s2>=T-4&&Math.random()>0.6);
  if(stand){ns.p[1].std=true;ns.log.push(`Bot stands at ${s2}.`);}
  else{const c=ns.deck.shift();ns.p[1].h.push({v:c,fd:false});ns.log.push(`Bot draws (${hSum(ns.p[1].h)})`);ns.p[0].std=false;}
  const ck=checkEnd(ns);
  if(ck.phase!=="play") return ck;
  return {...ck,cur:0};
};

/* ─── GLOBAL STYLES ──────────────────────────────────────────────────── */
const GFX = `
  @keyframes cIn{from{opacity:0;transform:translateY(-14px) rotateX(50deg)}to{opacity:1;transform:none}}
  @keyframes cardFlip{0%{transform:perspective(300px) rotateX(4deg) rotateY(0deg) scale(1)}25%{transform:perspective(300px) rotateX(4deg) rotateY(90deg) scale(1.12)}75%{transform:perspective(300px) rotateX(4deg) rotateY(270deg) scale(1.12)}100%{transform:perspective(300px) rotateX(4deg) rotateY(360deg) scale(1)}}
  @keyframes spin{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}
  @keyframes pulse{0%,100%{opacity:0.3}50%{opacity:1}}
  @keyframes slideIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
  @keyframes popIn{from{opacity:0;transform:scale(0.88) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes revealGlow{0%,100%{box-shadow:0 0 20px rgba(212,192,64,0.15)}50%{box-shadow:0 0 40px rgba(212,192,64,0.4)}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes timerPulse{0%,100%{opacity:1}50%{opacity:0.6}}
  @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
`;
const FELT = {minHeight:"100vh",background:"radial-gradient(ellipse at 50% 30%,#1a4828 0%,#0c2815 55%,#040c08 100%)",fontFamily:"Georgia,'Times New Roman',serif",color:"#d4c078"};
const GL = "linear-gradient(90deg,transparent,rgba(212,192,120,0.18) 20%,rgba(212,192,120,0.32) 50%,rgba(212,192,120,0.18) 80%,transparent)";

/* ─── GAME CARD ──────────────────────────────────────────────────────── */
const GameCard = ({v,fd,idx=0,small=false,justFlipped=false}) => {
  const t=v?TIER[cTier(v)]:TIER[0];
  const W=small?44:58, H=small?64:84;
  return (
    <div style={{width:W,height:H,flexShrink:0,animation:justFlipped?"cardFlip .55s ease both":`cIn .3s ease ${idx*55}ms both`}}>
      <div style={{width:"100%",height:"100%",borderRadius:7,transform:"perspective(200px) rotateX(4deg)",boxShadow:fd?"0 6px 18px rgba(0,0,0,0.8)":`0 6px 18px rgba(0,0,0,0.7),0 0 14px ${t.gw}55`}}>
        {fd ? (
          <div style={{width:"100%",height:"100%",borderRadius:7,background:"linear-gradient(145deg,#400000,#720808)",border:"1.5px solid rgba(200,160,80,0.45)",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:3,borderRadius:5,border:"1px solid rgba(200,160,80,0.15)",backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(200,160,80,0.04) 4px,rgba(200,160,80,0.04) 5px)"}}/>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
              <div style={{fontSize:7,letterSpacing:2,color:"rgba(200,160,80,0.35)",fontFamily:"Georgia,serif",textTransform:"uppercase"}}>ROYAL</div>
              <div style={{fontSize:small?16:20,color:"rgba(200,160,80,0.45)"}}>◆</div>
              <div style={{fontSize:7,letterSpacing:2,color:"rgba(200,160,80,0.35)",fontFamily:"Georgia,serif",textTransform:"uppercase"}}>TRUMP</div>
            </div>
          </div>
        ) : (
          <div style={{width:"100%",height:"100%",borderRadius:7,background:`linear-gradient(145deg,${t.acc},${t.bg})`,border:`1.5px solid ${t.gw}44`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(circle,${t.gw}18 1px,transparent 1px)`,backgroundSize:"6px 6px"}}/>
            <div style={{position:"absolute",top:3,left:4}}>
              <div style={{fontSize:small?9:11,fontWeight:900,color:t.clr,lineHeight:1,textShadow:`0 0 8px ${t.gw}`}}>{v}</div>
              <div style={{fontSize:5,color:t.gw,lineHeight:1}}>◆</div>
            </div>
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:small?22:30,fontWeight:900,color:t.clr,textShadow:`0 0 18px ${t.gw},0 0 6px ${t.gw}88`}}>{v}</span>
            </div>
            <div style={{position:"absolute",bottom:small?8:10,left:0,right:0,textAlign:"center",fontSize:5,letterSpacing:2,color:`${t.gw}88`,fontFamily:"Georgia,serif",textTransform:"uppercase"}}>{t.lbl}</div>
            <div style={{position:"absolute",bottom:3,right:4,transform:"rotate(180deg)"}}>
              <div style={{fontSize:small?9:11,fontWeight:900,color:t.clr,lineHeight:1}}>{v}</div>
              <div style={{fontSize:5,color:t.gw,lineHeight:1}}>◆</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── TRUMP CARD ─────────────────────────────────────────────────────── */
const TrumpCard = ({tid,onClick,disabled,size=62}) => {
  const t=TD[tid];
  const [tip,setTip]=useState(false);
  const [tipDir,setTipDir]=useState("center");
  const hRef=useRef(null);
  const cRef=useRef(null);
  const H=Math.round(size*1.42);
  if(!t) return null;
  const enter = () => {
    if(cRef.current){
      const r=cRef.current.getBoundingClientRect(),tw=200;
      if(r.left<tw/2+10) setTipDir("right");
      else if(window.innerWidth-r.right<tw/2+10) setTipDir("left");
      else setTipDir("center");
    }
    hRef.current=setTimeout(()=>setTip(true),900);
  };
  const leave = () => { clearTimeout(hRef.current); setTip(false); };
  const tipPos = tipDir==="right"?{left:0}:tipDir==="left"?{right:0}:{left:"50%",transform:"translateX(-50%)"};
  return (
    <div ref={cRef} style={{position:"relative",width:size,height:H,flexShrink:0}} onMouseEnter={enter} onMouseLeave={leave}>
      <button onClick={onClick} disabled={disabled}
        style={{width:"100%",height:"100%",padding:0,border:"none",background:"none",cursor:disabled?"not-allowed":"pointer",borderRadius:8,transform:disabled?"none":"perspective(200px) rotateX(4deg)",boxShadow:disabled?"none":`0 5px 14px rgba(0,0,0,0.6),0 0 10px ${t.glow}44,0 4px 0 ${t.color}aa`,transition:"transform 0.15s,box-shadow 0.15s"}}
        onMouseEnter={e=>{if(!disabled){e.currentTarget.style.transform="perspective(200px) rotateX(0deg) translateY(-6px) scale(1.07)";e.currentTarget.style.boxShadow=`0 14px 28px rgba(0,0,0,0.7),0 0 20px ${t.glow}99,0 6px 0 ${t.color}aa`;}}}
        onMouseLeave={e=>{e.currentTarget.style.transform=disabled?"none":"perspective(200px) rotateX(4deg)";e.currentTarget.style.boxShadow=disabled?"none":`0 5px 14px rgba(0,0,0,0.6),0 0 10px ${t.glow}44,0 4px 0 ${t.color}aa`;}}>
        <div style={{width:"100%",height:"100%",borderRadius:8,background:`linear-gradient(145deg,${t.color}ee,${t.color}88)`,border:`1.5px solid ${t.glow}66`,position:"relative",overflow:"hidden",opacity:disabled?0.25:1}}>
          <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(circle,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:"6px 6px"}}/>
          <div style={{position:"absolute",top:3,left:4,fontSize:7,letterSpacing:1,color:`${t.glow}99`,fontFamily:"Georgia,serif",textTransform:"uppercase",fontWeight:700}}>TC</div>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:size>50?28:20,color:t.glow,textShadow:`0 0 14px ${t.glow}`,lineHeight:1}}>{t.sym}</div>
          </div>
          <div style={{position:"absolute",bottom:3,left:0,right:0,textAlign:"center",fontSize:6,letterSpacing:0.5,color:`${t.glow}cc`,fontFamily:"Georgia,serif",textTransform:"uppercase",fontWeight:700,lineHeight:1.2,padding:"0 3px"}}>{t.n}</div>
          {disabled&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.55)",borderRadius:8}}/>}
        </div>
      </button>
      {tip&&!disabled&&(
        <div style={{position:"absolute",bottom:"110%",zIndex:999,width:200,background:"rgba(4,2,0,0.97)",border:`1px solid ${t.glow}55`,borderRadius:10,padding:"10px 12px",boxShadow:`0 8px 28px rgba(0,0,0,0.85),0 0 14px ${t.glow}44`,pointerEvents:"none",...tipPos}}>
          <div style={{fontSize:11,fontWeight:700,color:t.glow,marginBottom:5,fontFamily:"Georgia,serif"}}>{t.sym} {t.n}</div>
          <div style={{fontSize:10.5,color:"#a08060",lineHeight:1.6}}>{t.d}</div>
        </div>
      )}
    </div>
  );
};

/* ─── TABLE TRUMP ────────────────────────────────────────────────────── */
const TableTrump = ({tid,active=false}) => {
  const t=TD[tid]; if(!t) return null;
  return (
    <div style={{width:44,height:62,flexShrink:0,borderRadius:7,background:`linear-gradient(145deg,${t.color}cc,${t.color}66)`,border:`1.5px solid ${active?t.glow+"88":t.glow+"33"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,boxShadow:active?`0 3px 10px rgba(0,0,0,0.5),0 0 10px ${t.glow}55`:"0 2px 6px rgba(0,0,0,0.4)",opacity:active?1:0.6,position:"relative"}}>
      <div style={{fontSize:18,color:t.glow,textShadow:active?`0 0 12px ${t.glow}`:"none",lineHeight:1}}>{t.sym}</div>
      <div style={{fontSize:5.5,color:`${t.glow}cc`,fontFamily:"Georgia,serif",textTransform:"uppercase",letterSpacing:0.5,textAlign:"center",lineHeight:1.2,padding:"0 3px"}}>{t.n}</div>
      {active&&<div style={{position:"absolute",top:-3,right:-3,width:7,height:7,borderRadius:"50%",background:t.glow,boxShadow:`0 0 6px ${t.glow}`}}/>}
    </div>
  );
};

/* ─── CHIP ───────────────────────────────────────────────────────────── */
const Chip = ({n,color,label}) => (
  <div style={{textAlign:"center"}}>
    <div style={{width:38,height:38,borderRadius:"50%",margin:"0 auto",background:`radial-gradient(circle at 35% 30%,${color}ee,${color}88)`,border:"3px solid rgba(255,255,255,0.18)",boxShadow:`0 4px 10px rgba(0,0,0,0.5),inset 0 1px 0 rgba(255,255,255,0.2)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff",textShadow:"0 1px 3px rgba(0,0,0,0.8)"}}>{n}</div>
    {label&&<div style={{fontSize:8,color:"#5a4a30",marginTop:4,letterSpacing:0.8,textTransform:"uppercase"}}>{label}</div>}
  </div>
);

/* ─── LOG ────────────────────────────────────────────────────────────── */
const LogPanel = ({log}) => {
  const el=useRef(null);
  useEffect(()=>{if(el.current) el.current.scrollTop=el.current.scrollHeight;},[log]);
  return (
    <div ref={el} style={{height:"100%",overflowY:"auto",padding:"6px 8px"}}>
      {log.map((l,i)=><div key={i} style={{fontSize:10.5,color:i===log.length-1?"#d4c078":"#3a3020",padding:"2px 0",lineHeight:1.4,borderBottom:"1px solid rgba(255,255,255,0.02)"}}>{l}</div>)}
    </div>
  );
};

/* ─── BTN 3D ─────────────────────────────────────────────────────────── */
const Btn3D = ({label,onClick,disabled,top,bot,shad,sx={}}) => {
  const [pr,setPr]=useState(false);
  return (
    <button onMouseDown={()=>setPr(true)} onMouseUp={()=>setPr(false)} onMouseLeave={()=>setPr(false)} onClick={onClick} disabled={disabled}
      style={{padding:"11px 28px",fontSize:14,fontWeight:900,borderRadius:11,border:"none",cursor:disabled?"not-allowed":"pointer",background:disabled?"rgba(8,6,2,0.6)":pr?bot:`linear-gradient(180deg,${top},${bot})`,color:disabled?"#1e1a10":"#fff",boxShadow:disabled?"none":pr?`0 1px 0 ${shad}`:`0 5px 0 ${shad},0 7px 14px rgba(0,0,0,0.5)`,transform:pr?"translateY(4px)":"none",transition:"all 0.09s",letterSpacing:"0.5px",textShadow:disabled?"none":"0 1px 2px rgba(0,0,0,0.5)",fontFamily:"Georgia,serif",...sx}}>
      {label}
    </button>
  );
};

/* ─── COUNTDOWN TIMER ────────────────────────────────────────────────── */
const CountdownTimer = ({seconds,onExpire,active}) => {
  const [left,setLeft]=useState(seconds);
  const [shake,setShake]=useState(false);
  useEffect(()=>{setLeft(seconds);},[seconds]);
  useEffect(()=>{
    if(!active) return;
    const id=setInterval(()=>{
      setLeft(p=>{
        if(p<=1){clearInterval(id);onExpire();return 0;}
        if(p===6){setShake(true);setTimeout(()=>setShake(false),400);}
        return p-1;
      });
    },1000);
    return()=>clearInterval(id);
  },[active,onExpire]);
  const pct=(left/seconds)*100;
  const urgent=left<=10;
  const col=urgent?"#ef5350":left<=20?"#ffa726":"#69f0ae";
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{position:"relative",width:44,height:44,flexShrink:0,animation:shake?"shake 0.4s ease":"none"}}>
        <svg width="44" height="44" style={{transform:"rotate(-90deg)"}}>
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
          <circle cx="22" cy="22" r="18" fill="none" stroke={col} strokeWidth="3"
            strokeDasharray={`${2*Math.PI*18}`}
            strokeDashoffset={`${2*Math.PI*18*(1-pct/100)}`}
            style={{transition:"stroke-dashoffset 0.9s linear,stroke 0.3s"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:col,animation:urgent?"timerPulse 0.8s ease infinite":"none"}}>{left}</div>
      </div>
      <div style={{fontSize:9,color:"#3a3020",letterSpacing:1,textTransform:"uppercase",lineHeight:1.4}}>Turn<br/>Timer</div>
    </div>
  );
};

/* ─── PLAYER ROW ─────────────────────────────────────────────────────── */
const PlayerRow = ({player,pid,isMe,isBot,mode,T,flippedSet}) => {
  // For "me": see all cards face-up. For opponent: respect fd flag.
  const viewHand = player.h.map(c=>({...c, fd: isMe ? false : c.fd}));
  const s=hSum(viewHand), bust=s>T;
  const visSum=viewHand.filter(c=>!c.fd).reduce((a,c)=>a+c.v,0);
  const hiddenCount=viewHand.filter(c=>c.fd).length;
  const pColor=pid===0?"#7ec8e3":"#f0a080";
  const label=mode==="bot"?(pid===0?"You":"Bot"):(isMe?"You":"Opponent");
  return (
    <div style={{display:"flex",alignItems:"center",gap:16,width:"100%"}}>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flexShrink:0,width:64}}>
        <div style={{width:44,height:44,borderRadius:"50%",background:pid===0?"#0d2a4a":"#4a0808",border:`2px solid ${pColor}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:pid===1&&isBot?20:14,fontWeight:900,color:pColor,boxShadow:`0 2px 8px ${pColor}33`}}>{pid===1&&isBot?"🤖":isMe?"Me":"Opp"}</div>
        <div style={{fontSize:9,color:pColor,fontWeight:700,letterSpacing:0.5,textAlign:"center"}}>{label}</div>
        <div style={{fontSize:8,color:player.std?"#8bc34a":player.blk?"#f44336":"#3a3020"}}>{player.std?"STAND":player.blk?"BLOCKED":"ACTIVE"}</div>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center",flex:1,flexWrap:"wrap"}}>
        {viewHand.map((c,i)=>(
          <GameCard key={i} v={c.v} fd={c.fd} idx={i} justFlipped={!!flippedSet&&flippedSet.has(`${pid}-${i}`)}/>
        ))}
      </div>
      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <div style={{minWidth:56,height:46,borderRadius:10,background:isMe?(bust?"rgba(100,0,0,0.7)":s===T?"rgba(0,90,35,0.7)":"rgba(5,3,1,0.7)"):"rgba(5,3,1,0.7)",border:`1px solid ${isMe?(bust?"#b02020":s===T?"#2e7d32":"rgba(212,192,120,0.12)"):"rgba(212,192,120,0.12)"}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:isMe&&s===T?"0 0 14px rgba(0,180,70,0.3)":isMe&&bust?"0 0 12px rgba(190,0,0,0.3)":"none"}}>
          {hiddenCount>0
            ?<div style={{fontSize:12,fontWeight:900,color:"#d4c078",textAlign:"center",padding:"0 4px"}}>?+{visSum}</div>
            :<>
              <div style={{fontSize:18,fontWeight:900,color:bust?"#ff5252":s===T?"#69f0ae":"#d4c078",lineHeight:1}}>{s}</div>
              {bust&&<div style={{fontSize:6,color:"#ff6060",fontWeight:700,letterSpacing:1}}>BUST</div>}
              {!bust&&s===T&&<div style={{fontSize:6,color:"#69f0ae",fontWeight:700}}>EXACT!</div>}
            </>}
        </div>
        <div style={{fontSize:8,color:"#2a2015"}}>{hiddenCount>0?"visible":"total"}</div>
      </div>
    </div>
  );
};

/* ─── ROUND END POPUP ────────────────────────────────────────────────── */
const RoundPopup = ({gs,T,myPid,onNext,onHome}) => {
  const isBot=gs.mode==="bot";
  const wLabel=gs.winner===-1?"Draw":gs.winner===myPid?"You Win!":"Opponent Wins!";
  const wc=gs.winner===myPid?"#7ec8e3":gs.winner===-1?"#d4c078":"#f0a080";
  const maxR=gs.settings?.maxRounds||5, need=winThreshold(maxR);
  return (
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.75)"}}>
      <div style={{background:"radial-gradient(ellipse at 50% 20%,#1a3020 0%,#080e0a 100%)",border:"1.5px solid rgba(212,192,120,0.3)",borderRadius:20,padding:"32px 40px",minWidth:420,maxWidth:520,boxShadow:"0 24px 60px rgba(0,0,0,0.9)",animation:"popIn .35s cubic-bezier(0.34,1.56,0.64,1) both",textAlign:"center"}}>
        <div style={{height:2,width:"80%",background:GL,margin:"0 auto 16px",borderRadius:2}}/>
        <div style={{fontSize:28,fontWeight:900,color:wc,letterSpacing:2,marginBottom:4}}>{wLabel}</div>
        <div style={{fontSize:10,color:"#4a4030",letterSpacing:2,marginBottom:18,textTransform:"uppercase"}}>Round {gs.rnd} · First to {need} wins · {maxR}-round match</div>
        <div style={{display:"flex",gap:32,justifyContent:"center",marginBottom:18}}>
          {gs.p.map((p,i)=>{
            const sv=hSum(p.h), bv=sv>T;
            return (
              <div key={i} style={{textAlign:"center"}}>
                <div style={{color:i===myPid?"#7ec8e3":"#f0a080",fontWeight:700,marginBottom:7,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>{i===myPid?"You":"Opponent"}</div>
                <div style={{display:"flex",gap:4,justifyContent:"center"}}>{p.h.map((c,j)=><GameCard key={j} v={c.v} fd={false} idx={j} small/>)}</div>
                <div style={{marginTop:6,fontSize:18,fontWeight:900,color:bv?"#ff5252":"#d4c078"}}>{sv}{bv?" 💀":""}</div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:20,justifyContent:"center",marginBottom:22}}>
          <Chip n={gs.sc[myPid]} color="#1565c0" label="You"/>
          <div style={{display:"flex",flexDirection:"column",justifyContent:"center",gap:2,textAlign:"center"}}>
            <div style={{fontSize:9,color:"#3a3020",letterSpacing:2,textTransform:"uppercase"}}>Score</div>
            <div style={{fontSize:22,fontWeight:900,color:"#6a5820"}}>{gs.sc[myPid]} — {gs.sc[1-myPid]}</div>
          </div>
          <Chip n={gs.sc[1-myPid]} color="#6a1b1b" label={isBot?"Bot":"Opp"}/>
        </div>
        <div style={{height:1,width:"80%",background:GL,margin:"0 auto 18px",borderRadius:1}}/>
        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          <Btn3D label={gs.rnd<(gs.settings?.maxRounds||5)?"NEXT ROUND →":"NEW MATCH"} onClick={onNext} top="#d4a820" bot="#9a7010" shad="#5a4000"/>
          <Btn3D label="HOME" onClick={onHome} top="#3a3020" bot="#1a1810" shad="#0a0804"/>
        </div>
      </div>
    </div>
  );
};

/* ─── SETTINGS MODAL ─────────────────────────────────────────────────── */
const SettingsModal = ({settings,onChange,onClose}) => {
  const [s,setS]=useState(settings);
  const update=k=>v=>setS(p=>({...p,[k]:v}));
  const opts=(vals,cur,set,label,fmt)=>(
    <div style={{marginBottom:16}}>
      <div style={{fontSize:10,letterSpacing:2,color:"#5a4a30",textTransform:"uppercase",marginBottom:8}}>{label}</div>
      <div style={{display:"flex",gap:8}}>
        {vals.map(v=>(
          <button key={v} onClick={()=>set(v)} style={{flex:1,padding:"10px 0",borderRadius:10,border:`1px solid ${cur===v?"rgba(212,192,120,0.6)":"rgba(212,192,120,0.15)"}`,background:cur===v?"rgba(212,192,64,0.12)":"rgba(0,0,0,0.3)",color:cur===v?"#d4c078":"#5a4a30",cursor:"pointer",fontSize:13,fontWeight:cur===v?900:400,fontFamily:"Georgia,serif",transition:"all 0.15s"}}>{fmt(v)}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.8)"}}>
      <div style={{background:"radial-gradient(ellipse at 50% 0%,#1a3020,#080e0a)",border:"1.5px solid rgba(212,192,120,0.25)",borderRadius:18,padding:"28px 32px",width:380,boxShadow:"0 24px 60px rgba(0,0,0,0.9)",animation:"popIn .3s ease both"}}>
        <div style={{fontSize:16,fontWeight:900,color:"#d4c078",letterSpacing:2,marginBottom:20,textAlign:"center",textTransform:"uppercase"}}>⚙ Room Settings</div>
        {opts([3,5,10],s.maxRounds,update("maxRounds"),"Rounds",v=>`${v} Rounds`)}
        {opts([15,30,45,60],s.timerSec,update("timerSec"),"Turn Timer",v=>v<60?`${v}s`:"1 min")}
        <div style={{display:"flex",gap:10,marginTop:8}}>
          <Btn3D label="Cancel" onClick={onClose} top="#3a3020" bot="#1a1810" shad="#0a0804" sx={{flex:1,padding:"10px 0"}}/>
          <Btn3D label="Save" onClick={()=>{onChange(s);onClose();}} top="#d4a820" bot="#9a7010" shad="#5a4000" sx={{flex:1,padding:"10px 0"}}/>
        </div>
      </div>
    </div>
  );
};

/* ─── CREATE ROOM ────────────────────────────────────────────────────── */
const CreateRoomScreen = ({settings,onBack,roomCodeRef,setRoomCode,setMyPid,setGs,lastPushed}) => {
  const code=useRef(genCode()).current;
  const [status,setStatus]=useState("inserting");
  const [copied,setCopied]=useState(false);
  const [joinedState,setJoinedState]=useState(null);

  // Insert room
  useEffect(()=>{
    const init=mkRound([0,0],1,"pvp",settings,null);
    init.p2joined=false;
    supabase.from("rooms").insert({code,state:init})
      .then(({error})=>{
        if(error){console.error(error);setStatus("error");}
        else setStatus("waiting");
      });
  },[]);// eslint-disable-line

  // Poll every 1.5s for p2joined
  useEffect(()=>{
    if(status!=="waiting") return;
    const iv=setInterval(async()=>{
      const {data,error}=await supabase.from("rooms").select("state").eq("code",code).single();
      if(!error && data?.state?.p2joined===true){
        clearInterval(iv);
        setJoinedState(data.state);
      }
    },1500);
    return()=>clearInterval(iv);
  },[status]);// eslint-disable-line

  // When joined — update App state (App will navigate via its own useEffect)
  useEffect(()=>{
    if(!joinedState) return;
    roomCodeRef.current=code;
    setRoomCode(code);
    setMyPid(0);
    lastPushed.current=JSON.stringify(joinedState);
    setGs(joinedState);
  },[joinedState]);// eslint-disable-line

  const copy=()=>{navigator.clipboard?.writeText(code).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2000);};

  return (
    <div style={{...FELT,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:24}}>
      <style>{GFX}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:11,letterSpacing:5,color:"#5a4820",textTransform:"uppercase",marginBottom:6}}>
          {status==="inserting"?"Creating Room...":status==="error"?"Error!":"Room Ready"}
        </div>
        <div style={{fontSize:22,fontWeight:900,color:"#d4c078"}}>
          {status==="waiting"?"Waiting for opponent...":status==="error"?"Failed to create room":"Setting up..."}
        </div>
      </div>
      {status==="waiting"&&(
        <>
          <div style={{background:"rgba(0,0,0,0.5)",border:"1.5px solid rgba(212,192,120,0.3)",borderRadius:16,padding:"28px 40px",textAlign:"center"}}>
            <div style={{fontSize:11,letterSpacing:3,color:"#5a4820",textTransform:"uppercase",marginBottom:10}}>Room Code</div>
            <div style={{fontSize:48,fontWeight:900,color:"#d4c078",letterSpacing:8,marginBottom:16}}>{code}</div>
            <button onClick={copy} style={{padding:"8px 24px",borderRadius:10,border:"1px solid rgba(212,192,120,0.3)",background:copied?"rgba(100,200,100,0.15)":"rgba(212,192,120,0.08)",color:copied?"#8bc34a":"#d4c078",cursor:"pointer",fontSize:13,fontFamily:"Georgia,serif"}}>
              {copied?"✓ Copied!":"Copy Code"}
            </button>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:"#c08040",animation:`pulse 1s ease ${i*0.25}s infinite`}}/>)}
            <span style={{fontSize:13,color:"#6a5820",marginLeft:6,fontStyle:"italic"}}>Waiting for Player 2...</span>
          </div>
          <div style={{fontSize:10,color:"#2a2015"}}>Settings: {settings.maxRounds} rounds · {settings.timerSec}s timer</div>
        </>
      )}
      {status==="inserting"&&<div style={{fontSize:13,color:"#6a5820"}}>Creating room...</div>}
      {status==="error"&&<div style={{fontSize:13,color:"#ff8080"}}>Could not create room. Try again.</div>}
      <Btn3D label="← Back" onClick={onBack} top="#3a3020" bot="#1a1810" shad="#0a0804"/>
    </div>
  );
};

/* ─── JOIN ROOM ──────────────────────────────────────────────────────── */
const JoinRoomScreen = ({onBack,onJoin}) => {
  const [code,setCode]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const submit=async()=>{
    if(code.trim().length<4){setErr("Please enter a valid room code.");return;}
    setLoading(true);setErr("");
    await onJoin(code.trim().toUpperCase());
    setLoading(false);
  };
  return (
    <div style={{...FELT,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:24}}>
      <style>{GFX}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:11,letterSpacing:5,color:"#5a4820",textTransform:"uppercase",marginBottom:6}}>Join a Game</div>
        <div style={{fontSize:22,fontWeight:900,color:"#d4c078"}}>Enter Room Code</div>
      </div>
      <div style={{background:"rgba(0,0,0,0.5)",border:"1.5px solid rgba(212,192,120,0.25)",borderRadius:16,padding:"28px 36px",textAlign:"center",minWidth:320}}>
        <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().slice(0,8))}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          placeholder="e.g. AB12CD"
          style={{width:"100%",padding:"14px 16px",fontSize:24,letterSpacing:6,textAlign:"center",fontWeight:900,borderRadius:10,border:`1px solid ${err?"rgba(240,80,80,0.5)":"rgba(212,192,120,0.3)"}`,background:"rgba(0,0,0,0.4)",color:"#d4c078",outline:"none",fontFamily:"Georgia,serif",boxSizing:"border-box",marginBottom:8}}/>
        {err&&<div style={{fontSize:11,color:"#ff6060",marginBottom:8}}>{err}</div>}
        <Btn3D label={loading?"Joining...":"Join Room"} onClick={submit} disabled={loading} top="#d4a820" bot="#9a7010" shad="#5a4000" sx={{width:"100%",padding:"12px 0"}}/>
      </div>
      <Btn3D label="← Back" onClick={onBack} top="#3a3020" bot="#1a1810" shad="#0a0804"/>
    </div>
  );
};

/* ─── MAIN APP ───────────────────────────────────────────────────────── */
export default function App() {
  const DEF_SETTINGS={maxRounds:5,timerSec:30};
  const [screen,setScreen]=useState("home");
  const [settings,setSettings]=useState(DEF_SETTINGS);
  const [showSettings,setShowSettings]=useState(false);
  const [gs,setGs]=useState(null);
  const [showLog,setShowLog]=useState(false);
  const [flippedSet,setFlippedSet]=useState(new Set());
  const [timerKey,setTimerKey]=useState(0);
  const [roomCode,setRoomCode]=useState(null);
  const [myPid,setMyPid]=useState(0);
  const botRef=useRef(null);
  const revTimers=useRef([]);
  const roomCodeRef=useRef(null);
  const lastPushed=useRef(null);
  const needsPush=useRef(false);

  /* ── AUTO-NAVIGATE: when host's gs is set with p2joined, go to game ── */
  useEffect(()=>{
    if(!gs) return;
    if(gs.p2joined===true && screen==="create"){
      setScreen("game");
      setTimerKey(k=>k+1);
    }
  },[gs]);// eslint-disable-line

  /* ── BOT TURN ── */
  useEffect(()=>{
    if(!gs||gs.phase!=="play"||gs.cur!==1||gs.mode!=="bot") return;
    const d=800+Math.random()*600;
    botRef.current=setTimeout(()=>{
      setGs(prev=>{if(!prev||prev.phase!=="play"||prev.cur!==1) return prev; return botAct(prev);});
    },d);
    return()=>clearTimeout(botRef.current);
  },[gs]);

  /* ── REVEAL ANIMATION ── */
  useEffect(()=>{
    if(!gs||gs.phase!=="reveal") return;
    revTimers.current.forEach(clearTimeout);
    revTimers.current=[];
    setFlippedSet(new Set());
    const flips=[];
    gs.p.forEach((p,pid)=>p.h.forEach((c,ci)=>{if(c.fd) flips.push({pid,ci,key:`${pid}-${ci}`});}));
    flips.forEach(({pid,ci,key},i)=>{
      const t1=setTimeout(()=>{
        setFlippedSet(prev=>new Set([...prev,key]));
        setGs(prev=>{
          if(!prev||prev.phase!=="reveal") return prev;
          const ns=JSON.parse(JSON.stringify(prev));
          ns.p[pid].h[ci].fd=false;
          return ns;
        });
      },500+i*500);
      revTimers.current.push(t1);
      const t2=setTimeout(()=>setFlippedSet(prev=>{const s=new Set(prev);s.delete(key);return s;}),500+i*500+700);
      revTimers.current.push(t2);
    });
    const tF=setTimeout(()=>{
      setGs(prev=>{
        if(!prev||prev.phase!=="reveal") return prev;
        const ns=JSON.parse(JSON.stringify(prev));
        ns.phase=ns.matchOver?"matchEnd":"roundEnd";
        // Push final state for PvP sync
        if(roomCodeRef.current) pushState(ns);
        return ns;
      });
    },500+flips.length*500+700);
    revTimers.current.push(tF);
    return()=>revTimers.current.forEach(clearTimeout);
  },[gs?.phase]);// eslint-disable-line

  /* ── SYNC DURING GAME ── */
  useEffect(()=>{
    if(!roomCode||screen!=="game") return;
    const channel=supabase.channel(`game-${roomCode}`)
      .on("postgres_changes",
        {event:"UPDATE",schema:"public",table:"rooms",filter:`code=eq.${roomCode}`},
        (payload)=>{
          if(!payload.new?.state) return;
          const inc=JSON.stringify(payload.new.state);
          if(inc===lastPushed.current) return;
          lastPushed.current=inc;
          setGs(payload.new.state);
        }
      ).subscribe();
    return()=>supabase.removeChannel(channel);
  },[roomCode,screen]);

  /* ── PUSH MOVES ── */
  const pushState = useCallback((newGs)=>{
    if(!roomCodeRef.current) return;
    const str=JSON.stringify(newGs);
    lastPushed.current=str;
    supabase.from("rooms").update({state:newGs}).eq("code",roomCodeRef.current);
  },[]);

  // Helper: set game state AND push to DB (for player-initiated actions)
  const setGsAndPush = useCallback((newGs)=>{
    setGs(newGs);
    pushState(newGs);
  },[pushState]);

  /* ── HELPERS ── */
  const activePid=gs?(gs.mode==="bot"?0:myPid):0;

  const advanceAfter=(ns,actingPid)=>{
    ns.p[1-actingPid].std=false;
    const ck=checkEnd(ns);
    if(ck.phase!=="play"){setFlippedSet(new Set());setGsAndPush(ck);return;}
    const nx=JSON.parse(JSON.stringify(ck));
    nx.cur=1-actingPid;
    setGsAndPush(nx);
    setTimerKey(k=>k+1);
  };

  const doTrump=tid=>{
    if(!gs||gs.phase!=="play"||gs.cur!==activePid||gs.p[activePid].std) return;
    const ns=applyT(gs,activePid,tid);
    ns.p[1-activePid].std=false;
    const ck=checkEnd(ns);
    if(ck.phase!=="play"){setFlippedSet(new Set());setGsAndPush(ck);return;}
    setGsAndPush(ns);
  };

  const doDraw=useCallback(()=>{
    if(!gs||gs.phase!=="play"||gs.cur!==activePid||gs.p[activePid].std) return;
    const ns=JSON.parse(JSON.stringify(gs));
    if(ns.deck.length===0){ns.p[activePid].std=true;ns.log.push("Deck empty — forced stand.");}
    else{const c=ns.deck.shift();ns.p[activePid].h.push({v:c,fd:false});ns.log.push(`P${activePid+1} draws ${c} (${hSum(ns.p[activePid].h)})`);}
    advanceAfter(ns,activePid);
  },[gs,activePid]);// eslint-disable-line

  const doStand=useCallback(()=>{
    if(!gs||gs.phase!=="play"||gs.cur!==activePid||gs.p[activePid].std) return;
    const ns=JSON.parse(JSON.stringify(gs));
    ns.p[activePid].std=true;
    ns.log.push(`P${activePid+1} stands at ${hSum(ns.p[activePid].h)}.`);
    const ck=checkEnd(ns);
    if(ck.phase!=="play"){setFlippedSet(new Set());setGsAndPush(ck);return;}
    const nx=JSON.parse(JSON.stringify(ck));
    nx.cur=1-activePid;
    setGsAndPush(nx);
    setTimerKey(k=>k+1);
  },[gs,activePid]);// eslint-disable-line

  const nextRound=()=>{
    if(!gs) return;
    const ns=mkRound(gs.sc,gs.rnd<(gs.settings?.maxRounds||5)?gs.rnd+1:gs.rnd,gs.mode,gs.settings,[gs.p[0].tr,gs.p[1].tr]);
    setGsAndPush(ns);setFlippedSet(new Set());setTimerKey(k=>k+1);
  };
  const newMatch=()=>{
    if(!gs) return;
    const ns=mkRound([0,0],1,gs.mode,settings,null);
    setGsAndPush(ns);
    setFlippedSet(new Set());setTimerKey(k=>k+1);
  };

  const onTimerExpire=useCallback(()=>{
    if(!gs||gs.phase!=="play"||gs.cur!==activePid||gs.p[activePid].std) return;
    const ns=JSON.parse(JSON.stringify(gs));
    ns.p[activePid].std=true;
    ns.log.push("⏰ Time's up! Auto-stand.");
    const ck=checkEnd(ns);
    if(ck.phase!=="play"){setGsAndPush(ck);return;}
    const nx=JSON.parse(JSON.stringify(ck));nx.cur=1-activePid;
    setGsAndPush(nx);
    setTimerKey(k=>k+1);
  },[activePid]);// eslint-disable-line

  /* ══ HOME ══════════════════════════════════════════════════════════ */
  if(screen==="home"){
    return (
      <div style={{...FELT,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:36}}>
        <style>{GFX}</style>
        {showSettings&&<SettingsModal settings={settings} onChange={setSettings} onClose={()=>setShowSettings(false)}/>}
        <div style={{textAlign:"center",animation:"slideIn 0.6s ease both"}}>
          <div style={{height:3,width:120,background:GL,margin:"0 auto 14px",borderRadius:2}}/>
          <div style={{fontSize:11,letterSpacing:7,color:"#6a5820",textTransform:"uppercase",marginBottom:6}}>Royal Casino Presents</div>
          <div style={{fontSize:52,fontWeight:900,color:"#d4c078",letterSpacing:3,textShadow:"0 0 40px rgba(212,192,64,0.3)",lineHeight:1}}>TRUMP CARD</div>
          <div style={{fontSize:13,letterSpacing:4,color:"#8a7040",marginTop:5,textTransform:"uppercase"}}>Blackjack Edition</div>
          <div style={{height:3,width:120,background:GL,margin:"12px auto 0",borderRadius:2}}/>
        </div>
        <div style={{display:"flex",gap:10}}>{[2,5,7,9,11].map((v,i)=><GameCard key={v} v={v} fd={false} idx={i}/>)}</div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center",animation:"slideIn 0.7s ease 0.2s both"}}>
          {[
            {id:"bot",  label:"vs Bot",      sub:"Solo Play", icon:"🤖", action:()=>{setMyPid(0);setGs(mkRound([0,0],1,"bot",settings,null));setScreen("game");setTimerKey(k=>k+1);}},
            {id:"create",label:"Create Room",sub:"1v1 · Host",icon:"🏠", action:()=>setScreen("create")},
            {id:"join",  label:"Find Room",  sub:"1v1 · Join",icon:"🔍", action:()=>setScreen("join")},
          ].map(m=>(
            <button key={m.id} onClick={m.action}
              style={{width:160,padding:"22px 16px",borderRadius:16,border:"1.5px solid rgba(212,192,120,0.25)",background:"rgba(0,0,0,0.4)",cursor:"pointer",textAlign:"center",transition:"all 0.2s",boxShadow:"0 6px 24px rgba(0,0,0,0.5)"}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(30,20,5,0.7)";e.currentTarget.style.borderColor="rgba(212,192,120,0.6)";e.currentTarget.style.transform="translateY(-4px)";}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,0.4)";e.currentTarget.style.borderColor="rgba(212,192,120,0.25)";e.currentTarget.style.transform="none";}}>
              <div style={{fontSize:32,marginBottom:8}}>{m.icon}</div>
              <div style={{fontSize:17,fontWeight:900,color:"#d4c078",marginBottom:3}}>{m.label}</div>
              <div style={{fontSize:10,color:"#6a5820",letterSpacing:1,textTransform:"uppercase"}}>{m.sub}</div>
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:16,alignItems:"center",background:"rgba(0,0,0,0.35)",borderRadius:12,padding:"10px 20px",border:"1px solid rgba(212,192,120,0.1)"}}>
          <div style={{fontSize:11,color:"#5a4820"}}>⚙ Settings:</div>
          <div style={{fontSize:12,color:"#8a7040",fontWeight:700}}>{settings.maxRounds} Rounds</div>
          <div style={{fontSize:10,color:"#3a3020"}}>·</div>
          <div style={{fontSize:12,color:"#8a7040",fontWeight:700}}>{settings.timerSec<60?`${settings.timerSec}s`:"1 min"} timer</div>
          <button onClick={()=>setShowSettings(true)} style={{padding:"4px 12px",borderRadius:8,border:"1px solid rgba(212,192,120,0.25)",background:"rgba(212,192,120,0.06)",color:"#8a7040",cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif"}}>Change</button>
        </div>
        <div style={{fontSize:10,color:"#2a2015",letterSpacing:1,textTransform:"uppercase"}}>First to {winThreshold(settings.maxRounds)} wins · Trump cards carry over between rounds</div>
      </div>
    );
  }

  /* ══ CREATE ROOM ═══════════════════════════════════════════════════ */
  if(screen==="create") return (
    <CreateRoomScreen
      settings={settings}
      onBack={()=>setScreen("home")}
      roomCodeRef={roomCodeRef}
      setRoomCode={setRoomCode}
      setMyPid={setMyPid}
      setGs={setGs}
      lastPushed={lastPushed}
    />
  );

  /* ══ JOIN ROOM ═════════════════════════════════════════════════════ */
  if(screen==="join") return (
    <JoinRoomScreen
      onBack={()=>setScreen("home")}
      onJoin={async(code)=>{
        const {data,error}=await supabase.from("rooms").select("state").eq("code",code).single();
        if(!data||error){alert("Room not found! Check the code and try again.");return;}
        const updatedState={...data.state, p2joined:true};
        const {error:updateError}=await supabase.from("rooms").update({state:updatedState}).eq("code",code);
        if(updateError){alert("Failed to join. Try again.");return;}
        roomCodeRef.current=code;
        setRoomCode(code);
        setMyPid(1);
        lastPushed.current=JSON.stringify(updatedState);
        setGs(updatedState);
        setScreen("game");
        setTimerKey(k=>k+1);
      }}
    />
  );

  if(!gs) return null;

  const T=getTgt(gs.p);
  const isBot=gs.mode==="bot";
  const botThinking=isBot&&gs.cur===1&&gs.phase==="play";
  const me=gs.p[activePid];
  const op=gs.p[1-activePid];
  const myTurn=gs.phase==="play"&&gs.cur===activePid&&!me.std;
  const isRevealing=gs.phase==="reveal";
  const showPopup=gs.phase==="roundEnd";

  /* ══ MATCH END ═════════════════════════════════════════════════════ */
  if(gs.phase==="matchEnd"){
    const mw=gs.sc[myPid]>=winThreshold(gs.settings?.maxRounds||5)?"You":"Opponent";
    return (
      <div style={{...FELT,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",gap:20}}>
        <style>{GFX}</style>
        <div style={{fontSize:72,animation:"spin 4s linear infinite"}}>🏆</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,letterSpacing:5,color:"#6a5820",textTransform:"uppercase"}}>Champion</div>
          <div style={{fontSize:36,fontWeight:900,color:"#d4c078",textShadow:"0 0 30px rgba(212,192,64,0.4)"}}>{mw}</div>
        </div>
        <div style={{display:"flex",gap:16}}>
          <Chip n={gs.sc[myPid]} color="#1565c0" label="You"/>
          <Chip n={gs.sc[1-myPid]} color="#6a1b1b" label={isBot?"Bot":"Opp"}/>
        </div>
        <div style={{display:"flex",gap:12}}>
          <Btn3D label="NEW MATCH" onClick={newMatch} top="#d4a820" bot="#9a7010" shad="#5a4000"/>
          <Btn3D label="HOME" onClick={()=>setScreen("home")} top="#3a3020" bot="#1a1810" shad="#0a0804"/>
        </div>
      </div>
    );
  }

  /* ══ PLAY / REVEAL / POPUP ════════════════════════════════════════ */
  return (
    <div style={{...FELT,minHeight:"100vh",display:"flex",gap:0,position:"relative"}}>
      <style>{GFX}</style>

      {isRevealing&&(
        <div style={{position:"fixed",inset:0,zIndex:40,pointerEvents:"none"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,display:"flex",justifyContent:"center",paddingTop:18}}>
            <div style={{background:"rgba(4,2,0,0.94)",border:"1.5px solid rgba(212,192,120,0.5)",borderRadius:14,padding:"11px 36px",animation:"revealGlow 1.2s ease infinite"}}>
              <div style={{fontSize:16,fontWeight:900,letterSpacing:4,textTransform:"uppercase",background:"linear-gradient(90deg,#7a5008,#d4c078,#f5e8b0,#d4c078,#7a5008)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 1.8s linear infinite"}}>Revealing Hidden Cards</div>
            </div>
          </div>
        </div>
      )}

      {showPopup&&(
        <RoundPopup gs={gs} T={T} myPid={myPid}
          onNext={gs.rnd<(gs.settings?.maxRounds||5)?nextRound:newMatch}
          onHome={()=>setScreen("home")}/>
      )}

      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"16px 20px 16px 16px",gap:0,minWidth:0}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,background:"rgba(0,0,0,0.38)",borderRadius:12,padding:"10px 16px",border:"1px solid rgba(212,192,120,0.08)"}}>
          <div style={{display:"flex",gap:24,alignItems:"center"}}>
            <div>
              <div style={{fontSize:8,letterSpacing:3,color:"#3a3020",textTransform:"uppercase"}}>Round</div>
              <div style={{fontSize:20,fontWeight:900,color:"#d4c078",lineHeight:1}}>{gs.rnd}<span style={{fontSize:10,color:"#3a3020"}}>/{gs.settings?.maxRounds||5}</span></div>
            </div>
            <div>
              <div style={{fontSize:8,letterSpacing:3,color:"#3a3020",textTransform:"uppercase"}}>Target</div>
              <div style={{fontSize:24,fontWeight:900,color:"#d4c078",lineHeight:1}}>{T}</div>
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <Chip n={gs.sc[myPid]} color="#1565c0" label="You"/>
              <div style={{fontSize:9,color:"#2a2015",textAlign:"center",lineHeight:1.3}}>First to<br/><b style={{color:"#5a4820"}}>{winThreshold(gs.settings?.maxRounds||5)}</b></div>
              <Chip n={gs.sc[1-myPid]} color="#6a1b1b" label={isBot?"Bot":"Opp"}/>
            </div>
            {myTurn&&!isRevealing&&(
              <CountdownTimer key={timerKey} seconds={gs.settings?.timerSec||30} active={myTurn} onExpire={onTimerExpire}/>
            )}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{fontSize:11,color:"#3a3020"}}>🂠 {gs.deck.length}</div>
            <button onClick={()=>setShowLog(v=>!v)} style={{padding:"4px 10px",borderRadius:6,fontSize:10,cursor:"pointer",border:"1px solid rgba(212,192,120,0.15)",background:showLog?"rgba(212,192,120,0.08)":"transparent",color:"#6a5820",fontFamily:"Georgia,serif"}}>LOG {showLog?"▲":"▼"}</button>
            <button onClick={()=>setScreen("home")} style={{padding:"4px 10px",borderRadius:6,fontSize:10,cursor:"pointer",border:"1px solid rgba(212,192,120,0.15)",background:"transparent",color:"#4a3820",fontFamily:"Georgia,serif"}}>HOME</button>
          </div>
        </div>

        {/* Opponent zone */}
        <div style={{background:"rgba(0,0,0,0.2)",borderRadius:14,padding:"14px 16px",border:"1px solid rgba(212,192,120,0.06)",boxShadow:isRevealing?"0 0 18px rgba(212,192,64,0.08)":"none",transition:"box-shadow 0.4s"}}>
          <PlayerRow player={op} pid={1-activePid} isMe={false} isBot={isBot} mode={gs.mode} T={T} flippedSet={flippedSet}/>
          {botThinking&&(
            <div style={{display:"flex",gap:5,alignItems:"center",marginTop:10}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#c08040",animation:`pulse 1s ease ${i*0.2}s infinite`}}/>)}
              <span style={{fontSize:11,color:"#4a3820",marginLeft:4,fontStyle:"italic"}}>Bot is thinking...</span>
            </div>
          )}
          {op.std&&<div style={{marginTop:8,fontSize:10,color:"#4a8840"}}>● Standing</div>}
          {!isBot&&gs.cur===(1-activePid)&&!op.std&&gs.phase==="play"&&(
            <div style={{marginTop:8,fontSize:10,color:"#c08040",fontStyle:"italic"}}>Opponent is taking their turn...</div>
          )}
        </div>

        {/* Table zone */}
        <div style={{margin:"10px 0",background:"rgba(0,0,0,0.15)",borderRadius:12,border:"1px solid rgba(212,192,120,0.07)",padding:"10px 16px",display:"flex",flexDirection:"column",gap:8}}>
          <div style={{height:1,background:GL,borderRadius:1}}/>
          <div style={{display:"flex",gap:8,alignItems:"center",minHeight:66}}>
            <div style={{fontSize:8,letterSpacing:1.5,color:"#2a2015",textTransform:"uppercase",width:56,flexShrink:0,textAlign:"right",paddingRight:10,lineHeight:1.4}}>Opp<br/>played</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,alignItems:"center"}}>
              {op.played.length>0?op.played.map((t,i)=><TableTrump key={i} tid={t} active={op.tbl.includes(t)}/>)
                :<div style={{fontSize:9,color:"#1a1408",fontStyle:"italic"}}>no trump cards played yet</div>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,height:1,background:"rgba(212,192,120,0.07)"}}/>
            <div style={{fontSize:8,color:"#2a2015",letterSpacing:2,textTransform:"uppercase"}}>◆ Table ◆</div>
            <div style={{flex:1,height:1,background:"rgba(212,192,120,0.07)"}}/>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",minHeight:66}}>
            <div style={{fontSize:8,letterSpacing:1.5,color:"#2a2015",textTransform:"uppercase",width:56,flexShrink:0,textAlign:"right",paddingRight:10,lineHeight:1.4}}>You<br/>played</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",flex:1,alignItems:"center"}}>
              {me.played.length>0?me.played.map((t,i)=><TableTrump key={i} tid={t} active={me.tbl.includes(t)}/>)
                :<div style={{fontSize:9,color:"#1a1408",fontStyle:"italic"}}>no trump cards played yet</div>}
            </div>
          </div>
          <div style={{height:1,background:GL,borderRadius:1}}/>
        </div>

        {/* My zone */}
        <div style={{background:"rgba(0,0,0,0.28)",borderRadius:14,padding:"14px 16px",border:`1px solid ${isRevealing?"rgba(212,192,64,0.18)":myTurn?"rgba(212,192,64,0.25)":"rgba(212,192,120,0.06)"}`,boxShadow:myTurn?"0 0 20px rgba(212,192,64,0.06)":"none",transition:"border-color 0.3s"}}>
          <PlayerRow player={me} pid={activePid} isMe={true} isBot={false} mode={gs.mode} T={T} flippedSet={flippedSet}/>
          <div style={{marginTop:12,paddingTop:10,borderTop:"1px solid rgba(212,192,120,0.07)"}}>
            <div style={{fontSize:8,letterSpacing:2,color:"#2a2015",textTransform:"uppercase",marginBottom:8}}>
              Your Trump Cards ({me.tr.length}){me.tr.length>0?" — hover 1s for details":""}
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",minHeight:88,alignItems:"center"}}>
              {me.tr.length>0
                ?me.tr.map((tid,i)=><TrumpCard key={i} tid={tid} disabled={me.blk||me.std||isRevealing||!myTurn} onClick={()=>doTrump(tid)}/>)
                :<div style={{fontSize:10,color:"#1a1408",fontStyle:"italic"}}>No trump cards in hand</div>}
            </div>
          </div>
          {myTurn&&hSum(me.h)>T&&(
            <div style={{marginTop:10,padding:"6px 12px",borderRadius:8,background:"rgba(80,0,0,0.4)",border:"1px solid rgba(180,40,40,0.3)",fontSize:11,color:"#ff8080",lineHeight:1.5}}>
              ⚠ Over {T}! Use a trump card to recover, or Stand to lock in your bust.
            </div>
          )}
          <div style={{display:"flex",gap:10,marginTop:12}}>
            {isRevealing?(
              <div style={{padding:"10px 16px",borderRadius:10,background:"rgba(0,0,0,0.2)",border:"1px solid rgba(212,192,120,0.1)",fontSize:12,color:"#6a5820",fontStyle:"italic",letterSpacing:1}}>Revealing all hidden cards...</div>
            ):myTurn?(
              <>
                <Btn3D label="DRAW" onClick={doDraw} disabled={gs.deck.length===0} top="#1a4a7a" bot="#0c2a4a" shad="#050f20"/>
                <Btn3D label="STAND" onClick={doStand} top="#1a5224" bot="#0c2e12" shad="#060f08"/>
              </>
            ):(
              <div style={{padding:"10px 16px",borderRadius:10,background:"rgba(0,0,0,0.2)",border:"1px solid rgba(212,192,120,0.05)",fontSize:12,color:"#1e1a10",fontStyle:"italic"}}>
                {me.std?"You are standing — waiting for opponent...":botThinking?"Bot is taking its turn...":"Waiting for your turn..."}
              </div>
            )}
          </div>
        </div>
      </div>

      {showLog&&(
        <div style={{width:230,flexShrink:0,background:"rgba(0,0,0,0.45)",borderLeft:"1px solid rgba(212,192,120,0.07)",padding:"16px 0",display:"flex",flexDirection:"column"}}>
          <div style={{fontSize:9,letterSpacing:3,color:"#3a3020",textTransform:"uppercase",padding:"0 12px",marginBottom:8}}>Round Log</div>
          <div style={{flex:1,overflow:"hidden"}}><LogPanel log={gs.log}/></div>
        </div>
      )}
    </div>
  );
}