import { test } from 'vitest';
import { BattleSim } from '../src/sim/BattleSim';
import { MISSION_BY_ID } from '../src/data/missions';
import { runBattle } from '../tests/helpers';
test('m10 late deck', () => {
  const deck = ['huntress','uv_tower','light_pulse','shotgunner','veteran','medic','molotov','reaper'];
  const up = { treated_wood:3, shelter_walls:3, scope:2, patched_generator:3, field_kits:2, rations:2, quick_rituals:2, blood_pact:1 };
  const r = [1,2,3].map(seed => { const sim = new BattleSim({ mission: MISSION_BY_ID.m10, deck, seed, upgradeLevels: up }); const res = runBattle(sim, true, 600); return `${res?.victory?'W':'L'} ${res?.reason} ${Math.round(sim.time)}s core ${Math.round((res?.coreHpPct??0)*100)}%`; });
  console.log('m10', r.join(' | '));
}, 60000);
