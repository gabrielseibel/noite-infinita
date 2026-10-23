import Phaser from 'phaser';
import type { Entity, StatusType } from '../sim/types';
import { SKINS } from '../data/upgrades';
import { RES, actorKey } from './textures';

export const DEPTH = {
  ground: 0,
  decal: 5,
  zone: 8,
  entity: 20,
  projectile: 40,
  particle: 45,
  fog: 50,
  dark: 60,
  glow: 65,
  telegraph: 70,
  overlay: 75,
  text: 80,
  ghost: 90,
};

const ICON_ORDER: StatusType[] = ['stun', 'slow', 'burn', 'poison', 'taunted', 'reinforced', 'vulnerable', 'disabled'];

class EntityView {
  sprite: Phaser.GameObjects.Sprite;
  eyes?: Phaser.GameObjects.Image;
  ring?: Phaser.GameObjects.Image;
  hpBg: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
  icons: Phaser.GameObjects.Image[] = [];
  flash = 0;
  lunge = 0;
  lungeX = 0;
  lungeY = 0;
  windup = 0;
  walk = Math.random() * 10;
  spawnT = 0;
  baseScale: number;
  tint: number | null;
  dying = false;

  constructor(private scene: Phaser.Scene, public e: Entity, skinTint: number | null, highContrast: boolean) {
    const key = scene.textures.exists(actorKey(e.def.id)) ? actorKey(e.def.id) : 'hard';
    this.sprite = scene.add.sprite(e.x, e.y, key, key === 'hard' ? undefined : 'idle');
    this.baseScale = key === 'hard' ? 2 : 1 / RES;
    if (e.elite) this.baseScale *= 1.12;
    // Personagens um pouco maiores que a caixa de colisão para leitura em telas pequenas.
    if (e.kind === 'unit' || e.kind === 'enemy' || e.kind === 'escort') this.baseScale *= 1.3;
    else if (e.kind === 'boss') this.baseScale *= 1.15;
    this.sprite.setScale(this.baseScale);
    this.tint = skinTint ?? (e.elite ? 0xff9a9a : null);
    if (this.tint !== null) this.sprite.setTint(this.tint);
    const w = Math.max(18, e.radius * 1.8);
    this.hpBg = scene.add.rectangle(e.x, e.y, w + 2, 4, 0x000000, 0.75).setDepth(DEPTH.overlay).setVisible(false);
    this.hpFill = scene.add.rectangle(e.x, e.y, w, 2.4, 0x7cff6b).setDepth(DEPTH.overlay).setOrigin(0, 0.5).setVisible(false);
    const enemy = e.team === 'enemy' && e.kind !== 'nest';
    if (enemy && e.kind !== 'boss') {
      this.eyes = scene.add.image(e.x, e.y, 'eyes').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.glow).setAlpha(0.7).setScale(0.6);
      if (e.def.id === 'specter') this.eyes.setTint(0x99ffff);
      if (e.def.id === 'abyss_spider') this.eyes.setTint(0xff1744);
    }
    this.setHighContrast(highContrast);
    if (e.kind === 'unit' || e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'escort') this.spawnT = 0.0001;
  }

  setHighContrast(on: boolean) {
    const e = this.e;
    const mobile = e.kind === 'unit' || e.kind === 'enemy' || e.kind === 'boss' || e.kind === 'escort';
    if (on && mobile) {
      if (!this.ring) this.ring = this.scene.add.image(e.x, e.y, 'ring').setDepth(DEPTH.overlay - 1);
      this.ring.setTint(e.team === 'player' ? 0x4fc3ff : 0xff4d4d).setScale((e.radius * 2.4) / 128, (e.radius * 1.2) / 128).setAlpha(0.9).setVisible(true);
    } else if (this.ring) this.ring.setVisible(false);
  }

  update(dt: number, selected: boolean, showBars: boolean) {
    const e = this.e;
    const s = this.sprite;
    // Surgimento
    let alpha = 1;
    let scaleMul = 1;
    let yOff = 0;
    if (e.spawnDelay > 0) {
      const k = 1 - Math.max(0, e.spawnDelay) / 0.6;
      alpha = Math.max(0.05, k);
      if (e.team === 'enemy') yOff = (1 - k) * 10;
      else scaleMul = 0.4 + 0.6 * k;
    }
    // Animação de passos ou ociosa
    const moving = Math.hypot(e.vx, e.vy) > 4;
    let frame = 'idle';
    if (e.def.speed > 0 && (moving || e.def.id === 'raven')) {
      this.walk += dt * (6 + Math.hypot(e.vx, e.vy) * 0.05);
      frame = Math.floor(this.walk) % 2 ? 'walk1' : 'walk2';
      yOff += Math.abs(Math.sin(this.walk * Math.PI)) * -1.5;
    } else if (e.kind === 'nest') {
      this.walk += dt * 1.6;
      frame = Math.floor(this.walk) % 2 ? 'walk1' : 'walk2';
    } else {
      this.walk += dt;
      scaleMul *= 1 + Math.sin(this.walk * 2.5) * 0.012;
    }
    if (e.state === 'windup' || e.state === 'channel') {
      this.windup += dt;
      frame = 'attack';
    } else this.windup = 0;
    if (this.lunge > 0) {
      this.lunge = Math.max(0, this.lunge - dt);
      frame = 'attack';
    }
    const lk = this.lunge > 0 ? Math.sin((this.lunge / 0.16) * Math.PI) : 0;
    let ox = this.lungeX * lk, oy = this.lungeY * lk;
    if (this.windup > 0) {
      // recuo antes do golpe
      ox -= e.facing * Math.min(3, this.windup * 10);
      if (e.kind === 'boss') scaleMul *= 1 + Math.min(0.08, this.windup * 0.06);
    }
    if (e.state === 'stunned') ox += Math.sin(this.walk * 30) * 1.2;
    if (s.frame.name !== frame && s.texture.has(frame)) s.setFrame(frame);
    s.setPosition(e.x + ox, e.y + oy + yOff);
    s.setDepth(DEPTH.entity + e.y / 1000);
    if (e.def.speed > 0 || e.kind === 'unit') s.setFlipX(e.facing < 0);
    s.setScale(this.baseScale * scaleMul);
    s.setAlpha(alpha * (e.def.tags.includes('ethereal') ? 0.82 : 1));
    if (this.flash > 0) {
      this.flash -= dt;
      s.setTintFill(0xffffff);
      if (this.flash <= 0) {
        s.clearTint();
        if (this.tint !== null) s.setTint(this.tint);
      }
    } else if (e.state === 'stunned' || e.statuses.some((st) => st.type === 'disabled')) s.setTint(0x8a8aa0);
    else if (e.statuses.some((st) => st.type === 'vulnerable')) s.setTint(0xff7070);
    else if (this.tint !== null) s.setTint(this.tint);
    else s.clearTint();

    const top = e.y - (s.displayHeight * 0.36);
    if (this.eyes) {
      this.eyes.setPosition(e.x + e.facing * e.radius * 0.35 + ox, top + e.radius * 0.5 + oy + yOff).setVisible(alpha > 0.5);
      this.eyes.setAlpha(0.45 + Math.sin(this.walk * 3) * 0.15);
    }
    if (this.ring?.visible) this.ring.setPosition(e.x, e.y + e.radius * 0.8);

    // Barra de vida
    const show = showBars && (selected || e.hp < e.maxHp || (e.kind === 'structure' && e.team === 'player')) && e.kind !== 'core' && e.kind !== 'nest' && e.kind !== 'trap';
    this.hpBg.setVisible(show);
    this.hpFill.setVisible(show);
    if (show) {
      const w = this.hpBg.width - 2;
      const pct = Math.max(0, e.hp / e.maxHp);
      this.hpBg.setPosition(e.x, top - 4);
      this.hpFill.setPosition(e.x - w / 2, top - 4);
      this.hpFill.width = w * pct;
      this.hpFill.fillColor = e.team === 'player' ? (pct > 0.35 ? 0x6bd6ff : 0xffb74d) : e.elite ? 0xff9800 : 0xff4d4d;
    }
    // Ícones de estado
    const active = ICON_ORDER.filter((t) => e.statuses.some((st) => st.type === t));
    while (this.icons.length < active.length) this.icons.push(this.scene.add.image(0, 0, 'st_stun').setDepth(DEPTH.overlay).setScale(0.6));
    for (let i = 0; i < this.icons.length; i++) {
      const ic = this.icons[i];
      if (i < active.length) {
        ic.setTexture('st_' + active[i]).setVisible(true);
        ic.setPosition(e.x + (i - (active.length - 1) / 2) * 12, top - 13 + (active[i] === 'stun' ? Math.sin(this.walk * 8) * 1.5 : 0));
      } else ic.setVisible(false);
    }
  }

  hit() {
    this.flash = 0.07;
  }

  attack(tx: number, ty: number) {
    const e = this.e;
    const d = Math.hypot(tx - e.x, ty - e.y) || 1;
    const amp = e.def.attack?.kind === 'melee' ? 7 : 2.5;
    this.lungeX = ((tx - e.x) / d) * amp;
    this.lungeY = ((ty - e.y) / d) * amp;
    this.lunge = 0.16;
  }

  /** Animação de morte específica por categoria. */
  die(onDone: () => void) {
    if (this.dying) return;
    this.dying = true;
    const e = this.e;
    this.hpBg.destroy();
    this.hpFill.destroy();
    this.eyes?.destroy();
    this.ring?.destroy();
    for (const i of this.icons) i.destroy();
    const s = this.sprite;
    s.clearTint();
    const spectral = e.def.tags.includes('ethereal') || e.def.id === 'faceless' || e.def.id === 'raven' || e.def.id === 'reaper';
    const structure = e.kind === 'structure' || e.kind === 'trap' || e.kind === 'core' || e.kind === 'nest';
    const tweens = this.scene.tweens;
    if (spectral) {
      tweens.add({ targets: s, y: s.y - 26, alpha: 0, scaleX: s.scaleX * 0.6, scaleY: s.scaleY * 1.5, duration: 600, ease: 'Sine.easeIn', onComplete: () => { s.destroy(); onDone(); } });
    } else if (structure) {
      tweens.add({ targets: s, alpha: 0, scaleY: s.scaleY * 0.5, y: s.y + 8, duration: 450, ease: 'Quad.easeIn', onComplete: () => { s.destroy(); onDone(); } });
    } else {
      s.setTint(0x777777);
      tweens.add({ targets: s, angle: e.facing > 0 ? -88 : 88, scaleY: s.scaleY * 0.7, alpha: 0, duration: 700, delay: 60, ease: 'Quad.easeOut', onComplete: () => { s.destroy(); onDone(); } });
    }
  }

  destroyNow() {
    this.sprite.destroy();
    this.hpBg.destroy();
    this.hpFill.destroy();
    this.eyes?.destroy();
    this.ring?.destroy();
    for (const i of this.icons) i.destroy();
  }
}

export class EntityViews {
  views = new Map<number, EntityView>();
  selectedId = 0;
  highContrast = false;
  skins: Record<string, string> = {};

  constructor(private scene: Phaser.Scene) {}

  add(e: Entity) {
    if (this.views.has(e.id)) return;
    let tint: number | null = null;
    if (e.cardId && this.skins[e.cardId]) tint = SKINS.find((s) => s.id === this.skins[e.cardId!])?.tint ?? null;
    this.views.set(e.id, new EntityView(this.scene, e, tint, this.highContrast));
  }

  get(id: number) {
    return this.views.get(id);
  }

  remove(id: number, animate = true) {
    const v = this.views.get(id);
    if (!v) return;
    this.views.delete(id);
    if (animate) v.die(() => {});
    else v.destroyNow();
  }

  setHighContrast(on: boolean) {
    this.highContrast = on;
    for (const v of this.views.values()) v.setHighContrast(on);
  }

  update(dt: number) {
    for (const v of this.views.values()) v.update(dt, v.e.id === this.selectedId, true);
  }

  /** Entidade sob um ponto do mundo (para seleção). */
  pick(x: number, y: number) {
    let best: Entity | undefined;
    let bestD = Infinity;
    for (const v of this.views.values()) {
      const e = v.e;
      if (!e.alive) continue;
      const d = Math.hypot(e.x - x, e.y - 6 - y);
      if (d < Math.max(16, e.radius + 8) && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  destroy() {
    for (const v of this.views.values()) v.destroyNow();
    this.views.clear();
  }
}
