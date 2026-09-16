const THEME = {
  primary: '139, 92, 246',
  primaryLight: '167, 139, 250',
  primaryLightest: '196, 181, 253',
  primaryDark: '124, 58, 237',
  primaryDarker: '109, 40, 217'
};

let isCanvasVisible = true;
export function setCanvasVisibility(visible) {
  const wasVisible = isCanvasVisible;
  isCanvasVisible = visible;
  if (!wasVisible && visible) {
    if (typeof lastT !== 'undefined') lastT = performance.now();
    requestAnimationFrame(loop);
  }
}

let lastT = 0;
let W, H, dpr;
let boxCX, boxTY, boxBY, boxW, beamSrcHW, beamTopHW;
let mouseNX = 0.5, mouseNY = 0.5;
let time = 0;
let surgeAmt = 0, surgePhase = 'idle', surgeTmr = 0, nextSurge = 0;
let imgW = 512, imgH = 910;
let beamParts = [], ambParts = [], streaks = [], sparks = [];

let fx, bl, fxC, blC;

// Performance Monitoring
let fpsCount = 0;
let lastFpsTime = 0;
let isLowPowerMode = false;
let fpsHistory = [];

const IMG_BOX_CX = 0.50;
const IMG_BOX_TY = 0.795;
const IMG_BOX_BY = 0.875;
const IMG_BOX_W  = 0.135;
const BEAM_SRC_HW_RATIO = 0.18;
const BEAM_TOP_HW_FRAC  = 0.34;
const SURGE_MIN = 3500;
const SURGE_MAX = 6500;
const MOUSE_INFLUENCE = 0.018;

export function initCanvas() {
  fxC = document.getElementById('fx-canvas');
  blC = document.getElementById('bloom-canvas');
  if (!fxC || !blC) return;
  fx = fxC.getContext('2d', { alpha: true });
  bl = blC.getContext('2d', { alpha: true });

  const bgImg = new Image();
  bgImg.src = 'purple-beam-bg.webp';
  bgImg.onload = function () {
    imgW = bgImg.naturalWidth;
    imgH = bgImg.naturalHeight;
    resize();
    lastT = performance.now();
    lastFpsTime = lastT;
    requestAnimationFrame(loop);
  };

  document.addEventListener('mousemove', function (e) {
    mouseNX = e.clientX / W;
    mouseNY = e.clientY / H;
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (e.touches.length) {
      mouseNX = e.touches[0].clientX / W;
      mouseNY = e.touches[0].clientY / H;
    }
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });
  scheduleSurge();
}

function coverTransform() {
  const ia = imgW / imgH, va = W / H;
  let dW, dH, oX, oY;
  if (va > ia) { dW = W; dH = W / ia; oX = 0; oY = (H - dH) / 2; }
  else         { dH = H; dW = H * ia; oX = (W - dW) / 2; oY = 0; }
  return { dW, dH, oX, oY };
}

function imgToVp(rx, ry) {
  const t = coverTransform();
  return { x: t.oX + rx * t.dW, y: t.oY + ry * t.dH };
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;

  fxC.width  = W * dpr;  fxC.height  = H * dpr;
  fxC.style.width = W + 'px';  fxC.style.height = H + 'px';

  // In Low Power Mode, we turn off bloom completely or reduce resolution further
  let bloomRes = isLowPowerMode ? 0.25 : 0.5;
  blC.width  = Math.floor(W * dpr * bloomRes);
  blC.height = Math.floor(H * dpr * bloomRes);
  blC.style.width = W + 'px';  blC.style.height = H + 'px';

  const ctr = imgToVp(IMG_BOX_CX, IMG_BOX_TY);
  const bot = imgToVp(IMG_BOX_CX, IMG_BOX_BY);
  const cv  = coverTransform();

  boxCX = ctr.x;
  boxTY = ctr.y;
  boxBY = bot.y;
  boxW  = IMG_BOX_W * cv.dW;
  beamSrcHW = boxW * BEAM_SRC_HW_RATIO;
  beamTopHW = W * BEAM_TOP_HW_FRAC;

  initParticles();
}

function beamHW(y) {
  if (y >= boxTY) return beamSrcHW;
  if (y <= 0) return beamTopHW;
  const t = 1 - y / boxTY;
  return beamSrcHW + (beamTopHW - beamSrcHW) * Math.pow(t, 0.75);
}

function beamEdgeWobble(y, t, seed) {
  return Math.sin(y * 0.008 + t * 1.8 + seed) * 3 + Math.sin(y * 0.018 + t * 3.2 + seed * 2) * 1.8;
}

function smoothstep(x) {
  x = Math.max(0, Math.min(1, x));
  return x * x * (3 - 2 * x);
}

function isMobile() { return W < 768; }

function initParticles() {
  const m = isMobile();
  const powerFactor = isLowPowerMode ? 0.3 : 1.0;
  
  beamParts = []; for (let i = 0; i < (m ? 130 : 280) * powerFactor; i++) beamParts.push(mkBeam(true));
  ambParts  = []; for (let i = 0; i < (m ? 20 : 45) * powerFactor; i++)  ambParts.push(mkAmb(true));
  streaks   = []; for (let i = 0; i < (m ? 6 : 14) * powerFactor; i++)   streaks.push(mkStreak(true));
  sparks    = []; for (let i = 0; i < (m ? 8 : 18) * powerFactor; i++)   sparks.push(mkSpark(true));
}

function mkBeam(rand) {
  const y = rand ? Math.random() * boxTY : boxTY - Math.random() * 15;
  const hw = beamHW(y) * 0.65;
  return {
    x: boxCX + (Math.random() - 0.5) * hw * 2,
    y: y,
    vy: -(35 + Math.random() * 85),
    vx: (Math.random() - 0.5) * 12,
    sz: 0.8 + Math.random() * 2.2,
    a:  0.3 + Math.random() * 0.7,
    life: rand ? Math.random() * 6 : 0,
    max: 3 + Math.random() * 5,
    bright: Math.random() > 0.85
  };
}
function mkAmb(rand) {
  return {
    x: boxCX + (Math.random() - 0.5) * boxW * 4,
    y: rand ? boxBY + (Math.random() - 0.3) * H * 0.25 : boxBY + Math.random() * 20,
    vy: -(4 + Math.random() * 14),
    vx: (Math.random() - 0.5) * 6,
    sz: 0.8 + Math.random() * 1.5,
    a:  0.15 + Math.random() * 0.35,
    life: rand ? Math.random() * 8 : 0,
    max: 6 + Math.random() * 12
  };
}
function mkStreak(rand) {
  const y = rand ? Math.random() * boxTY : boxTY;
  const hw = beamHW(y) * 0.45;
  return {
    x: boxCX + (Math.random() - 0.5) * hw * 2,
    y: y,
    vy: -(250 + Math.random() * 450),
    len: 25 + Math.random() * 65,
    a:  0.08 + Math.random() * 0.22,
    life: rand ? Math.random() * 2 : 0,
    max: 0.8 + Math.random() * 1.8
  };
}
function mkSpark(rand) {
  return {
    x: boxCX + (Math.random() - 0.5) * beamSrcHW * 3,
    y: boxTY - Math.random() * 40,
    vy: -(60 + Math.random() * 120),
    vx: (Math.random() - 0.5) * 80,
    a: 0,
    life: rand ? Math.random() * 5 : 0,
    max: 0.3 + Math.random() * 0.8,
    active: false,
    cd: rand ? Math.random() * 4 : 1 + Math.random() * 3
  };
}

function scheduleSurge() { nextSurge = time + SURGE_MIN / 1000 + Math.random() * (SURGE_MAX - SURGE_MIN) / 1000; }
function updateSurge(dt) {
  if (surgePhase === "idle" && time >= nextSurge) { surgePhase = "build"; surgeTmr = 0; }
  surgeTmr += dt;
  switch (surgePhase) {
    case "build": surgeAmt = Math.min(1, surgeTmr / 0.35); if (surgeTmr >= 0.35) { surgePhase = "flash"; surgeTmr = 0; } break;
    case "flash": surgeAmt = 1; if (surgeTmr >= 0.12) { surgePhase = "hold"; surgeTmr = 0; } break;
    case "hold": surgeAmt = 0.85 + Math.sin(surgeTmr * 25) * 0.15; if (surgeTmr >= 0.45) { surgePhase = "decay"; surgeTmr = 0; } break;
    case "decay": surgeAmt = Math.max(0, 0.85 * (1 - surgeTmr / 1.4)); if (surgeTmr >= 1.4) { surgePhase = "idle"; surgeAmt = 0; scheduleSurge(); } break;
  }
}

function beamNoise(y, t) {
  return Math.sin(y * 0.007 + t * 1.4) * 0.3 + Math.sin(y * 0.016 + t * 2.8) * 0.2 + Math.sin(y * 0.003 + t * 0.7) * 0.5;
}
function traceCone(ctx, mOff, steps=36) {
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; const y = t * boxTY;
    const hw = beamHW(y) + beamEdgeWobble(y, time, 0);
    const mx = mOff * (1 - t);
    const x = boxCX - hw + mx;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps; const y = t * boxTY;
    const hw = beamHW(y) + beamEdgeWobble(y, time, 3.7);
    const mx = mOff * (1 - t);
    ctx.lineTo(boxCX + hw + mx, y);
  }
  ctx.closePath();
}

function drawFloorGlow(ctx, s) {
  ctx.save(); ctx.translate(boxCX, boxBY + 10); ctx.scale(1, 0.22);
  let r = W * 0.28 * s; let g = ctx.createRadialGradient(0, 0, r * 0.02, 0, 0, r);
  g.addColorStop(0, `rgba(${THEME.primary}, ${(0.14 * s)})`);
  g.addColorStop(0.5, `rgba(88, 28, 135, ${(0.06 * s)})`);
  g.addColorStop(1, "rgba(60, 20, 120, 0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function drawBeamBody(ctx, s, mOff) {
  let pulse = 0.85 + beamNoise(H * 0.4, time) * 0.15; let base = 0.065 * s * pulse;
  ctx.save(); ctx.globalCompositeOperation = "lighter"; traceCone(ctx, mOff);
  let g = ctx.createLinearGradient(boxCX, boxTY, boxCX, 0);
  g.addColorStop(0, `rgba(200, 160, 255, ${Math.min(0.28, base * 3.5)})`);
  g.addColorStop(0.08, `rgba(160, 120, 255, ${Math.min(0.18, base * 2.5)})`);
  g.addColorStop(0.35, `rgba(120, 80, 220, ${base})`);
  g.addColorStop(0.7, `rgba(90, 50, 190, ${(base * 0.55)})`);
  g.addColorStop(1, `rgba(60, 30, 150, ${(base * 0.08)})`);
  ctx.fillStyle = g; ctx.fill();
  
  let g2 = ctx.createLinearGradient(boxCX, boxTY, boxCX, 0);
  let ca = base * 1.2;
  g2.addColorStop(0, `rgba(220, 200, 255, ${Math.min(0.2, ca)})`);
  g2.addColorStop(0.15, `rgba(180, 150, 255, ${Math.min(0.08, ca * 0.5)})`);
  g2.addColorStop(0.5, `rgba(140, 100, 240, ${(ca * 0.15)})`);
  g2.addColorStop(1, "rgba(100, 60, 200, 0)");
  ctx.beginPath(); let shrink = 0.5;
  for (let i = 0; i <= 20; i++) {
    let t = i / 20, y = t * boxTY;
    let hw = (beamHW(y) + beamEdgeWobble(y, time, 0)) * shrink;
    let mx = mOff * (1 - t); i === 0 ? ctx.moveTo(boxCX - hw + mx, y) : ctx.lineTo(boxCX - hw + mx, y);
  }
  for (let i = 20; i >= 0; i--) {
    let t = i / 20, y = t * boxTY;
    let hw = (beamHW(y) + beamEdgeWobble(y, time, 3.7)) * shrink;
    let mx = mOff * (1 - t); ctx.lineTo(boxCX + hw + mx, y);
  }
  ctx.closePath(); ctx.fillStyle = g2; ctx.fill(); ctx.restore();
}
function drawVolumetricBands(ctx, s, mOff) {
  ctx.save(); ctx.globalCompositeOperation = "lighter"; traceCone(ctx, mOff); ctx.clip();
  let bandCount = 6; let spacing = boxTY / bandCount;
  for (let i = 0; i < bandCount; i++) {
    let baseY = (time * 60 + i * spacing) % (boxTY + 80) - 40; let y = boxTY - baseY;
    if (y < -40 || y > boxTY + 40) continue;
    let hw = beamHW(Math.max(0, y)) * 0.55;
    let bandA = 0.04 * s * (0.6 + Math.sin(time * 2 + i * 1.5) * 0.4);
    let g = ctx.createRadialGradient(boxCX + mOff * (1 - y / boxTY), y, 0, boxCX + mOff * (1 - y / boxTY), y, hw);
    g.addColorStop(0, `rgba(200, 170, 255, ${bandA})`);
    g.addColorStop(0.6, `rgba(140, 100, 240, ${(bandA * 0.3)})`);
    g.addColorStop(1, "rgba(100, 60, 200, 0)");
    ctx.fillStyle = g; ctx.fillRect(boxCX - hw * 1.5, y - 18, hw * 3, 36);
  }
  ctx.restore();
}
function drawBeamEdges(ctx, s, mOff) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  let pulse = 0.7 + beamNoise(H * 0.3, time) * 0.3; let alpha = 0.18 * s * pulse;
  ctx.lineWidth = 1.5; ctx.shadowBlur = 12; ctx.shadowColor = `rgba(${THEME.primaryLight}, ${(alpha * 2)})`;
  ctx.strokeStyle = `rgba(180, 150, 255, ${alpha})`;
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) { let t = i / 30, y = t * boxTY; let x = boxCX - (beamHW(y) + beamEdgeWobble(y, time, 0)) + mOff * (1 - t); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke(); ctx.beginPath();
  for (let i = 0; i <= 30; i++) { let t = i / 30, y = t * boxTY; let x = boxCX + (beamHW(y) + beamEdgeWobble(y, time, 3.7)) + mOff * (1 - t); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke(); ctx.restore();
}
function drawBeamCore(ctx, s, mOff) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  let pulse = 0.6 + beamNoise(H * 0.5, time + 1) * 0.4; let a = 0.12 * s * pulse;
  ctx.lineWidth = 2; ctx.shadowBlur = 20; ctx.shadowColor = `rgba(200, 180, 255, ${(a * 2.5)})`; ctx.strokeStyle = `rgba(230, 210, 255, ${a})`;
  ctx.beginPath();
  for (let i = 0; i <= 25; i++) { let t = i / 25, y = t * boxTY; let x = boxCX + Math.sin(y * 0.012 + time * 2.5) * 2 + mOff * (1 - t); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke(); ctx.restore();
}
function drawBoxGlow(ctx, s) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  let pulse = 0.7 + Math.sin(time * 3) * 0.15 + Math.sin(time * 5.3) * 0.15;
  let r = boxW * 0.6 * s; let g = ctx.createRadialGradient(boxCX, boxTY, 0, boxCX, boxTY, r);
  g.addColorStop(0, `rgba(220, 200, 255, ${(0.3 * s * pulse)})`);
  g.addColorStop(0.3, `rgba(160, 120, 255, ${(0.12 * s * pulse)})`);
  g.addColorStop(0.7, `rgba(120, 80, 230, ${(0.04 * s * pulse)})`);
  g.addColorStop(1, "rgba(80, 40, 180, 0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(boxCX, boxTY, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function drawAtmosphericHaze(ctx, s) {
  ctx.save(); let a = 0.03 * s + beamNoise(0, time) * 0.01;
  let g = ctx.createRadialGradient(boxCX, boxTY * 0.5, 0, boxCX, boxTY * 0.5, H * 0.6);
  g.addColorStop(0, `rgba(100, 60, 200, ${a})`); g.addColorStop(0.5, `rgba(60, 30, 150, ${(a * 0.4)})`); g.addColorStop(1, "rgba(30, 10, 80, 0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function updateAndDrawBeamParticles(ctx, dt, s, mOff) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < beamParts.length; i++) {
    let p = beamParts[i]; p.life += dt;
    if (p.life >= p.max || p.y < -20) { beamParts[i] = mkBeam(false); continue; }
    let dx = (mouseNX - 0.5) * W - p.x; let dy = mouseNY * H - p.y; let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 120 && dist > 0) { p.vx -= (dx / dist) * ((120 - dist) / 120 * 0.4); }
    p.x += p.vx * dt; p.y += p.vy * dt;
    let hw = beamHW(Math.max(0, p.y)) * 0.75; let cxOff = boxCX + mOff * Math.max(0, 1 - p.y / boxTY);
    if (p.x < cxOff - hw) p.x = cxOff - hw + 2; if (p.x > cxOff + hw) p.x = cxOff + hw - 2;
    let lifeT = p.life / p.max; let fadeA = lifeT < 0.1 ? lifeT / 0.1 : lifeT > 0.85 ? (1 - lifeT) / 0.15 : 1;
    let heightFade = Math.max(0.15, p.y / boxTY); let a = p.a * fadeA * heightFade * s * (p.bright ? 1.5 : 1);
    if (a < 0.01) continue;
    ctx.fillStyle = p.bright ? `rgba(230, 210, 255, ${Math.min(1, a)})` : `rgba(180, 150, 255, ${Math.min(1, a)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (p.bright ? 1.3 : 1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function updateAndDrawAmbientParticles(ctx, dt, s) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < ambParts.length; i++) {
    let p = ambParts[i]; p.life += dt;
    if (p.life >= p.max) { ambParts[i] = mkAmb(false); continue; }
    p.x += p.vx * dt + Math.sin(time * 0.8 + i * 2) * 0.3; p.y += p.vy * dt;
    let lifeT = p.life / p.max; let a = p.a * (lifeT < 0.15 ? lifeT / 0.15 : lifeT > 0.8 ? (1 - lifeT) / 0.2 : 1) * s;
    if (a < 0.01) continue;
    ctx.fillStyle = `rgba(${THEME.primaryLight}, ${Math.min(1, a)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function updateAndDrawStreaks(ctx, dt, s, mOff) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < streaks.length; i++) {
    let p = streaks[i]; p.life += dt;
    if (p.life >= p.max || p.y < -p.len) { streaks[i] = mkStreak(false); continue; }
    p.y += p.vy * dt;
    let lifeT = p.life / p.max; let a = p.a * (lifeT < 0.15 ? lifeT / 0.15 : lifeT > 0.7 ? (1 - lifeT) / 0.3 : 1) * s;
    if (a < 0.01) continue;
    let x = (boxCX + mOff * Math.max(0, 1 - p.y / boxTY)) + (p.x - boxCX);
    let g = ctx.createLinearGradient(x, p.y, x, p.y + p.len);
    g.addColorStop(0, `rgba(200, 180, 255, ${a})`); g.addColorStop(1, "rgba(140, 100, 240, 0)");
    ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x, p.y + p.len); ctx.stroke();
  }
  ctx.restore();
}
function updateAndDrawSparks(ctx, dt, s) {
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < sparks.length; i++) {
    let p = sparks[i];
    if (!p.active) {
      p.cd -= dt;
      if (p.cd <= 0 && (surgeAmt > 0.3 || Math.random() < 0.005)) {
        p.active = true; p.life = 0; p.x = boxCX + (Math.random() - 0.5) * beamSrcHW * 3; p.y = boxTY - Math.random() * 30;
        p.vx = (Math.random() - 0.5) * 100; p.vy = -(80 + Math.random() * 140);
      }
      continue;
    }
    p.life += dt;
    if (p.life >= p.max) { p.active = false; p.cd = 1.5 + Math.random() * 4; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97;
    let a = (1 - (p.life / p.max)) * 0.5 * s;
    ctx.strokeStyle = `rgba(200, 170, 255, ${a})`; ctx.lineWidth = 1.5; ctx.shadowBlur = 8; ctx.shadowColor = `rgba(${THEME.primaryLight}, ${(a * 2)})`;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * dt * 3, p.y - p.vy * dt * 3); ctx.stroke();
  }
  ctx.restore();
}
function drawSurgeFlash(ctx, s) {
  if (surgeAmt < 0.3) return;
  ctx.save(); ctx.globalCompositeOperation = "lighter";
  let r = boxW * (0.8 + surgeAmt * 0.5); let g = ctx.createRadialGradient(boxCX, boxTY, 0, boxCX, boxTY, r); let a = surgeAmt * 0.25;
  g.addColorStop(0, `rgba(255, 240, 255, ${a})`); g.addColorStop(0.3, `rgba(200, 170, 255, ${(a * 0.5)})`); g.addColorStop(1, "rgba(139, 92, 246, 0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(boxCX, boxTY, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(100, 60, 200, ${surgeAmt * 0.04})`; ctx.fillRect(0, 0, W, H); ctx.restore();
}
function drawBloom(s, mOff) {
  if (isLowPowerMode) return; // Skip bloom in low power mode to save battery
  let sc = blC.width / W; bl.setTransform(sc, 0, 0, sc, 0, 0); bl.clearRect(0, 0, W, H); bl.globalCompositeOperation = "lighter";
  let pulse = 0.85 + beamNoise(H * 0.4, time) * 0.15; let base = 0.1 * s * pulse;
  bl.save(); traceCone(bl, mOff, 20);
  let g = bl.createLinearGradient(boxCX, boxTY, boxCX, 0);
  g.addColorStop(0, `rgba(180, 150, 255, ${Math.min(0.35, base * 3)})`);
  g.addColorStop(0.2, `rgba(${THEME.primary}, ${Math.min(0.15, base * 1.5)})`);
  g.addColorStop(0.6, `rgba(100, 60, 200, ${(base * 0.4)})`); g.addColorStop(1, "rgba(60, 30, 150, 0)");
  bl.fillStyle = g; bl.fill(); bl.restore();
  
  let r = boxW * 0.7 * s; let bg = bl.createRadialGradient(boxCX, boxTY, 0, boxCX, boxTY, r);
  bg.addColorStop(0, `rgba(220, 200, 255, ${(0.4 * s * pulse)})`);
  bg.addColorStop(0.5, `rgba(${THEME.primary}, ${(0.1 * s * pulse)})`); bg.addColorStop(1, "rgba(80, 40, 180, 0)");
  bl.fillStyle = bg; bl.beginPath(); bl.arc(boxCX, boxTY, r, 0, Math.PI * 2); bl.fill();
  
  bl.strokeStyle = `rgba(220, 200, 255, ${0.18 * s * pulse})`; bl.lineWidth = 4; bl.beginPath();
  for (let i = 0; i <= 15; i++) {
    let t = i / 15, y = t * boxTY; let x = boxCX + Math.sin(y * 0.012 + time * 2.5) * 2 + mOff * (1 - t);
    i === 0 ? bl.moveTo(x, y) : bl.lineTo(x, y);
  }
  bl.stroke();
  if (surgeAmt > 0.2) {
    let sr = boxW * (1 + surgeAmt); let sg = bl.createRadialGradient(boxCX, boxTY, 0, boxCX, boxTY, sr);
    sg.addColorStop(0, `rgba(255, 240, 255, ${(surgeAmt * 0.35)})`); sg.addColorStop(0.5, `rgba(180, 140, 255, ${(surgeAmt * 0.1)})`); sg.addColorStop(1, "rgba(100, 60, 200, 0)");
    bl.fillStyle = sg; bl.beginPath(); bl.arc(boxCX, boxTY, sr, 0, Math.PI * 2); bl.fill();
  }
  bl.setTransform(1, 0, 0, 1, 0, 0);
}

function render(dt) {
  var intro = smoothstep(Math.min(1, time / 2.5));
  var surge = (1 + surgeAmt * 0.8) * intro;
  var mOff = (mouseNX - 0.5) * W * MOUSE_INFLUENCE * intro;
  fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, W, H);
  drawFloorGlow(fx, surge); drawAtmosphericHaze(fx, surge); drawBeamBody(fx, surge, mOff);
  if(!isLowPowerMode) drawVolumetricBands(fx, surge, mOff);
  drawBeamEdges(fx, surge, mOff); drawBeamCore(fx, surge, mOff);
  updateAndDrawStreaks(fx, dt, surge, mOff); updateAndDrawBeamParticles(fx, dt, surge, mOff);
  updateAndDrawSparks(fx, dt, surge); updateAndDrawAmbientParticles(fx, dt, surge);
  drawBoxGlow(fx, surge); drawSurgeFlash(fx, surge);
  drawBloom(surge, mOff);
}

function loop(ts) {
  if (!lastT) lastT = ts;
  var dt = Math.min((ts - lastT) / 1000, 0.05);
  lastT = ts;
  time += dt;

  fpsCount++;
  if (ts - lastFpsTime >= 1000) {
    fpsHistory.push(fpsCount);
    if(fpsHistory.length > 5) fpsHistory.shift();
    if(fpsHistory.length >= 5 && fpsHistory.reduce((a,b)=>a+b)/5 < 40 && !isLowPowerMode) {
      console.log('Low FPS detected, engaging battery saver mode');
      isLowPowerMode = true;
      initParticles(); // refresh particle counts to lower values
      if(blC) {
        blC.getContext('2d').clearRect(0,0,blC.width,blC.height); // clear bloom
      }
    }
    fpsCount = 0;
    lastFpsTime = ts;
  }

  updateSurge(dt); render(dt);
  if (isCanvasVisible) requestAnimationFrame(loop);
}
