import { test } from 'vitest';
import { makeSim, runBattle } from '../tests/helpers';
import { MISSIONS } from '../src/data/missions';
test('balance report', () => {
  for (const m of MISSIONS.filter(m=>!m.endless)) {
    const out: string[] = [];
    for (const seed of [1,2,3]) {
      const sim = makeSim(m.id, undefined, seed);
      const t0 = performance.now();
      const r = runBattle(sim, true, 600);
      const ms = performance.now()-t0;
      out.push(`${r?.victory?'W':'L'}(${r?.reason},${Math.round(sim.time)}s,core ${Math.round((r?.coreHpPct??0)*100)}%,${Math.round(ms)}ms)`);
    }
    console.log(m.id, out.join(' '));
  }
}, 120000);
