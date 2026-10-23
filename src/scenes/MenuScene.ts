import Phaser from 'phaser';
import { Rng } from '../sim/rng';
import { RES, actorKey } from '../render/textures';

/** Fundo animado do menu: lua, floresta em camadas, abrigo com luz piscando, névoa, olhos e chuva. */
export class MenuScene extends Phaser.Scene {
  private layers: { img: Phaser.GameObjects.Image; speed: number }[] = [];
  private eyes: Phaser.GameObjects.Image[] = [];
  private windowLight!: Phaser.GameObjects.Image;
  private fog: Phaser.GameObjects.TileSprite[] = [];
  private t = 0;
  private nextBlink = 2;
  private nextFlash = 9;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private keys: string[] = [];

  constructor() {
    super('menu');
  }

  create() {
    const W = 1600, H = 900;
    const rng = new Rng(42);
    this.layers = [];
    this.eyes = [];
    this.fog = [];
    this.keys = [];
    const mk = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      draw(cv.getContext('2d')!);
      const k = `${key}_${Date.now()}`;
      this.textures.addCanvas(k, cv);
      this.keys.push(k);
      return k;
    };
    const sky = mk('menu_sky', W, H, (c) => {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#05060c');
      g.addColorStop(0.55, '#16121e');
      g.addColorStop(1, '#2a0e12');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) {
        c.fillStyle = `rgba(255,255,255,${rng.range(0.1, 0.6)})`;
        c.fillRect(rng.range(0, W), rng.range(0, H * 0.5), 1.2, 1.2);
      }
      const mg = c.createRadialGradient(1180, 190, 30, 1180, 190, 260);
      mg.addColorStop(0, 'rgba(255,230,210,0.35)');
      mg.addColorStop(1, 'rgba(255,230,210,0)');
      c.fillStyle = mg;
      c.fillRect(0, 0, W, H);
      c.fillStyle = '#e9ddd0';
      c.beginPath();
      c.arc(1180, 190, 74, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(160,120,110,0.35)';
      for (const [x, y, r] of [[1160, 170, 14], [1205, 215, 10], [1190, 160, 7]]) {
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
    });
    this.add.image(0, 0, sky).setOrigin(0).setScrollFactor(0);
    const forest = (y0: number, color: string, height: number, seed: number) => mk('menu_forest', W + 400, H, (c) => {
      const r = new Rng(seed);
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W + 400; x += r.range(14, 30)) {
        const top = y0 - r.range(0, height);
        c.lineTo(x, y0);
        c.lineTo(x + 6, top);
        c.lineTo(x + 12, y0);
      }
      c.lineTo(W + 400, H);
      c.closePath();
      c.fill();
      // galhos secos
      c.strokeStyle = color;
      c.lineWidth = 2;
      for (let i = 0; i < 70; i++) {
        const x = r.range(0, W + 400), y = y0 - r.range(20, height);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + r.range(-30, 30), y - r.range(10, 40));
        c.stroke();
      }
      c.fillRect(0, y0, W + 400, H - y0);
    });
    const l1 = forest(560, '#140f17', 220, 1);
    const l2 = forest(650, '#0c090e', 260, 2);
    this.layers.push({ img: this.add.image(-100, 0, l1).setOrigin(0), speed: 4 });
    // Olhos na mata
    for (let i = 0; i < 7; i++) {
      const e = this.add.image(rng.range(500, 1550), rng.range(600, 720), 'eyes').setBlendMode(Phaser.BlendModes.ADD).setTint(rng.chance(0.5) ? 0xff2a2a : 0xfff0a0).setScale(0.8).setAlpha(0);
      this.eyes.push(e);
    }
    this.layers.push({ img: this.add.image(-100, 0, l2).setOrigin(0), speed: 9 });
    // Abrigo
    const shelter = mk('menu_shelter', 520, 340, (c) => {
      c.fillStyle = '#07060a';
      c.fillRect(60, 120, 380, 220);
      c.beginPath();
      c.moveTo(40, 130);
      c.lineTo(250, 30);
      c.lineTo(460, 130);
      c.fill();
      c.fillRect(330, 40, 30, 80);
      for (let x = 0; x < 520; x += 16) {
        c.fillRect(x, 260 - (x % 32 ? 8 : 0), 10, 90);
      }
      c.fillRect(470, 0, 8, 260);
      c.fillRect(440, 20, 70, 6);
    });
    this.add.image(120, 900, shelter).setOrigin(0, 1);
    this.windowLight = this.add.image(330, 760, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffb347).setScale(0.7);
    this.add.rectangle(318, 735, 40, 34, 0xffc070).setOrigin(0, 0);
    this.add.image(594, 640, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2020).setScale(0.12);
    for (let i = 0; i < 2; i++) {
      const f = this.add.tileSprite(W / 2, 760, W, 340, 'fog').setTint(0x8899aa).setAlpha(0.35 - i * 0.1);
      f.tileScaleX = f.tileScaleY = 1.5 + i;
      this.fog.push(f);
    }
    // Sobrevivente com lanterna à porta
    if (this.textures.exists(actorKey('gunslinger'))) this.add.sprite(590, 870, actorKey('gunslinger'), 'idle').setScale(2.2 / RES).setTint(0x404050);
    this.add.particles(0, 0, 'dot', { x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 5000, speedX: { min: 10, max: 40 }, speedY: { min: 5, max: 20 }, scale: { min: 0.06, max: 0.16 }, alpha: { start: 0.6, end: 0 }, tint: 0xb0a090, frequency: 120 });
    this.add.particles(0, 0, 'firefly', { x: { min: 600, max: W }, y: { min: 560, max: 860 }, lifespan: 3500, speed: { min: 4, max: 14 }, scale: { start: 0.5, end: 0.1 }, alpha: { start: 0.9, end: 0 }, blendMode: 'ADD', frequency: 350 });
    this.add.particles(0, 0, 'rain', { x: { min: -100, max: W + 100 }, y: -20, lifespan: 900, speedY: { min: 800, max: 1000 }, speedX: -140, rotate: 10, alpha: 0.25, quantity: 3, frequency: 30 });
    this.flashRect = this.add.rectangle(0, 0, W, H, 0xcfd8ff).setOrigin(0).setAlpha(0);
    this.cameras.main.setBackgroundColor('#05060c');
    this.scale.on('resize', this.fit, this);
    this.fit();
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.fit, this);
      const keys = this.keys;
      window.setTimeout(() => keys.forEach((k) => this.textures.exists(k) && this.textures.remove(k)), 0);
    });
  }

  private fit() {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h);
    const z = Math.max(w / 1600, h / 900);
    cam.setZoom(z);
    cam.centerOn(w < h ? 500 : 800, 450);
  }

  update(_t: number, dms: number) {
    const dt = dms / 1000;
    this.t += dt;
    for (const l of this.layers) l.img.x = -100 + Math.sin(this.t * 0.05) * l.speed * 4;
    for (const f of this.fog) f.tilePositionX += dt * 12;
    this.windowLight.setAlpha(0.75 + Math.sin(this.t * 17) * 0.05 + (Math.random() < 0.02 ? -0.5 : 0));
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) {
      this.nextBlink = 1 + Math.random() * 2.5;
      const e = Phaser.Utils.Array.GetRandom(this.eyes);
      this.tweens.add({ targets: e, alpha: { from: 0, to: 0.9 }, yoyo: true, hold: 1200 + Math.random() * 1500, duration: 500 });
    }
    this.nextFlash -= dt;
    const reduce = (this.registry.get('reduceFlashes') as boolean) ?? false;
    if (this.nextFlash <= 0) {
      this.nextFlash = 10 + Math.random() * 12;
      if (!reduce) this.tweens.add({ targets: this.flashRect, alpha: { from: 0.35, to: 0 }, duration: 380 });
    }
  }
}
