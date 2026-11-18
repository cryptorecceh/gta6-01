// Sunset Harbor — HUD: money, health, wanted stars, objective, speed, toast,
// and a canvas minimap (roads, sea, player arrow, waypoint, police dots).
import { ROAD_LINES } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      hud: document.getElementById('hud'),
      money: document.getElementById('money'),
      healthfill: document.getElementById('healthfill'),
      healthnum: document.getElementById('healthnum'),
      mislabel: document.getElementById('mislabel'),
      stars: document.getElementById('stars'),
      objtitle: document.getElementById('objtitle'),
      objtext: document.getElementById('objtext'),
      speednum: document.getElementById('speednum'),
      gear: document.getElementById('gear'),
      toast: document.getElementById('toast'),
      crosshair: document.getElementById('crosshair'),
      status: document.getElementById('status'),
      minimap: document.getElementById('minimap'),
    };
    this._toastTimer = 0;
    this._mapCtx = this.el.minimap.getContext('2d');
  }

  show(on) { this.el.hud.classList.toggle('on', on); }

  toast(msg, seconds = 3.5) {
    this.el.toast.textContent = msg;
    this._toastTimer = seconds;
    this.el.status.textContent = msg;
  }

  update(dt, s) {
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.el.toast.textContent = '';
    }
    this.el.money.textContent = '$' + s.money.toLocaleString('en-US');
    this.el.healthfill.style.width = Math.max(0, s.health) + '%';
    this.el.healthnum.textContent = Math.max(0, Math.round(s.health));
    this.el.mislabel.textContent = s.missionLabel;
    this.el.stars.textContent = s.stars;
    this.el.stars.style.opacity = s.wanted > 0 ? '1' : '0.35';
    this.el.objtitle.textContent = s.objTitle;
    this.el.objtext.textContent = s.objText;
    this.el.speednum.textContent = s.speedMph;
    this.el.gear.textContent = s.inCar ? (s.speedMph > 0 ? 'DRIVING' : 'IN CAR') : 'ON FOOT';
    this.el.crosshair.style.display = s.showCrosshair ? 'block' : 'none';
    this._drawMinimap(s);
  }

  _drawMinimap(s) {
    const ctx = this._mapCtx, W = 190, H = 190;
    const toMap = (x, z) => [((x + 130) / 260) * W, ((z + 130) / 260) * H];
    ctx.clearRect(0, 0, W, H);
    // Sea west, land, then the road grid.
    ctx.fillStyle = '#14425e'; ctx.fillRect(0, 0, 14, H);
    ctx.fillStyle = '#2a2f3d'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#14425e'; ctx.fillRect(0, 0, 12, H);
    ctx.strokeStyle = '#5a6274'; ctx.lineWidth = 5;
    for (const c of ROAD_LINES) {
      const [x1] = toMap(c, 0); ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke();
      const [, y1] = toMap(0, c); ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(W, y1); ctx.stroke();
    }
    // Waypoint (gold pulsing dot).
    if (s.waypoint) {
      const [wx, wy] = toMap(s.waypoint.x, s.waypoint.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(wx, wy, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    // Police cruisers (red dots).
    ctx.fillStyle = '#ff3344';
    for (const p of s.police) {
      const [px, py] = toMap(p.x, p.z);
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Enemies (orange dots).
    ctx.fillStyle = '#ff8833';
    for (const e of s.enemies) {
      const [ex, ey] = toMap(e.x, e.z);
      ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow, rotated to heading.
    const [px, py] = toMap(s.playerX, s.playerZ);
    ctx.save();
    ctx.translate(px, py); ctx.rotate(Math.PI - s.heading);
    ctx.fillStyle = '#7dff9a';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('N', 4, 12);
  }
}

// Start / pause / game-over screens, all in one place.
export function showMenu(el, kind, data = {}) {
  const card = document.getElementById('menucard');
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';
  if (kind === 'start') {
    card.innerHTML = `
      <h1>SUNSET HARBOR</h1><h2>An open-world crime story</h2>
      <p>${data.intro}</p>
      <p><b>Fixer Mara Voss has 4 jobs for you.</b> Run them, get paid, stay ahead of the Harbor Police.</p>
      <div class="controls">WASD move &nbsp;·&nbsp; Mouse look &nbsp;·&nbsp; Shift run &nbsp;·&nbsp; Space jump<br>
      E enter / exit car &nbsp;·&nbsp; F steal car &nbsp;·&nbsp; Click shoot &nbsp;·&nbsp; R reload &nbsp;·&nbsp; P pause</div>
      <button id="btn-new">▶ NEW GAME</button>
      ${data.hasSave ? '<button id="btn-continue" class="ghost">CONTINUE — $' + data.saveMoney + ' · Job ' + (data.saveMission + 1) + '</button>' : ''}
      <p style="font-size:12px;color:#9a8ab0">Original game — no Rockstar / GTA content. All art, story and sound made for this game.</p>`;
    document.getElementById('btn-new').onclick = data.onNew;
    const cont = document.getElementById('btn-continue');
    if (cont) cont.onclick = data.onContinue;
  } else if (kind === 'pause') {
    card.innerHTML = `<h1>PAUSED</h1><p>Sunset Harbor waits for no one — except right now.</p>
      <p>Money: <b>$${data.money}</b> · Job ${data.mission + 1} of 4 · Wanted ${'★'.repeat(data.wanted)}${'☆'.repeat(5 - data.wanted)}</p>
      <button id="btn-resume">RESUME</button><button id="btn-quit" class="ghost">SAVE &amp; QUIT TO MENU</button>`;
    document.getElementById('btn-resume').onclick = data.onResume;
    document.getElementById('btn-quit').onclick = data.onQuit;
  } else if (kind === 'gameover') {
    card.innerHTML = `<h1 style="color:#ff5a4e">BUSTED</h1><h2>${data.reason}</h2>
      <p>The Harbor Police caught up with you. Mara Voss is already lining up your next shot at the city.</p>
      <p>Money kept: <b>$${data.money}</b> · Jobs done: ${data.missionsDone} of 4</p>
      <button id="btn-retry">↻ TRY AGAIN</button><button id="btn-menu" class="ghost">MAIN MENU</button>`;
    document.getElementById('btn-retry').onclick = data.onRetry;
    document.getElementById('btn-menu').onclick = data.onMenu;
  }
}

export function hideMenu() { document.getElementById('overlay').style.display = 'none'; }
