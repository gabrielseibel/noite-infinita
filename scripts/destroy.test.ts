import { test } from 'vitest';
import { makeSim } from '../tests/helpers';
import { CARD_BY_ID } from '../src/data/cards';
test('aggressive destroy', () => {
  const deck = ['wardog','raven','bone_golem','gunslinger','barricade','molotov','watchtower','shotgunner'];
  for (const id of ['m4','m6','m8']) {
    const out=[];
    for (const seed of [1,2,3]) {
      const sim = makeSim(id, deck, seed);
      let step=0;
      while(!sim.over && sim.time<400){
        if(step%15===0){ for(let s=0;s<4;s++){ const c=CARD_BY_ID[sim.deck.hand[s]]; if(!sim.canPlay(s).ok||sim.energy.value<Math.min(9,c.cost+1)) continue;
          const x = c.category==='creature'? 21*32 : c.category==='ability' ? (sim.entities.find(e=>e.alive&&e.team==='enemy'&&e.kind==='enemy'&&e.x<800)?.x ?? -1) : 14*32;
          if (x<0) continue; const y = c.category==='ability'? sim.entities.find(e=>e.alive&&e.team==='enemy'&&e.kind==='enemy'&&e.x<800)!.y : 464+(Math.random()-0.5)*160;
          if(sim.playCard(s,x,y).ok) break; } }
        sim.update(1/30); sim.drainEvents(); step++;
      }
      out.push(`${sim.result?.victory?'W':'L'} ${sim.result?.reason} ${Math.round(sim.time)}s nest ${Math.round(sim.nest.hp)}`);
    }
    console.log(id, out.join(' | '));
  }
}, 120000);
