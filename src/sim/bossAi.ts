import { BOSS_CONFIG } from '../data/bosses';
import type { BattleSim } from './BattleSim';
import { applyStatus, dealDamage, isStructureLike } from './combat';
import { alliesNear, dist, enemyThink, validTarget } from './targeting';
import type { AiId, Entity } from './types';

/** Decisão de alvo dos chefes (intervalada). */
export const BOSS_THINK: Partial<Record<AiId, (sim: BattleSim, e: Entity) => void>> = {
  butcher: (sim, e) => enemyThink(sim, e),
  matriarch: (sim, e) => enemyThink(sim, e),
  faceless: (sim, e) => {
    // Prefere a unidade isolada mais próxima.
    enemyThink(sim, e, (t, d) => d + alliesNear(sim, t, 120) * 80);
  },
};

function cancelChannel(e: Entity) {
  e.special.channelAt = 0;
  e.state = 'idle';
}

/** Atualização por frame dos ataques especiais (telegrafados) dos chefes. */
export const BOSS_UPDATE: Partial<Record<AiId, (sim: BattleSim, e: Entity, dt: number) => void>> = {
  butcher: (sim, e) => {
    const cfg = BOSS_CONFIG.butcher.slam!;
    if (e.special.nextSlam === undefined) e.special.nextSlam = sim.time + cfg.interval * 0.6;
    if (e.special.channelAt) {
      if (e.state !== 'channel') return cancelChannel(e);
      if (sim.time < e.special.channelAt) return;
      const x = e.special.sx, y = e.special.sy;
      sim.emit({ type: 'slam', entity: e, x, y, radius: cfg.radius });
      sim.queryRadius(x, y, cfg.radius + 30, (t) => {
        if (!t.alive || t.team === 'enemy' || t.kind === 'trap') return;
        if (dist(t, { x, y }) > cfg.radius + t.radius) return;
        dealDamage(sim, e, t, cfg.damage * (isStructureLike(t) ? cfg.vsStructures : 1), 'physical');
      });
      cancelChannel(e);
      // Golpe pesado deixa o Açougueiro exposto.
      e.statuses.push({ type: 'vulnerable', remaining: cfg.vulnerable, power: cfg.vulnerableMult });
      e.statuses.push({ type: 'stun', remaining: cfg.vulnerable, power: 1 });
      sim.emit({ type: 'status', entity: e, status: 'vulnerable' });
      e.special.nextSlam = sim.time + cfg.interval + cfg.vulnerable;
      return;
    }
    if (sim.time < e.special.nextSlam) return;
    const t = sim.get(e.targetId);
    if (!validTarget(e, t) || dist(e, t) > 170) return;
    e.state = 'channel';
    e.special.channelAt = sim.time + cfg.telegraph;
    // Golpe acontece entre o chefe e o alvo
    const k = Math.min(1, 60 / Math.max(1, dist(e, t)));
    e.special.sx = e.x + (t.x - e.x) * Math.max(k, 0.6);
    e.special.sy = e.y + (t.y - e.y) * Math.max(k, 0.6);
    sim.addTelegraph(e.special.sx, e.special.sy, cfg.radius, cfg.telegraph, 'slam');
    sim.emit({ type: 'windup', entity: e, duration: cfg.telegraph });
  },
  matriarch: (sim, e) => {
    const cfg = BOSS_CONFIG.matriarch.brood!;
    if (e.special.nextBrood === undefined) e.special.nextBrood = sim.time + 3;
    // Redução de dano proporcional às crias vivas próximas.
    let broods = 0;
    sim.queryRadius(e.x, e.y, cfg.radius, (o) => {
      if (o.alive && o.ownerId === e.id) broods++;
    });
    e.special.damageReduction = Math.min(cfg.maxReduction, broods * cfg.reductionPerBrood);
    if (e.special.channelAt) {
      if (e.state !== 'channel') return cancelChannel(e);
      if (sim.time < e.special.channelAt) return;
      sim.emit({ type: 'summon', entity: e });
      for (let k = 0; k < cfg.count; k++) {
        const a = (Math.PI * 2 * k) / cfg.count + sim.rng.range(0, 0.5);
        sim.spawnEnemyNear(cfg.actor, e.x + Math.cos(a) * 42, e.y + Math.sin(a) * 42, { ownerId: e.id });
      }
      cancelChannel(e);
      e.special.nextBrood = sim.time + cfg.interval;
      return;
    }
    if (sim.time < e.special.nextBrood) return;
    const alive = sim.entities.filter((o) => o.alive && o.ownerId === e.id).length;
    if (alive >= cfg.maxAlive) {
      e.special.nextBrood = sim.time + 2;
      return;
    }
    e.state = 'channel';
    e.special.channelAt = sim.time + cfg.telegraph;
    sim.addTelegraph(e.x, e.y, 70, cfg.telegraph, 'summon');
    sim.emit({ type: 'scream', entity: e });
  },
  faceless: (sim, e) => {
    const cfg = BOSS_CONFIG.faceless.faceless!;
    if (e.special.nextTp === undefined) e.special.nextTp = sim.time + 4;
    if ((e.special.nextDark ?? 0) <= sim.time) {
      e.special.nextDark = sim.time + 0.3;
      sim.queryRadius(e.x, e.y, cfg.darkRadius, (o) => {
        if (o.alive && o.team === 'player' && o.kind === 'structure' && o.def.attack && dist(o, e) <= cfg.darkRadius)
          applyStatus(sim, o, { type: 'disabled', duration: 0.7, power: 1 }, e.id);
      });
    }
    if (e.special.channelAt) {
      if (e.state !== 'channel') return cancelChannel(e);
      if (sim.time < e.special.channelAt) return;
      const fromX = e.x, fromY = e.y;
      if (!sim.grid.isBlockedAt(e.special.sx, e.special.sy)) {
        e.x = e.special.sx;
        e.y = e.special.sy;
      }
      e.path = null;
      e.targetId = e.special.tpTarget;
      e.attackCd = Math.min(e.attackCd, 0.3);
      sim.emit({ type: 'teleport', entity: e, fromX, fromY });
      cancelChannel(e);
      e.special.nextTp = sim.time + cfg.interval;
      return;
    }
    if (sim.time < e.special.nextTp) return;
    let best: Entity | undefined;
    let bestScore = Infinity;
    sim.queryRadius(e.x, e.y, cfg.jump, (o) => {
      if (!o.alive || o.team !== 'player' || (o.kind !== 'unit' && o.kind !== 'escort') || o.def.tags.includes('flying')) return;
      const s = dist(o, e) * 0.5 + alliesNear(sim, o, 120) * 120;
      if (s < bestScore) {
        bestScore = s;
        best = o;
      }
    });
    if (!best) {
      e.special.nextTp = sim.time + 1.5;
      return;
    }
    const b: Entity = best;
    const ang = Math.atan2(e.y - b.y, e.x - b.x);
    e.special.sx = b.x + Math.cos(ang) * 34;
    e.special.sy = b.y + Math.sin(ang) * 34;
    e.special.tpTarget = b.id;
    e.state = 'channel';
    e.special.channelAt = sim.time + cfg.telegraph;
    sim.addTelegraph(e.special.sx, e.special.sy, 40, cfg.telegraph, 'teleport');
  },
};
