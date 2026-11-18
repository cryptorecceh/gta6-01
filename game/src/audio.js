// Sunset Harbor — all sound is procedural WebAudio: no audio files, no network.
// Engine hum (oscillator + speed), gunshots (noise burst), sirens (two-tone),
// pickup blips, footsteps-free ambient pad loop and a simple dusk music line.
export class AudioEngine {
  constructor() {
    this.ctx = null; this.muted = false; this._engineOsc = null; this._engineGain = null;
    this._musicTimer = null; this._musicStep = 0;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this._master = this.ctx.createGain();
      this._master.gain.value = 0.5;
      this._master.connect(this.ctx.destination);
      // Engine hum: two detuned saws through a lowpass, gain follows speed.
      this._engineOsc = this.ctx.createOscillator();
      this._engineOsc.type = 'sawtooth'; this._engineOsc.frequency.value = 55;
      const sub = this.ctx.createOscillator();
      sub.type = 'sine'; sub.frequency.value = 28;
      this._engineGain = this.ctx.createGain(); this._engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      this._engineOsc.connect(lp); sub.connect(lp); lp.connect(this._engineGain);
      this._engineGain.connect(this._master);
      this._engineOsc.start(); sub.start(); this._engineSub = sub;
      this._startMusic();
    } catch { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this._master) this._master.gain.value = m ? 0 : 0.5;
  }

  setEngine(speed01, on) {
    if (!this.ctx || !this._engineGain) return;
    const t = this.ctx.currentTime;
    this._engineGain.gain.setTargetAtTime(on ? 0.03 + speed01 * 0.09 : 0, t, 0.1);
    this._engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, t, 0.08);
    this._engineSub.frequency.setTargetAtTime(26 + speed01 * 60, t, 0.08);
  }

  _blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this._master); o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 1800;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(this._master); src.start(t);
  }

  gunshot() { this._noise(0.16, 0.3, 2400); this._blip(160, 0.09, 'square', 0.1, 50); }
  enemyShot() { this._noise(0.12, 0.12, 1400); }
  crash() { this._noise(0.35, 0.3, 700); this._blip(70, 0.25, 'sawtooth', 0.14, 35); }
  pickup() { this._blip(660, 0.09, 'sine', 0.16); setTimeout(() => this._blip(990, 0.14, 'sine', 0.16), 90); }
  cash() { [523, 659, 784].forEach((f, i) => setTimeout(() => this._blip(f, 0.16, 'sine', 0.14), i * 90)); }
  sirenBurst() { this._blip(750, 0.5, 'sine', 0.05, 1150); }
  hurt() { this._blip(220, 0.2, 'sawtooth', 0.14, 90); }
  busted() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this._blip(f, 0.3, 'triangle', 0.16), i * 180)); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._blip(f, 0.22, 'triangle', 0.15), i * 110)); }

  // Slow dusk pad: a soft minor-key loop, one note every 0.55 s.
  _startMusic() {
    const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];
    const melody = [0, 2, 4, 3, 4, 6, 5, 4, 2, 0, 1, 2];
    this._musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const n = melody[this._musicStep % melody.length];
      this._musicStep++;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = 'triangle';
      o.frequency.value = scale[n] / 2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g); g.connect(this._master); o.start(t); o.stop(t + 1.2);
    }, 550);
  }
}
