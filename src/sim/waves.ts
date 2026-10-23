import type { MissionDef, SpawnGroup, WaveDef } from '../data/missions';
import type { SpawnId } from '../data/maps';
import type { Rng } from './rng';

export interface PendingSpawn {
  at: number;
  enemy: string;
  spawn: SpawnId;
  elite: boolean;
  waveIndex: number;
  boss: boolean;
}

export interface WaveHooks {
  onWave(index: number, wave: WaveDef): void;
  onSpawn(p: PendingSpawn): void;
}

const SPAWN_ORDER: SpawnId[] = ['nest', 'north', 'south'];
const ENDLESS_POOL: { id: string; from: number; weight: number; cost: number }[] = [
  { id: 'wanderer', from: 0, weight: 5, cost: 1 },
  { id: 'runner', from: 1, weight: 3, cost: 1 },
  { id: 'crawler', from: 2, weight: 2, cost: 1 },
  { id: 'spitter', from: 3, weight: 2, cost: 2 },
  { id: 'brute', from: 3, weight: 1, cost: 4 },
  { id: 'parasite', from: 4, weight: 2, cost: 2 },
  { id: 'specter', from: 5, weight: 2, cost: 2 },
  { id: 'abyss_spider', from: 6, weight: 2, cost: 2 },
  { id: 'screamer', from: 7, weight: 1, cost: 4 },
  { id: 'devourer', from: 9, weight: 1, cost: 8 },
];
const ENDLESS_BOSSES = ['butcher', 'matriarch', 'faceless'];

/** Linha do tempo das ondas. O tempo pode ser congelado (tutorial) com `hold`. */
export class WaveSystem {
  time = 0;
  index = 0;
  hold = false;
  readonly waves: WaveDef[];
  pending: PendingSpawn[] = [];
  private loops = 0;
  private endlessCount = 0;

  constructor(private mission: MissionDef, private rng: Rng, private hooks: WaveHooks) {
    this.waves = mission.waves.map((w) => ({ ...w, groups: w.groups.map((g) => ({ ...g })) }));
    if (mission.endless) this.appendEndlessWave(3);
  }

  get totalWaves(): number {
    return this.mission.endless || this.mission.loopFrom !== undefined ? Infinity : this.waves.length;
  }

  get allSpawned(): boolean {
    return this.totalWaves !== Infinity && this.index >= this.waves.length && this.pending.length === 0;
  }

  get lastWaveAt(): number {
    return this.waves.length ? this.waves[this.waves.length - 1].at : 0;
  }

  get timeToNext(): number {
    const w = this.waves[this.index];
    return w ? Math.max(0, w.at - this.time) : 0;
  }

  update(dt: number) {
    if (!this.hold) this.time += dt;
    while (this.index < this.waves.length && this.waves[this.index].at <= this.time) {
      this.startWave(this.index);
      this.index++;
      this.extendIfNeeded();
    }
    if (this.pending.length) {
      // pendentes ficam ordenados por tempo
      while (this.pending.length && this.pending[0].at <= this.time) this.hooks.onSpawn(this.pending.shift()!);
    }
  }

  /** Força a próxima onda imediatamente (tutorial / botão "chamar onda"). */
  callNext() {
    const w = this.waves[this.index];
    if (!w) return;
    const shift = w.at - this.time;
    if (shift > 0) for (let i = this.index; i < this.waves.length; i++) this.waves[i].at -= shift;
  }

  enqueueGroups(groups: SpawnGroup[], waveIndex: number, delay = 0) {
    for (const g of groups) this.enqueueGroup(g, waveIndex, delay, false);
  }

  private startWave(i: number) {
    const w = this.waves[i];
    this.hooks.onWave(i, w);
    for (const g of w.groups) this.enqueueGroup(g, i, 0, false);
    if (w.boss) this.push({ at: this.time + 4, enemy: w.boss, spawn: 'nest', elite: false, waveIndex: i, boss: true });
  }

  private enqueueGroup(g: SpawnGroup, waveIndex: number, delay: number, boss: boolean) {
    const spacing = g.spacing ?? 0.9;
    for (let k = 0; k < g.count; k++) {
      const spawn: SpawnId = g.spawn === 'all' || !g.spawn ? (g.spawn === 'all' ? SPAWN_ORDER[k % 3] : 'nest') : g.spawn;
      this.push({ at: this.time + delay + (g.delay ?? 0) + k * spacing, enemy: g.enemy, spawn, elite: !!g.elite, waveIndex, boss });
    }
  }

  private push(p: PendingSpawn) {
    let i = this.pending.length;
    while (i > 0 && this.pending[i - 1].at > p.at) i--;
    this.pending.splice(i, 0, p);
  }

  private extendIfNeeded() {
    if (this.index < this.waves.length) return;
    if (this.mission.endless) {
      this.appendEndlessWave(this.time + 26);
    } else if (this.mission.loopFrom !== undefined) {
      this.loops++;
      const base = this.mission.waves.slice(this.mission.loopFrom);
      const interval = this.mission.loopInterval ?? 30;
      let t = this.time + interval;
      for (const w of base) {
        this.waves.push({
          at: t,
          label: `Pressão contínua ${this.loops + 1}`,
          groups: w.groups.map((g) => ({ ...g, count: Math.ceil(g.count * (1 + 0.25 * this.loops)), elite: g.elite || (this.loops >= 2 && this.rng.chance(0.3)) })),
        });
        t += interval;
      }
    }
  }

  private appendEndlessWave(at: number) {
    const n = this.endlessCount++;
    let budget = 8 + n * 4;
    const pool = ENDLESS_POOL.filter((p) => n >= p.from);
    const counts: Record<string, number> = {};
    let guard = 0;
    while (budget > 0 && guard++ < 200) {
      const total = pool.reduce((s, p) => s + p.weight, 0);
      let r = this.rng.next() * total;
      let pick = pool[0];
      for (const p of pool) {
        r -= p.weight;
        if (r <= 0) {
          pick = p;
          break;
        }
      }
      if (pick.cost > budget) continue;
      budget -= pick.cost;
      counts[pick.id] = (counts[pick.id] ?? 0) + 1;
    }
    const groups: SpawnGroup[] = Object.entries(counts).map(([enemy, count]) => ({ enemy, count, spawn: 'all', spacing: 0.5, elite: n >= 6 && this.rng.chance(0.15) }));
    const boss = n > 0 && n % 6 === 5 ? ENDLESS_BOSSES[Math.floor(n / 6) % 3] : undefined;
    this.waves.push({ at, groups, boss, label: `Noite ${n + 1}` });
  }
}
