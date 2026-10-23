import type { SpawnId } from './maps';
import type { EventMods } from './events';

export type Objective = 'destroy' | 'survive';

export interface SpawnGroup {
  enemy: string;
  count: number;
  spawn?: SpawnId | 'all';
  /** Intervalo entre cada criatura do grupo (s). */
  spacing?: number;
  /** Atraso do grupo em relação ao início da onda (s). */
  delay?: number;
  elite?: boolean;
}

export interface WaveDef {
  at: number;
  label?: string;
  groups: SpawnGroup[];
  boss?: string;
}

export interface MissionDef {
  id: string;
  index: number;
  name: string;
  intro: string;
  map: string;
  theme: string;
  objectives: Objective[];
  /** Tempo limite: em missões só de destruição, esgotar o tempo é derrota. */
  timeLimit?: number;
  nestHp: number;
  waves: WaveDef[];
  /** Depois da última onda, repete a partir deste índice (pressão contínua). */
  loopFrom?: number;
  loopInterval?: number;
  events: { id: string; at: number }[];
  randomEvents?: { pool: string[]; count: number; from: number; to: number };
  permanentMods?: EventMods;
  reward: number;
  unlockCards: string[];
  requires?: string;
  purchasePrice?: number;
  tutorial?: boolean;
  endless?: boolean;
  special?: boolean;
  /** Multiplicador de dificuldade geral de vida dos inimigos. */
  enemyHpMult?: number;
}

// Atalho para descrever grupos: g('wanderer', 6, 'north', 0.8)
const g = (enemy: string, count: number, spawn: SpawnGroup['spawn'] = 'nest', spacing = 0.9, extra: Partial<SpawnGroup> = {}): SpawnGroup => ({ enemy, count, spawn, spacing, ...extra });
const w = (at: number, groups: SpawnGroup[], extra: Partial<WaveDef> = {}): WaveDef => ({ at, groups, ...extra });

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1', index: 1, name: 'O Último Abrigo', map: 'shelter', theme: 'shelter', objectives: ['survive'], nestHp: 3000, tutorial: true,
    intro: 'O rádio silenciou. Restou o abrigo na orla da floresta. Aguente até o fim da noite.',
    waves: [
      w(2, [g('wanderer', 3, 'nest', 1.4)], { label: 'Primeiros passos' }),
      w(14, [g('wanderer', 5, 'nest', 0.9), g('runner', 2, 'nest', 1.2, { delay: 3 })], { label: 'Eles ouviram' }),
      w(26, [g('wanderer', 8, 'nest', 0.25)], { label: 'Horda compacta' }),
      w(38, [g('spitter', 2, 'nest', 2), g('wanderer', 4, 'nest', 1)], { label: 'Cuspidores' }),
      w(56, [g('wanderer', 10, 'all', 0.7), g('runner', 4, 'north', 1), g('brute', 1, 'nest', 0, { delay: 6 })], { label: 'Onda final' }),
    ],
    events: [], reward: 60, unlockCards: ['engineer'],
  },
  {
    id: 'm2', index: 2, name: 'A Estrada Morta', map: 'road', theme: 'road', objectives: ['survive'], nestHp: 3200, requires: 'm1',
    intro: 'Carros abandonados formam corredores. Os Rastejantes passam por baixo de tudo.',
    waves: [
      w(4, [g('wanderer', 6, 'nest', 1)]),
      w(30, [g('runner', 5, 'north', 0.8), g('wanderer', 5, 'south', 1)]),
      w(60, [g('crawler', 6, 'nest', 0.7), g('wanderer', 4, 'nest', 1, { delay: 3 })], { label: 'Rastejantes' }),
      w(95, [g('wanderer', 10, 'all', 0.6), g('runner', 6, 'nest', 0.5, { delay: 5 })]),
      w(130, [g('brute', 2, 'nest', 4), g('crawler', 8, 'all', 0.5)]),
      w(170, [g('wanderer', 14, 'all', 0.4), g('runner', 8, 'all', 0.5), g('brute', 2, 'north', 3, { delay: 6 }), g('crawler', 6, 'south', 0.5, { delay: 8 })], { label: 'Engarrafamento' }),
    ],
    events: [{ id: 'storm', at: 80 }], reward: 70, unlockCards: ['shotgunner'],
  },
  {
    id: 'm3', index: 3, name: 'O Hospital Abandonado', map: 'hospital', theme: 'hospital', objectives: ['survive'], nestHp: 3400, requires: 'm2',
    intro: 'Corredores estreitos, macas viradas. Algo enorme arrasta um cutelo pelo piso.',
    waves: [
      w(4, [g('wanderer', 7, 'nest', 0.9)]),
      w(32, [g('spitter', 3, 'all', 1.5), g('wanderer', 5, 'nest', 1)]),
      w(62, [g('parasite', 4, 'north', 1.2), g('runner', 5, 'south', 0.7)], { label: 'Parasitas' }),
      w(95, [g('brute', 2, 'nest', 3), g('spitter', 3, 'all', 1), g('wanderer', 8, 'all', 0.6)]),
      w(135, [g('parasite', 5, 'all', 0.8), g('crawler', 6, 'nest', 0.6), g('runner', 6, 'all', 0.5)]),
      w(175, [g('wanderer', 10, 'all', 0.6), g('spitter', 2, 'nest', 2, { delay: 4 })], { boss: 'butcher', label: 'O Açougueiro' }),
    ],
    events: [{ id: 'blackout', at: 110 }], reward: 85, enemyHpMult: 1.05, unlockCards: ['huntress'],
  },
  {
    id: 'm4', index: 4, name: 'O Cemitério das Máquinas', map: 'road', theme: 'junkyard', objectives: ['destroy'], timeLimit: 300, nestHp: 3200, requires: 'm3',
    intro: 'O ninho pulsa no meio do ferro-velho. Desta vez, vá até ele: destrua-o antes do amanhecer falso.',
    waves: [
      w(5, [g('wanderer', 8, 'nest', 0.8)]),
      w(35, [g('brute', 1, 'nest'), g('runner', 6, 'all', 0.6)]),
      w(65, [g('spitter', 3, 'nest', 1), g('crawler', 6, 'all', 0.6)]),
      w(95, [g('brute', 2, 'all', 2), g('wanderer', 10, 'all', 0.5)]),
      w(125, [g('parasite', 4, 'all', 1), g('runner', 8, 'all', 0.4)]),
    ],
    loopFrom: 1, loopInterval: 30,
    events: [{ id: 'red_moon', at: 140 }], reward: 90, enemyHpMult: 1.1, unlockCards: ['uv_tower'],
  },
  {
    id: 'm5', index: 5, name: 'A Floresta que Respira', map: 'forest', theme: 'forest', objectives: ['survive'], nestHp: 3600, requires: 'm4',
    intro: 'As árvores se movem quando você não olha. Espectros flutuam através das defesas.',
    waves: [
      w(4, [g('wanderer', 8, 'all', 0.8)]),
      w(30, [g('specter', 3, 'nest', 1.5), g('wanderer', 6, 'all', 0.8)], { label: 'Espectros' }),
      w(62, [g('abyss_spider', 4, 'all', 1), g('runner', 5, 'nest', 0.6)], { label: 'Aranhas Abissais' }),
      w(95, [g('specter', 5, 'all', 1), g('crawler', 8, 'all', 0.5), g('brute', 1, 'nest', 0, { delay: 4 })]),
      w(135, [g('abyss_spider', 6, 'all', 0.7), g('spitter', 3, 'nest', 1.2), g('wanderer', 10, 'all', 0.4)]),
      w(180, [g('specter', 6, 'all', 0.8), g('abyss_spider', 6, 'all', 0.6), g('brute', 2, 'nest', 3), g('wanderer', 12, 'all', 0.4)], { label: 'A floresta inspira' }),
    ],
    events: [{ id: 'dense_fog', at: 50 }, { id: 'escape', at: 110 }], reward: 100, enemyHpMult: 1.15, unlockCards: ['light_pulse'],
  },
  {
    id: 'm6', index: 6, name: 'O Posto da Madrugada', map: 'shelter', theme: 'station', objectives: ['survive', 'destroy'], nestHp: 5800, requires: 'm5',
    intro: 'O letreiro do posto ainda pisca. Uma mãe monstruosa guarda o ninho além das bombas de combustível.',
    waves: [
      w(4, [g('wanderer', 8, 'all', 0.7), g('runner', 3, 'nest', 1)]),
      w(32, [g('screamer', 1, 'nest'), g('wanderer', 8, 'all', 0.6)], { label: 'Berrante' }),
      w(64, [g('parasite', 4, 'all', 1), g('spitter', 3, 'all', 1.2), g('crawler', 5, 'nest', 0.6)]),
      w(100, [g('brute', 2, 'all', 2), g('screamer', 1, 'north'), g('runner', 8, 'all', 0.4)]),
      w(140, [g('specter', 4, 'all', 1), g('abyss_spider', 4, 'all', 0.8), g('wanderer', 10, 'all', 0.4)]),
      w(185, [g('wanderer', 10, 'all', 0.5), g('screamer', 1, 'south', 0, { delay: 5 })], { boss: 'matriarch', label: 'A Matriarca' }),
    ],
    events: [{ id: 'storm', at: 40 }, { id: 'escape', at: 120 }], reward: 110, enemyHpMult: 1.2, unlockCards: ['veteran'],
  },
  {
    id: 'm7', index: 7, name: 'O Vilarejo Silencioso', map: 'hospital', theme: 'village', objectives: ['survive'], nestHp: 3800, requires: 'm6',
    intro: 'Nenhum cão late, nenhum sino toca. Então alguém grita ao longe, e todos os postes se apagam.',
    waves: [
      w(4, [g('wanderer', 10, 'all', 0.6)]),
      w(34, [g('spitter', 3, 'all', 1), g('parasite', 3, 'all', 1)]),
      w(66, [g('devourer', 1, 'nest'), g('wanderer', 8, 'all', 0.6)], { label: 'Devorador' }),
      w(102, [g('specter', 5, 'all', 0.8), g('screamer', 1, 'nest'), g('runner', 8, 'all', 0.4)]),
      w(140, [g('brute', 3, 'all', 2), g('crawler', 10, 'all', 0.4), g('abyss_spider', 4, 'all', 0.8)]),
      w(185, [g('devourer', 2, 'all', 4, { elite: true }), g('wanderer', 14, 'all', 0.35), g('screamer', 2, 'all', 3)], { label: 'Silêncio absoluto' }),
    ],
    events: [{ id: 'blackout', at: 50 }, { id: 'distant_scream', at: 125 }, { id: 'blackout', at: 170 }], reward: 120, enemyHpMult: 1.25, unlockCards: ['bone_golem'],
  },
  {
    id: 'm8', index: 8, name: 'A Mina Subterrânea', map: 'mine', theme: 'mine', objectives: ['destroy', 'survive'], nestHp: 6200, requires: 'm7',
    intro: 'Túneis estreitos e escuridão quase total. As aranhas conhecem cada galeria.',
    waves: [
      w(4, [g('crawler', 8, 'all', 0.6)]),
      w(30, [g('abyss_spider', 5, 'all', 0.8), g('wanderer', 6, 'nest', 0.7)]),
      w(62, [g('brute', 2, 'nest', 3), g('spitter', 3, 'all', 1)]),
      w(96, [g('abyss_spider', 6, 'all', 0.6), g('parasite', 4, 'all', 0.8), g('crawler', 8, 'all', 0.4)]),
      w(132, [g('devourer', 1, 'nest'), g('specter', 4, 'all', 1), g('runner', 10, 'all', 0.3)]),
      w(175, [g('abyss_spider', 8, 'all', 0.5), g('brute', 3, 'all', 2), g('screamer', 2, 'all', 2), g('crawler', 12, 'all', 0.3)], { label: 'Desabamento' }),
    ],
    events: [{ id: 'red_moon', at: 70 }, { id: 'blackout', at: 140 }], permanentMods: { darkness: 0.12 }, reward: 130, enemyHpMult: 1.3, unlockCards: ['reaper'],
  },
  {
    id: 'm9', index: 9, name: 'O Santuário Partido', map: 'forest', theme: 'sanctuary', objectives: ['survive'], nestHp: 4200, requires: 'm8',
    intro: 'Velas apagadas sobre um altar rachado. Ele não tem rosto, mas sempre sabe onde você está.',
    waves: [
      w(4, [g('specter', 4, 'all', 1), g('wanderer', 8, 'all', 0.6)]),
      w(34, [g('screamer', 1, 'nest'), g('abyss_spider', 5, 'all', 0.7)]),
      w(68, [g('parasite', 5, 'all', 0.8), g('spitter', 4, 'all', 1)]),
      w(104, [g('devourer', 1, 'nest'), g('specter', 6, 'all', 0.7), g('runner', 8, 'all', 0.4)]),
      w(145, [g('brute', 3, 'all', 2), g('screamer', 2, 'all', 3), g('crawler', 10, 'all', 0.4)]),
      w(190, [g('specter', 6, 'all', 0.6), g('wanderer', 12, 'all', 0.4)], { boss: 'faceless', label: 'O Homem Sem Rosto' }),
    ],
    events: [{ id: 'dense_fog', at: 60 }, { id: 'escape', at: 120 }],
    randomEvents: { pool: ['red_moon', 'storm', 'blackout'], count: 1, from: 150, to: 185 },
    reward: 140, enemyHpMult: 1.35, unlockCards: [],
  },
  {
    id: 'm10', index: 10, name: 'A Origem da Noite', map: 'mine', theme: 'origin', objectives: ['destroy', 'survive'], nestHp: 8000, requires: 'm9',
    intro: 'O coração da escuridão bate sob a terra. Tudo o que você enfrentou nasceu aqui.',
    waves: [
      w(4, [g('wanderer', 12, 'all', 0.5), g('runner', 6, 'all', 0.5)]),
      w(40, [g('specter', 5, 'all', 0.8), g('abyss_spider', 5, 'all', 0.7)]),
      w(80, [g('wanderer', 8, 'all', 0.5)], { boss: 'butcher', label: 'O Açougueiro retorna' }),
      w(130, [g('devourer', 2, 'all', 3), g('screamer', 2, 'all', 2), g('parasite', 6, 'all', 0.6)]),
      w(175, [g('crawler', 12, 'all', 0.3), g('spitter', 4, 'all', 1)], { boss: 'matriarch', label: 'A Matriarca desperta' }),
      w(225, [g('specter', 8, 'all', 0.5), g('brute', 3, 'all', 2), g('wanderer', 16, 'all', 0.3)], { boss: 'faceless', label: 'A Origem' }),
    ],
    events: [{ id: 'red_moon', at: 60 }, { id: 'distant_scream', at: 150 }, { id: 'blackout', at: 230 }],
    randomEvents: { pool: ['storm', 'dense_fog', 'escape'], count: 1, from: 100, to: 140 },
    reward: 200, enemyHpMult: 1.3, unlockCards: [],
  },
  // Missões especiais
  {
    id: 'endless', index: 11, name: 'Noite Sem Fim', map: 'shelter', theme: 'origin', objectives: ['survive'], nestHp: 999999, requires: 'm5', endless: true, special: true,
    intro: 'Modo infinito: as ondas nunca param. Quanto tempo você aguenta?',
    waves: [], events: [], randomEvents: { pool: ['red_moon', 'storm', 'blackout', 'dense_fog', 'distant_scream', 'escape'], count: 99, from: 60, to: 9999 },
    reward: 0, unlockCards: [],
  },
  {
    id: 'blood_moon', index: 12, name: 'Desafio: Lua de Sangue', map: 'forest', theme: 'origin', objectives: ['survive'], nestHp: 4000, purchasePrice: 200, special: true,
    intro: 'A lua sangra a noite inteira. Monstros mais fortes, recompensas maiores.',
    waves: [
      w(4, [g('runner', 10, 'all', 0.4)]),
      w(30, [g('wanderer', 12, 'all', 0.4), g('brute', 1, 'nest')]),
      w(62, [g('abyss_spider', 6, 'all', 0.6), g('specter', 4, 'all', 0.8)]),
      w(100, [g('devourer', 1, 'nest', 0, { elite: true }), g('parasite', 6, 'all', 0.6)]),
      w(140, [g('wanderer', 16, 'all', 0.3), g('screamer', 2, 'all', 2)], { boss: 'butcher' }),
    ],
    events: [], permanentMods: { enemyDamageMult: 1.25, enemySpeedMult: 1.12 }, reward: 180, unlockCards: [], enemyHpMult: 1.1,
  },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
export const CAMPAIGN = MISSIONS.filter((m) => !m.special);
