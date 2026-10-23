import { COMBAT } from '../data/balance';
import type { BattleSim } from './BattleSim';
import { applyStatus, canTargetLayer, getStatus, heal, isFlying, isStructureLike, resolveHit } from './combat';
import { fieldFor, moveAlongField, moveToward } from './movement';
import { BOSS_THINK, BOSS_UPDATE } from './bossAi';
import {
  MOVE_FIELD, MOVE_NONE, MOVE_POINT, MOVE_TARGET, alliesNear, attackRange, bestTarget, dist, enemyThink, gap,
  isDisabled, setMove, validTarget,
} from './targeting';
import type { AiId, BehaviorDef, Entity } from './types';

const THINK: Partial<Record<AiId, (sim: BattleSim, e: Entity) => void>> = {
  walker: (sim, e) => enemyThink(sim, e),
  ranged: (sim, e) => enemyThink(sim, e),
  screamer: (sim, e) => enemyThink(sim, e),
  parasite: (sim, e) =>
    enemyThink(sim, e, (t, d) => d + alliesNear(sim, t, 120) * 90, (t) => t.kind === 'unit' || t.kind === 'escort'),
  flanker: (sim, e) =>
    enemyThink(sim, e, (t, d) => d - (t.def.tags.includes('support') ? 160 : t.def.tags.includes('ranged') ? 90 : 0) + (isStructureLike(t) ? 120 : 0)),
  guard: (sim, e) => {
    const aggro = e.def.aggroRange * sim.mods.allyRangeMult;
    const leash = aggro + 90;
    const homeD = Math.hypot(e.x - e.homeX, e.y - e.homeY);
    const cur = sim.get(e.targetId);
    if (validTarget(e, cur) && gap(e, cur) < aggro + 30 && dist(cur, { x: e.homeX, y: e.homeY }) < leash + 40) {
      setMove(e, MOVE_TARGET);
      return;
    }
    const t = bestTarget(sim, e, aggro, (t, d) => d + (t.kind === 'nest' ? 400 : 0), (t) => dist(t, { x: e.homeX, y: e.homeY }) < leash);
    if (t) {
      e.targetId = t.id;
      setMove(e, MOVE_TARGET);
    } else {
      e.targetId = 0;
      setMove(e, homeD > 6 ? MOVE_POINT : MOVE_NONE, e.homeX, e.homeY);
    }
  },
  assault: (sim, e) => {
    const aggro = e.def.aggroRange * sim.mods.allyRangeMult;
    const cur = sim.get(e.targetId);
    if (validTarget(e, cur) && gap(e, cur) < aggro + 40) {
      setMove(e, MOVE_TARGET);
      return;
    }
    // Corvos preferem voadores e espectros.
    const prefersAir = e.def.attack?.bonusVs?.flying;
    const t = bestTarget(sim, e, aggro, (t, d) => d - (prefersAir && isFlying(t) ? 150 : 0));
    if (t) {
      e.targetId = t.id;
      setMove(e, MOVE_TARGET);
      return;
    }
    const nest = sim.nest;
    if (nest.alive && validTarget(e, nest)) {
      if (gap(e, nest) < aggro) {
        e.targetId = nest.id;
        setMove(e, MOVE_TARGET);
        return;
      }
    }
    e.targetId = 0;
    if (isFlying(e)) setMove(e, MOVE_POINT, nest.x, nest.y);
    else setMove(e, MOVE_FIELD);
  },
  siege: (sim, e) => {
    // Ignora a horda: só ataca o ninho (ou destroços que bloqueiem nada — aliados os atravessam).
    const nest = sim.nest;
    if (nest.alive && validTarget(e, nest) && gap(e, nest) < e.def.aggroRange) {
      e.targetId = nest.id;
      setMove(e, MOVE_TARGET);
    } else {
      e.targetId = 0;
      setMove(e, MOVE_FIELD);
    }
  },
  tower: (sim, e) => {
    if (isDisabled(sim, e)) {
      e.targetId = 0;
      return;
    }
    const r = attackRange(sim, e);
    const cur = sim.get(e.targetId);
    if (validTarget(e, cur) && gap(e, cur) <= r) return;
    const t = bestTarget(sim, e, r, (t, d) => d - (t.kind === 'boss' ? 30 : 0));
    e.targetId = t ? t.id : 0;
    setMove(e, MOVE_NONE);
  },
  escort: (_sim, e) => setMove(e, MOVE_FIELD),
  ...BOSS_THINK,
};

// ---------------------------------------------------------------------------
// Comportamentos contínuos (cura, reparo, auras...)
// ---------------------------------------------------------------------------

type BehaviorFn = (sim: BattleSim, e: Entity, b: any, index: number, dt: number) => void;

function every(e: Entity, index: number, dt: number, interval: number): boolean {
  e.behaviorTimers[index] = (e.behaviorTimers[index] ?? interval * 0.5) - dt;
  if (e.behaviorTimers[index] <= 0) {
    e.behaviorTimers[index] += interval;
    return true;
  }
  return false;
}

const BEHAVIORS: Record<BehaviorDef['type'], BehaviorFn> = {
  heal: (sim, e, b: Extract<BehaviorDef, { type: 'heal' }>, i, dt) => {
    if (!every(e, i, dt, b.interval)) return;
    const cands: Entity[] = [];
    sim.queryRadius(e.x, e.y, b.radius, (o) => {
      if (o.alive && o.team === e.team && (o.kind === 'unit' || o.kind === 'escort') && o.hp < o.maxHp && dist(o, e) <= b.radius) cands.push(o);
    });
    cands.sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp);
    for (const o of cands.slice(0, b.maxTargets)) heal(sim, o, b.amount * e.healMult);
  },
  repair: (sim, e, b: Extract<BehaviorDef, { type: 'repair' }>, i, dt) => {
    if (!every(e, i, dt, b.interval)) return;
    sim.queryRadius(e.x, e.y, b.radius, (o) => {
      if (!o.alive || o.team !== e.team || o.kind !== 'structure' || dist(o, e) > b.radius) return;
      heal(sim, o, b.amount);
      applyStatus(sim, o, { type: 'reinforced', duration: b.interval + 0.6, power: 0.25 }, e.id);
    });
  },
  buildBarricade: (sim, e, b: Extract<BehaviorDef, { type: 'buildBarricade' }>, i, dt) => {
    if (!every(e, i, dt, b.interval)) return;
    const mine = sim.entities.filter((o) => o.alive && o.ownerId === e.id && o.def.id === b.actor).length;
    if (mine >= b.maxAlive) return;
    // tenta posições à frente (leste) da engenheira
    for (const [ox, oy] of [[44, 0], [40, -30], [40, 30], [0, -40], [0, 40]]) {
      const x = e.x + ox, y = e.y + oy;
      if (sim.isStructureSpotFree(x, y, 16)) {
        const s = sim.spawnActor(b.actor, 'player', x, y, { ownerId: e.id });
        sim.emit({ type: 'build', entity: s });
        break;
      }
    }
  },
  taunt: (sim, e, b: Extract<BehaviorDef, { type: 'taunt' }>, i, dt) => {
    if (!every(e, i, dt, b.interval)) return;
    let any = false;
    sim.queryRadius(e.x, e.y, b.radius, (o) => {
      if (o.alive && o.team === 'enemy' && o.kind === 'enemy' && dist(o, e) <= b.radius && (!o.def.attack || canTargetLayer(o.def.attack, e))) {
        applyStatus(sim, o, { type: 'taunted', duration: b.duration, power: 1 }, e.id);
        o.targetId = e.id;
        any = true;
      }
    });
    if (any) sim.emit({ type: 'taunt', entity: e, radius: b.radius });
  },
  aura: (sim, e, b: Extract<BehaviorDef, { type: 'aura' }>, i, dt) => {
    if (!every(e, i, dt, 0.3)) return;
    sim.queryRadius(e.x, e.y, b.radius, (o) => {
      if (o.alive && o.team === e.team && o !== e && dist(o, e) <= b.radius) {
        o.special.auraUntil = sim.time + 0.7;
        o.special.auraDmg = b.damageMult;
        o.special.auraSpd = b.speedMult;
      }
    });
  },
  summon: (sim, e, b: Extract<BehaviorDef, { type: 'summon' }>, i, dt) => {
    if (e.special.summonAt && sim.time >= e.special.summonAt) {
      e.special.summonAt = 0;
      sim.emit({ type: 'summon', entity: e });
      for (let k = 0; k < b.count; k++) {
        const a = sim.rng.range(0, Math.PI * 2);
        sim.spawnEnemyNear(b.actor, e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26, { ownerId: e.id });
      }
      return;
    }
    if (!every(e, i, dt, b.interval)) return;
    const mine = sim.entities.filter((o) => o.alive && o.ownerId === e.id).length;
    if (mine >= b.maxAlive) return;
    e.special.summonAt = sim.time + b.windup;
    sim.emit({ type: 'scream', entity: e });
    sim.addTelegraph(e.x, e.y, 50, b.windup, 'summon');
  },
  slowAura: (sim, e, b: Extract<BehaviorDef, { type: 'slowAura' }>, i, dt) => {
    if (!every(e, i, dt, 0.3)) return;
    sim.queryRadius(e.x, e.y, b.radius + 10, (o) => {
      if (o.alive && o.team === 'enemy' && !isFlying(o) && o.kind !== 'boss' && dist(o, e) <= b.radius + o.radius)
        applyStatus(sim, o, { type: 'slow', duration: 0.5, power: b.power }, e.id);
    });
  },
  deathBurst: () => {},
  deathEnergy: () => {},
};

// ---------------------------------------------------------------------------
// Ação por frame: comportamentos, ataque com preparação e movimento
// ---------------------------------------------------------------------------

export function updateEntity(sim: BattleSim, e: Entity, dt: number) {
  e.attackCd -= dt;
  const stunned = !!getStatus(e, 'stun');
  if (stunned) {
    e.vx = e.vy = 0;
    e.windupLeft = 0;
    e.state = 'stunned';
    BOSS_UPDATE[e.def.ai]?.(sim, e, dt);
    return;
  }
  if (e.state === 'stunned') e.state = 'idle';
  BOSS_UPDATE[e.def.ai]?.(sim, e, dt);

  const behaviors = e.def.behaviors;
  if (behaviors) for (let i = 0; i < behaviors.length; i++) BEHAVIORS[behaviors[i].type](sim, e, behaviors[i], i, dt);

  if (e.def.ai === 'trap') return updateTrap(sim, e);
  if (e.def.ai === 'static' || e.def.ai === 'nest') return;

  e.aiTimer -= dt;
  if (e.aiTimer <= 0) {
    e.aiTimer = COMBAT.aiTickSeconds + sim.rng.range(0, 0.1);
    THINK[e.def.ai]?.(sim, e);
  }

  // Chefes podem estar canalizando um ataque especial: ficam parados.
  if (e.state === 'channel') {
    e.vx = e.vy = 0;
    return;
  }

  const target = sim.get(e.targetId);
  const atk = e.def.attack;

  if (e.state === 'windup') {
    e.vx = e.vy = 0;
    e.windupLeft -= dt;
    if (e.windupLeft <= 0) {
      executeAttack(sim, e);
      e.state = 'recover';
    }
    return;
  }

  if (atk && validTarget(e, target) && !isDisabled(sim, e)) {
    const inRange = gap(e, target) <= attackRange(sim, e);
    if (inRange) {
      e.vx = e.vy = 0;
      if (Math.abs(target.x - e.x) > 2) e.facing = target.x > e.x ? 1 : -1;
      if (e.attackCd <= 0) {
        e.windupTargetId = target.id;
        e.attackCd = atk.interval;
        if (atk.windup > 0) {
          e.state = 'windup';
          e.windupLeft = atk.windup;
          sim.emit({ type: 'windup', entity: e, duration: atk.windup });
        } else executeAttack(sim, e);
      } else if (e.state !== 'recover') e.state = 'idle';
      return;
    }
  }

  if (e.def.speed <= 0) return;
  const mode = e.special.moveMode ?? MOVE_NONE;
  e.state = 'move';
  if (mode === MOVE_TARGET && target && target.alive) {
    const stop = atk ? Math.max(0, attackRange(sim, e) * 0.85) + e.radius + target.radius : e.radius + target.radius;
    moveToward(sim, e, target.x, target.y, dt, Math.min(stop, dist(e, target)));
  } else if (mode === MOVE_FIELD) {
    moveAlongField(sim, e, fieldFor(e), dt);
  } else if (mode === MOVE_POINT) {
    moveToward(sim, e, e.special.mx ?? e.x, e.special.my ?? e.y, dt, 4);
  } else {
    e.vx = e.vy = 0;
    e.state = 'idle';
  }
}

export function executeAttack(sim: BattleSim, e: Entity) {
  const atk = e.def.attack;
  if (!atk) return;
  const t = sim.get(e.windupTargetId);
  if (!validTarget(e, t) || gap(e, t) > attackRange(sim, e) + 24) {
    return;
  }
  sim.emit({ type: 'attack', entity: e, targetId: t.id, tx: t.x, ty: t.y });
  if (atk.kind === 'melee') {
    resolveHit(sim, e, t, t.x, t.y, atk, e.team);
  } else {
    sim.fireProjectile(e, t, atk);
  }
}

function updateTrap(sim: BattleSim, e: Entity) {
  const atk = e.def.attack!;
  if (e.attackCd > 0) return;
  let triggered = false;
  sim.queryRadius(e.x, e.y, e.def.aggroRange + 12, (o) => {
    if (triggered || !o.alive || o.team !== 'enemy' || isFlying(o) || o.spawnDelay > 0) return;
    if (dist(o, e) <= e.def.aggroRange + o.radius) triggered = true;
  });
  if (!triggered) return;
  e.attackCd = atk.interval;
  sim.emit({ type: 'trapTrigger', entity: e });
  resolveHit(sim, e, undefined, e.x, e.y, atk, 'player');
  e.charges--;
  if (e.charges <= 0) sim.kill(e, 0);
}
