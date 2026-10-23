import Phaser from 'phaser';
import { DEPTH } from './EntityViews';

type EmitterKey = 'blood' | 'ichor' | 'ecto' | 'spark' | 'chip' | 'smoke' | 'ember' | 'flash' | 'acid' | 'magic' | 'dust' | 'heal' | 'bone';

interface FxSettings {
  particles: 'high' | 'low';
  reduceFlashes: boolean;
  reduceShake: boolean;
  damageNumbers: boolean;
}

/** Partículas, decalques, números flutuantes, tremores e flashes — com limites de quantidade. */
export class Effects {
  private emitters = {} as Record<EmitterKey, Phaser.GameObjects.Particles.ParticleEmitter>;
  private texts: Phaser.GameObjects.Text[] = [];
  private textCursor = 0;
  private decals: Phaser.GameObjects.Image[] = [];
  private decalCursor = 0;
  private budget = 0;

  constructor(private scene: Phaser.Scene, public settings: FxSettings) {
    const mk = (key: EmitterKey, tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig) => {
      const em = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      em.setDepth(DEPTH.particle);
      this.emitters[key] = em;
    };
    mk('blood', 'blood', { speed: { min: 40, max: 160 }, angle: { min: 0, max: 360 }, scale: { start: 0.7, end: 0.2 }, lifespan: { min: 250, max: 550 }, gravityY: 220, tint: [0x8a0d12, 0x5c070b, 0xb3161c] });
    mk('ichor', 'blood', { speed: { min: 40, max: 150 }, angle: { min: 0, max: 360 }, scale: { start: 0.7, end: 0.2 }, lifespan: { min: 250, max: 550 }, gravityY: 220, tint: [0x4a5a1a, 0x2a3a0a, 0x6a1a2a] });
    mk('ecto', 'dot', { speed: { min: 10, max: 60 }, angle: { min: 200, max: 340 }, scale: { start: 0.9, end: 0 }, lifespan: { min: 500, max: 1000 }, blendMode: 'ADD', tint: [0x9fe7ff, 0xc7a6ff] });
    mk('spark', 'spark', { speed: { min: 120, max: 320 }, angle: { min: 0, max: 360 }, rotate: { onEmit: (p: any) => Phaser.Math.RadToDeg(Math.atan2(p.velocityY, p.velocityX)) }, scale: { start: 0.8, end: 0.1 }, lifespan: { min: 120, max: 260 }, blendMode: 'ADD', tint: [0xffe08a, 0xffb347, 0xffffff] });
    mk('chip', 'chip', { speed: { min: 60, max: 200 }, angle: { min: 200, max: 340 }, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.6 }, lifespan: { min: 400, max: 800 }, gravityY: 400, tint: [0x6b4b33, 0x8a6444, 0x6f7680] });
    mk('bone', 'chip', { speed: { min: 60, max: 180 }, angle: { min: 200, max: 340 }, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.6 }, lifespan: { min: 400, max: 800 }, gravityY: 400, tint: [0xd6cfbd, 0xbdb59f] });
    mk('smoke', 'smoke', { speed: { min: 8, max: 40 }, angle: { min: 230, max: 310 }, scale: { start: 0.4, end: 1.4 }, alpha: { start: 0.45, end: 0 }, lifespan: { min: 700, max: 1400 }, tint: [0x3a3a3a, 0x555555] });
    mk('ember', 'dot', { speed: { min: 20, max: 80 }, angle: { min: 240, max: 300 }, scale: { start: 0.5, end: 0 }, lifespan: { min: 400, max: 900 }, blendMode: 'ADD', tint: [0xff9a1a, 0xffcf3a, 0xff5a1a], gravityY: -40 });
    mk('flash', 'dot', { speed: { min: 0, max: 20 }, scale: { start: 3, end: 0 }, lifespan: 120, blendMode: 'ADD', tint: 0xfff2c0 });
    mk('acid', 'dot', { speed: { min: 30, max: 110 }, angle: { min: 0, max: 360 }, scale: { start: 0.6, end: 0 }, lifespan: { min: 250, max: 500 }, blendMode: 'ADD', tint: [0xa8ff3a, 0x6aff1a] });
    mk('magic', 'dot', { speed: { min: 40, max: 160 }, angle: { min: 0, max: 360 }, scale: { start: 0.8, end: 0 }, lifespan: { min: 300, max: 700 }, blendMode: 'ADD', tint: [0xc59bff, 0xff4fa3, 0x7fd3ff] });
    mk('dust', 'smoke', { speed: { min: 20, max: 70 }, angle: { min: 0, max: 360 }, scale: { start: 0.2, end: 0.7 }, alpha: { start: 0.35, end: 0 }, lifespan: { min: 400, max: 800 }, tint: 0x6a5a48 });
    mk('heal', 'dot', { speed: { min: 10, max: 30 }, angle: { min: 250, max: 290 }, scale: { start: 0.5, end: 0 }, lifespan: 700, blendMode: 'ADD', tint: 0x7cff9b, gravityY: -60 });
    for (let i = 0; i < 48; i++) {
      const t = scene.add.text(0, 0, '', { fontFamily: 'Oswald, Impact, sans-serif', fontSize: '15px', color: '#fff', stroke: '#000', strokeThickness: 3 });
      t.setDepth(DEPTH.text).setOrigin(0.5).setVisible(false);
      this.texts.push(t);
    }
  }

  /** Reinicia o orçamento de partículas a cada frame. */
  frame() {
    this.budget = this.settings.particles === 'low' ? 40 : 140;
  }

  burst(key: EmitterKey, x: number, y: number, count: number) {
    let n = this.settings.particles === 'low' ? Math.ceil(count * 0.35) : count;
    n = Math.min(n, this.budget);
    if (n <= 0) return;
    this.budget -= n;
    this.emitters[key].explode(n, x, y);
  }

  decal(tex: 'splat' | 'scorch', x: number, y: number, tint: number, scale = 1, alpha = 0.7) {
    const max = this.settings.particles === 'low' ? 30 : 90;
    let img = this.decals[this.decalCursor];
    if (!img) {
      img = this.scene.add.image(x, y, tex).setDepth(DEPTH.decal);
      this.decals[this.decalCursor] = img;
    }
    this.decalCursor = (this.decalCursor + 1) % max;
    img.setTexture(tex).setPosition(x, y).setTint(tint).setAlpha(alpha).setScale(scale * Phaser.Math.FloatBetween(0.7, 1.2)).setAngle(Phaser.Math.Between(0, 360)).setVisible(true);
    this.scene.tweens.add({ targets: img, alpha: 0, delay: 14000, duration: 6000 });
  }

  number(x: number, y: number, text: string, color: string, size = 14, rise = 26) {
    if (!this.settings.damageNumbers && !/[A-Z]/.test(text)) return;
    const t = this.texts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % this.texts.length;
    this.scene.tweens.killTweensOf(t);
    t.setText(text).setColor(color).setFontSize(size).setPosition(x + Phaser.Math.Between(-6, 6), y).setAlpha(1).setScale(1).setVisible(true);
    this.scene.tweens.add({ targets: t, y: y - rise, alpha: 0, duration: 750, ease: 'Cubic.easeOut', onComplete: () => t.setVisible(false) });
    if (size > 16) this.scene.tweens.add({ targets: t, scale: { from: 1.5, to: 1 }, duration: 160 });
  }

  /** Texto de estado curto ("ATORDOADO", "BLOQUEADO"...). */
  label(x: number, y: number, text: string, color: string) {
    const t = this.texts[this.textCursor];
    this.textCursor = (this.textCursor + 1) % this.texts.length;
    this.scene.tweens.killTweensOf(t);
    t.setText(text).setColor(color).setFontSize(11).setPosition(x, y).setAlpha(1).setScale(1).setVisible(true);
    this.scene.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 1000, delay: 250, onComplete: () => t.setVisible(false) });
  }

  shake(intensity: number, duration = 160) {
    if (this.settings.reduceShake) return;
    this.scene.cameras.main.shake(duration, intensity * 0.004);
  }

  flash(color = 0xffffff, duration = 120, strength = 0.5) {
    const cam = this.scene.cameras.main;
    const k = this.settings.reduceFlashes ? 0.15 : strength;
    const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    cam.flash(duration, Math.round(r * k), Math.round(g * k), Math.round(b * k), true);
  }

  /** Anel que se expande (impacto, invocação, ondas de luz). */
  ring(x: number, y: number, radius: number, color: number, duration = 400, add = true) {
    const r = this.scene.add.image(x, y, 'ring').setDepth(DEPTH.telegraph - 1).setTint(color).setScale(0.05);
    if (add) r.setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: r, scale: (radius * 2) / 128, alpha: { from: 1, to: 0 }, duration, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  }

  destroy() {
    for (const em of Object.values(this.emitters)) em.destroy();
    for (const t of this.texts) t.destroy();
    for (const d of this.decals) d?.destroy();
  }
}
