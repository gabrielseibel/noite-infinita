import type { ActorDef } from '../sim/types';

export const ENEMY_ACTORS: ActorDef[] = [
  {
    id: 'wanderer', name: 'Errante', kind: 'enemy', hp: 120, radius: 10, speed: 32, tags: [], ai: 'walker', aggroRange: 90, bounty: 1,
    attack: { kind: 'melee', damage: 14, range: 20, interval: 1.1, windup: 0.35, targets: 'ground', damageType: 'physical' },
    blurb: 'Lento e numeroso. Sozinho é fraco; em bando, sufoca.',
  },
  {
    id: 'runner', name: 'Corredor', kind: 'enemy', hp: 72, radius: 9, speed: 98, tags: [], ai: 'walker', aggroRange: 60, bounty: 1,
    attack: { kind: 'melee', damage: 10, range: 18, interval: 0.6, windup: 0.18, targets: 'ground', damageType: 'physical' },
    blurb: 'Rápido e frágil. Ignora unidades e corre para o abrigo.',
  },
  {
    id: 'brute', name: 'Bruto', kind: 'enemy', hp: 680, radius: 17, speed: 26, armor: 0.2, tags: ['heavy'], ai: 'walker', aggroRange: 80, bounty: 4,
    attack: { kind: 'melee', damage: 46, range: 28, interval: 1.6, windup: 0.6, targets: 'ground', damageType: 'physical', vsStructures: 2.6, splash: 30 },
    blurb: 'Muito resistente. Esmaga estruturas.',
  },
  {
    id: 'crawler', name: 'Rastejante', kind: 'enemy', hp: 95, radius: 9, speed: 50, tags: ['low'], ai: 'walker', aggroRange: 70, bounty: 1,
    attack: { kind: 'melee', damage: 13, range: 18, interval: 0.9, windup: 0.25, targets: 'ground', damageType: 'physical' },
    blurb: 'Passa por baixo de barricadas. Use torres e armadilhas.',
  },
  {
    id: 'spitter', name: 'Cuspidor', kind: 'enemy', hp: 150, radius: 11, speed: 30, tags: ['ranged'], ai: 'ranged', aggroRange: 200, bounty: 2,
    attack: { kind: 'projectile', damage: 20, range: 175, interval: 1.8, windup: 0.5, targets: 'ground', damageType: 'poison', splash: 30, projectileSpeed: 260, projectileFx: 'acid', vsStructures: 1.3 },
    behaviors: [{ type: 'deathBurst', radius: 40, damage: 20, damageType: 'poison' }],
    blurb: 'Cospe ácido de longe. Elimine-o antes que derreta suas defesas.',
  },
  {
    id: 'parasite', name: 'Parasita', kind: 'enemy', hp: 105, radius: 9, speed: 72, tags: ['supernatural'], ai: 'parasite', aggroRange: 320, bounty: 2,
    attack: { kind: 'melee', damage: 6, range: 18, interval: 0.9, windup: 0.15, targets: 'ground', damageType: 'poison', onHit: [{ type: 'poison', duration: 4, power: 9 }] },
    blurb: 'Caça unidades isoladas e as envenena.',
  },
  {
    id: 'specter', name: 'Espectro', kind: 'enemy', hp: 165, radius: 11, speed: 44, tags: ['supernatural', 'flying', 'ethereal'], ai: 'walker', aggroRange: 100, bounty: 2,
    attack: { kind: 'melee', damage: 17, range: 22, interval: 1.0, windup: 0.3, targets: 'ground', damageType: 'spectral', onHit: [{ type: 'slow', duration: 1.5, power: 0.3 }] },
    blurb: 'Atravessa defesas. Metade do dano de armas comuns.',
  },
  {
    id: 'abyss_spider', name: 'Aranha Abissal', kind: 'enemy', hp: 170, radius: 11, speed: 92, tags: ['supernatural'], ai: 'flanker', aggroRange: 240, bounty: 2,
    attack: { kind: 'melee', damage: 21, range: 20, interval: 0.8, windup: 0.2, targets: 'ground', damageType: 'physical' },
    blurb: 'Contorna pelas laterais e embosca a retaguarda.',
  },
  {
    id: 'screamer', name: 'Berrante', kind: 'enemy', hp: 310, radius: 12, speed: 28, tags: ['supernatural', 'support'], ai: 'screamer', aggroRange: 150, bounty: 4,
    attack: { kind: 'projectile', damage: 12, range: 140, interval: 1.6, windup: 0.4, targets: 'ground', damageType: 'spectral', projectileSpeed: 400, projectileFx: 'spit' },
    behaviors: [
      { type: 'aura', radius: 160, damageMult: 1.25, speedMult: 1.15 },
      { type: 'summon', actor: 'wanderer', count: 2, interval: 9, windup: 0.9, maxAlive: 8 },
    ],
    blurb: 'Fortalece aliados e convoca reforços. Prioridade!',
  },
  {
    id: 'devourer', name: 'Devorador', kind: 'enemy', hp: 1650, radius: 22, speed: 24, armor: 0.15, tags: ['elite', 'supernatural', 'heavy'], ai: 'walker', aggroRange: 110, bounty: 8,
    attack: { kind: 'melee', damage: 72, range: 34, interval: 2.0, windup: 0.7, targets: 'ground', damageType: 'physical', splash: 72, vsStructures: 1.4 },
    behaviors: [{ type: 'deathEnergy', amount: 2 }],
    blurb: 'Elite colossal com golpes em área. Deixa essência (+2 energia).',
  },
  {
    id: 'brood', name: 'Cria', kind: 'enemy', hp: 48, radius: 7, speed: 80, tags: ['supernatural'], ai: 'walker', aggroRange: 90, bounty: 0,
    attack: { kind: 'melee', damage: 8, range: 16, interval: 0.7, windup: 0.15, targets: 'ground', damageType: 'physical' },
    blurb: 'Filhote da Matriarca. Fortalece a mãe enquanto vive.',
  },
];
