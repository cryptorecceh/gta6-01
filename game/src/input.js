// Sunset Harbor — keyboard, mouse and touch input in one place.
// Pointer lock is requested on canvas click while playing; shot modes never need it.
import { clamp } from './config.js';

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.lookDX = 0; this.lookDY = 0;
    this.mouseDown = false; this.mouseClicked = false;
    this.touchMove = { x: 0, y: 0, active: false };
    this.touchLookDX = 0; this.touchLookDY = 0;
    this.touchFire = false;
    this.locked = false;
    this.onPauseKey = null; this.onInteractKey = null; this.onStealKey = null;
    this.onReloadKey = null; this.onMuteKey = null;
    this._canvas = canvas;
    this._isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyP' || e.code === 'Escape') this.onPauseKey?.();
      if (e.code === 'KeyE') this.onInteractKey?.();
      if (e.code === 'KeyF') this.onStealKey?.();
      if (e.code === 'KeyR') this.onReloadKey?.();
      if (e.code === 'KeyM') this.onMuteKey?.();
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.lookDX += e.movementX; this.lookDY += e.movementY;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true; this.mouseClicked = true;
      if (!this.locked && !this._isTouch) canvas.requestPointerLock?.();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this._bindTouch(canvas);
  }

  _bindTouch(canvas) {
    if (!this._isTouch) return;
    document.getElementById('touch').style.display = 'block';
    let moveId = null, lookId = null, lastX = 0, lastY = 0;
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < window.innerWidth / 2 && moveId === null) { moveId = t.identifier; lastX = t.clientX; lastY = t.clientY; }
        else if (lookId === null) { lookId = t.identifier; lastX = t.clientX; lastY = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) {
          this.touchMove.x = clamp((t.clientX - lastX) / 40, -1, 1);
          this.touchMove.y = clamp((t.clientY - lastY) / 40, -1, 1);
          this.touchMove.active = true;
        } else if (t.identifier === lookId) {
          this.touchLookDX += (t.clientX - lastX) * 2.2;
          this.touchLookDY += (t.clientY - lastY) * 2.2;
        }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) { moveId = null; this.touchMove = { x: 0, y: 0, active: false }; }
        if (t.identifier === lookId) lookId = null;
      }
    });
    document.getElementById('firebtn').addEventListener('touchstart', (e) => { this.touchFire = true; e.preventDefault(); }, { passive: false });
    document.getElementById('firebtn').addEventListener('touchend', () => { this.touchFire = false; });
  }

  axis() {
    let f = 0, s = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) s -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) s += 1;
    if (this.touchMove.active) { f -= this.touchMove.y; s += this.touchMove.x; }
    return { forward: clamp(f, -1, 1), strafe: clamp(s, -1, 1) };
  }

  consumeLook() {
    const dx = this.lookDX + this.touchLookDX;
    const dy = this.lookDY + this.touchLookDY;
    this.lookDX = 0; this.lookDY = 0; this.touchLookDX = 0; this.touchLookDY = 0;
    return { dx, dy };
  }

  consumeClick() { const c = this.mouseClicked || this.touchFire; this.mouseClicked = false; return c; }
  get firing() { return this.mouseDown || this.touchFire; }
  get running() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get jumping() { return this.keys.has('Space'); }
  unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
}
