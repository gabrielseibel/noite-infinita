import { BattleSim } from '../src/sim/BattleSim';
import { CARD_BY_ID, STARTER_DECK } from '../src/data/cards';
import { MISSION_BY_ID, type MissionDef } from '../src/data/missions';

export function makeSim(missionId = 'm2', deck = STARTER_DECK, seed = 7, extra: Partial<MissionDef> = {}) {
  const mission = { ...MISSION_BY_ID[missionId], ...extra };
  return new BattleSim({ mission, deck: [...deck], seed, shuffle: false });
}

/** Bot simples: joga a carta mais cara que puder em posições defensivas razoáveis. */
export function botStep(sim: BattleSim) {
  const t = sim.tile;
  for (let slot = 0; slot < 4; slot++) {
    const id = sim.deck.hand[slot];
    const card = CARD_BY_ID[id];
    if (!sim.canPlay(slot).ok) continue;
    if (sim.energy.value < Math.min(9, card.cost + 2)) continue;
    let x = (sim.map.deployMaxCol - 6) * t;
    let y = sim.height / 2 + sim.rng.range(-120, 120);
    if (card.category === 'ability') {
      const enemy = sim.entities.find((e) => e.alive && e.team === 'enemy' && e.kind === 'enemy' && e.x < sim.map.deployMaxCol * t + 200);
      if (!enemy) continue;
      x = enemy.x;
      y = enemy.y;
    } else if (card.category === 'structure') {
      x = (10 + sim.rng.int(0, 8)) * t;
      y = sim.height / 2 + sim.rng.range(-100, 100);
    }
    for (let attempt = 0; attempt < 6; attempt++) {
      if (sim.playCard(slot, x, y).ok) return true;
      x -= 30;
      y += sim.rng.range(-60, 60);
    }
  }
  return false;
}

export function runBattle(sim: BattleSim, bot = true, maxSeconds = 900) {
  const dt = 1 / 30;
  let steps = 0;
  while (!sim.over && sim.time < maxSeconds) {
    if (bot && steps % 10 === 0) botStep(sim);
    sim.update(dt);
    sim.drainEvents();
    steps++;
  }
  return sim.result;
}
