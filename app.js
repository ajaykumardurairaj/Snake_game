
// Friends-themed Snake Game PWA
'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const statusEl = document.getElementById('status');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const installBtn = document.getElementById('installBtn');

let tileSize = 20;
let cols = Math.floor(canvas.width / tileSize);
let rows = Math.floor(canvas.height / tileSize);

let snake = [{x: Math.floor(cols/2), y: Math.floor(rows/2)}];
let dir = {x:1,y:0};
let nextDir = dir;
let food = null;
let obstacles = [];
let powerups = [];
let score = 0;
let speedMultiplier = 1;
let baseDelay = 120; // ms
let paused = false;
let muted = false;
let lastTick = 0;

// avatars (friends-themed colors)
const avatars = [
  {name:'A', color:'#FF6B6B'}, {name:'B', color:'#FFD166'},
  {name:'C', color:'#74C0FC'}, {name:'D', color:'#8D99AE'}
];
let playerAvatar = avatars[0];

// audio
const audioCtx = (() => {
  try { return new (window.AudioContext||window.webkitAudioContext)(); } catch(e){ return null; }
})();

let bgAudio = new Audio('assets/music_bg.wav');
bgAudio.loop = true; bgAudio.volume = 0.45;
let sfxPower = new Audio('assets/sfx_power.wav');
let sfxBoost = new Audio('assets/sfx_boost.wav');
function playAudio(a){ if(muted) return; try{ a.currentTime=0; a.play(); }catch(e){} }

// service-worker install prompt handling
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove('hidden');
});
installBtn.addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add('hidden');
});

muteBtn.addEventListener('click', ()=>{ muted = !muted; muteBtn.textContent = muted ? '🔇' : '🔊'; if(!muted) bgAudio.play(); else bgAudio.pause(); });
pauseBtn.addEventListener('click', ()=>{ paused = !paused; pauseBtn.textContent = paused ? '▶️' : '⏸️'; });

// mobile controls
document.querySelectorAll('.mobile-controls button').forEach(b=>{
  b.addEventListener('touchstart', (e)=>{ e.preventDefault(); handleDir(b.dataset.dir); });
  b.addEventListener('click', ()=> handleDir(b.dataset.dir));
});

// keyboard input
window.addEventListener('keydown', (e)=>{
  if(['ArrowUp','KeyW'].includes(e.code)) handleDir('up');
  if(['ArrowDown','KeyS'].includes(e.code)) handleDir('down');
  if(['ArrowLeft','KeyA'].includes(e.code)) handleDir('left');
  if(['ArrowRight','KeyD'].includes(e.code)) handleDir('right');
  if(e.code==='Space') { paused = !paused; pauseBtn.textContent = paused ? '▶️':'⏸️'; }
});

function handleDir(d){
  const map = {up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  const nd = map[d];
  if(!nd) return;
  // prevent direct reverse
  if(nd.x === -dir.x && nd.y === -dir.y) return;
  nextDir = nd;
}

// game helpers
function rndCell(){ return {x: Math.floor(Math.random()*cols), y: Math.floor(Math.random()*rows)}; }
function cellEq(a,b){ return a.x===b.x && a.y===b.y; }
function pointInList(pt,list){ return list.some(i=>cellEq(i,pt)); }

// initialize obstacles and powerups
function resetBoard(){
  cols = Math.floor(canvas.width / tileSize);
  rows = Math.floor(canvas.height / tileSize);
  snake = [{x: Math.floor(cols/2), y: Math.floor(rows/2)}];
  dir = {x:1,y:0}; nextDir=dir;
  score=0; speedMultiplier=1; paused=false;
  obstacles = [];
  powerups = [];
  // place obstacles (friends-themed furniture)
  for(let i=0;i<12;i++){
    let p = rndCell();
    while(pointInList(p,obstacles) || cellEq(p,snake[0])) p=rndCell();
    obstacles.push(p);
  }
  spawnFood();
  spawnPowerup();
  statusEl.textContent = `Speed: ${speedMultiplier}x`;
  scoreEl.textContent = `Score: ${score}`;
}

function spawnFood(){
  let p=rndCell();
  while(pointInList(p,snake) || pointInList(p,obstacles) || pointInList(p,powerups)) p=rndCell();
  food = p;
}

function spawnPowerup(){
  let p = rndCell();
  while(pointInList(p,snake) || pointInList(p,obstacles) || cellEq(p,food)) p=rndCell();
  const types = ['size','shield','speed'];
  let t = types[Math.floor(Math.random()*types.length)];
  powerups.push({x:p.x,y:p.y,type:t,ttl:12000,created:Date.now()});
  // respawn next after some time
  setTimeout(()=>{ if(Math.random()>0.5) spawnPowerup(); }, 8000+Math.random()*8000);
}

// game tick
function tick(ts){
  if(!lastTick) lastTick = ts;
  const elapsed = ts - lastTick;
  const delay = baseDelay / speedMultiplier;
  if(!paused && elapsed > delay){
    step();
    lastTick = ts;
  }
  draw();
  requestAnimationFrame(tick);
}

function step(){
  dir = nextDir;
  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
  // wrap
  head.x = (head.x + cols) % cols;
  head.y = (head.y + rows) % rows;

  // collision with obstacles
  for(const o of obstacles){
    if(cellEq(o,head)){
      // game over — reset
      flash('You bumped into an obstacle! Resetting...');
      resetBoard();
      return;
    }
  }

  // collision with self
  if(pointInList(head, snake)){
    flash('You ran into yourself! Resetting...');
    resetBoard();
    return;
  }

  snake.unshift(head);

  // food
  if(cellEq(head, food)){
    score += 10;
    playAudio(sfxPower);
    spawnFood();
    // small chance to spawn obstacle after eating
    if(Math.random()>0.6){
      let p=rndCell(); while(pointInList(p,snake)||pointInList(p,obstacles)||cellEq(p,food)) p=rndCell();
      obstacles.push(p);
    }
  } else {
    snake.pop();
  }

  // powerups
  for(let i=powerups.length-1;i>=0;i--){
    const pu = powerups[i];
    if(Date.now() - pu.created > pu.ttl){ powerups.splice(i,1); continue; }
    if(cellEq(head, pu)){
      // apply effect
      if(pu.type==='size'){ // grow
        snake.push({...snake[snake.length-1]});
        score += 15;
        flash('Length +1!');
      } else if(pu.type==='shield'){
        // temporary invulnerable (we implement as removing first collision obstacle on next 6 moves)
        // mark on head
        head._shield = (head._shield||0)+6;
        flash('Shield! Next obstacle hit avoided.');
      } else if(pu.type==='speed'){
        speedMultiplier = Math.min(3, speedMultiplier + 0.75);
        setTimeout(()=>{ speedMultiplier = Math.max(1, speedMultiplier - 0.75); }, 6000);
        playAudio(sfxBoost);
        flash('Speed Boost!');
      }
      powerups.splice(i,1);
    }
  }

  // decrease shield counters on snake parts (simple handling)
  for(const part of snake){ if(part._shield) part._shield = Math.max(0, part._shield-1); }

  scoreEl.textContent = `Score: ${score}`;
  statusEl.textContent = `Speed: ${speedMultiplier.toFixed(2)}x`;
}

// flash message
let flashTimeout = null;
function flash(msg){
  const old = statusEl.textContent;
  statusEl.textContent = msg;
  clearTimeout(flashTimeout);
  flashTimeout = setTimeout(()=> statusEl.textContent = `Speed: ${speedMultiplier.toFixed(2)}x`, 1500);
}

// drawing
function draw(){
  // clear
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // draw grid background
  for(let x=0;x<cols;x++){
    for(let y=0;y<rows;y++){
      if((x+y)%2===0) ctx.fillStyle = '#f8fcff'; else ctx.fillStyle = '#ffffff';
      ctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);
    }
  }

  // obstacles
  for(const o of obstacles){
    ctx.fillStyle = '#b2bec3';
    ctx.fillRect(o.x*tileSize + 2, o.y*tileSize + 2, tileSize-4, tileSize-4);
    // little table top
    ctx.fillStyle = '#6c5ce7';
    ctx.fillRect(o.x*tileSize + 6, o.y*tileSize + 6, tileSize-12, tileSize-12);
  }

  // powerups
  for(const pu of powerups){
    if(pu.type==='size') drawRoundedRect(pu.x*tileSize+4, pu.y*tileSize+4, tileSize-8, tileSize-8, 4, '#2ecc71');
    if(pu.type==='shield') drawRoundedRect(pu.x*tileSize+4, pu.y*tileSize+4, tileSize-8, tileSize-8, 4, '#ffd166');
    if(pu.type==='speed') drawRoundedRect(pu.x*tileSize+4, pu.y*tileSize+4, tileSize-8, tileSize-8, 4, '#74c0fc');
  }

  // food (snack)
  if(food){
    ctx.fillStyle = '#ff6b6b';
    const fx = food.x*tileSize + tileSize*0.12;
    const fy = food.y*tileSize + tileSize*0.12;
    ctx.beginPath();
    ctx.ellipse(fx + tileSize*0.38, fy + tileSize*0.38, tileSize*0.38, tileSize*0.28, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // snake — head with avatar color
  for(let i=0;i<snake.length;i++){
    const p = snake[i];
    if(i===0){
      ctx.fillStyle = playerAvatar.color;
      roundRect(ctx, p.x*tileSize+2, p.y*tileSize+2, tileSize-4, tileSize-4, 6, true, false);
      // avatar initial
      ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(playerAvatar.name, p.x*tileSize + tileSize/2, p.y*tileSize + tileSize/2 + 1);
    } else {
      // gradient body
      ctx.fillStyle = `rgba(44,62,80,${0.08 + Math.min(0.6, i/snake.length)})`;
      roundRect(ctx, p.x*tileSize+3, p.y*tileSize+3, tileSize-6, tileSize-6, 4, true, false);
    }
  }
}

// utility: rounded rect
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  if(typeof r==='undefined') r=5;
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  if(fill) ctx.fill();
  if(stroke) ctx.stroke();
}

function drawRoundedRect(x,y,w,h,r,color){
  ctx.fillStyle = color;
  roundRect(ctx,x,y,w,h,r,true,false);
}

// on resize: maintain canvas ratio but keep tilesize scale for responsiveness
function handleResize(){
  const parentW = canvas.parentElement.clientWidth - 4;
  const maxW = Math.min(720, parentW);
  canvas.style.width = maxW + 'px';
  // cols/rows depend on canvas width/height attributes, not css.
  // Keep attributes fixed to make game grid consistent.
}
window.addEventListener('resize', handleResize);

// start
resetBoard();
requestAnimationFrame(tick);
bgAudio.play().catch(()=>{});

// register service worker
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then(()=>console.log('SW registered'));
}

// preload some assets for quick mobile sound play
function preloadAudio(a){ a.load(); }
preloadAudio(bgAudio); preloadAudio(sfxPower); preloadAudio(sfxBoost);
