import { COMBAT } from '../data/balance';
import type { BattleSim } from './BattleSim';
import type { FieldId } from './grid';
import { getStatus, isFlying } from './combat';
import type { Entity } from './types';

export function effectiveSpeed(sim: BattleSim, e: Entity): number {
  if (getStatus(e, 'stun')) return 0;
  let s = e.def.speed * e.speedMult;
  if (e.team === 'enemy') s *= sim.mods.enemySpeedMult;
  if ((e.special.auraUntil ?? 0) > sim.time) s *= e.special.auraSpd ?? 1;
  const slow = getStatus(e, 'slow');
  if (slow) s *= 1 - Math.min(0.8, slow.power);
  if (!isFlying(e) && sim.grid.isMudAt(e.x, e.y)) s *= 0.65;
  return s;
}

/** Campo de fluxo usado por cada inimigo, conforme suas características. */
export function fieldFor(e: Entity): FieldId {
  if (e.team === 'player') return e.kind === 'escort' ? 'free' : 'allyNest';
  if (e.def.ai === 'flanker') return 'flank';
  if (e.def.tags.includes('low')) return 'low';
  return 'ground';
}

function step(sim: BattleSim, e: Entity, dx: number, dy: number, speed: number, dt: number) {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return;
  const mx = (dx / len) * speed * dt, my = (dy / len) * speed * dt;
  e.vx = mx / dt;
  e.vy = my / dt;
  if (Math.abs(mx) > 0.05) e.facing = mx > 0 ? 1 : -1;
  if (isFlying(e)) {
    e.x += mx;
    e.y += my;
    return;
  }
  // Deslizamento por eixo para não atravessar obstáculos estáticos.
  const g = sim.grid;
  if (!g.isBlockedAt(e.x + mx, e.y + my)) {
    e.x += mx;
    e.y += my;
  } else if (!g.isBlockedAt(e.x + mx, e.y)) e.x += mx;
  else if (!g.isBlockedAt(e.x, e.y + my)) e.y += my;
}

/** Move em direção a um ponto. Usa linha reta com visão livre; caso contrário, A* com cache. */
export function moveToward(sim: BattleSim, e: Entity, tx: number, ty: number, dt: number, stopDist = 0) {
  const speed = effectiveSpeed(sim, e);
  if (speed <= 0) return;
  const d = Math.hypot(tx - e.x, ty - e.y);
  if (d <= stopDist) {
    e.vx = e.vy = 0;
    return;
  }
  if (isFlying(e) || sim.grid.lineOfSight(e.x, e.y, tx, ty)) {
    e.path = null;
    step(sim, e, tx - e.x, ty - e.y, Math.min(speed, (d - stopDist) / dt), dt);
    return;
  }
  const goalCell = sim.grid.cellOf(tx, ty);
  e.pathTimer -= dt;
  if (!e.path || e.pathTimer <= 0 || e.pathGoalCell !== goalCell) {
    if (e.pathTimer <= 0 || !e.path) {
      e.path = sim.grid.findPath(e.x, e.y, tx, ty);
      e.pathGoalCell = goalCell;
      e.pathTimer = COMBAT.pathRepathSeconds + sim.rng.range(0, 0.3);
    }
  }
  if (!e.path || !e.path.length) {
    step(sim, e, tx - e.x, ty - e.y, speed, dt);
    return;
  }
  let wp = e.path[0];
  if (Math.hypot(wp.x - e.x, wp.y - e.y) < 10 && e.path.length > 1) {
    e.path.shift();
    wp = e.path[0];
  }
  step(sim, e, wp.x - e.x, wp.y - e.y, speed, dt);
}

/** Segue o campo de fluxo até o objetivo (núcleo ou ninho). Retorna a célula seguinte. */
export function moveAlongField(sim: BattleSim, e: Entity, field: FieldId, dt: number): number {
  const speed = effectiveSpeed(sim, e);
  const g = sim.grid;
  const c = g.cellOf(e.x, e.y);
  let n = g.nextCell(field, c);
  if (n < 0) {
    if (!g.blocked[c]) return -1; // já no objetivo
    // empurrado para dentro de obstáculo: volte à célula livre mais próxima
    const free = g.nearestFree(c);
    if (free >= 0 && free !== c) {
      const p = g.cellCenter(free);
      step(sim, e, p.x - e.x, p.y - e.y, speed, dt);
    }
    return -1;
  }
  if (speed <= 0) return n;
  // Olha duas células à frente para suavizar a curva.
  const n2 = g.nextCell(field, n);
  const target = g.cellCenter(n2 >= 0 && !g.structureAt[n] ? n2 : n);
  step(sim, e, target.x - e.x, target.y - e.y, speed, dt);
  return n;
}
