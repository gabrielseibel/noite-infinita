import { describe, expect, it } from 'vitest';
import { SaveSystem, sanitize, defaultSave, type StorageLike } from '../src/systems/SaveSystem';
import { applyResult, buyCard, buyUpgrade, computeRewards, isMissionUnlocked } from '../src/systems/ProgressionSystem';
import { MISSION_BY_ID } from '../src/data/missions';
import { STARTER_DECK } from '../src/data/cards';
import { makeSim } from './helpers';
import { BattleSim } from '../src/sim/BattleSim';
import type { BattleResult } from '../src/sim/types';

class MemStorage implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const win = (stars = 3): BattleResult => ({ victory: true, reason: 'survive', time: 120, coreHpPct: 1, stars, stats: makeSim().stats });

describe('salvamento', () => {
  it('persiste e recarrega', () => {
    const st = new MemStorage();
    const a = new SaveSystem(st, 'k');
    a.data.shards = 123;
    a.data.settings.musicVolume = 0.2;
    a.save();
    const b = new SaveSystem(st, 'k');
    expect(b.data.shards).toBe(123);
    expect(b.data.settings.musicVolume).toBe(0.2);
  });
  it('resiste a JSON inválido, tipos errados e dados ausentes', () => {
    const st = new MemStorage();
    st.setItem('k', '{isto não é json');
    expect(new SaveSystem(st, 'k').data).toEqual(defaultSave());
    const d = sanitize({ shards: 'muito', deck: ['xyz'], upgrades: { treated_wood: 99, fake: 3 }, settings: { musicVolume: 7 }, completed: { m1: { stars: 9 }, zz: {} } });
    expect(d.shards).toBe(0);
    expect(d.deck).toEqual(STARTER_DECK);
    expect(d.upgrades).toEqual({ treated_wood: 3 });
    expect(d.settings.musicVolume).toBe(1);
    expect(d.completed.m1.stars).toBe(3);
    expect(d.completed.zz).toBeUndefined();
    expect(d.tutorialDone).toBe(true);
    expect(sanitize(null).version).toBe(2);
    expect(sanitize([1, 2]).shards).toBe(0);
  });
  it('migra versão antiga', () => {
    const d = sanitize({ version: 1, coins: 50 });
    expect(d.shards).toBe(50);
  });
});

describe('progressão', () => {
  it('vitória concede fragmentos, conclui missão e desbloqueia cartas e a próxima missão', () => {
    const s = defaultSave();
    const m = MISSION_BY_ID.m1;
    const r = computeRewards(s, m, win());
    expect(r.firstClear).toBe(true);
    expect(r.unlockedCards).toContain('engineer');
    applyResult(s, m, win(), r);
    expect(s.shards).toBe(r.shards);
    expect(s.completed.m1.stars).toBe(3);
    expect(s.unlockedCards).toContain('engineer');
    expect(isMissionUnlocked(s, MISSION_BY_ID.m2)).toBe(true);
    // repetir rende menos
    expect(computeRewards(s, m, win()).shards).toBeLessThan(r.shards);
  });
  it('compras respeitam saldo, pré-requisitos e níveis máximos', () => {
    const s = defaultSave();
    expect(buyUpgrade(s, 'treated_wood').ok).toBe(false);
    s.shards = 10000;
    expect(buyUpgrade(s, 'shelter_walls').ok).toBe(false); // requer madeira tratada
    for (let i = 0; i < 3; i++) expect(buyUpgrade(s, 'treated_wood').ok).toBe(true);
    expect(buyUpgrade(s, 'treated_wood').ok).toBe(false);
    expect(buyUpgrade(s, 'shelter_walls').ok).toBe(true);
    expect(buyCard(s, 'reaper').ok).toBe(true);
    expect(buyCard(s, 'reaper').ok).toBe(false);
  });
  it('melhorias produzem efeitos reais na batalha', () => {
    const base = makeSim('m2');
    const mission = MISSION_BY_ID.m2;
    const up = new BattleSim({ mission, deck: STARTER_DECK, seed: 1, upgradeLevels: { treated_wood: 3, shelter_walls: 2, patched_generator: 3 } });
    expect(up.core.maxHp).toBeGreaterThan(base.core.maxHp);
    expect(up.energy.ratePerSecond).toBeGreaterThan(base.energy.ratePerSecond);
    const b1 = base.spawnActor('barricade', 'player', 300, 300, { noDelay: true });
    const b2 = up.spawnActor('barricade', 'player', 300, 300, { noDelay: true });
    expect(b2.maxHp).toBeGreaterThan(b1.maxHp);
  });
});
