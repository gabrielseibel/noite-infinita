import type { BattleSim } from './BattleSim';
import { canTargetLayer, getStatus, isFlying } from './combat';
import { fieldFor } from './movement';
import type { Entity } from './types';

// ---------------------------------------------------------------------------
// Utilidades de alvo
// ---------------------------------------------------------------------------

export function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Distância borda a borda. */
export function gap(a: Entity, b: Entity) {
  return dist(a, b) - a.radius - b.radius;
}

export function attackRange(sim: BattleSim, e: Entity): number {
  const a = e.def.attack;
  if (!a) return 0;
  let r = a.range * e.rangeMult;
  if (e.team === 'player') r *= sim.mods.allyRangeMult;
  if (e.def.id === 'watchtower') r *= sim.mods.watchtowerRangeMult;
  return r;
}

export function isHostile(a: Entity, b: Entity) {
  if (a.team === b.team) return false;
  if (b.team === 'neutral') return a.team === 'enemy';
  if (a.team === 'neutral') return false;
  return true;
}

/** Alvo pode ser atacado por `e`? */
export function validTarget(e: Entity, t: Entity | undefined): t is Entity {
  if (!t || !t.alive || t.spawnDelay > 0) return false;
  if (!isHostile(e, t)) return false;
  if (t.kind === 'trap') return false;
  const a = e.def.attack;
  if (a && !canTargetLayer(a, t)) return false;
  return true;
}

export function bestTarget(sim: BattleSim, e: Entity, radius: number, score: (t: Entity, d: number) => number, filter?: (t: Entity) => boolean) {
  let best: Entity | undefined;
  let bestScore = Infinity;
  sim.queryRadius(e.x, e.y, radius, (t) => {
    if (!validTarget(e, t)) return;
    if (t.team === 'neutral') return; // destroços só são atacados quando bloqueiam
    if (filter && !filter(t)) return;
    const d = gap(e, t);
    if (d > radius) return;
    const s = score(t, d);
    if (s < bestScore) {
      bestScore = s;
      best = t;
    }
  });
  return best;
}

export function isDisabled(sim: BattleSim, e: Entity) {
  if (getStatus(e, 'disabled')) return true;
  return sim.mods.disablePowered && e.def.tags.includes('powered');
}

// ---------------------------------------------------------------------------
// Pensamento (decisão de alvo/movimento) — executado em intervalos (aiTick)
// ---------------------------------------------------------------------------

export const MOVE_NONE = 0, MOVE_FIELD = 1, MOVE_POINT = 2, MOVE_TARGET = 3;

export function setMove(e: Entity, mode: number, x = 0, y = 0) {
  e.special.moveMode = mode;
  e.special.mx = x;
  e.special.my = y;
}

/** Inimigo comum: prioriza provocação, fugitivo, unidades próximas; senão segue o campo até o núcleo. */
export function enemyThink(sim: BattleSim, e: Entity, scoreFn?: (t: Entity, d: number) => number, filter?: (t: Entity) => boolean, aggroMult = 1) {
  const taunt = getStatus(e, 'taunted');
  if (taunt) {
    const t = sim.get(taunt.sourceId ?? 0);
    if (validTarget(e, t)) {
      e.targetId = t.id;
      setMove(e, MOVE_TARGET);
      return;
    }
  }
  const cur = sim.get(e.targetId);
  const aggro = e.def.aggroRange * aggroMult * (1 - Math.min(0.5, sim.mods.darkness * 0.3));
  // Mantém alvo atual se ainda for válido e próximo (evita tremer entre alvos).
  if (validTarget(e, cur) && gap(e, cur) < aggro + 40 && cur.team !== 'neutral' && cur.kind !== 'core') {
    setMove(e, MOVE_TARGET);
    return;
  }
  const escort = sim.escort;
  if (escort && validTarget(e, escort) && gap(e, escort) < aggro * 1.6) {
    e.targetId = escort.id;
    setMove(e, MOVE_TARGET);
    return;
  }
  const t = bestTarget(sim, e, aggro, scoreFn ?? ((_t, d) => d), filter);
  if (t) {
    e.targetId = t.id;
    setMove(e, MOVE_TARGET);
    return;
  }
  // Núcleo ao alcance?
  const core = sim.core;
  if (core.alive && validTarget(e, core) && gap(e, core) <= Math.max(attackRange(sim, e), 20) + 6) {
    e.targetId = core.id;
    setMove(e, MOVE_TARGET);
    return;
  }
  // Bloqueado por estrutura no caminho?
  if (!isFlying(e)) {
    const field = fieldFor(e);
    const g = sim.grid;
    const c = g.cellOf(e.x, e.y);
    const n = g.nextCell(field, c);
    const low = e.def.tags.includes('low');
    for (const cell of [c, n]) {
      if (cell < 0) continue;
      const sid = g.structureAt[cell];
      if (sid && !(low && g.lowAt[cell])) {
        const s = sim.get(sid);
        if (s && s.alive && isHostile(e, s) && (!e.def.attack || canTargetLayer(e.def.attack, s))) {
          e.targetId = s.id;
          setMove(e, MOVE_TARGET);
          return;
        }
      }
    }
    e.targetId = 0;
    setMove(e, MOVE_FIELD);
  } else {
    e.targetId = 0;
    setMove(e, MOVE_POINT, core.x, core.y);
  }
}

export function alliesNear(sim: BattleSim, t: Entity, r: number) {
  let n = 0;
  sim.queryRadius(t.x, t.y, r, (o) => {
    if (o !== t && o.alive && o.team === t.team && (o.kind === 'unit' || o.kind === 'structure')) n++;
  });
  return n;
}

