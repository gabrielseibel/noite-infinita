import { describe, expect, it } from 'vitest';
import { EnergySystem } from '../src/sim/energy';
import { DeckSystem, validateDeck, averageCost } from '../src/sim/deck';
import { ENERGY } from '../src/data/balance';
import { STARTER_DECK, CARDS } from '../src/data/cards';
import { MISSIONS } from '../src/data/missions';
import { MAPS } from '../src/data/maps';
import { NavGrid } from '../src/sim/grid';
import { dealDamage } from '../src/sim/combat';
import { makeSim, runBattle } from './helpers';

describe('energia', () => {
  it('regenera até o máximo e não passa dele', () => {
    const e = new EnergySystem(0, 10);
    e.update(ENERGY.secondsPerPoint);
    expect(e.value).toBeCloseTo(1, 5);
    e.update(1000);
    expect(e.value).toBe(10);
  });
  it('consome apenas quando há energia suficiente', () => {
    const e = new EnergySystem(3, 10);
    expect(e.spend(4)).toBe(false);
    expect(e.value).toBe(3);
    expect(e.spend(3)).toBe(true);
    expect(e.value).toBe(0);
    expect(e.spent).toBe(3);
  });
  it('fase final dobra a regeneração e melhorias aumentam', () => {
    const a = new EnergySystem(0, 10, 0);
    const b = new EnergySystem(0, 10, 0.12);
    b.phaseMult = 2;
    expect(b.ratePerSecond).toBeCloseTo(a.ratePerSecond * 2 * 1.12, 6);
  });
});

describe('baralho', () => {
  it('mão de 4 com ciclo: carta jogada vai para o fim da fila', () => {
    const d = new DeckSystem([...STARTER_DECK], undefined, false);
    expect(d.hand).toEqual(STARTER_DECK.slice(0, 4));
    expect(d.nextCard).toBe(STARTER_DECK[4]);
    const played = d.play(1);
    expect(played).toBe(STARTER_DECK[1]);
    expect(d.hand[1]).toBe(STARTER_DECK[4]);
    expect(d.queue[d.queue.length - 1]).toBe(STARTER_DECK[1]);
    // após 8 jogadas no mesmo slot, todas as cartas passaram pela mão
    const seen = new Set<string>(d.hand);
    for (let i = 0; i < 8; i++) {
      d.play(0);
      seen.add(d.hand[0]);
    }
    expect(seen.size).toBe(8);
  });
  it('recarga expira com o tempo', () => {
    const d = new DeckSystem([...STARTER_DECK], undefined, false);
    d.play(2, 4);
    expect(d.cooldownOf(STARTER_DECK[2])).toBe(4);
    d.update(4.1);
    expect(d.cooldownOf(STARTER_DECK[2])).toBe(0);
  });
  it('valida regras de montagem', () => {
    expect(validateDeck(STARTER_DECK).ok).toBe(true);
    expect(validateDeck(STARTER_DECK.slice(0, 7)).ok).toBe(false);
    expect(validateDeck([...STARTER_DECK.slice(0, 7), STARTER_DECK[0]]).ok).toBe(false);
    expect(validateDeck(['reaper', ...STARTER_DECK.slice(1)], STARTER_DECK).ok).toBe(false); // não desbloqueada
    const structures = ['watchtower', 'uv_tower', 'barricade', 'spike_trap', 'gunslinger', 'molotov', 'light_pulse', 'wardog'];
    expect(validateDeck(structures).ok).toBe(true);
    expect(validateDeck(['watchtower', 'uv_tower', 'barricade', 'spike_trap', 'molotov', 'light_pulse', 'gunslinger', 'medic']).ok).toBe(true);
    expect(averageCost(STARTER_DECK)).toBeGreaterThan(2);
  });
  it('16 cartas com custos e ids únicos', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(16);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
});

describe('mapas', () => {
  it('todos os pontos de surgimento alcançam o núcleo', () => {
    for (const m of Object.values(MAPS)) {
      const g = new NavGrid(m, 32);
      g.recompute();
      for (const sp of Object.values(m.spawns)) {
        expect(g.distance('ground', sp.cy * m.cols + sp.cx), `${m.id}`).toBeLessThan(1e8);
        expect(g.distance('flank', sp.cy * m.cols + sp.cx), `${m.id}`).toBeLessThan(1e8);
      }
      expect(g.distance('allyNest', m.core.cy * m.cols + m.core.cx + 3)).toBeLessThan(1e8);
    }
  });
});

describe('combate e partida', () => {
  it('dano reduz vida e a morte remove a entidade', () => {
    const sim = makeSim('m2');
    const e = sim.spawnActor('wanderer', 'enemy', 800, 400, { noDelay: true });
    dealDamage(sim, undefined, e, 50, 'light');
    expect(e.hp).toBe(e.maxHp - 50);
    dealDamage(sim, undefined, e, 9999, 'light');
    expect(e.alive).toBe(false);
    sim.update(0.016);
    expect(sim.entities.includes(e)).toBe(false);
    expect(sim.stats.kills.wanderer).toBe(1);
  });
  it('espectros recebem metade do dano físico', () => {
    const sim = makeSim('m2');
    const s = sim.spawnActor('specter', 'enemy', 800, 400, { noDelay: true });
    dealDamage(sim, undefined, s, 40, 'physical', { noCrit: true });
    expect(s.maxHp - s.hp).toBe(20);
  });
  it('jogar carta gasta energia, invoca e cicla', () => {
    const sim = makeSim('m2');
    sim.energy.value = 10;
    const card = sim.deck.hand[0];
    const r = sim.playCard(0, 400, 464);
    expect(r.ok).toBe(true);
    expect(sim.energy.value).toBeLessThan(10);
    expect(sim.deck.hand[0]).not.toBe(card);
    expect(sim.entities.some((e) => e.cardId === card)).toBe(true);
  });
  it('rejeita posicionamento fora da zona', () => {
    const sim = makeSim('m2');
    sim.energy.value = 10;
    const slot = sim.deck.hand.indexOf('gunslinger');
    expect(sim.playCard(slot, 1400, 464).ok).toBe(false);
    expect(sim.energy.value).toBe(10);
  });
  it('ondas geram inimigos ao longo do tempo', () => {
    const sim = makeSim('m2');
    for (let i = 0; i < 60 * 8; i++) sim.update(1 / 60);
    expect(sim.waves.index).toBeGreaterThan(0);
    expect(sim.hostileCount).toBeGreaterThan(0);
  });
  it('derrota quando o núcleo chega a zero', () => {
    const sim = makeSim('m2');
    dealDamage(sim, undefined, sim.core, 1e6, 'physical');
    expect(sim.over).toBe(true);
    expect(sim.result?.victory).toBe(false);
    expect(sim.result?.reason).toBe('coreDestroyed');
  });
  it('vitória por destruição do ninho', () => {
    const sim = makeSim('m4');
    dealDamage(sim, undefined, sim.nest, 1e6, 'physical');
    expect(sim.result?.victory).toBe(true);
    expect(sim.result?.reason).toBe('destroy');
  });
  it('ninho é selado em missões só de sobrevivência', () => {
    const sim = makeSim('m2');
    dealDamage(sim, undefined, sim.nest, 1e6, 'physical');
    expect(sim.over).toBe(false);
    expect(sim.nest.alive).toBe(true);
  });
  it('tempo esgotado em missão de destruição é derrota (não vitória automática)', () => {
    const sim = makeSim('m4', undefined, 3, { timeLimit: 5, waves: [] });
    for (let i = 0; i < 60 * 6; i++) sim.update(1 / 60);
    expect(sim.result?.victory).toBe(false);
    expect(sim.result?.reason).toBe('timeout');
  });
  it('vitória por sobrevivência só quando todas as ondas foram eliminadas', () => {
    const sim = makeSim('m1');
    const r = runBattle(sim, true, 400);
    expect(r?.victory).toBe(true);
    expect(r?.reason).toBe('survive');
    expect(sim.waves.allSpawned).toBe(true);
    expect(sim.hostileCount).toBe(0);
  });
  it('chefes usam ataques especiais', () => {
    for (const boss of ['butcher', 'matriarch', 'faceless']) {
      const sim = makeSim('m2');
      const b = sim.spawnActor(boss, 'enemy', 500, 464, { noDelay: true });
      sim.spawnActor('veteran', 'player', 440, 464, { noDelay: true });
      sim.spawnActor('gunslinger', 'player', 300, 300, { noDelay: true });
      const types = new Set<string>();
      for (let i = 0; i < 60 * 20; i++) {
        sim.update(1 / 60);
        for (const ev of sim.drainEvents()) types.add(ev.type);
        if (!b.alive) break;
      }
      const expected = { butcher: 'slam', matriarch: 'summon', faceless: 'teleport' }[boss]!;
      expect(types.has(expected), boss).toBe(true);
    }
  });
  it('todas as missões têm configurações jogáveis', () => {
    for (const m of MISSIONS) {
      const sim = makeSim(m.id);
      for (let i = 0; i < 60 * 30; i++) sim.update(1 / 60);
      expect(sim.time).toBeGreaterThan(0);
    }
  });
  it('desempenho: ondas grandes não travam a simulação', () => {
    const sim = makeSim('m2');
    for (let i = 0; i < 120; i++) sim.spawnActor(i % 3 ? 'wanderer' : 'runner', 'enemy', 1300 + (i % 10) * 10, 200 + (i * 5) % 500, { noDelay: true });
    for (let i = 0; i < 20; i++) sim.spawnActor('gunslinger', 'player', 300 + (i % 5) * 20, 380 + i * 8, { noDelay: true });
    const t0 = performance.now();
    for (let i = 0; i < 60 * 10; i++) sim.update(1 / 60);
    const ms = (performance.now() - t0) / 600;
    expect(ms).toBeLessThan(8); // ms por passo de simulação
  });
});
