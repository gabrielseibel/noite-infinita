import type { ActorDef } from '../sim/types';

// Unidades e estruturas do jogador. Escala: 1 unidade = 1 pixel do mundo (1600x896).
export const PLAYER_ACTORS: ActorDef[] = [
  {
    id: 'gunslinger', name: 'Pistoleiro', kind: 'unit', hp: 230, radius: 12, speed: 72, tags: ['ranged'],
    ai: 'guard', aggroRange: 230,
    attack: { kind: 'projectile', damage: 22, range: 190, interval: 0.7, windup: 0.12, targets: 'both', damageType: 'physical', projectileSpeed: 900, projectileFx: 'bullet', critChance: 0.1 },
    blurb: 'Disparos rápidos à distância. Confiável contra quase tudo.',
  },
  {
    id: 'huntress', name: 'Caçadora', kind: 'unit', hp: 190, radius: 12, speed: 66, tags: ['ranged', 'support'],
    ai: 'guard', aggroRange: 320,
    attack: { kind: 'projectile', damage: 95, range: 285, interval: 2.0, windup: 0.45, targets: 'both', damageType: 'physical', projectileSpeed: 1100, projectileFx: 'arrow', bonusVs: { elite: 2.2, boss: 1.6 }, critChance: 0.2 },
    blurb: 'Tiro lento e devastador. Dano dobrado contra elites.',
  },
  {
    id: 'medic', name: 'Médico de Campo', kind: 'unit', hp: 220, radius: 12, speed: 70, tags: ['support', 'ranged'],
    ai: 'guard', aggroRange: 200,
    attack: { kind: 'projectile', damage: 9, range: 150, interval: 1.0, windup: 0.1, targets: 'both', damageType: 'physical', projectileSpeed: 800, projectileFx: 'bullet' },
    behaviors: [{ type: 'heal', radius: 130, amount: 16, interval: 1.0, maxTargets: 3 }],
    blurb: 'Cura aliados próximos (não cura o núcleo).',
  },
  {
    id: 'engineer', name: 'Engenheira', kind: 'unit', hp: 250, radius: 12, speed: 70, tags: ['support'],
    ai: 'guard', aggroRange: 120,
    attack: { kind: 'melee', damage: 16, range: 26, interval: 1.0, windup: 0.25, targets: 'ground', damageType: 'physical' },
    behaviors: [
      { type: 'repair', radius: 150, amount: 18, interval: 1.0 },
      { type: 'buildBarricade', interval: 13, maxAlive: 2, actor: 'mini_barricade' },
    ],
    blurb: 'Repara e reforça estruturas. Monta pequenas barricadas.',
  },
  {
    id: 'shotgunner', name: 'Guarda com Escopeta', kind: 'unit', hp: 420, radius: 13, speed: 64, armor: 0.1, tags: [],
    ai: 'guard', aggroRange: 170,
    attack: { kind: 'projectile', damage: 30, range: 115, interval: 1.15, windup: 0.2, targets: 'ground', damageType: 'physical', splash: 58, projectileSpeed: 700, projectileFx: 'pellet' },
    blurb: 'Curto alcance, dano em área. Ótimo contra hordas.',
  },
  {
    id: 'veteran', name: 'Veterano', kind: 'unit', hp: 950, radius: 14, speed: 60, armor: 0.25, tags: [],
    ai: 'guard', aggroRange: 150,
    attack: { kind: 'melee', damage: 34, range: 30, interval: 1.0, windup: 0.3, targets: 'ground', damageType: 'physical' },
    behaviors: [{ type: 'taunt', radius: 170, interval: 3.5, duration: 3 }],
    blurb: 'Resistente. Provoca inimigos e protege o suporte.',
  },
  {
    id: 'wardog', name: 'Cão de Guerra', kind: 'unit', hp: 290, radius: 11, speed: 150, tags: [],
    ai: 'assault', aggroRange: 260,
    attack: { kind: 'melee', damage: 38, range: 24, interval: 0.8, windup: 0.15, targets: 'ground', damageType: 'physical', firstHitMultiplier: 3.2 },
    blurb: 'Avança rápido. O primeiro bote causa dano enorme.',
  },
  {
    id: 'raven', name: 'Corvo Espectral', kind: 'unit', hp: 115, radius: 9, speed: 165, tags: ['flying', 'supernatural'],
    ai: 'assault', aggroRange: 280,
    attack: { kind: 'melee', damage: 17, range: 22, interval: 0.6, windup: 0.1, targets: 'both', damageType: 'spectral', bonusVs: { flying: 1.8, ethereal: 1.4 } },
    blurb: 'Voa e caça alvos aéreos e espectrais. Invoca 2.',
  },
  {
    id: 'bone_golem', name: 'Golem de Ossos', kind: 'unit', hp: 2100, radius: 20, speed: 38, armor: 0.2, tags: ['heavy', 'supernatural'],
    ai: 'siege', aggroRange: 200,
    attack: { kind: 'melee', damage: 62, range: 34, interval: 1.6, windup: 0.5, targets: 'ground', damageType: 'physical', splash: 44, vsStructures: 1.6 },
    blurb: 'Tanque lento que ignora a horda e marcha para esmagar o ninho.',
  },
  {
    id: 'reaper', name: 'Ceifador', kind: 'unit', hp: 1150, radius: 16, speed: 82, armor: 0.1, tags: ['supernatural'],
    ai: 'assault', aggroRange: 240,
    attack: { kind: 'melee', damage: 88, range: 44, interval: 1.3, windup: 0.4, targets: 'both', damageType: 'spectral', splash: 92 },
    blurb: 'Foice espectral em arco amplo. Ceifa grupos inteiros.',
  },
  // Estruturas
  {
    id: 'watchtower', name: 'Torre de Vigia', kind: 'structure', hp: 680, radius: 18, speed: 0, armor: 0.1, tags: ['blocker'],
    ai: 'tower', aggroRange: 225,
    attack: { kind: 'projectile', damage: 30, range: 225, interval: 0.75, windup: 0, targets: 'ground', damageType: 'physical', projectileSpeed: 1000, projectileFx: 'bullet', critChance: 0.08 },
    blurb: 'Atira em inimigos terrestres. Não atinge voadores.',
  },
  {
    id: 'uv_tower', name: 'Torre de Luz UV', kind: 'structure', hp: 560, radius: 17, speed: 0, tags: ['blocker', 'powered'],
    ai: 'tower', aggroRange: 175,
    attack: { kind: 'projectile', damage: 15, range: 175, interval: 0.45, windup: 0, targets: 'both', damageType: 'light', projectileSpeed: 1400, projectileFx: 'uv', bonusVs: { supernatural: 2.6 }, onHit: [{ type: 'slow', duration: 1.3, power: 0.4, onlyTag: 'supernatural' }] },
    blurb: 'Feixe UV: dano extra e lentidão em sobrenaturais. Precisa de energia.',
  },
  {
    id: 'barricade', name: 'Barricada Reforçada', kind: 'structure', hp: 760, radius: 20, speed: 0, armor: 0.15, tags: ['blocker', 'lowObstacle'],
    ai: 'static', aggroRange: 0,
    behaviors: [{ type: 'slowAura', radius: 46, power: 0.35 }],
    blurb: 'Bloqueia o caminho e desacelera quem tenta passar.',
  },
  {
    id: 'mini_barricade', name: 'Barricada Improvisada', kind: 'structure', hp: 260, radius: 14, speed: 0, tags: ['blocker', 'lowObstacle'],
    ai: 'static', aggroRange: 0, lifetime: 28,
    blurb: 'Montada pela Engenheira. Temporária.',
  },
  {
    id: 'spike_trap', name: 'Armadilha de Estacas', kind: 'trap', hp: 1, radius: 16, speed: 0, tags: [],
    ai: 'trap', aggroRange: 22, charges: 4,
    attack: { kind: 'melee', damage: 125, range: 22, interval: 1.1, windup: 0, targets: 'ground', damageType: 'physical', splash: 52 },
    blurb: 'Dispara ao ser pisada. 4 usos. Voadores não ativam.',
  },
  {
    id: 'core', name: 'Núcleo do Abrigo', kind: 'core', hp: 3000, radius: 40, speed: 0, armor: 0, tags: ['blocker'],
    ai: 'tower', aggroRange: 210,
    attack: { kind: 'projectile', damage: 18, range: 210, interval: 0.8, windup: 0, targets: 'both', damageType: 'physical', projectileSpeed: 1000, projectileFx: 'bullet' },
    blurb: 'O último refúgio. Se cair, a noite vence.',
  },
  {
    id: 'debris', name: 'Destroços', kind: 'structure', hp: 450, radius: 18, speed: 0, armor: 0.3, tags: ['blocker'],
    ai: 'static', aggroRange: 0,
    blurb: 'Entulho que bloqueia a passagem até ser destruído.',
  },
  {
    id: 'refugee', name: 'Sobrevivente em Fuga', kind: 'escort', hp: 260, radius: 10, speed: 52, tags: [],
    ai: 'escort', aggroRange: 0,
    blurb: 'Precisa chegar ao abrigo com vida.',
  },
];
