import { GAME_CONFIG } from '../app/config';
import { CORE, COMBAT, DIFFICULTY, ENERGY, LIMITS, NEST } from '../data/balance';
import { getActor } from '../data/actors';
import { CARD_BY_ID } from '../data/cards';
import { EVENT_BY_ID, type EventDef } from '../data/events';
import { MAPS, type MapDef, type SpawnId } from '../data/maps';
import type { MissionDef } from '../data/missions';
import { computeUpgradeMods, type UpgradeMods } from '../data/upgrades';
import { updateEntity } from './ai';
import { applyStatus, dealDamage, isFlying, resolveHit, updateStatuses } from './combat';
import { DeckSystem } from './deck';
import { EventDirector, type BattleMods, neutralMods } from './director';
import { EnergySystem } from './energy';
import { NavGrid } from './grid';
import { Rng } from './rng';
import { SpatialHash } from './spatial';
import { WaveSystem } from './waves';
import type {
  ActorDef, AttackDef, BattleEvent, BattleResult, BattleStats, CardDef, Entity, FireZone, Projectile, Team, Telegraph,
} from './types';

export interface BattleSetup {
  mission: MissionDef;
  deck: string[];
  upgrades?: Partial<UpgradeMods> | Record<string, number>;
  /** Níveis de melhoria (alternativa a `upgrades`). */
  upgradeLevels?: Record<string, number>;
  seed?: number;
  shuffle?: boolean;
}

export interface PlayCheck {
  ok: boolean;
  reason?: string;
}

const emptyStats = (): BattleStats => ({
  kills: {}, cardsPlayed: {}, damageDealt: 0, damageTaken: 0, energySpent: 0, bossesKilled: [],
  unitsLost: 0, structuresBuilt: 0, wavesCleared: 0, bounty: 0,
});

/**
 * Estado central e regras da partida. Não conhece Phaser nem DOM:
 * a renderização observa `entities`, `projectiles`, etc. e consome `drainEvents()`.
 */
export class BattleSim {
  readonly mission: MissionDef;
  readonly map: MapDef;
  readonly tile = GAME_CONFIG.world.tile;
  readonly width: number;
  readonly height: number;
  readonly grid: NavGrid;
  readonly rng: Rng;
  readonly energy: EnergySystem;
  readonly deck: DeckSystem;
  readonly waves: WaveSystem;
  readonly director: EventDirector;
  readonly upgrades: UpgradeMods;
  readonly stats: BattleStats = emptyStats();

  entities: Entity[] = [];
  projectiles: Projectile[] = [];
  fireZones: FireZone[] = [];
  telegraphs: Telegraph[] = [];
  mods: BattleMods = neutralMods();
  time = 0;
  over = false;
  result: BattleResult | null = null;
  finalPhase = false;
  core!: Entity;
  nest!: Entity;
  escort: Entity | null = null;
  /** Unidade/estrutura atingida por último que causou alerta de ameaça. */
  private lastThreatAt = -99;
  private nestRage = 0;
  private nextId = 1;
  private byId = new Map<number, Entity>();
  private events: BattleEvent[] = [];
  private hash: SpatialHash;
  private repathTimer = 0;
  private finalPhaseAt: number;
  private hpWaveScale = 0;

  constructor(setup: BattleSetup) {
    this.mission = setup.mission;
    this.map = MAPS[this.mission.map];
    if (!this.map) throw new Error(`Mapa inexistente: ${this.mission.map}`);
    this.width = this.map.cols * this.tile;
    this.height = this.map.rows * this.tile;
    this.rng = new Rng(setup.seed ?? Date.now() % 100000);
    this.upgrades = computeUpgradeMods(setup.upgradeLevels ?? {});
    this.grid = new NavGrid(this.map, this.tile);
    this.hash = new SpatialHash(64);
    this.energy = new EnergySystem(ENERGY.start, ENERGY.max, this.upgrades.energyRegen);
    this.deck = new DeckSystem(setup.deck, this.rng, setup.shuffle ?? true);
    this.waves = new WaveSystem(this.mission, this.rng, {
      onWave: (i, w) => {
        this.hpWaveScale = i;
        this.stats.wavesCleared = Math.max(this.stats.wavesCleared, i);
        this.emit({ type: 'wave', index: i, label: w.label ?? `Onda ${i + 1}`, boss: !!w.boss });
        if (w.boss) this.emit({ type: 'bossIncoming', bossId: w.boss, name: getActor(w.boss).name });
      },
      onSpawn: (p) => {
        const pt = this.map.spawns[p.spawn];
        if (p.boss) {
          const c = this.grid.cellCenter(pt.cy * this.map.cols + pt.cx);
          this.spawnEnemyNear(p.enemy, c.x - 30, c.y, { waveIndex: p.waveIndex });
        } else this.spawnAtSpawn(p.enemy, p.spawn, p.elite, p.waveIndex);
      },
    });
    this.director = new EventDirector(this.mission, this.rng, {
      onStart: (d) => this.onEventStart(d),
      onEnd: (d) => this.emit({ type: 'eventEnd', eventId: d.id }),
    });
    const duration = this.mission.timeLimit ?? this.waves.lastWaveAt + 45;
    this.finalPhaseAt = this.mission.endless ? Infinity : Math.max(30, duration - ENERGY.finalPhaseSeconds);

    // Núcleo, ninho, destroços e estruturas iniciais.
    const corePos = this.cellPos(this.map.core.cx, this.map.core.cy);
    this.core = this.spawnActor('core', 'player', corePos.x, corePos.y, { hpMult: 1 + this.upgrades.coreHp, noDelay: true });
    this.core.maxHp = this.core.hp = Math.round(CORE.hp * (1 + this.upgrades.coreHp));
    const nestPos = this.cellPos(this.map.nest.cx, this.map.nest.cy);
    this.nest = this.spawnActor('nest', 'enemy', nestPos.x, nestPos.y, { noDelay: true });
    this.nest.maxHp = this.nest.hp = this.mission.nestHp || NEST.hp;
    if (!this.mission.objectives.includes('destroy')) this.nest.special.invulnerable = 1;
    for (const d of this.map.debris) {
      const p = this.cellPos(d.cx, d.cy);
      this.spawnActor('debris', 'neutral', p.x, p.y, { noDelay: true });
    }
    this.grid.recompute();
  }

  // -------------------------------------------------------------------------
  // Utilidades
  // -------------------------------------------------------------------------

  cellPos(cx: number, cy: number) {
    return { x: (cx + 0.5) * this.tile, y: (cy + 0.5) * this.tile };
  }

  emit(ev: BattleEvent) {
    this.events.push(ev);
    if (this.events.length > 4000) this.events.splice(0, this.events.length - 2000);
  }

  drainEvents(): BattleEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  get(id: number): Entity | undefined {
    if (!id) return undefined;
    return this.byId.get(id);
  }

  queryRadius(x: number, y: number, r: number, cb: (e: Entity) => void) {
    this.hash.query(x, y, r, cb);
  }

  addTelegraph(x: number, y: number, radius: number, duration: number, kind: Telegraph['kind']) {
    const t: Telegraph = { id: this.nextId++, x, y, radius, remaining: duration, total: duration, kind };
    this.telegraphs.push(t);
    this.emit({ type: 'telegraph', telegraph: t });
    return t;
  }

  get hostileCount() {
    let n = 0;
    for (const e of this.entities) if (e.alive && e.team === 'enemy' && (e.kind === 'enemy' || e.kind === 'boss')) n++;
    return n;
  }

  get bosses() {
    return this.entities.filter((e) => e.alive && e.kind === 'boss');
  }

  get regenMult() {
    return this.energy.phaseMult;
  }

  // -------------------------------------------------------------------------
  // Criação de entidades
  // -------------------------------------------------------------------------

  spawnActor(
    defId: string,
    team: Team,
    x: number,
    y: number,
    opts: { elite?: boolean; ownerId?: number; hpMult?: number; dmgMult?: number; noDelay?: boolean; cardId?: string; waveIndex?: number } = {},
  ): Entity {
    const def: ActorDef = getActor(defId);
    let hpMult = opts.hpMult ?? 1;
    let dmgMult = opts.dmgMult ?? 1;
    let rangeMult = 1;
    let healMult = 1;
    let charges = def.charges ?? 0;
    const card = opts.cardId ? CARD_BY_ID[opts.cardId] : undefined;
    if (team === 'player') {
      const u = this.upgrades;
      if (defId === 'barricade' || defId === 'mini_barricade') hpMult *= 1 + u.barricadeHp;
      if (defId === 'watchtower') rangeMult *= 1 + u.watchtowerRange;
      if (defId === 'medic') healMult *= 1 + u.medicHeal;
      if (card?.category === 'survivor') hpMult *= 1 + u.survivorHp;
      if (card?.category === 'creature') dmgMult *= 1 + u.creatureDamage;
      if (defId === 'spike_trap') charges += u.trapCharges;
    }
    if (team === 'enemy' && def.kind !== 'nest') {
      const wave = opts.waveIndex ?? this.hpWaveScale;
      hpMult *= (1 + DIFFICULTY.hpPerWave * wave) * (this.mission.enemyHpMult ?? 1);
      dmgMult *= 1 + DIFFICULTY.damagePerWave * wave;
      if (opts.elite) {
        hpMult *= DIFFICULTY.eliteHpMult;
        dmgMult *= DIFFICULTY.eliteDamageMult;
      }
    }
    const hp = Math.round(def.hp * hpMult);
    const e: Entity = {
      id: this.nextId++, def, team, kind: def.kind, x, y, vx: 0, vy: 0, hp, maxHp: hp,
      radius: def.radius * (opts.elite ? 1.15 : 1), alive: true, age: 0,
      spawnDelay: opts.noDelay ? 0 : def.kind === 'structure' || def.kind === 'trap' ? 0.35 : def.kind === 'boss' ? 1.2 : 0.55,
      state: 'idle', targetId: 0, attackCd: 0.2, windupLeft: 0, windupTargetId: 0, hitsDone: 0, statuses: [],
      aiTimer: this.rng.range(0, COMBAT.aiTickSeconds), behaviorTimers: [], homeX: x, homeY: y, path: null, pathTimer: 0,
      pathGoalCell: -1, facing: team === 'enemy' ? -1 : 1, elite: !!opts.elite, damageMult: dmgMult, speedMult: 1,
      rangeMult, healMult, hpMult, charges, lifetime: def.lifetime ?? 0, ownerId: opts.ownerId ?? 0, special: {}, lastHitBy: 0,
      cardId: opts.cardId,
    };
    this.entities.push(e);
    this.byId.set(e.id, e);
    this.hash.insert(e);
    if (def.tags.includes('blocker') && (team === 'player' || team === 'neutral') && def.kind !== 'core') {
      this.grid.setStructure(e.id, x, y, e.radius, def.tags.includes('lowObstacle'), true);
    }
    this.emit({ type: 'spawn', entity: e });
    return e;
  }

  spawnAtSpawn(defId: string, spawn: SpawnId, elite: boolean, waveIndex: number) {
    if (this.hostileCount >= LIMITS.maxEnemies) return;
    const pt = this.map.spawns[spawn];
    const base = this.cellPos(pt.cx, pt.cy);
    this.spawnEnemyNear(defId, base.x + this.rng.range(-26, 26), base.y + this.rng.range(-40, 40), { elite, waveIndex });
  }

  spawnEnemyNear(defId: string, x: number, y: number, opts: { elite?: boolean; ownerId?: number; waveIndex?: number } = {}) {
    if (this.hostileCount >= LIMITS.maxEnemies) return undefined;
    if (this.grid.isBlockedAt(x, y)) {
      const c = this.grid.nearestFree(this.grid.cellOf(x, y));
      if (c >= 0) ({ x, y } = this.grid.cellCenter(c));
    }
    return this.spawnActor(defId, 'enemy', x, y, opts);
  }

  isStructureSpotFree(x: number, y: number, radius: number): boolean {
    if (x < radius || y < radius || x > this.width - radius || y > this.height - radius) return false;
    for (const [ox, oy] of [[0, 0], [radius * 0.7, 0], [-radius * 0.7, 0], [0, radius * 0.7], [0, -radius * 0.7]])
      if (this.grid.isBlockedAt(x + ox, y + oy)) return false;
    let free = true;
    this.queryRadius(x, y, radius + 50, (o) => {
      if (!free || !o.alive) return;
      if (o.kind === 'structure' || o.kind === 'core' || o.kind === 'trap' || o.kind === 'nest') {
        if (Math.hypot(o.x - x, o.y - y) < o.radius + radius + 2) free = false;
      }
    });
    return free;
  }

  // -------------------------------------------------------------------------
  // Cartas
  // -------------------------------------------------------------------------

  inDeployZone(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.map.deployMaxCol * this.tile && y < this.height;
  }

  checkPlacement(card: CardDef, x: number, y: number): PlayCheck {
    if (x < 0 || y < 0 || x > this.width || y > this.height) return { ok: false, reason: 'Fora da arena.' };
    if (card.placement === 'anywhere') return { ok: true };
    if (!this.inDeployZone(x, y)) return { ok: false, reason: 'Fora da zona de posicionamento.' };
    if (this.grid.isBlockedAt(x, y)) return { ok: false, reason: 'Local obstruído.' };
    const actor = card.actor ? getActor(card.actor) : undefined;
    if (actor && (actor.kind === 'structure' || actor.kind === 'trap')) {
      const count = this.entities.filter((e) => e.alive && e.team === 'player' && (e.kind === 'structure' || e.kind === 'trap')).length;
      if (count >= LIMITS.maxPlayerStructures) return { ok: false, reason: 'Limite de estruturas atingido.' };
      if (!this.isStructureSpotFree(x, y, actor.radius)) return { ok: false, reason: 'Espaço ocupado.' };
    } else if (actor) {
      const count = this.entities.filter((e) => e.alive && e.team === 'player' && e.kind === 'unit').length;
      if (count >= LIMITS.maxPlayerUnits) return { ok: false, reason: 'Limite de unidades em campo.' };
      if (Math.hypot(x - this.core.x, y - this.core.y) < this.core.radius) return { ok: false, reason: 'Muito perto do núcleo.' };
    }
    return { ok: true };
  }

  canPlay(slot: number, x?: number, y?: number): PlayCheck {
    if (this.over) return { ok: false, reason: 'A partida terminou.' };
    const id = this.deck.hand[slot];
    const card = id ? CARD_BY_ID[id] : undefined;
    if (!card) return { ok: false, reason: 'Carta inválida.' };
    if (this.deck.cooldownOf(id) > 0) return { ok: false, reason: `${card.name} em recarga.` };
    if (!this.energy.canAfford(card.cost)) return { ok: false, reason: `Energia insuficiente (${card.cost} necessária).` };
    if (x !== undefined && y !== undefined) return this.checkPlacement(card, x, y);
    return { ok: true };
  }

  playCard(slot: number, x: number, y: number): PlayCheck {
    const check = this.canPlay(slot, x, y);
    if (!check.ok) return check;
    const id = this.deck.hand[slot];
    const card = CARD_BY_ID[id];
    this.energy.spend(card.cost);
    this.stats.energySpent += card.cost;
    this.stats.cardsPlayed[id] = (this.stats.cardsPlayed[id] ?? 0) + 1;
    const cd = card.cooldown ? card.cooldown * (1 - this.upgrades.abilityCooldown) : 0;
    this.deck.play(slot, cd);
    if (card.ability) this.castAbility(card, x, y);
    else if (card.actor) {
      const n = card.count ?? 1;
      for (let i = 0; i < n; i++) {
        const ox = n > 1 ? (i - (n - 1) / 2) * 22 : 0;
        const e = this.spawnActor(card.actor, 'player', x + ox, y + (n > 1 ? (i % 2) * 10 : 0), { cardId: id });
        if (e.kind === 'structure' || e.kind === 'trap') this.stats.structuresBuilt++;
      }
    }
    this.emit({ type: 'cardPlayed', cardId: id, x, y });
    return { ok: true };
  }

  private castAbility(card: CardDef, x: number, y: number) {
    const ab = card.ability!;
    if (ab.type === 'fireZone') {
      const zone: FireZone = {
        id: this.nextId++, x, y, radius: ab.radius, remaining: ab.duration * (this.mods.rain ? 0.6 : 1), dps: ab.dps, tick: ab.tick, tickTimer: 0,
      };
      this.fireZones.push(zone);
      this.emit({ type: 'fireZone', zone });
    } else if (ab.type === 'lightBurst') {
      this.emit({ type: 'lightBurst', x, y, radius: ab.radius });
      this.queryRadius(x, y, ab.radius + 30, (t) => {
        if (!t.alive || t.team !== 'enemy' || t.kind === 'nest') return;
        if (Math.hypot(t.x - x, t.y - y) > ab.radius + t.radius) return;
        const sup = t.def.tags.includes('supernatural');
        dealDamage(this, undefined, t, ab.damage * (sup ? ab.supernaturalMult : 1), 'light');
        if (sup) applyStatus(this, t, { type: 'stun', duration: ab.stun, power: 1 });
      });
    }
  }

  // -------------------------------------------------------------------------
  // Projéteis
  // -------------------------------------------------------------------------

  fireProjectile(src: Entity, target: Entity, atk: AttackDef) {
    if (this.projectiles.length >= LIMITS.maxProjectiles) {
      // sem espaço para projéteis: resolve o golpe imediatamente (evita perder dano)
      resolveHit(this, src, target, target.x, target.y, atk, src.team);
      return;
    }
    const crit = !!atk.critChance && this.rng.chance(atk.critChance);
    const p: Projectile = {
      id: this.nextId++, x: src.x + src.facing * src.radius * 0.6, y: src.y - 6, sourceId: src.id, targetId: target.id,
      tx: target.x, ty: target.y, speed: atk.projectileSpeed ?? 600, damage: atk.damage, attack: atk, team: src.team,
      fx: atk.projectileFx ?? 'bullet', alive: true, crit,
    };
    this.projectiles.push(p);
    this.emit({ type: 'projectile', projectile: p });
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const t = this.get(p.targetId);
      const homing = p.fx !== 'acid' && p.fx !== 'spit';
      if (homing && t && t.alive) {
        p.tx = t.x;
        p.ty = t.y;
      }
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = p.speed * dt;
      if (d <= stepLen + 2) {
        p.x = p.tx;
        p.y = p.ty;
        p.alive = false;
        const src = this.get(p.sourceId);
        const primary = t && t.alive && Math.hypot(t.x - p.x, t.y - p.y) < t.radius + 14 ? t : undefined;
        // Atacante pode ter morrido: usa um "fantasma" com os multiplicadores do disparo.
        resolveHit(this, src && src.alive ? src : undefined, primary, p.x, p.y, p.attack, p.team, src ? src.damageMult : 1, p.crit);
        this.emit({ type: 'projectileHit', projectile: p });
      } else {
        p.x += (dx / d) * stepLen;
        p.y += (dy / d) * stepLen;
      }
    }
    if (this.projectiles.some((p) => !p.alive)) this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateFireZones(dt: number) {
    for (const z of this.fireZones) {
      z.remaining -= dt;
      z.tickTimer -= dt;
      if (z.tickTimer <= 0) {
        z.tickTimer += z.tick;
        this.queryRadius(z.x, z.y, z.radius + 20, (t) => {
          if (!t.alive || t.team !== 'enemy' || isFlying(t) || t.kind === 'nest') return;
          if (Math.hypot(t.x - z.x, t.y - z.y) > z.radius + t.radius * 0.5) return;
          dealDamage(this, undefined, t, z.dps * z.tick, 'fire', { noCrit: true, silentSmall: true });
        });
      }
    }
    if (this.fireZones.some((z) => z.remaining <= 0)) this.fireZones = this.fireZones.filter((z) => z.remaining > 0);
  }

  // -------------------------------------------------------------------------
  // Morte e eventos
  // -------------------------------------------------------------------------

  kill(e: Entity, killerId: number) {
    if (!e.alive) return;
    if (e.special.invulnerable) {
      e.hp = 1;
      return;
    }
    e.alive = false;
    e.hp = 0;
    e.state = 'dead';
    if (e.def.tags.includes('blocker')) this.grid.setStructure(e.id, e.x, e.y, e.radius, false, false);
    if (e.team === 'enemy' && (e.kind === 'enemy' || e.kind === 'boss')) {
      this.stats.kills[e.def.id] = (this.stats.kills[e.def.id] ?? 0) + 1;
      this.stats.bounty += e.def.bounty ?? 0;
      if (e.kind === 'boss') this.stats.bossesKilled.push(e.def.id);
    }
    if (e.team === 'player' && e.kind === 'unit') this.stats.unitsLost++;
    for (const b of e.def.behaviors ?? []) {
      if (b.type === 'deathBurst') {
        this.queryRadius(e.x, e.y, b.radius + 20, (t) => {
          if (t.alive && t.team === 'player' && t.kind !== 'trap' && Math.hypot(t.x - e.x, t.y - e.y) <= b.radius + t.radius)
            dealDamage(this, e, t, b.damage, b.damageType, { noCrit: true });
        });
      } else if (b.type === 'deathEnergy') this.energy.gain(b.amount);
    }
    if (e === this.escort) {
      this.escort = null;
      this.emit({ type: 'escortLost' });
      if (this.core.alive) dealDamage(this, undefined, this.core, 150, 'physical');
    }
    this.emit({ type: 'death', entity: e, killerId });
    if (e === this.core) this.finish(false, 'coreDestroyed');
    else if (e === this.nest && this.mission.objectives.includes('destroy')) this.finish(true, 'destroy');
  }

  onCoreDamaged() {
    if (this.core.hp / this.core.maxHp < CORE.threatThreshold && this.time - this.lastThreatAt > 6) {
      this.lastThreatAt = this.time;
      this.emit({ type: 'coreThreat' });
    }
  }

  onNestDamaged() {
    this.nest.special.lastHit = this.time;
    const pct = this.nest.hp / this.nest.maxHp;
    while (this.nestRage < NEST.rageSteps.length && pct <= NEST.rageSteps[this.nestRage]) {
      this.nestRage++;
      this.emit({ type: 'nestRage', level: this.nestRage });
      // O ninho expele guardiões ao ser ferido.
      const n = 3 + this.nestRage * 2;
      for (let i = 0; i < n; i++) {
        const a = this.rng.range(Math.PI * 0.5, Math.PI * 1.5);
        this.spawnEnemyNear(i % 3 === 0 ? 'runner' : 'wanderer', this.nest.x + Math.cos(a) * 70, this.nest.y + Math.sin(a) * 70, { waveIndex: this.hpWaveScale });
      }
      if (this.nestRage === NEST.rageSteps.length)
        this.spawnEnemyNear('brute', this.nest.x - 80, this.nest.y, { elite: true, waveIndex: this.hpWaveScale });
    }
  }

  private onEventStart(d: EventDef) {
    this.emit({ type: 'eventStart', eventId: d.id, name: d.name, description: d.description });
    if (d.special === 'scream') {
      this.waves.enqueueGroups(
        [
          { enemy: 'abyss_spider', count: 4, spawn: 'all', spacing: 0.5 },
          { enemy: 'specter', count: 3, spawn: 'all', spacing: 0.7 },
          { enemy: 'runner', count: 5, spawn: 'all', spacing: 0.3 },
        ],
        Math.max(this.hpWaveScale, 2),
        5,
      );
    } else if (d.special === 'escort' && !this.escort) {
      const p = this.cellPos(this.map.escortStart.cx, this.map.escortStart.cy);
      this.escort = this.spawnActor('refugee', 'player', p.x, p.y);
    }
  }

  private finish(victory: boolean, reason: BattleResult['reason']) {
    if (this.over) return;
    this.over = true;
    const pct = Math.max(0, this.core.hp / this.core.maxHp);
    const stars = victory ? 1 + (pct >= 0.5 ? 1 : 0) + (pct >= 0.85 ? 1 : 0) : 0;
    this.result = { victory, reason, time: this.time, stats: this.stats, coreHpPct: pct, stars };
    this.emit({ type: 'gameOver', result: this.result });
  }

  /** Encerrar manualmente (abandono). */
  forfeit() {
    this.finish(false, 'coreDestroyed');
  }

  // -------------------------------------------------------------------------
  // Laço principal
  // -------------------------------------------------------------------------

  update(dt: number) {
    if (this.over) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;

    this.director.update(dt, this.time);
    this.mods = this.director.computeMods();
    if (this.entities.some((e) => e.alive && e.def.id === 'faceless')) this.mods.darkness += 0.22;

    if (!this.finalPhase && this.time >= this.finalPhaseAt) {
      this.finalPhase = true;
      this.energy.phaseMult = ENERGY.finalPhaseMult;
      this.emit({ type: 'finalPhase' });
    }
    this.energy.update(dt);
    this.deck.update(dt);
    // O ninho se regenera quando deixado em paz.
    if (this.nest.alive && this.time - (this.nest.special.lastHit ?? -99) > NEST.regenDelay)
      this.nest.hp = Math.min(this.nest.maxHp, this.nest.hp + NEST.regenPerSecond * dt);
    this.waves.update(dt);

    this.repathTimer -= dt;
    if (this.grid.dirty && this.repathTimer <= 0) {
      this.grid.recompute();
      this.repathTimer = 0.25;
    }

    this.hash.rebuild(this.entities);
    for (const e of this.entities) {
      if (!e.alive) continue;
      e.age += dt;
      if (e.spawnDelay > 0) {
        e.spawnDelay -= dt;
        continue;
      }
      updateStatuses(this, e, dt);
      if (!e.alive) continue;
      if (e.lifetime > 0 && e.age > e.lifetime) {
        this.kill(e, 0);
        continue;
      }
      updateEntity(this, e, dt);
      if (e === this.escort && Math.hypot(e.x - this.core.x, e.y - this.core.y) < this.core.radius + 30) this.rescueEscort();
    }
    this.separate();
    this.updateProjectiles(dt);
    this.updateFireZones(dt);
    for (const t of this.telegraphs) t.remaining -= dt;
    if (this.telegraphs.some((t) => t.remaining <= 0)) this.telegraphs = this.telegraphs.filter((t) => t.remaining > 0);

    // Remove entidades mortas (renderização já recebeu o evento de morte).
    if (this.entities.some((e) => !e.alive)) {
      this.entities = this.entities.filter((e) => {
        if (!e.alive) this.byId.delete(e.id);
        return e.alive;
      });
    }
    this.checkEnd();
  }

  private rescueEscort() {
    const e = this.escort!;
    this.escort = null;
    e.alive = false;
    e.state = 'dead';
    this.energy.gain(3);
    this.core.hp = Math.min(this.core.maxHp, this.core.hp + 150);
    this.emit({ type: 'escortSaved' });
    this.emit({ type: 'heal', entity: this.core, amount: 150 });
    this.emit({ type: 'death', entity: e, killerId: -1 });
  }

  private checkEnd() {
    if (this.over) return;
    const m = this.mission;
    if (m.objectives.includes('survive') && this.waves.allSpawned && this.hostileCount === 0) {
      this.stats.wavesCleared = this.waves.waves.length;
      this.finish(true, 'survive');
      return;
    }
    if (m.timeLimit && this.time >= m.timeLimit && !m.objectives.includes('survive')) this.finish(false, 'timeout');
  }

  /** Separação simples entre corpos (evita sobreposição) e empurrão para fora de estruturas. */
  private separate() {
    const strength = COMBAT.separationStrength;
    this.hash.rebuild(this.entities);
    for (const a of this.entities) {
      if (!a.alive || a.def.speed <= 0 || a.spawnDelay > 0) continue;
      const flyA = isFlying(a);
      const lowA = a.def.tags.includes('low');
      this.hash.query(a.x, a.y, a.radius + 48, (b) => {
        if (b === a || !b.alive || b.kind === 'trap') return;
        if (flyA !== isFlying(b)) return;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.radius + b.radius;
        if (d >= min) return;
        const overlap = min - d;
        if (b.def.speed <= 0) {
          // Estruturas são fixas. Aliados atravessam as próprias estruturas; rastejantes passam por barricadas baixas.
          if (a.team === 'player' && b.team === 'player') return;
          if (a.team === 'player' && b.team === 'neutral') return;
          if (lowA && b.def.tags.includes('lowObstacle')) return;
          if (b.kind === 'nest' && a.team === 'enemy') return;
          const nx = a.x + (dx / d) * overlap, ny = a.y + (dy / d) * overlap;
          if (!this.grid.isBlockedAt(nx, ny)) {
            a.x = nx;
            a.y = ny;
          }
          return;
        }
        const push = overlap * 0.5 * strength;
        const nx = a.x + (dx / d) * push, ny = a.y + (dy / d) * push;
        if (flyA || !this.grid.isBlockedAt(nx, ny)) {
          a.x = nx;
          a.y = ny;
        }
      });
      a.x = Math.max(a.radius, Math.min(this.width - a.radius, a.x));
      a.y = Math.max(a.radius, Math.min(this.height - a.radius, a.y));
    }
  }
}

export { EVENT_BY_ID };
