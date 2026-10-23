import { COMBAT } from '../data/balance';
import type { BattleSim } from './BattleSim';
import type { AttackDef, DamageType, Entity, StatusApply, StatusType, Tag } from './types';

export function hasTag(e: Entity, t: Tag) {
  return e.def.tags.includes(t);
}

export function isFlying(e: Entity) {
  return e.def.tags.includes('flying');
}

export function isStructureLike(e: Entity) {
  return e.kind === 'structure' || e.kind === 'core' || e.kind === 'nest' || e.kind === 'trap';
}

export function getStatus(e: Entity, type: StatusType) {
  for (const s of e.statuses) if (s.type === type) return s;
  return undefined;
}

export function canTargetLayer(attack: AttackDef, target: Entity) {
  if (attack.targets === 'both') return true;
  return attack.targets === 'air' ? isFlying(target) : !isFlying(target);
}

export function applyStatus(sim: BattleSim, e: Entity, s: StatusApply, sourceId = 0) {
  if (!e.alive) return;
  if (s.onlyTag && !hasTag(e, s.onlyTag)) return;
  let duration = s.duration;
  // Chefes resistem a controle de grupo.
  if ((s.type === 'stun' || s.type === 'slow') && e.kind === 'boss') duration *= 0.4;
  if (isStructureLike(e) && (s.type === 'stun' || s.type === 'slow' || s.type === 'poison' || s.type === 'burn')) return;
  const cur = getStatus(e, s.type);
  if (cur) {
    cur.remaining = Math.max(cur.remaining, duration);
    cur.power = Math.max(cur.power, s.power);
    cur.sourceId = sourceId;
  } else {
    e.statuses.push({ type: s.type, remaining: duration, power: s.power, sourceId, tick: 0 });
    sim.emit({ type: 'status', entity: e, status: s.type });
  }
  if (s.type === 'stun') {
    e.windupLeft = 0;
    e.state = 'stunned';
  }
}

export function updateStatuses(sim: BattleSim, e: Entity, dt: number) {
  for (let i = e.statuses.length - 1; i >= 0; i--) {
    const s = e.statuses[i];
    s.remaining -= dt;
    if (s.type === 'burn' || s.type === 'poison') {
      s.tick = (s.tick ?? 0) + dt;
      if (s.tick >= 0.5) {
        s.tick -= 0.5;
        const src = sim.get(s.sourceId ?? 0);
        dealDamage(sim, src, e, s.power * 0.5, s.type === 'burn' ? 'fire' : 'poison', { noCrit: true, silentSmall: true });
      }
    }
    if (s.remaining <= 0) {
      e.statuses.splice(i, 1);
      if (s.type === 'stun' && e.state === 'stunned') e.state = 'idle';
    }
  }
}

export interface DamageOpts {
  attack?: AttackDef;
  crit?: boolean;
  noCrit?: boolean;
  silentSmall?: boolean;
  multiplier?: number;
}

/** Calcula o multiplicador total entre atacante e alvo (sem aplicar). */
export function damageMultiplier(sim: BattleSim, source: Entity | undefined, target: Entity, type: DamageType, attack?: AttackDef) {
  let m = 1;
  if (source) {
    m *= source.damageMult;
    if (source.team === 'enemy') m *= sim.mods.enemyDamageMult;
    if ((source.special.auraUntil ?? 0) > sim.time) m *= source.special.auraDmg ?? 1;
  }
  if (attack?.bonusVs) for (const [tag, mult] of Object.entries(attack.bonusVs)) if (hasTag(target, tag as Tag) || (tag === 'elite' && target.elite)) m *= mult!;
  if (attack?.vsStructures && isStructureLike(target)) m *= attack.vsStructures;
  if (type === 'physical' && hasTag(target, 'ethereal')) m *= COMBAT.etherealPhysicalMult;
  if (type === 'physical' && target.def.armor) m *= 1 - target.def.armor;
  if (type === 'fire') m *= sim.mods.fireMult;
  const vul = getStatus(target, 'vulnerable');
  if (vul) m *= vul.power;
  const rein = getStatus(target, 'reinforced');
  if (rein) m *= 1 - rein.power;
  if (target.special.damageReduction) m *= 1 - target.special.damageReduction;
  return m;
}

export function dealDamage(sim: BattleSim, source: Entity | undefined, target: Entity, base: number, type: DamageType, opts: DamageOpts = {}) {
  if (!target.alive || target.spawnDelay > 0) return 0;
  let crit = !!opts.crit;
  if (!opts.noCrit && !crit && opts.attack?.critChance && sim.rng.chance(opts.attack.critChance)) crit = true;
  let amount = base * damageMultiplier(sim, source, target, type, opts.attack) * (opts.multiplier ?? 1);
  if (crit) amount *= COMBAT.critMult;
  amount = Math.max(1, Math.round(amount));
  target.hp -= amount;
  target.lastHitBy = source?.id ?? 0;
  if (source?.team === 'player') sim.stats.damageDealt += amount;
  if (target.team === 'player') sim.stats.damageTaken += amount;
  sim.emit({ type: 'damage', entity: target, amount, crit, damageType: type, sourceId: source?.id ?? 0 });
  if (target.kind === 'core') sim.onCoreDamaged();
  if (target.kind === 'nest') sim.onNestDamaged();
  if (target.hp <= 0) sim.kill(target, source?.id ?? 0);
  return amount;
}

export function heal(sim: BattleSim, target: Entity, amount: number) {
  if (!target.alive || target.hp >= target.maxHp) return 0;
  const real = Math.min(amount, target.maxHp - target.hp);
  target.hp += real;
  if (real >= 1) sim.emit({ type: 'heal', entity: target, amount: Math.round(real) });
  return real;
}

/** Aplica um golpe (corpo a corpo ou impacto de projétil), incluindo dano em área e efeitos. */
export function resolveHit(sim: BattleSim, source: Entity | undefined, primary: Entity | undefined, x: number, y: number, attack: AttackDef, team: 'player' | 'enemy' | 'neutral', mult = 1, crit = false) {
  const first = source && attack.firstHitMultiplier && source.hitsDone === 0 ? attack.firstHitMultiplier : 1;
  const dmg = attack.damage * mult * first;
  const hitOne = (t: Entity, m: number) => {
    if (!canTargetLayer(attack, t)) return;
    dealDamage(sim, source, t, dmg * m, attack.damageType, { attack, crit: crit || first > 1 });
    if (attack.onHit) for (const s of attack.onHit) applyStatus(sim, t, s, source?.id ?? 0);
  };
  if (attack.splash) {
    sim.queryRadius(x, y, attack.splash, (t) => {
      if (!t.alive || t.team === team || t.team === 'neutral' && team !== 'enemy') return;
      if (t.kind === 'trap') return;
      hitOne(t, t === primary ? 1 : 0.75);
    });
    if (primary && primary.alive && Math.hypot(primary.x - x, primary.y - y) > attack.splash + primary.radius) hitOne(primary, 1);
  } else if (primary) {
    hitOne(primary, 1);
  }
  if (source) source.hitsDone++;
}
