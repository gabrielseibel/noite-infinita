import { EVENT_BY_ID, type EventDef, type EventMods } from '../data/events';
import type { MissionDef } from '../data/missions';
import type { Rng } from './rng';

export interface BattleMods {
  enemyDamageMult: number;
  enemySpeedMult: number;
  fireMult: number;
  allyRangeMult: number;
  darkness: number;
  disablePowered: boolean;
  watchtowerRangeMult: number;
  rain: boolean;
  fog: number;
}

export const neutralMods = (): BattleMods => ({
  enemyDamageMult: 1, enemySpeedMult: 1, fireMult: 1, allyRangeMult: 1, darkness: 0,
  disablePowered: false, watchtowerRangeMult: 1, rain: false, fog: 0,
});

export function applyMods(m: BattleMods, e: EventMods) {
  if (e.enemyDamageMult) m.enemyDamageMult *= e.enemyDamageMult;
  if (e.enemySpeedMult) m.enemySpeedMult *= e.enemySpeedMult;
  if (e.fireMult) m.fireMult *= e.fireMult;
  if (e.allyRangeMult) m.allyRangeMult *= e.allyRangeMult;
  if (e.watchtowerRangeMult) m.watchtowerRangeMult *= e.watchtowerRangeMult;
  if (e.darkness) m.darkness += e.darkness;
  if (e.disablePowered) m.disablePowered = true;
  if (e.rain) m.rain = true;
  if (e.fog) m.fog = Math.max(m.fog, e.fog);
}

export interface ActiveEvent {
  def: EventDef;
  remaining: number;
}

export interface DirectorHooks {
  onStart(def: EventDef): void;
  onEnd(def: EventDef): void;
}

/** Agenda eventos fixos e aleatórios (controlados) da missão. */
export class EventDirector {
  scheduled: { id: string; at: number }[];
  active: ActiveEvent[] = [];
  private nextEndless = 70;

  constructor(private mission: MissionDef, private rng: Rng, private hooks: DirectorHooks) {
    this.scheduled = [...mission.events];
    const re = mission.randomEvents;
    if (re && !mission.endless) {
      const span = Math.max(1, re.to - re.from);
      const slot = span / re.count;
      for (let i = 0; i < re.count; i++) {
        this.scheduled.push({ id: rng.pick(re.pool), at: re.from + slot * i + rng.range(0, slot * 0.6) });
      }
    }
    this.scheduled.sort((a, b) => a.at - b.at);
  }

  update(dt: number, time: number) {
    while (this.scheduled.length && this.scheduled[0].at <= time) this.start(this.scheduled.shift()!.id);
    if (this.mission.endless && this.mission.randomEvents && time >= this.nextEndless) {
      this.nextEndless = time + this.rng.range(70, 100);
      this.start(this.rng.pick(this.mission.randomEvents.pool));
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.remaining -= dt;
      if (a.remaining <= 0) {
        this.active.splice(i, 1);
        this.hooks.onEnd(a.def);
      }
    }
  }

  start(id: string) {
    const def = EVENT_BY_ID[id];
    if (!def) return;
    const existing = this.active.find((a) => a.def.id === id);
    if (existing) existing.remaining = Math.max(existing.remaining, def.duration);
    else this.active.push({ def, remaining: def.duration });
    this.hooks.onStart(def);
  }

  isActive(id: string) {
    return this.active.some((a) => a.def.id === id);
  }

  computeMods(): BattleMods {
    const m = neutralMods();
    if (this.mission.permanentMods) applyMods(m, this.mission.permanentMods);
    for (const a of this.active) applyMods(m, a.def.mods);
    return m;
  }
}
