// Áudio procedural com Web Audio API. Todos os sons são sintetizados em tempo real;
// para usar assets profissionais, registre buffers em `samples` com a mesma chave (ver `playSample`).

type Osc = OscillatorType;

interface ToneOpts {
  type?: Osc;
  freq: number;
  freqEnd?: number;
  dur: number;
  attack?: number;
  gain?: number;
  filter?: { type: BiquadFilterType; freq: number; q?: number };
  detune?: number;
  delay?: number;
  bus?: GainNode;
}

interface NoiseOpts {
  dur: number;
  filter?: BiquadFilterType;
  freq?: number;
  freqEnd?: number;
  q?: number;
  gain?: number;
  attack?: number;
  delay?: number;
  bus?: GainNode;
}

export type SfxName =
  | 'ui_click' | 'ui_select' | 'ui_deny' | 'card_play' | 'deploy' | 'build' | 'pistol' | 'rifle' | 'shotgun' | 'tower'
  | 'uv' | 'melee' | 'claw' | 'bite' | 'slash' | 'heavy' | 'hit' | 'hit_structure' | 'death_monster' | 'death_unit'
  | 'break' | 'fire' | 'light' | 'trap' | 'spit' | 'scream' | 'growl' | 'boss' | 'alarm' | 'wave' | 'victory' | 'defeat'
  | 'heal' | 'teleport' | 'slam' | 'thunder' | 'escort' | 'crow' | 'footstep' | 'reward';

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private lastPlayed: Partial<Record<SfxName, number>> = {};
  private musicNodes: AudioNode[] = [];
  private musicTimer: number | null = null;
  private intensity = 0;
  private bossMode = false;
  private layers: { tension?: GainNode; drone?: GainNode; boss?: GainNode; pad?: GainNode; wind?: GainNode; filter?: BiquadFilterNode } = {};
  private nextBeat = 0;
  private nextNote = 0;
  private nextAmbient = 0;
  private mode: 'menu' | 'battle' | 'none' = 'none';
  musicVolume = 0.55;
  sfxVolume = 0.8;
  muted = false;
  samples: Record<string, AudioBuffer> = {};

  /** Deve ser chamado a partir de uma interação explícita do usuário. */
  unlock() {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number, muted: boolean) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.7, t, 0.05);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // -------------------------------------------------------------------------
  // Primitivas de síntese
  // -------------------------------------------------------------------------

  private tone(o: ToneOpts) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const peak = o.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node: AudioNode = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.value = o.filter.freq;
      f.Q.value = o.filter.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g).connect(o.bus ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  private noise(o: NoiseOpts) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.filter ?? 'lowpass';
    f.frequency.setValueAtTime(o.freq ?? 2000, t);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.freqEnd), t + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + (o.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(o.bus ?? this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + 0.05);
  }

  /** Toca um sample registrado (substituição futura por assets). */
  private playSample(name: string, gain = 1) {
    const buf = this.samples[name];
    if (!buf || !this.ctx) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.sfxBus);
    src.start();
    return true;
  }

  // -------------------------------------------------------------------------
  // Efeitos sonoros
  // -------------------------------------------------------------------------

  play(name: SfxName, volume = 1) {
    if (!this.ctx || this.muted || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const minGap: Partial<Record<SfxName, number>> = { pistol: 0.05, tower: 0.06, hit: 0.04, melee: 0.05, claw: 0.05, death_monster: 0.06, footstep: 0.15, uv: 0.07, fire: 0.3 };
    if (now - (this.lastPlayed[name] ?? -1) < (minGap[name] ?? 0.03)) return;
    this.lastPlayed[name] = now;
    if (this.playSample(name, volume)) return;
    const v = volume;
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    switch (name) {
      case 'ui_click': this.tone({ type: 'triangle', freq: 660, freqEnd: 520, dur: 0.06, gain: 0.12 * v }); break;
      case 'ui_select': this.tone({ type: 'triangle', freq: 440, freqEnd: 880, dur: 0.1, gain: 0.12 * v }); this.tone({ type: 'sine', freq: 1320, dur: 0.12, gain: 0.04 * v, delay: 0.04 }); break;
      case 'ui_deny': this.tone({ type: 'square', freq: 160, freqEnd: 110, dur: 0.18, gain: 0.08 * v, filter: { type: 'lowpass', freq: 900 } }); break;
      case 'card_play': this.noise({ dur: 0.12, filter: 'bandpass', freq: 1800, freqEnd: 600, gain: 0.12 * v }); this.tone({ type: 'sine', freq: 220, freqEnd: 440, dur: 0.15, gain: 0.08 * v }); break;
      case 'deploy': this.tone({ type: 'sine', freq: 180, freqEnd: 90, dur: 0.25, gain: 0.25 * v }); this.noise({ dur: 0.2, filter: 'lowpass', freq: 600, gain: 0.15 * v }); break;
      case 'build':
        for (let i = 0; i < 3; i++) this.noise({ dur: 0.06, filter: 'bandpass', freq: r(500, 900), q: 4, gain: 0.25 * v, delay: i * 0.11 });
        break;
      case 'pistol': this.noise({ dur: 0.09, filter: 'highpass', freq: 1200, gain: 0.22 * v }); this.tone({ type: 'square', freq: r(140, 170), freqEnd: 60, dur: 0.07, gain: 0.12 * v, filter: { type: 'lowpass', freq: 1200 } }); break;
      case 'rifle': this.noise({ dur: 0.22, filter: 'bandpass', freq: 900, freqEnd: 300, gain: 0.3 * v }); this.tone({ type: 'sawtooth', freq: 120, freqEnd: 40, dur: 0.2, gain: 0.15 * v, filter: { type: 'lowpass', freq: 700 } }); break;
      case 'shotgun': this.noise({ dur: 0.3, filter: 'lowpass', freq: 3000, freqEnd: 400, gain: 0.4 * v }); this.tone({ type: 'sine', freq: 90, freqEnd: 35, dur: 0.25, gain: 0.3 * v }); break;
      case 'tower': this.noise({ dur: 0.07, filter: 'highpass', freq: 1800, gain: 0.15 * v }); this.tone({ type: 'square', freq: 200, freqEnd: 80, dur: 0.06, gain: 0.07 * v, filter: { type: 'lowpass', freq: 1500 } }); break;
      case 'uv': this.tone({ type: 'sawtooth', freq: 1400, freqEnd: 900, dur: 0.1, gain: 0.05 * v, filter: { type: 'bandpass', freq: 1800, q: 6 } }); break;
      case 'melee': this.noise({ dur: 0.08, filter: 'bandpass', freq: 700, q: 2, gain: 0.22 * v }); this.tone({ type: 'sine', freq: 120, freqEnd: 60, dur: 0.1, gain: 0.2 * v }); break;
      case 'claw': this.noise({ dur: 0.12, filter: 'bandpass', freq: 2400, freqEnd: 900, q: 3, gain: 0.16 * v }); break;
      case 'bite': this.noise({ dur: 0.1, filter: 'bandpass', freq: 1200, q: 5, gain: 0.25 * v }); this.tone({ type: 'square', freq: 90, dur: 0.08, gain: 0.08 * v, filter: { type: 'lowpass', freq: 500 } }); break;
      case 'slash': this.noise({ dur: 0.3, filter: 'bandpass', freq: 4000, freqEnd: 600, q: 2, gain: 0.25 * v }); this.tone({ type: 'sine', freq: 600, freqEnd: 150, dur: 0.3, gain: 0.06 * v }); break;
      case 'heavy': this.tone({ type: 'sine', freq: 80, freqEnd: 30, dur: 0.35, gain: 0.45 * v }); this.noise({ dur: 0.25, filter: 'lowpass', freq: 500, gain: 0.3 * v }); break;
      case 'hit': this.noise({ dur: 0.05, filter: 'bandpass', freq: r(800, 1400), q: 2, gain: 0.12 * v }); break;
      case 'hit_structure': this.noise({ dur: 0.08, filter: 'bandpass', freq: r(300, 600), q: 6, gain: 0.2 * v }); break;
      case 'death_monster': this.tone({ type: 'sawtooth', freq: r(180, 260), freqEnd: 50, dur: 0.4, gain: 0.08 * v, filter: { type: 'lowpass', freq: 900 } }); this.noise({ dur: 0.2, filter: 'lowpass', freq: 800, gain: 0.12 * v }); break;
      case 'death_unit': this.tone({ type: 'triangle', freq: 330, freqEnd: 110, dur: 0.5, gain: 0.12 * v }); break;
      case 'break': for (let i = 0; i < 5; i++) this.noise({ dur: 0.12, filter: 'bandpass', freq: r(300, 1500), q: 3, gain: 0.22 * v, delay: i * 0.05 }); break;
      case 'fire': this.noise({ dur: 0.9, filter: 'lowpass', freq: 400, freqEnd: 2500, gain: 0.25 * v, attack: 0.1 }); this.noise({ dur: 0.3, filter: 'highpass', freq: 3000, gain: 0.1 * v }); break;
      case 'light':
        this.tone({ type: 'sine', freq: 400, freqEnd: 1600, dur: 0.5, gain: 0.2 * v });
        this.tone({ type: 'triangle', freq: 800, freqEnd: 2400, dur: 0.7, gain: 0.08 * v, delay: 0.05 });
        this.noise({ dur: 0.6, filter: 'highpass', freq: 5000, gain: 0.08 * v });
        break;
      case 'trap': this.noise({ dur: 0.12, filter: 'bandpass', freq: 2500, q: 3, gain: 0.3 * v }); this.tone({ type: 'square', freq: 300, freqEnd: 100, dur: 0.1, gain: 0.1 * v, filter: { type: 'lowpass', freq: 1500 } }); break;
      case 'spit': this.noise({ dur: 0.2, filter: 'bandpass', freq: 600, freqEnd: 1600, q: 4, gain: 0.15 * v }); break;
      case 'scream':
        this.tone({ type: 'sawtooth', freq: 500, freqEnd: 1100, dur: 0.6, gain: 0.08 * v, filter: { type: 'bandpass', freq: 1200, q: 3 } });
        this.tone({ type: 'sawtooth', freq: 520, freqEnd: 1180, dur: 0.6, gain: 0.06 * v, detune: 30, filter: { type: 'bandpass', freq: 1300, q: 3 } });
        break;
      case 'growl': this.tone({ type: 'sawtooth', freq: 70, freqEnd: 55, dur: 0.6, gain: 0.12 * v, filter: { type: 'lowpass', freq: 400 } }); break;
      case 'boss':
        for (const [f, d] of [[55, 0], [58, 0.02], [41, 0.04]]) this.tone({ type: 'sawtooth', freq: f, freqEnd: f * 0.9, dur: 2.2, attack: 0.2, gain: 0.18 * v, filter: { type: 'lowpass', freq: 600 }, delay: d });
        this.noise({ dur: 2, filter: 'lowpass', freq: 200, gain: 0.25 * v, attack: 0.3 });
        break;
      case 'alarm':
        for (let i = 0; i < 4; i++) this.tone({ type: 'square', freq: i % 2 ? 660 : 880, dur: 0.22, gain: 0.06 * v, delay: i * 0.25, filter: { type: 'lowpass', freq: 2000 } });
        break;
      case 'wave': this.tone({ type: 'sawtooth', freq: 110, freqEnd: 98, dur: 1.4, attack: 0.15, gain: 0.12 * v, filter: { type: 'lowpass', freq: 700 } }); this.tone({ type: 'sawtooth', freq: 165, freqEnd: 147, dur: 1.4, attack: 0.15, gain: 0.08 * v, filter: { type: 'lowpass', freq: 700 } }); break;
      case 'victory':
        [440, 554, 659, 880].forEach((f, i) => this.tone({ type: 'triangle', freq: f, dur: 1.4 - i * 0.2, gain: 0.12 * v, delay: i * 0.14, bus: this.musicBus }));
        break;
      case 'defeat':
        [330, 311, 262, 196].forEach((f, i) => this.tone({ type: 'sawtooth', freq: f, freqEnd: f * 0.97, dur: 1.2, gain: 0.07 * v, delay: i * 0.35, filter: { type: 'lowpass', freq: 800 }, bus: this.musicBus }));
        break;
      case 'heal': this.tone({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.25, gain: 0.05 * v }); break;
      case 'teleport': this.tone({ type: 'sine', freq: 1200, freqEnd: 80, dur: 0.5, gain: 0.15 * v }); this.noise({ dur: 0.4, filter: 'bandpass', freq: 300, freqEnd: 3000, q: 5, gain: 0.12 * v }); break;
      case 'slam': this.tone({ type: 'sine', freq: 60, freqEnd: 25, dur: 0.6, gain: 0.6 * v }); this.noise({ dur: 0.5, filter: 'lowpass', freq: 1200, freqEnd: 100, gain: 0.45 * v }); break;
      case 'thunder': this.noise({ dur: 2.5, filter: 'lowpass', freq: 800, freqEnd: 80, gain: 0.4 * v, attack: 0.02 }); break;
      case 'escort': this.tone({ type: 'triangle', freq: 523, dur: 0.3, gain: 0.1 * v }); this.tone({ type: 'triangle', freq: 784, dur: 0.4, gain: 0.1 * v, delay: 0.12 }); break;
      case 'crow': this.tone({ type: 'sawtooth', freq: 900, freqEnd: 600, dur: 0.15, gain: 0.04 * v, filter: { type: 'bandpass', freq: 1200, q: 4 } }); break;
      case 'footstep': this.noise({ dur: 0.05, filter: 'lowpass', freq: 300, gain: 0.05 * v }); break;
      case 'reward': [784, 988, 1175].forEach((f, i) => this.tone({ type: 'triangle', freq: f, dur: 0.3, gain: 0.08 * v, delay: i * 0.08 })); break;
    }
  }

  // -------------------------------------------------------------------------
  // Música e ambiente adaptativos
  // -------------------------------------------------------------------------

  startMusic(mode: 'menu' | 'battle') {
    if (!this.ctx) return;
    if (this.mode === mode) return;
    this.stopMusic();
    this.mode = mode;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.Q.value = 3;
    const drone = ctx.createGain();
    drone.gain.value = 0;
    drone.gain.setTargetAtTime(0.22, t, 2);
    filter.connect(drone).connect(this.musicBus);
    for (const [f, det] of [[55, -8], [55, 7], [82.4, 0]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(filter);
      o.start();
      this.musicNodes.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.musicNodes.push(lfo, filter, drone);

    // Camada de tensão: cluster agudo com tremolo
    const tension = ctx.createGain();
    tension.gain.value = 0;
    const trem = ctx.createOscillator();
    trem.frequency.value = 5.5;
    const tremG = ctx.createGain();
    tremG.gain.value = 0.5;
    trem.connect(tremG).connect(tension.gain);
    trem.start();
    const tf = ctx.createBiquadFilter();
    tf.type = 'bandpass';
    tf.frequency.value = 1200;
    tf.Q.value = 0.8;
    tf.connect(tension).connect(this.musicBus);
    for (const f of [880, 932.3, 1318.5]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.03;
      o.connect(g).connect(tf);
      o.start();
      this.musicNodes.push(o, g);
    }
    this.musicNodes.push(trem, tremG, tf, tension);

    // Camada de chefe: metais graves
    const boss = ctx.createGain();
    boss.gain.value = 0;
    const bf = ctx.createBiquadFilter();
    bf.type = 'lowpass';
    bf.frequency.value = 500;
    bf.connect(boss).connect(this.musicBus);
    for (const [f, det] of [[36.7, 0], [36.7, 12], [73.4, -6]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(bf);
      o.start();
      this.musicNodes.push(o);
    }
    this.musicNodes.push(bf, boss);

    // Vento
    const wind = ctx.createGain();
    wind.gain.value = 0;
    wind.gain.setTargetAtTime(0.12, t, 2);
    const ws = ctx.createBufferSource();
    ws.buffer = this.noiseBuf;
    ws.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 500;
    wf.Q.value = 0.7;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.11;
    const wlg = ctx.createGain();
    wlg.gain.value = 300;
    wl.connect(wlg).connect(wf.frequency);
    ws.connect(wf).connect(wind).connect(this.musicBus);
    ws.start();
    wl.start();
    this.musicNodes.push(ws, wf, wl, wlg, wind);

    this.layers = { tension, drone, boss, wind, filter };
    this.intensity = 0;
    this.bossMode = false;
    this.nextBeat = t + 1;
    this.nextNote = t + 2;
    this.nextAmbient = t + 3;
    this.musicTimer = window.setInterval(() => this.schedule(), 120);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const i = this.intensity;
    // Batimento cardíaco: acelera com a intensidade.
    if (this.mode === 'battle' && i > 0.15 && t >= this.nextBeat) {
      const bpm = 56 + i * 64 + (this.bossMode ? 20 : 0);
      const gap = 60 / bpm;
      this.tone({ type: 'sine', freq: 62, freqEnd: 38, dur: 0.22, gain: 0.25 * i, bus: this.musicBus });
      this.tone({ type: 'sine', freq: 56, freqEnd: 34, dur: 0.2, gain: 0.18 * i, delay: 0.22, bus: this.musicBus });
      this.nextBeat = t + gap;
    }
    // Notas esparsas de piano desafinado.
    if (t >= this.nextNote) {
      const scale = [220, 246.9, 261.6, 329.6, 349.2, 440, 493.9, 523.3];
      const f = scale[Math.floor(Math.random() * scale.length)];
      this.tone({ type: 'triangle', freq: f, dur: 2.4, gain: 0.05, detune: Math.random() * 30 - 15, bus: this.musicBus });
      this.tone({ type: 'sine', freq: f * 2, dur: 1.4, gain: 0.015, bus: this.musicBus });
      this.nextNote = t + (this.mode === 'menu' ? 2.5 : 4 - i * 2.4) + Math.random() * 2;
    }
    // Ruídos ambientes distantes (rangidos, uivos, corvos).
    if (t >= this.nextAmbient) {
      const k = Math.random();
      if (k < 0.35) this.noise({ dur: 0.9, filter: 'bandpass', freq: 300, freqEnd: 700, q: 12, gain: 0.05, attack: 0.3, bus: this.musicBus });
      else if (k < 0.6) this.tone({ type: 'sine', freq: 320, freqEnd: 260, dur: 2.2, attack: 0.6, gain: 0.025, bus: this.musicBus });
      else if (k < 0.8) this.play('crow', 0.6);
      else this.noise({ dur: 1.6, filter: 'lowpass', freq: 160, gain: 0.08, attack: 0.5, bus: this.musicBus });
      this.nextAmbient = t + 5 + Math.random() * 8;
    }
  }

  setIntensity(v: number, boss = false) {
    if (!this.ctx || !this.layers.tension) return;
    this.intensity = Math.max(0, Math.min(1, v));
    this.bossMode = boss;
    const t = this.ctx.currentTime;
    this.layers.tension.gain.setTargetAtTime(0.02 + this.intensity * 0.5, t, 1.2);
    this.layers.boss!.gain.setTargetAtTime(boss ? 0.16 : 0, t, 1.5);
    this.layers.filter!.frequency.setTargetAtTime(320 + this.intensity * 520, t, 1.5);
  }

  /** Corte dramático do ambiente (derrota). */
  fadeOutMusic(seconds = 2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const l of [this.layers.drone, this.layers.tension, this.layers.boss, this.layers.wind]) l?.gain.setTargetAtTime(0, t, seconds / 3);
  }

  stopMusic() {
    if (this.musicTimer !== null) clearInterval(this.musicTimer);
    this.musicTimer = null;
    for (const n of this.musicNodes) {
      try {
        if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) n.stop();
        n.disconnect();
      } catch {
        /* nó já parado */
      }
    }
    this.musicNodes = [];
    this.layers = {};
    this.mode = 'none';
  }
}
