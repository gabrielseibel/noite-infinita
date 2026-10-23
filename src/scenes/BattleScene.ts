import Phaser from 'phaser';
import { GAME_CONFIG } from '../app/config';
import { COMBAT } from '../data/balance';
import { getActor } from '../data/actors';
import { CARD_BY_ID } from '../data/cards';
import { THEMES } from '../data/maps';
import type { MissionDef } from '../data/missions';
import { BattleSim } from '../sim/BattleSim';
import type { BattleEvent, BattleResult, CardDef, Entity, Projectile } from '../sim/types';
import { attackRange } from '../sim/targeting';
import { paintArena } from '../render/arenaArt';
import { Effects } from '../render/Effects';
import { DEPTH, EntityViews } from '../render/EntityViews';
import { Lighting, type Light } from '../render/Lighting';
import { RES, actorKey } from '../render/textures';
import type { AudioSystem, SfxName } from '../systems/AudioSystem';
import type { SaveSystem } from '../systems/SaveSystem';
import { TutorialDirector } from '../systems/TutorialDirector';
import { Hud } from '../ui/Hud';
import { isTyping } from '../ui/dom';

export interface BattleHost {
  saveSys: SaveSystem;
  audio: AudioSystem;
  uiRoot: HTMLElement;
  openPause(): void;
  onBattleEnd(result: BattleResult, sim: BattleSim, extra: { escortSaved: number }): void;
  toggleMute(): void;
}

export interface BattleData {
  mission: MissionDef;
  deck: string[];
  host: BattleHost;
}

const ATTACK_SFX: Record<string, SfxName> = {
  gunslinger: 'pistol', medic: 'pistol', huntress: 'rifle', shotgunner: 'shotgun', watchtower: 'tower', core: 'tower', uv_tower: 'uv',
  engineer: 'melee', veteran: 'melee', wardog: 'bite', raven: 'claw', bone_golem: 'heavy', reaper: 'slash', spitter: 'spit',
  matriarch: 'spit', nest: 'spit', screamer: 'spit', brute: 'heavy', devourer: 'heavy', butcher: 'heavy', faceless: 'slash',
};

const BURST_FOR = (e: Entity) => {
  if (e.kind === 'structure' || e.kind === 'trap' || e.kind === 'core') return 'chip' as const;
  if (e.def.id === 'bone_golem') return 'bone' as const;
  if (e.def.tags.includes('ethereal') || e.def.id === 'raven' || e.def.id === 'reaper' || e.def.id === 'faceless') return 'ecto' as const;
  if (e.team === 'player') return 'blood' as const;
  return 'ichor' as const;
};

export class BattleScene extends Phaser.Scene {
  sim!: BattleSim;
  private host!: BattleHost;
  private mission!: MissionDef;
  private deck!: string[];
  private views!: EntityViews;
  private fx!: Effects;
  private light!: Lighting;
  hud!: Hud;
  private tutorial: TutorialDirector | null = null;
  private projectileSprites = new Map<number, Phaser.GameObjects.Image>();
  private projectilePool: Phaser.GameObjects.Image[] = [];
  private fireEmitters = new Map<number, Phaser.GameObjects.Particles.ParticleEmitter>();
  private transient: (Light & { ttl: number })[] = [];
  private telegraphG!: Phaser.GameObjects.Graphics;
  private overlayG!: Phaser.GameObjects.Graphics;
  private ghostG!: Phaser.GameObjects.Graphics;
  private debugG?: Phaser.GameObjects.Graphics;
  private debugText?: HTMLElement;
  private ghost!: Phaser.GameObjects.Image;
  private selected = -1;
  private pointerWorld = { x: 0, y: 0, valid: false, inside: false };
  private dragCard = false;
  private dragStart = { x: 0, y: 0 };
  private panning = false;
  private panStart = { x: 0, y: 0, sx: 0, sy: 0 };
  private pinchDist = 0;
  private fitZoom = 1;
  speed = 1;
  private hitStop = 0;
  private accumulator = 0;
  private intro = 0;
  private ending = 0;
  private endResult: BattleResult | null = null;
  private defeatDark = 0;
  private escortSaved = 0;
  private stormTimer = 8;
  private lampFlicker: number[] = [];
  private dmgAgg = new Map<number, { amount: number; t: number; crit: boolean; x: number; y: number; type: string }>();
  private winListeners: [string, EventListener][] = [];
  private seenThisMatch = new Set<string>();
  private elapsedReal = 0;
  private arenaKey = '';

  constructor() {
    super('battle');
  }

  init(data: BattleData) {
    this.host = data.host;
    this.mission = data.mission;
    this.deck = data.deck;
    this.selected = -1;
    this.speed = data.host.saveSys.data.settings.fastDefault ? 2 : 1;
    this.hitStop = 0;
    this.accumulator = 0;
    this.ending = 0;
    this.endResult = null;
    this.defeatDark = 0;
    this.escortSaved = 0;
    this.projectileSprites = new Map();
    this.projectilePool = [];
    this.fireEmitters = new Map();
    this.transient = [];
    this.dmgAgg = new Map();
    this.seenThisMatch = new Set();
    this.tutorial = null;
  }

  create() {
    const save = this.host.saveSys.data;
    const settings = save.settings;
    const theme = THEMES[this.mission.theme] ?? THEMES.shelter;
    this.sim = new BattleSim({ mission: this.mission, deck: this.deck, upgradeLevels: save.upgrades, shuffle: !this.mission.tutorial });
    const W = this.sim.width, H = this.sim.height;

    // Cenário estático pintado uma vez.
    const key = (this.arenaKey = `arena_${this.mission.id}_${Date.now()}`);
    this.textures.addCanvas(key, paintArena(this.sim.map, theme, this.sim.tile, this.mission.index * 17 + 3));
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(DEPTH.ground);

    this.views = new EntityViews(this);
    this.views.skins = save.skinsEquipped;
    this.views.highContrast = settings.highContrast;
    this.fx = new Effects(this, { particles: settings.particles, reduceFlashes: settings.reduceFlashes, reduceShake: settings.reduceShake, damageNumbers: settings.damageNumbers });
    this.light = new Lighting(this, W, H, theme.fogColor, settings.particles === 'low');
    this.light.darkness = theme.darkness;
    this.light.fogAlpha = theme.fog;
    this.lampFlicker = this.sim.map.lamps.map(() => 1);

    this.overlayG = this.add.graphics().setDepth(DEPTH.telegraph - 2);
    this.telegraphG = this.add.graphics().setDepth(DEPTH.telegraph);
    this.ghostG = this.add.graphics().setDepth(DEPTH.ghost);
    this.ghost = this.add.image(0, 0, 'hard').setDepth(DEPTH.ghost).setAlpha(0.6).setVisible(false);
    if (GAME_CONFIG.debug) {
      this.debugG = this.add.graphics().setDepth(DEPTH.ghost + 1);
      this.debugText = document.createElement('div');
      this.debugText.className = 'debug';
      this.host.uiRoot.append(this.debugText);
    }
    for (const e of this.sim.entities) this.views.add(e);
    this.sim.drainEvents();

    this.hud = new Hud(this.host.uiRoot, {
      onSelectCard: (slot) => this.selectCard(slot, true),
      onCancel: () => this.cancelSelection(),
      onPause: () => this.host.openPause(),
      onSpeed: () => this.toggleSpeed(),
      onMute: () => this.host.toggleMute(),
    });
    if (this.mission.tutorial && settings.hints !== false) {
      this.tutorial = new TutorialDirector(this.sim, this.hud, () => this.hud.toast('Tutorial ignorado.'));
    }

    // Câmera
    const cam = this.cameras.main;
    cam.setBackgroundColor('#050507');
    this.scale.on('resize', this.onResize, this);
    this.onResize();
    this.input.addPointer(1);
    this.setupInput();

    // Introdução atmosférica: a câmera parte do ninho e recua até o abrigo.
    this.intro = 2.6;
    cam.setZoom(this.fitZoom * 1.7);
    cam.centerOn(this.sim.nest.x - 80, this.sim.nest.y);
    cam.pan(W / 2, H / 2 + this.cameraOffsetY(), 2300, 'Sine.easeInOut');
    cam.zoomTo(this.fitZoom, 2300, 'Sine.easeInOut');
    this.hud.banner(this.mission.name, this.mission.intro);
    this.host.audio.startMusic('battle');
    this.host.audio.setIntensity(0.05);
    this.host.audio.play('wave', 0.6);

    this.events.once('shutdown', () => this.cleanup());
  }

  // ---------------------------------------------------------------------------
  // Câmera
  // ---------------------------------------------------------------------------

  private cameraOffsetY() {
    const ins = this.hud?.insets() ?? { top: 0, bottom: 0 };
    return (ins.bottom - ins.top) / 2 / this.cameras.main.zoom;
  }

  private onResize() {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h);
    const ins = this.hud?.insets() ?? { top: 40, bottom: 140 };
    const availH = Math.max(120, h - ins.top - ins.bottom);
    const fitW = w / this.sim.width, fitH = availH / this.sim.height;
    // Em retrato a arena ficaria minúscula: prioriza a altura e permite arrastar.
    this.fitZoom = h > w ? Math.max(fitW, fitH * 0.62) : Math.min(fitW, fitH);
    if (this.intro <= 0) {
      cam.setZoom(Math.max(this.fitZoom, Math.min(cam.zoom, this.fitZoom * 3)));
      if (h > w) cam.centerOn(this.sim.map.deployMaxCol * this.sim.tile * 0.55, cam.midPoint.y);
      this.clampCamera();
    }
  }

  private clampCamera() {
    const cam = this.cameras.main;
    const W = this.sim.width, H = this.sim.height;
    const viewW = cam.width / cam.zoom, viewH = cam.height / cam.zoom;
    const ins = this.hud.insets();
    const top = ins.top / cam.zoom, bottom = ins.bottom / cam.zoom;
    const effH = viewH - top - bottom;
    let cx = cam.midPoint.x, cy = cam.midPoint.y;
    cx = viewW >= W ? W / 2 : Phaser.Math.Clamp(cx, viewW / 2, W - viewW / 2);
    // A área útil (entre o HUD do topo e o da base) deve conter a arena ou ficar dentro dela.
    if (effH >= H) cy = H / 2 + (bottom - top) / 2;
    else cy = Phaser.Math.Clamp(cy, viewH / 2 - top, H - effH - top + viewH / 2);
    cam.centerOn(cx, cy);
  }

  private zoomAt(factor: number, sx: number, sy: number) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(sx, sy);
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, this.fitZoom, this.fitZoom * 3));
    const after = cam.getWorldPoint(sx, sy);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
    this.clampCamera();
  }

  // ---------------------------------------------------------------------------
  // Entrada
  // ---------------------------------------------------------------------------

  private setupInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.host.audio.unlock();
      if (this.intro > 0) return this.skipIntro();
      if (p.rightButtonDown()) return this.cancelSelection();
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        this.pinchDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        this.panning = false;
        return;
      }
      this.updatePointer(p.x, p.y);
      if (this.selected < 0) {
        this.panning = false;
        this.panStart = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.pinchDist > 0) this.zoomAt(d / this.pinchDist, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
        this.pinchDist = d;
        return;
      }
      if (this.selected >= 0) return this.updatePointer(p.x, p.y);
      if (p.isDown && !this.dragCard) {
        const dx = p.x - this.panStart.x, dy = p.y - this.panStart.y;
        if (!this.panning && Math.hypot(dx, dy) > 10) this.panning = true;
        if (this.panning) {
          const cam = this.cameras.main;
          cam.scrollX = this.panStart.sx - dx / cam.zoom;
          cam.scrollY = this.panStart.sy - dy / cam.zoom;
          this.clampCamera();
        }
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.pinchDist = 0;
      if (this.intro > 0 || p.rightButtonReleased()) return;
      if (this.selected >= 0) {
        this.updatePointer(p.x, p.y);
        this.tryPlace();
      } else if (!this.panning) {
        const wp = this.cameras.main.getWorldPoint(p.x, p.y);
        const e = this.views.pick(wp.x, wp.y);
        this.views.selectedId = e?.id ?? 0;
        this.hud.showUnitInfo(e ?? null);
        if (e) this.host.audio.play('ui_click', 0.6);
      }
      this.panning = false;
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomAt(dy > 0 ? 0.9 : 1.1, p.x, p.y));

    // Arrastar a carta direto para a arena (mouse e toque).
    const onMove = (ev: PointerEvent) => {
      if (!this.dragCard || this.selected < 0) return;
      const r = this.game.canvas.getBoundingClientRect();
      if (Math.hypot(ev.clientX - this.dragStart.x, ev.clientY - this.dragStart.y) > 24) this.updatePointer(ev.clientX - r.left, ev.clientY - r.top);
    };
    const onUp = (ev: PointerEvent) => {
      if (!this.dragCard) return;
      this.dragCard = false;
      if (this.selected < 0) return;
      const moved = Math.hypot(ev.clientX - this.dragStart.x, ev.clientY - this.dragStart.y) > 40;
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (moved && over === this.game.canvas) {
        const r = this.game.canvas.getBoundingClientRect();
        this.updatePointer(ev.clientX - r.left, ev.clientY - r.top);
        this.tryPlace();
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (isTyping() || !this.sys.isActive()) return;
      if (ev.key === 'Escape') this.cancelSelection();
      else if (['1', '2', '3', '4'].includes(ev.key)) this.selectCard(Number(ev.key) - 1, false);
      else if (ev.code === 'Space') {
        ev.preventDefault();
        if (!this.sim.over) this.host.openPause();
      } else if (ev.key === '`' && this.debugG) {
        this.debugG.setVisible(!this.debugG.visible);
        this.debugText?.classList.toggle('hidden');
      }
    };
    this.addWin('pointermove', onMove as EventListener);
    this.addWin('pointerup', onUp as EventListener);
    this.addWin('keydown', onKey as EventListener);
  }

  private addWin(type: string, fn: EventListener) {
    window.addEventListener(type, fn);
    this.winListeners.push([type, fn]);
  }

  private skipIntro() {
    this.intro = 0;
    const cam = this.cameras.main;
    cam.panEffect.reset();
    cam.zoomEffect.reset();
    cam.setZoom(this.fitZoom);
    const portrait = this.scale.height > this.scale.width;
    cam.centerOn(portrait ? this.sim.map.deployMaxCol * this.sim.tile * 0.55 : this.sim.width / 2, this.sim.height / 2 + this.cameraOffsetY());
    this.clampCamera();
  }

  private updatePointer(sx: number, sy: number) {
    const wp = this.cameras.main.getWorldPoint(sx, sy);
    this.pointerWorld.x = wp.x;
    this.pointerWorld.y = wp.y;
    this.pointerWorld.inside = true;
  }

  selectCard(slot: number, fromPointer: boolean) {
    if (this.sim.over || this.intro > 0) {
      if (this.intro > 0) this.skipIntro();
      return;
    }
    this.host.audio.unlock();
    const id = this.sim.deck.hand[slot];
    if (!id) return;
    if (this.selected === slot && !fromPointer) return this.cancelSelection();
    this.selected = slot;
    this.pointerWorld.inside = false;
    if (fromPointer) {
      this.dragCard = true;
      const ev = window.event as PointerEvent | undefined;
      this.dragStart = { x: ev?.clientX ?? 0, y: ev?.clientY ?? 0 };
    }
    this.views.selectedId = 0;
    this.hud.showUnitInfo(null);
    this.host.audio.play('ui_select');
    const card = CARD_BY_ID[id];
    const chk = this.sim.canPlay(slot);
    this.hud.setPlaceHint(chk.ok ? (card.placement === 'anywhere' ? 'Escolha o alvo na arena' : 'Toque na área permitida') : chk.reason!, !chk.ok);
    this.drawDeployOverlay(card);
  }

  cancelSelection() {
    if (this.selected < 0) return;
    this.selected = -1;
    this.dragCard = false;
    this.ghost.setVisible(false);
    this.ghostG.clear();
    this.overlayG.clear();
    this.hud.setPlaceHint(null);
  }

  private tryPlace() {
    if (this.selected < 0 || !this.pointerWorld.inside) return;
    const slot = this.selected;
    const id = this.sim.deck.hand[slot];
    const { x, y } = this.pointerWorld;
    const res = this.sim.playCard(slot, x, y);
    if (res.ok) {
      this.cancelSelection();
      const card = CARD_BY_ID[id];
      this.host.audio.play(card.category === 'structure' ? 'build' : card.category === 'ability' ? 'card_play' : 'deploy');
      this.fx.ring(x, y, 40, card.category === 'ability' ? 0xff9a3a : 0x9fe7ff, 350);
    } else {
      this.host.audio.play('ui_deny');
      this.hud.toast(res.reason ?? 'Jogada inválida.');
    }
  }

  private toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    this.tweens.timeScale = this.speed;
    this.hud.toast(this.speed > 1 ? 'Velocidade ×2' : 'Velocidade normal', true);
  }

  // ---------------------------------------------------------------------------
  // Sobreposições de posicionamento
  // ---------------------------------------------------------------------------

  private drawDeployOverlay(card: CardDef) {
    const g = this.overlayG;
    g.clear();
    if (card.placement === 'anywhere') return;
    const t = this.sim.tile;
    const zoneW = this.sim.map.deployMaxCol * t;
    g.fillStyle(0x6bd6ff, 0.05).fillRect(0, 0, zoneW, this.sim.height);
    g.fillStyle(0xff2020, 0.035).fillRect(zoneW, 0, this.sim.width - zoneW, this.sim.height);
    g.fillStyle(0xff3030, 0.22);
    for (let cy = 0; cy < this.sim.map.rows; cy++)
      for (let cx = 0; cx < this.sim.map.deployMaxCol; cx++) if (this.sim.grid.blocked[cy * this.sim.map.cols + cx]) g.fillRect(cx * t, cy * t, t, t);
    g.lineStyle(2, 0x9fe7ff, 0.7);
    for (let y = 0; y < this.sim.height; y += 22) g.lineBetween(zoneW, y, zoneW, y + 12);
  }

  private updateGhost() {
    const g = this.ghostG;
    g.clear();
    if (this.selected < 0 || !this.pointerWorld.inside) {
      this.ghost.setVisible(false);
      return;
    }
    const id = this.sim.deck.hand[this.selected];
    const card = CARD_BY_ID[id];
    const { x, y } = this.pointerWorld;
    const chk = this.sim.canPlay(this.selected, x, y);
    const color = chk.ok ? 0x7cff9b : 0xff5252;
    this.hud.setPlaceHint(chk.ok ? card.name : chk.reason!, !chk.ok);
    if (card.ability) {
      const r = card.ability.radius;
      g.fillStyle(color, 0.12).fillCircle(x, y, r);
      g.lineStyle(2, color, 0.9).strokeCircle(x, y, r);
      // Possíveis alvos especiais dentro da área.
      for (const e of this.sim.entities) {
        if (!e.alive || e.team !== 'enemy' || e.kind === 'nest') continue;
        if (Math.hypot(e.x - x, e.y - y) > r + e.radius) continue;
        const special = card.ability.type === 'lightBurst' ? e.def.tags.includes('supernatural') : !e.def.tags.includes('flying');
        g.lineStyle(2, special ? 0xffe14d : 0xffffff, special ? 1 : 0.35).strokeCircle(e.x, e.y, e.radius + 5);
      }
      this.ghost.setVisible(false);
      return;
    }
    const actor = getActor(card.actor!);
    if (this.textures.exists(actorKey(actor.id))) {
      this.ghost.setTexture(actorKey(actor.id), 'idle').setScale(1 / RES).setVisible(true).setPosition(x, y).setTint(chk.ok ? 0xffffff : 0xff6060);
    }
    g.lineStyle(2, color, 0.9).strokeCircle(x, y, actor.radius + 2);
    const range = actor.attack?.range ?? 0;
    const reach = actor.kind === 'trap' ? actor.aggroRange : actor.behaviors?.find((b) => 'radius' in b && b.type !== 'deathBurst') as { radius?: number } | undefined;
    if (range > 30) g.lineStyle(1.5, color, 0.45).strokeCircle(x, y, range * (actor.id === 'watchtower' ? 1 + this.sim.upgrades.watchtowerRange : 1));
    if (reach && typeof reach === 'object' && reach.radius) g.lineStyle(1, 0x7cff9b, 0.35).strokeCircle(x, y, reach.radius);
  }

  // ---------------------------------------------------------------------------
  // Laço principal
  // ---------------------------------------------------------------------------

  update(_time: number, deltaMs: number) {
    const dtReal = Math.min(0.1, deltaMs / 1000);
    this.elapsedReal += dtReal;
    if (this.intro > 0) {
      this.intro -= dtReal;
      if (this.intro <= 0) this.skipIntro();
    }
    // Pausa curta e controlada em momentos especiais (morte de chefe).
    let scale = this.speed;
    if (this.hitStop > 0) {
      this.hitStop -= dtReal;
      scale *= COMBAT.hitStopScale;
    }
    if (this.ending > 0) scale *= 0.35;
    const simDt = dtReal * scale;
    if (this.intro <= 0 && !this.sim.over) {
      this.accumulator += simDt;
      const step = 1 / 60;
      let steps = 0;
      while (this.accumulator >= step && steps < 8) {
        this.sim.update(step);
        this.accumulator -= step;
        steps++;
      }
      if (steps === 8) this.accumulator = 0;
      this.tutorial?.update(simDt);
    }
    const events = this.sim.drainEvents();
    this.tutorial?.onEvents(events);
    for (const ev of events) this.handleEvent(ev);
    this.flushDamageNumbers(simDt);

    this.fx.frame();
    this.views.update(simDt || dtReal * 0.2);
    this.syncProjectiles();
    this.drawTelegraphs();
    this.updateGhost();
    this.updateLights(dtReal);
    this.hud.update(this.sim, this.selected, this.speed, this.host.audio.muted);
    this.updateMusic();
    if (this.debugG?.visible) this.drawDebug();

    if (this.ending > 0) {
      this.ending -= dtReal;
      if (this.ending <= 0 && this.endResult) this.host.onBattleEnd(this.endResult, this.sim, { escortSaved: this.escortSaved });
    }
  }

  private updateMusic() {
    if (this.sim.over) return;
    let near = 0;
    for (const e of this.sim.entities) if (e.alive && e.team === 'enemy' && e.kind !== 'nest' && e.x < this.sim.map.deployMaxCol * this.sim.tile) near++;
    const boss = this.sim.bosses.length > 0;
    const i = 0.1 + Math.min(0.5, near / 30) + (this.sim.finalPhase ? 0.25 : 0) + (boss ? 0.2 : 0) + (this.sim.core.hp / this.sim.core.maxHp < 0.35 ? 0.2 : 0);
    this.host.audio.setIntensity(i, boss);
  }

  private updateLights(dt: number) {
    const sim = this.sim;
    const mods = sim.mods;
    const theme = THEMES[this.mission.theme] ?? THEMES.shelter;
    const settings = this.host.saveSys.data.settings;
    const lights: Light[] = [];
    const t = this.elapsedReal;
    lights.push({ x: sim.core.x, y: sim.core.y, r: 250, a: 0.95, color: mods.disablePowered ? 0xff3030 : 0xffc070, glow: 0.22 });
    sim.map.lamps.forEach((l, i) => {
      if (mods.disablePowered) return;
      // lâmpadas que piscam de vez em quando
      if (Math.random() < 0.01) this.lampFlicker[i] = 0.1;
      this.lampFlicker[i] = Math.min(1, this.lampFlicker[i] + dt * 3);
      const p = sim.cellPos(l.cx, l.cy);
      const f = this.lampFlicker[i] * (0.9 + Math.sin(t * 13 + i) * 0.05);
      lights.push({ x: p.x, y: p.y, r: 150, a: 0.85 * f, color: theme.accent, glow: 0.3 * f });
    });
    for (const e of sim.entities) {
      if (!e.alive || e.spawnDelay > 0.3) continue;
      if (e.team === 'player') {
        if (e.def.id === 'watchtower') lights.push({ x: e.x, y: e.y, r: 120, a: 0.8, color: 0xffe0a0, glow: 0.12 });
        else if (e.def.id === 'uv_tower') {
          const off = mods.disablePowered || e.statuses.some((s) => s.type === 'disabled');
          if (!off) lights.push({ x: e.x, y: e.y - 10, r: 140, a: 0.75, color: 0xa070ff, glow: 0.45 });
        } else if (e.kind === 'unit' || e.kind === 'escort') lights.push({ x: e.x, y: e.y, r: e.def.id === 'raven' ? 40 : 72, a: 0.7 });
      } else if (e.kind === 'nest') lights.push({ x: e.x, y: e.y, r: 150, a: 0.35, color: 0xff2040, glow: 0.4 + Math.sin(t * 2) * 0.1 });
      else if (e.def.id === 'spitter') lights.push({ x: e.x, y: e.y, r: 40, a: 0.15, color: 0x9aff3a, glow: 0.25 });
      else if (e.def.id === 'specter') lights.push({ x: e.x, y: e.y, r: 46, a: 0.2, color: 0x9fd8ff, glow: 0.25 });
      else if (e.kind === 'boss') lights.push({ x: e.x, y: e.y, r: 90, a: 0.3, color: e.def.id === 'faceless' ? 0x5a00aa : e.def.id === 'matriarch' ? 0xff4fa3 : 0xff5a20, glow: 0.3 });
    }
    for (const z of sim.fireZones) {
      const f = 0.85 + Math.sin(t * 20 + z.id) * 0.1;
      lights.push({ x: z.x, y: z.y, r: z.radius * 1.9, a: 0.9 * f, color: 0xff7a1a, glow: 0.55 * f });
    }
    for (let i = this.transient.length - 1; i >= 0; i--) {
      const l = this.transient[i];
      l.ttl -= dt;
      if (l.ttl <= 0) this.transient.splice(i, 1);
      else lights.push(l);
    }
    if (this.tutorial?.worldMarker) {
      const m = this.tutorial.worldMarker;
      lights.push({ x: m.x, y: m.y, r: m.r * 2, a: 0.6, color: 0xffb347, glow: 0.35 + Math.sin(t * 5) * 0.15 });
    }
    this.light.darkness = Math.min(0.97, theme.darkness * 0.88 + mods.darkness + this.defeatDark);
    this.light.fogAlpha = theme.fog + mods.fog;
    this.light.setRain(mods.rain || (theme.rain && settings.weather));
    if (mods.rain && !settings.reduceFlashes) {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        this.stormTimer = 6 + Math.random() * 9;
        this.light.lightning();
        this.host.audio.play('thunder', 0.8);
      }
    }
    if (this.defeatDark > 0 && this.defeatDark < 0.5) this.defeatDark += dt * 0.25;
    this.light.update(dt, lights, t);
  }

  private flash(x: number, y: number, r: number, color: number, ttl = 0.06, a = 0.8) {
    if (this.transient.length > 30) return;
    this.transient.push({ x, y, r, a, color, glow: 0.4, ttl });
  }

  // ---------------------------------------------------------------------------
  // Eventos da simulação -> efeitos audiovisuais
  // ---------------------------------------------------------------------------

  private handleEvent(ev: BattleEvent) {
    const audio = this.host.audio;
    const fx = this.fx;
    switch (ev.type) {
      case 'spawn': {
        const e = ev.entity;
        this.views.add(e);
        if (e.team === 'enemy' && (e.kind === 'enemy' || e.kind === 'boss')) {
          fx.burst('dust', e.x, e.y + e.radius * 0.6, e.kind === 'boss' ? 18 : 4);
          this.firstSighting(e);
        }
        if (e.kind === 'boss') {
          fx.shake(3, 400);
          fx.ring(e.x, e.y, 160, 0xff3030, 900);
          audio.play('boss');
        } else if (e.team === 'player' && e.kind === 'unit') {
          fx.ring(e.x, e.y, 28, 0x9fe7ff, 450);
          this.flash(e.x, e.y, 90, 0x9fe7ff, 0.35, 0.6);
        } else if (e.kind === 'structure' && e.team === 'player') fx.burst('dust', e.x, e.y + 6, 8);
        else if (e.kind === 'escort') this.hud.toast('Um sobrevivente corre para o abrigo!', true);
        break;
      }
      case 'death': {
        const e = ev.entity;
        if (ev.killerId === -1) {
          this.views.remove(e.id, false);
          break;
        }
        const kind = BURST_FOR(e);
        const big = e.kind === 'boss' || e.def.id === 'devourer' || e.kind === 'core' || e.kind === 'nest';
        fx.burst(kind, e.x, e.y, big ? 40 : e.kind === 'structure' ? 16 : 9);
        if (kind === 'blood' || kind === 'ichor') fx.decal('splat', e.x, e.y + 4, kind === 'blood' ? 0x5a0508 : 0x2a1a0a, e.radius / 12, 0.65);
        if (e.kind === 'structure' || e.kind === 'trap') {
          fx.burst('smoke', e.x, e.y, 6);
          audio.play('break');
        } else if (e.team === 'enemy') audio.play('death_monster', big ? 1 : 0.6);
        else audio.play('death_unit');
        this.views.remove(e.id, true);
        if (this.views.selectedId === e.id) this.hud.showUnitInfo(null);
        if (e.kind === 'boss') {
          if (this.host.saveSys.data.settings.hitStop) this.hitStop = COMBAT.hitStopSeconds;
          fx.flash(0xffffff, 250, 0.6);
          fx.shake(5, 600);
          fx.ring(e.x, e.y, 220, 0xffd27f, 900);
          this.flash(e.x, e.y, 320, 0xffd27f, 0.6, 1);
          this.hud.banner(`${e.def.name} caiu!`, 'A noite recua por um instante.', '#ffb347');
        }
        if (e.kind === 'nest') {
          fx.flash(0xff3040, 400, 0.7);
          fx.shake(6, 900);
          fx.burst('magic', e.x, e.y, 60);
        }
        if (e.def.behaviors?.some((b) => b.type === 'deathEnergy')) fx.label(e.x, e.y - 30, '+2 ENERGIA', '#f6a8ff');
        break;
      }
      case 'damage': {
        const e = ev.entity;
        this.views.get(e.id)?.hit();
        const agg = this.dmgAgg.get(e.id);
        if (agg) {
          agg.amount += ev.amount;
          agg.crit ||= ev.crit;
          agg.x = e.x;
          agg.y = e.y;
        } else this.dmgAgg.set(e.id, { amount: ev.amount, t: 0.12, crit: ev.crit, x: e.x, y: e.y, type: ev.damageType });
        if (ev.damageType === 'physical' || ev.damageType === 'spectral') {
          if (e.kind === 'structure' || e.kind === 'core' || e.kind === 'trap') {
            fx.burst('chip', e.x, e.y, 2);
            fx.burst('spark', e.x, e.y, 2);
            audio.play('hit_structure', 0.5);
          } else {
            fx.burst(BURST_FOR(e), e.x, e.y - 4, ev.crit ? 6 : 2);
            audio.play('hit', 0.4);
          }
        }
        if (e === this.sim.core && Math.random() < 0.3) fx.shake(1, 100);
        break;
      }
      case 'heal': {
        const e = ev.entity;
        fx.number(e.x, e.y - e.radius - 10, `+${ev.amount}`, '#7cff9b', 13);
        fx.burst('heal', e.x, e.y, 3);
        audio.play('heal', 0.5);
        break;
      }
      case 'attack': {
        const e = ev.entity;
        this.views.get(e.id)?.attack(ev.tx, ev.ty);
        const sfx = ATTACK_SFX[e.def.id] ?? 'claw';
        audio.play(sfx, e.team === 'enemy' ? 0.5 : 0.7);
        if (e.def.attack?.kind === 'projectile' && (e.def.attack.damageType === 'physical')) {
          const mx = e.x + e.facing * e.radius, my = e.y - 6;
          fx.burst('flash', mx, my, 1);
          this.flash(mx, my, 60, 0xffd27f, 0.05, 0.6);
        }
        if (e.def.attack?.kind === 'melee' && e.def.attack.splash) {
          fx.ring(ev.tx, ev.ty, e.def.attack.splash, e.def.id === 'reaper' ? 0xc59bff : 0xffffff, 280);
          if (e.def.id === 'reaper') fx.burst('magic', ev.tx, ev.ty, 10);
        }
        break;
      }
      case 'projectileHit': {
        const p = ev.projectile;
        if (p.fx === 'acid' || p.fx === 'spit') {
          fx.burst('acid', p.x, p.y, 8);
          if (p.attack.splash) fx.ring(p.x, p.y, p.attack.splash, 0x9aff3a, 300);
        } else if (p.fx === 'uv') fx.burst('magic', p.x, p.y, 3);
        else if (p.fx === 'pellet') {
          fx.burst('spark', p.x, p.y, 5);
          if (p.attack.splash) fx.ring(p.x, p.y, p.attack.splash, 0xffe08a, 220);
        } else fx.burst('spark', p.x, p.y, p.crit ? 6 : 2);
        if (p.crit) fx.label(p.x, p.y - 22, 'CRÍTICO', '#ffe14d');
        break;
      }
      case 'status': {
        const e = ev.entity;
        const map: Partial<Record<string, [string, string]>> = {
          stun: ['ATORDOADO', '#ffe14d'], slow: ['LENTO', '#7fd3ff'], poison: ['VENENO', '#7dff4a'], taunted: ['PROVOCADO', '#ffb84d'], vulnerable: ['VULNERÁVEL!', '#ff5252'], disabled: ['DESLIGADA', '#c0c0c0'],
        };
        const m = map[ev.status];
        if (m && (e.kind !== 'enemy' || ev.status !== 'slow' || Math.random() < 0.3)) fx.label(e.x, e.y - e.radius - 18, m[0], m[1]);
        break;
      }
      case 'fireZone': {
        const z = ev.zone;
        audio.play('fire');
        fx.decal('scorch', z.x, z.y, 0xffffff, z.radius / 30, 0.8);
        fx.burst('ember', z.x, z.y, 20);
        const em = this.add.particles(z.x, z.y, 'flame', {
          emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, z.radius * 0.85) as any, quantity: 1 } as any,
          lifespan: { min: 300, max: 700 }, speedY: { min: -60, max: -20 }, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.9, end: 0 },
          blendMode: 'ADD', frequency: this.host.saveSys.data.settings.particles === 'low' ? 70 : 25,
        }).setDepth(DEPTH.particle);
        this.fireEmitters.set(z.id, em);
        break;
      }
      case 'lightBurst': {
        audio.play('light');
        fx.ring(ev.x, ev.y, ev.radius, 0xfff6c0, 500);
        fx.ring(ev.x, ev.y, ev.radius * 0.6, 0x9fe7ff, 380);
        fx.flash(0xfff6d0, 160, 0.35);
        this.flash(ev.x, ev.y, ev.radius * 2.6, 0xfff6d0, 0.45, 1);
        break;
      }
      case 'trapTrigger': {
        const e = ev.entity;
        audio.play('trap');
        fx.burst('spark', e.x, e.y, 8);
        fx.ring(e.x, e.y, e.def.attack?.splash ?? 40, 0xd0d6df, 250, false);
        const v = this.views.get(e.id);
        if (v) this.tweens.add({ targets: v.sprite, scaleY: v.sprite.scaleY * 1.5, duration: 90, yoyo: true });
        break;
      }
      case 'slam': {
        audio.play('slam');
        fx.shake(6, 350);
        fx.ring(ev.x, ev.y, ev.radius, 0xff5030, 450, false);
        fx.burst('dust', ev.x, ev.y, 24);
        fx.burst('chip', ev.x, ev.y, 10);
        fx.decal('scorch', ev.x, ev.y, 0x444444, ev.radius / 34, 0.6);
        break;
      }
      case 'teleport': {
        audio.play('teleport');
        fx.burst('ecto', ev.fromX, ev.fromY, 20);
        fx.burst('magic', ev.entity.x, ev.entity.y, 20);
        fx.ring(ev.entity.x, ev.entity.y, 60, 0x7a3aff, 400);
        break;
      }
      case 'summon': {
        fx.burst('magic', ev.entity.x, ev.entity.y, 14);
        audio.play('growl', 0.7);
        break;
      }
      case 'scream': {
        audio.play('scream', 0.7);
        fx.ring(ev.entity.x, ev.entity.y, 120, 0xff8a3a, 600);
        break;
      }
      case 'taunt': {
        fx.ring(ev.entity.x, ev.entity.y, ev.radius, 0xffb84d, 500, false);
        fx.label(ev.entity.x, ev.entity.y - 30, 'PROVOCAÇÃO', '#ffb84d');
        audio.play('growl', 0.3);
        break;
      }
      case 'build': {
        audio.play('build', 0.6);
        fx.burst('dust', ev.entity.x, ev.entity.y, 6);
        break;
      }
      case 'wave': {
        if (ev.index === 0 && this.mission.tutorial) break;
        audio.play('wave');
        if (!ev.boss) this.hud.banner(ev.label, ev.label === `Onda ${ev.index + 1}` ? '' : `Onda ${ev.index + 1}`);
        break;
      }
      case 'bossIncoming': {
        audio.play('alarm');
        this.hud.banner(`☠ ${ev.name}`, 'Um chefe se aproxima!', '#ff3030');
        fx.flash(0xff2020, 300, 0.3);
        break;
      }
      case 'eventStart': {
        this.hud.banner(ev.name, ev.description, '#ff8a3a');
        audio.play(ev.eventId === 'storm' ? 'thunder' : ev.eventId === 'distant_scream' ? 'scream' : ev.eventId === 'escape' ? 'escort' : 'alarm');
        if (ev.eventId === 'blackout') fx.flash(0x000000, 300, 1);
        break;
      }
      case 'eventEnd':
        this.hud.toast('O evento terminou.', true);
        break;
      case 'coreThreat':
        audio.play('alarm');
        this.hud.banner('O ABRIGO ESTÁ CAINDO!', 'Proteja o núcleo!', '#ff2020');
        break;
      case 'escortSaved':
        this.escortSaved++;
        audio.play('escort');
        this.hud.toast('Sobrevivente a salvo! +3 energia, núcleo reparado.', true);
        break;
      case 'escortLost':
        this.hud.toast('O sobrevivente não resistiu… o abrigo sofre o golpe.');
        break;
      case 'finalPhase':
        audio.play('alarm', 0.6);
        this.hud.banner('FASE FINAL', 'Energia em dobro. Resista!', '#e05cff');
        break;
      case 'nestRage':
        fx.shake(3, 400);
        audio.play('growl');
        this.hud.toast('O ninho se contorce e expele guardiões!');
        break;
      case 'gameOver':
        this.onGameOver(ev.result);
        break;
    }
  }

  private firstSighting(e: Entity) {
    const save = this.host.saveSys.data;
    if (!save.settings.hints || this.mission.tutorial) return;
    if (save.seenEnemies.includes(e.def.id) || this.seenThisMatch.has(e.def.id)) return;
    this.seenThisMatch.add(e.def.id);
    save.seenEnemies.push(e.def.id);
    this.host.saveSys.save();
    this.hud.toast(`Novo: ${e.def.name} — ${e.def.blurb}`);
  }

  private flushDamageNumbers(dt: number) {
    for (const [id, a] of this.dmgAgg) {
      a.t -= dt || 0.016;
      if (a.t > 0) continue;
      this.dmgAgg.delete(id);
      if (a.amount < 3) continue;
      const color = a.crit ? '#ffe14d' : a.type === 'fire' ? '#ff9a3a' : a.type === 'poison' ? '#9aff5a' : a.type === 'light' ? '#fff6c0' : '#ffffff';
      this.fx.number(a.x, a.y - 18, String(Math.round(a.amount)), color, a.crit ? 19 : 13);
    }
  }

  private onGameOver(result: BattleResult) {
    this.cancelSelection();
    this.endResult = result;
    this.ending = 2.2;
    const audio = this.host.audio;
    if (result.victory) {
      audio.play('victory');
      this.fx.flash(0xffe0a0, 400, 0.45);
      this.hud.banner(result.reason === 'destroy' ? 'NINHO DESTRUÍDO' : 'O AMANHECER CHEGOU', 'Vitória!', '#ffb347');
      this.host.audio.setIntensity(0);
    } else {
      // Apagão progressivo até a tela final.
      audio.fadeOutMusic(2);
      audio.play('defeat');
      this.defeatDark = 0.05;
      this.fx.shake(6, 900);
      this.hud.banner(result.reason === 'timeout' ? 'O TEMPO ACABOU' : 'O ABRIGO CAIU', 'A noite venceu.', '#ff2020');
    }
  }

  // ---------------------------------------------------------------------------
  // Projéteis e telegrafia
  // ---------------------------------------------------------------------------

  private syncProjectiles() {
    const alive = new Set<number>();
    for (const p of this.sim.projectiles) {
      alive.add(p.id);
      let img = this.projectileSprites.get(p.id);
      if (!img) {
        img = this.projectilePool.pop() ?? this.add.image(0, 0, 'p_bullet');
        img.setTexture('p_' + p.fx).setDepth(DEPTH.projectile).setVisible(true).setAlpha(1).setScale(this.projScale(p));
        img.setBlendMode(p.fx === 'uv' || p.fx === 'acid' || p.fx === 'spit' || p.fx === 'bullet' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
        this.projectileSprites.set(p.id, img);
      }
      img.setPosition(p.x, p.y);
      img.setRotation(Math.atan2(p.ty - p.y, p.tx - p.x));
    }
    for (const [id, img] of this.projectileSprites) {
      if (alive.has(id)) continue;
      img.setVisible(false);
      this.projectileSprites.delete(id);
      this.projectilePool.push(img);
    }
    for (const [id, em] of this.fireEmitters) {
      if (this.sim.fireZones.some((z) => z.id === id)) continue;
      em.stop();
      this.fireEmitters.delete(id);
      this.time.delayedCall(800, () => em.destroy());
    }
  }

  private projScale(p: Projectile) {
    return p.fx === 'acid' ? 1.4 : p.fx === 'pellet' ? 1.2 : 1;
  }

  private drawTelegraphs() {
    const g = this.telegraphG;
    g.clear();
    for (const t of this.sim.telegraphs) {
      const k = 1 - t.remaining / t.total;
      const color = t.kind === 'teleport' ? 0x9a5aff : t.kind === 'summon' ? 0xff4fa3 : 0xff2a2a;
      g.fillStyle(color, 0.12 + k * 0.25).fillCircle(t.x, t.y, t.radius);
      g.lineStyle(3, color, 0.9).strokeCircle(t.x, t.y, t.radius);
      g.lineStyle(2, 0xffffff, 0.7).strokeCircle(t.x, t.y, t.radius * k);
      if (t.kind === 'slam') {
        g.lineStyle(2, color, 0.8);
        g.lineBetween(t.x - 10, t.y - 10, t.x + 10, t.y + 10);
        g.lineBetween(t.x + 10, t.y - 10, t.x - 10, t.y + 10);
      }
    }
    // Indicadores persistentes: zona de lentidão das barricadas e área do tutorial.
    const m = this.tutorial?.worldMarker;
    if (m) g.lineStyle(3, 0xffb347, 0.6 + Math.sin(this.elapsedReal * 6) * 0.3).strokeCircle(m.x, m.y, m.r);
    // Alcance da entidade selecionada.
    const sel = this.views.selectedId ? this.sim.get(this.views.selectedId) : undefined;
    if (sel?.alive && sel.def.attack) g.lineStyle(1.5, sel.team === 'player' ? 0x9fe7ff : 0xff6b6b, 0.6).strokeCircle(sel.x, sel.y, attackRange(this.sim, sel) + sel.radius);
  }

  private drawDebug() {
    const g = this.debugG!;
    const sim = this.sim;
    g.clear();
    const t = sim.tile;
    g.lineStyle(1, 0x44ff44, 0.25);
    for (let c = 0; c < sim.map.cols * sim.map.rows; c += 1) {
      const n = sim.grid.nextCell('ground', c);
      if (n < 0) continue;
      const a = sim.grid.cellCenter(c), b = sim.grid.cellCenter(n);
      g.lineBetween(a.x, a.y, a.x + (b.x - a.x) * 0.4, a.y + (b.y - a.y) * 0.4);
    }
    for (const e of sim.entities) {
      g.lineStyle(1, 0xffffff, 0.5).strokeCircle(e.x, e.y, e.radius);
      if (e.def.attack) g.lineStyle(1, e.team === 'player' ? 0x66ccff : 0xff6666, 0.25).strokeCircle(e.x, e.y, attackRange(sim, e) + e.radius);
      const tgt = sim.get(e.targetId);
      if (tgt) g.lineStyle(1, 0xffff00, 0.5).lineBetween(e.x, e.y, tgt.x, tgt.y);
      if (e.path) {
        g.lineStyle(1, 0xff00ff, 0.6);
        let px = e.x, py = e.y;
        for (const p of e.path) {
          g.lineBetween(px, py, p.x, p.y);
          px = p.x;
          py = p.y;
        }
      }
    }
    g.lineStyle(1, 0xff0000, 0.3);
    for (let c = 0; c < sim.grid.structureAt.length; c++) if (sim.grid.structureAt[c]) g.strokeRect((c % sim.map.cols) * t, Math.floor(c / sim.map.cols) * t, t, t);
    const states: Record<string, number> = {};
    for (const e of sim.entities) states[e.state] = (states[e.state] ?? 0) + 1;
    this.debugText!.textContent =
      `fps ${this.game.loop.actualFps.toFixed(0)} · t ${sim.time.toFixed(1)}s · ×${this.speed}\n` +
      `entidades ${sim.entities.length} · inimigos ${sim.hostileCount} · projéteis ${sim.projectiles.length}\n` +
      `energia ${sim.energy.value.toFixed(2)} (+${sim.energy.ratePerSecond.toFixed(2)}/s) gasto ${sim.energy.spent}\n` +
      `onda ${sim.waves.index}/${sim.waves.waves.length} próxima ${sim.waves.timeToNext.toFixed(1)}s pend ${sim.waves.pending.length} hold ${sim.waves.hold}\n` +
      `estados ${JSON.stringify(states)}\nmods ${JSON.stringify(sim.mods)}\nnúcleo ${sim.core.hp}/${sim.core.maxHp} ninho ${Math.round(sim.nest.hp)}`;
  }

  // ---------------------------------------------------------------------------

  private cleanup() {
    this.scale.off('resize', this.onResize, this);
    for (const [t, fn] of this.winListeners) window.removeEventListener(t, fn);
    this.winListeners = [];
    this.tutorial?.destroy();
    this.tutorial = null;
    this.hud?.destroy();
    this.views?.destroy();
    this.fx?.destroy();
    this.light?.destroy();
    this.debugText?.remove();
    for (const em of this.fireEmitters.values()) em.destroy();
    this.fireEmitters.clear();
    this.projectileSprites.clear();
    this.projectilePool = [];
    this.tweens.killAll();
    this.tweens.timeScale = 1;
    const key = this.arenaKey;
    window.setTimeout(() => {
      if (this.textures.exists(key)) this.textures.remove(key);
    }, 0);
  }
}
