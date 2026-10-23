import Phaser from 'phaser';
import { DEPTH } from './EntityViews';

export interface Light {
  x: number;
  y: number;
  r: number;
  /** 0..1 quanto da escuridão é removida. */
  a: number;
  color?: number;
  glow?: number;
}

/**
 * Iluminação 2D: uma camada de escuridão (RenderTexture em meia resolução) com luzes "apagando"
 * a escuridão, mais brilhos coloridos aditivos por cima. Névoa e chuva também moram aqui.
 */
export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private brush: Phaser.GameObjects.Image;
  private glows: Phaser.GameObjects.Image[] = [];
  private fog: Phaser.GameObjects.TileSprite[] = [];
  private rain?: Phaser.GameObjects.Particles.ParticleEmitter;
  private splash?: Phaser.GameObjects.Particles.ParticleEmitter;
  private ambient: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private readonly scale = 0.5;
  darkness = 0.6;
  fogAlpha = 0.2;
  private fogNow = 0.2;
  private darkNow = 0.6;
  raining = false;
  private flashT = 0;

  constructor(private scene: Phaser.Scene, private w: number, private h: number, fogColor: number, private lowQuality: boolean) {
    this.rt = scene.add.renderTexture(0, 0, Math.ceil(w * this.scale), Math.ceil(h * this.scale)).setOrigin(0, 0).setScale(1 / this.scale).setDepth(DEPTH.dark);
    this.brush = scene.make.image({ key: 'light', add: false });
    for (let i = 0; i < 2; i++) {
      const f = scene.add.tileSprite(w / 2, h / 2, w + 200, h + 200, 'fog').setDepth(DEPTH.fog).setTint(fogColor).setAlpha(this.fogAlpha);
      f.tileScaleX = f.tileScaleY = 1.4 + i * 0.6;
      this.fog.push(f);
    }
    // Partículas ambientes: cinzas, folhas e vagalumes.
    const amb = (tex: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth: number) => {
      const em = scene.add.particles(0, 0, tex, cfg).setDepth(depth);
      this.ambient.push(em);
      return em;
    };
    const k = lowQuality ? 0.35 : 1;
    amb('dot', { x: { min: 0, max: w }, y: { min: -20, max: h }, lifespan: 6000, speedX: { min: 10, max: 30 }, speedY: { min: 5, max: 20 }, scale: { min: 0.08, max: 0.18 }, alpha: { start: 0.6, end: 0 }, tint: 0xb0a090, frequency: 220 / k, quantity: 1 }, DEPTH.particle);
    amb('leaf', { x: { min: 0, max: w }, y: -10, lifespan: 9000, speedX: { min: 20, max: 50 }, speedY: { min: 20, max: 50 }, rotate: { min: 0, max: 360 }, scale: { min: 0.6, max: 1 }, alpha: 0.7, tint: [0x4a3a20, 0x3a2a1a, 0x5a4020], frequency: 900 / k }, DEPTH.particle);
    amb('firefly', { x: { min: 0, max: w }, y: { min: 0, max: h }, lifespan: 4000, speed: { min: 4, max: 16 }, scale: { start: 0.4, end: 0.1 }, alpha: { start: 0.9, end: 0 }, blendMode: 'ADD', frequency: 400 / k, quantity: 1 }, DEPTH.glow);
  }

  setRain(on: boolean) {
    if (on === this.raining) return;
    this.raining = on;
    if (on && !this.rain) {
      this.rain = this.scene.add.particles(0, 0, 'rain', {
        x: { min: -100, max: this.w + 100 }, y: -30, lifespan: 700, speedY: { min: 900, max: 1100 }, speedX: -160, rotate: 10,
        scale: { min: 0.6, max: 1 }, alpha: 0.4, quantity: this.lowQuality ? 2 : 6, frequency: 16,
      }).setDepth(DEPTH.glow + 1);
      this.splash = this.scene.add.particles(0, 0, 'dot', {
        x: { min: 0, max: this.w }, y: { min: 0, max: this.h }, lifespan: 220, scale: { start: 0.25, end: 0 }, alpha: 0.35,
        quantity: this.lowQuality ? 1 : 3, frequency: 30,
      }).setDepth(DEPTH.particle);
    }
    this.rain?.setVisible(on);
    this.splash?.setVisible(on);
    if (on) {
      this.rain?.start();
      this.splash?.start();
    } else {
      this.rain?.stop();
      this.splash?.stop();
    }
  }

  /** Relâmpago: remove brevemente a escuridão. */
  lightning() {
    this.flashT = 0.25;
  }

  update(dt: number, lights: Light[], time: number) {
    this.darkNow += (this.darkness - this.darkNow) * Math.min(1, dt * 1.5);
    this.fogNow += (this.fogAlpha - this.fogNow) * Math.min(1, dt * 0.8);
    for (let i = 0; i < this.fog.length; i++) {
      const f = this.fog[i];
      f.tilePositionX += dt * (8 + i * 6);
      f.tilePositionY += dt * (2 + i);
      f.setAlpha(this.fogNow * (0.8 + Math.sin(time * 0.2 + i) * 0.2));
    }
    let dark = Phaser.Math.Clamp(this.darkNow, 0, 0.93);
    if (this.flashT > 0) {
      this.flashT -= dt;
      dark *= 0.25;
    }
    const s = this.scale;
    this.rt.clear();
    this.rt.fill(0x05060c, dark);
    let gi = 0;
    for (const l of lights) {
      this.brush.setScale((l.r * 2 * s) / 256).setAlpha(l.a);
      this.rt.erase(this.brush, l.x * s, l.y * s);
      if (l.color !== undefined && l.glow) {
        let g = this.glows[gi];
        if (!g) {
          g = this.scene.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow);
          this.glows[gi] = g;
        }
        g.setVisible(true).setPosition(l.x, l.y).setTint(l.color).setAlpha(l.glow).setScale((l.r * 1.4) / 256);
        gi++;
      }
    }
    for (; gi < this.glows.length; gi++) this.glows[gi].setVisible(false);
  }

  destroy() {
    this.rt.destroy();
    this.brush.destroy();
    for (const g of this.glows) g.destroy();
    for (const f of this.fog) f.destroy();
    for (const a of this.ambient) a.destroy();
    this.rain?.destroy();
    this.splash?.destroy();
  }
}
