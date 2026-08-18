const $=id=>document.getElementById(id);
const rewardCanvas=$("rewardChart"); const stockSvg=$("stockSvg");
const rctx=rewardCanvas.getContext("2d");

let prices=[], q={}, trainingRewards=[], agentTrades=[], manualTrades=[];
let cash=100000, shares=0, currentIndex=0, agentEquity=100000, episodes=0;
const START=10000, ACTIONS=["HOLD","BUY","SELL"];

function seededRandom(seed){let x=Math.sin(seed)*10000;return x-Math.floor(x)}
function generateMarket(n=220){
  let p=START;
  prices=[];
  for(let i=0;i<n;i++){
    const noise=(seededRandom(i*12.9898)-.5)*1.7;
    const wave=Math.sin(i/12)*.55+Math.sin(i/31)*.8;
    const drift=i<70?.08:i<150?.02:-.015;
    p=Math.max(7000,p*(1+(drift+wave+noise)/100));
    prices.push(+p.toFixed(2));
  }
  currentIndex=prices.length-1;
}
function drawStock(){
  if(!prices.length)return;
  const W=1000,H=430,pad={l:65,r:20,t:22,b:42};
  const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
  const min=Math.min(...prices)*.985,max=Math.max(...prices)*1.015;
  const x=i=>pad.l+cw*i/(prices.length-1);
  const y=p=>pad.t+ch*(max-p)/(max-min);
  const pts=prices.map((p,i)=>`${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const area=`${pad.l},${H-pad.b} ${pts} ${x(prices.length-1)},${H-pad.b}`;
  let out="";
  for(let i=0;i<5;i++){
    const yy=pad.t+ch*i/4, val=max-(max-min)*i/4;
    out+=`<line class="chart-grid" x1="${pad.l}" y1="${yy}" x2="${W-pad.r}" y2="${yy}"/>`;
    out+=`<text class="chart-axis" x="8" y="${yy+4}">₹${Math.round(val).toLocaleString("en-IN")}</text>`;
  }
  for(let i=0;i<6;i++){
    const idx=Math.round((prices.length-1)*i/5),xx=x(idx);
    out+=`<line class="chart-grid" x1="${xx}" y1="${pad.t}" x2="${xx}" y2="${H-pad.b}"/>`;
    out+=`<text class="chart-axis" x="${xx-15}" y="${H-13}">${idx}</text>`;
  }
  out+=`<polygon class="area-line" points="${area}"/>`;
  out+=`<polyline class="price-line" points="${pts}"/>`;

  const chip=(id)=>$(id)?.classList.contains("active");
  if(chip("smaChip")){
    const p=prices.map((v,i)=>`${x(i).toFixed(1)},${y(sma(i)).toFixed(1)}`).join(" ");
    out+=`<polyline class="sma-line" points="${p}"/>`;
  }
  if(chip("emaChip")){
    const p=prices.map((v,i)=>`${x(i).toFixed(1)},${y(ema(i)).toFixed(1)}`).join(" ");
    out+=`<polyline class="ema-line" points="${p}"/>`;
  }
  const cx=x(currentIndex),cy=y(prices[currentIndex]);
  out+=`<line class="current-line" x1="${cx}" y1="${pad.t}" x2="${cx}" y2="${H-pad.b}"/>`;
  out+=`<circle class="chart-cross" cx="${cx}" cy="${cy}" r="5"/>`;

  [...manualTrades,...agentTrades].forEach(t=>{
    const xx=x(t.i),yy=y(prices[t.i]), cls=t.a==="BUY"?"trade-buy":"trade-sell";
    out+=`<circle class="${cls}" cx="${xx}" cy="${yy}" r="6"/>`;
    out+=`<text class="trade-text" x="${xx+8}" y="${yy-8}">${t.a}</text>`;
  });
  stockSvg.innerHTML=out;
  addLog();
}

function drawRewards(){
  const r=rewardCanvas.getBoundingClientRect(),d=devicePixelRatio||1,w=Math.max(320,Math.floor(r.width)),h=Math.max(180,Math.floor(r.height));
  rewardCanvas.width=w*d;rewardCanvas.height=h*d;rewardCanvas.style.width=w+"px";rewardCanvas.style.height=h+"px";
  rctx.setTransform(d,0,0,d,0,0);rctx.clearRect(0,0,w,h);
  if(!trainingRewards.length)return;
  const pad=25, min=Math.min(...trainingRewards),max=Math.max(...trainingRewards),range=max-min||1;
  rctx.strokeStyle="#1a2b40";rctx.beginPath();rctx.moveTo(pad,h/2);rctx.lineTo(w-pad,h/2);rctx.stroke();
  rctx.beginPath();trainingRewards.forEach((v,i)=>{let x=pad+(w-2*pad)*i/(trainingRewards.length-1||1),y=pad+(h-2*pad)*(max-v)/range;i?rctx.lineTo(x,y):rctx.moveTo(x,y)});rctx.strokeStyle="#5b9dff";rctx.lineWidth=2;rctx.stroke();
}
function priceTrend(i){
  const a=prices[Math.max(0,i-3)],b=prices[i];
  return b>a*1.003?"UP":b<a*.997?"DOWN":"FLAT";
}
function state(i,pos){
  return `${priceTrend(i)}_${pos?"LONG":"FLAT"}`;
}
function getQ(s){if(!q[s])q[s]=[0,0,0];return q[s]}
function bestAction(s){const a=getQ(s);return a.indexOf(Math.max(...a))}
function choose(s,eps){return Math.random()<eps?Math.floor(Math.random()*3):bestAction(s)}
function stepPortfolio(action,i,holdings){
  let next=holdings;
  if(action===1 && next===0)next=1;
  if(action===2 && next===1)next=0;
  return next;
}
function trainAgent(){
  const N=Math.max(10,Math.min(5000,+$("episodeInput").value||500));
  const alpha=Math.max(.01,Math.min(1,+$("alphaInput").value||.15));
  const gamma=Math.max(0,Math.min(1,+$("gammaInput").value||.9));
  let eps=Math.max(0,Math.min(1,+$("epsilonInput").value||.2));
  q={};trainingRewards=[];$("trainStatus").textContent="Training...";
  for(let ep=0;ep<N;ep++){
    let pos=0,equity=100000,reward=0;
    for(let i=3;i<prices.length-1;i++){
      const s=state(i,pos),a=choose(s,eps),nextPos=stepPortfolio(a,i,pos);
      const before=equity, exposure=pos?prices[i]:0, nextExposure=nextPos?prices[i+1]:0;
      equity=100000+(nextExposure-prices[3])*nextPos;
      const r=(equity-before)/100;
      const ns=state(i+1,nextPos), qv=getQ(s), target=r+gamma*Math.max(...getQ(ns));
      qv[a]+=alpha*(target-qv[a]);reward+=r;pos=nextPos;
    }
    trainingRewards.push(+reward.toFixed(2));
    eps=Math.max(.02,eps*.995);
    if(ep%Math.max(1,Math.floor(N/100))===0){$("progressBar").style.width=((ep+1)/N*100)+"%";}
  }
  episodes+=N;$("episodes").textContent=episodes.toLocaleString();
  const last=trainingRewards.slice(-Math.min(100,N)),avg=last.reduce((a,b)=>a+b,0)/last.length;
  $("reward").textContent=avg.toFixed(2);
  $("trainStatus").textContent="Training complete. Agent policy is ready.";
  drawRewards();runAgent();
}
function runAgent(){
  if(!prices.length)return;
  agentTrades=[];
  let pos=0, cashSim=100000, equity=100000, peak=equity, maxDD=0, wins=0, closed=0, entry=0;
  const step=Math.max(1,Math.floor(prices.length/90));
  for(let i=3;i<prices.length-1;i+=step){
    const s=state(i,pos);
    const vals=getQ(s);
    let a=bestAction(s);
    // If the Q-table is still untrained/flat, use a simple trend fallback.
    if(vals.every(v=>Math.abs(v)<1e-9)){
      a=priceTrend(i)==="UP"?1:priceTrend(i)==="DOWN"?2:0;
    }
    if(a===1 && pos===0 && cashSim>=prices[i]){pos=1;cashSim-=prices[i];entry=prices[i];agentTrades.push({i,a:"BUY"});}
    else if(a===2 && pos===1){cashSim+=prices[i];pos=0;closed++;if(prices[i]>entry)wins++;agentTrades.push({i,a:"SELL"});}
    equity=cashSim+(pos?prices[i]:0);
    peak=Math.max(peak,equity);maxDD=Math.max(maxDD,(peak-equity)/peak);
  }
  if(pos){cashSim+=prices[prices.length-1];pos=0;}
  equity=cashSim;
  agentEquity=equity;
  $("agentReturn").textContent=((equity/100000-1)*100).toFixed(2)+"%";
  $("drawdown").textContent=(maxDD*100).toFixed(2)+"%";
  $("winRate").textContent=(closed?wins/closed*100:0).toFixed(0)+"%";
  currentIndex=prices.length-1;
  updateAgentDecision();
  drawStock();
  $("trainStatus").textContent="Agent run complete — BUY/SELL markers are now on the chart.";
}
function updateAgentDecision(){
  const s=state(currentIndex,shares>0),vals=getQ(s),a=bestAction(s),sum=vals.reduce((x,v)=>x+Math.abs(v),0)||1;
  const trend=priceTrend(currentIndex);
  $("agentAction").textContent=ACTIONS[a];
  $("agentConfidence").textContent="Confidence: "+Math.min(99,Math.round((Math.abs(vals[a])/sum)*100+33))+"%";
  $("agentReason").textContent=a===1?"The learned policy sees an upward/long opportunity.":a===2?"The learned policy sees a sell/exit opportunity.":"The learned policy is waiting for a stronger market signal.";
  $("stateView").textContent=(shares>0?"LONG":"FLAT")+" • "+trend;
  $("riskView").textContent=trend==="FLAT"?"LOW":trend==="UP"?"MEDIUM":"HIGH";
}
function updateAccount(){
  const total=cash+shares*prices[currentIndex];
  $("cash").textContent="₹"+Math.round(cash).toLocaleString("en-IN");
  $("shares").textContent=shares;
  $("portfolio").textContent="₹"+Math.round(total).toLocaleString("en-IN");
  $("currentPrice").textContent="₹"+prices[currentIndex].toLocaleString("en-IN",{minimumFractionDigits:2});
  const change=(prices[currentIndex]/prices[0]-1)*100;$("dayChange").textContent=(change>=0?"+":"")+change.toFixed(2)+"%";
  updateAgentDecision();drawStock();
}
function buy(){
  if(cash>=prices[currentIndex]){cash-=prices[currentIndex];shares++;manualTrades.push({i:currentIndex,a:"BUY"});updateAccount();$("buyBtn").classList.add("flash");setTimeout(()=>$("buyBtn").classList.remove("flash"),250)}
}
function sell(){
  if(shares>0){cash+=prices[currentIndex];shares--;manualTrades.push({i:currentIndex,a:"SELL"});updateAccount();$("sellBtn").classList.add("flash");setTimeout(()=>$("sellBtn").classList.remove("flash"),250)}
}
$("buyBtn").onclick=buy;$("sellBtn").onclick=sell;
$("resetBtn").onclick=()=>{cash=100000;shares=0;manualTrades=[];updateAccount()};
$("trainBtn").onclick=trainAgent;$("runBtn").onclick=runAgent;

function sma(i,n=20){let a=prices.slice(Math.max(0,i-n+1),i+1);return a.reduce((x,y)=>x+y,0)/a.length}
function ema(i,n=9){let k=2/(n+1),e=prices[0];for(let j=1;j<=i;j++)e=prices[j]*k+e*(1-k);return e}
function addLog(){
  const box=$("logRows"); box.innerHTML="";
  agentTrades.slice(-8).forEach(t=>{
    const row=document.createElement("div");row.className="log-row";
    row.innerHTML=`<span>Bar ${t.i}</span><b class="${t.a==="BUY"?"log-buy":"log-sell"}">${t.a} @ ₹${prices[t.i].toLocaleString("en-IN")}</b>`;
    box.appendChild(row);
  });
  if(!agentTrades.length)box.innerHTML='<div class="log-row"><span>System</span><b>No trades generated</b></div>';
}
["trendChip","smaChip","emaChip"].forEach(id=>$(id).onclick=()=>{$(id).classList.toggle("active");drawStock()});

window.addEventListener("resize",()=>{drawStock();drawRewards()});
generateMarket();updateAccount();drawRewards();
