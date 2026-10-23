// Mapas definidos em células (grade 50x28, células de 32px). Obstáculos são retângulos.
export type ObstacleType = 'building' | 'car' | 'trees' | 'rocks' | 'wall' | 'graves' | 'machine';
export type SpawnId = 'nest' | 'north' | 'south';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Obstacle extends Rect {
  type: ObstacleType;
}
export interface Cell {
  cx: number;
  cy: number;
}

export interface MapDef {
  id: string;
  name: string;
  cols: number;
  rows: number;
  core: Cell;
  nest: Cell;
  spawns: Record<SpawnId, Cell>;
  obstacles: Obstacle[];
  mud: Rect[];
  roads: Rect[];
  debris: Cell[];
  lamps: Cell[];
  /** Coluna máxima (exclusiva) para posicionar unidades e estruturas. */
  deployMaxCol: number;
  escortStart: Cell;
}

const COLS = 50;
const ROWS = 28;
const SPAWNS: Record<SpawnId, Cell> = { nest: { cx: 44, cy: 14 }, north: { cx: 47, cy: 3 }, south: { cx: 47, cy: 24 } };

export const MAPS: Record<string, MapDef> = {
  shelter: {
    id: 'shelter', name: 'Abrigo da Orla', cols: COLS, rows: ROWS,
    core: { cx: 4, cy: 14 }, nest: { cx: 47, cy: 14 }, spawns: SPAWNS,
    obstacles: [
      { x: 8, y: 2, w: 1, h: 8, type: 'wall' }, { x: 8, y: 18, w: 1, h: 8, type: 'wall' },
      { x: 0, y: 2, w: 8, h: 1, type: 'wall' }, { x: 0, y: 25, w: 8, h: 1, type: 'wall' },
      { x: 17, y: 5, w: 6, h: 5, type: 'building' }, { x: 17, y: 18, w: 6, h: 5, type: 'building' },
      { x: 28, y: 12, w: 2, h: 1, type: 'car' }, { x: 31, y: 15, w: 3, h: 1, type: 'car' }, { x: 13, y: 15, w: 2, h: 1, type: 'car' },
      { x: 33, y: 3, w: 4, h: 3, type: 'trees' }, { x: 33, y: 22, w: 4, h: 3, type: 'trees' },
      { x: 12, y: 0, w: 4, h: 2, type: 'trees' }, { x: 12, y: 26, w: 4, h: 2, type: 'trees' },
      { x: 25, y: 0, w: 6, h: 2, type: 'trees' }, { x: 25, y: 26, w: 6, h: 2, type: 'trees' },
      { x: 41, y: 7, w: 2, h: 4, type: 'rocks' }, { x: 41, y: 17, w: 2, h: 4, type: 'rocks' },
    ],
    mud: [{ x: 25, y: 7, w: 5, h: 3 }, { x: 25, y: 18, w: 5, h: 3 }],
    roads: [{ x: 0, y: 12, w: 50, h: 4 }],
    debris: [{ cx: 14, cy: 7 }, { cx: 14, cy: 20 }],
    lamps: [{ cx: 10, cy: 9 }, { cx: 10, cy: 18 }, { cx: 20, cy: 13 }, { cx: 30, cy: 11 }, { cx: 38, cy: 16 }, { cx: 5, cy: 6 }, { cx: 5, cy: 22 }],
    deployMaxCol: 22, escortStart: { cx: 38, cy: 4 },
  },
  road: {
    id: 'road', name: 'Rodovia 9', cols: COLS, rows: ROWS,
    core: { cx: 4, cy: 14 }, nest: { cx: 47, cy: 14 }, spawns: SPAWNS,
    obstacles: [
      { x: 7, y: 4, w: 1, h: 7, type: 'wall' }, { x: 7, y: 17, w: 1, h: 7, type: 'wall' },
      { x: 10, y: 8, w: 8, h: 2, type: 'car' }, { x: 22, y: 8, w: 10, h: 2, type: 'car' }, { x: 36, y: 8, w: 6, h: 2, type: 'car' },
      { x: 10, y: 18, w: 6, h: 2, type: 'car' }, { x: 20, y: 18, w: 10, h: 2, type: 'car' }, { x: 34, y: 18, w: 8, h: 2, type: 'car' },
      { x: 14, y: 0, w: 10, h: 3, type: 'building' }, { x: 30, y: 0, w: 8, h: 3, type: 'building' },
      { x: 14, y: 25, w: 10, h: 3, type: 'building' }, { x: 30, y: 25, w: 8, h: 3, type: 'building' },
      { x: 26, y: 13, w: 2, h: 1, type: 'car' },
    ],
    mud: [{ x: 22, y: 11, w: 3, h: 6 }],
    roads: [{ x: 0, y: 11, w: 50, h: 6 }],
    debris: [{ cx: 33, cy: 9 }, { cx: 17, cy: 18 }],
    lamps: [{ cx: 9, cy: 12 }, { cx: 9, cy: 16 }, { cx: 19, cy: 11 }, { cx: 29, cy: 16 }, { cx: 40, cy: 11 }, { cx: 20, cy: 4 }, { cx: 26, cy: 23 }],
    deployMaxCol: 22, escortStart: { cx: 40, cy: 22 },
  },
  hospital: {
    id: 'hospital', name: 'Ala Norte', cols: COLS, rows: ROWS,
    core: { cx: 4, cy: 14 }, nest: { cx: 47, cy: 14 }, spawns: SPAWNS,
    obstacles: [
      { x: 7, y: 3, w: 1, h: 8, type: 'wall' }, { x: 7, y: 17, w: 1, h: 8, type: 'wall' },
      { x: 12, y: 2, w: 6, h: 8, type: 'building' }, { x: 12, y: 13, w: 6, h: 3, type: 'building' }, { x: 12, y: 19, w: 6, h: 7, type: 'building' },
      { x: 24, y: 0, w: 3, h: 5, type: 'building' }, { x: 24, y: 8, w: 3, h: 4, type: 'building' },
      { x: 24, y: 15, w: 3, h: 4, type: 'building' }, { x: 24, y: 22, w: 3, h: 6, type: 'building' },
      { x: 33, y: 3, w: 5, h: 6, type: 'building' }, { x: 33, y: 19, w: 5, h: 6, type: 'building' },
      { x: 37, y: 13, w: 2, h: 1, type: 'car' }, { x: 30, y: 11, w: 1, h: 2, type: 'car' },
    ],
    mud: [{ x: 19, y: 11, w: 3, h: 6 }],
    roads: [{ x: 0, y: 12, w: 12, h: 4 }, { x: 27, y: 12, w: 23, h: 4 }],
    debris: [{ cx: 25, cy: 6 }, { cx: 25, cy: 20 }],
    lamps: [{ cx: 9, cy: 11 }, { cx: 9, cy: 17 }, { cx: 20, cy: 10 }, { cx: 20, cy: 18 }, { cx: 30, cy: 14 }, { cx: 40, cy: 10 }, { cx: 40, cy: 18 }],
    deployMaxCol: 21, escortStart: { cx: 40, cy: 3 },
  },
  forest: {
    id: 'forest', name: 'Mata Fechada', cols: COLS, rows: ROWS,
    core: { cx: 4, cy: 14 }, nest: { cx: 47, cy: 14 }, spawns: SPAWNS,
    obstacles: [
      { x: 8, y: 3, w: 1, h: 7, type: 'wall' }, { x: 8, y: 18, w: 1, h: 7, type: 'wall' },
      { x: 12, y: 4, w: 3, h: 4, type: 'trees' }, { x: 13, y: 19, w: 3, h: 4, type: 'trees' },
      { x: 18, y: 10, w: 2, h: 3, type: 'trees' }, { x: 18, y: 16, w: 3, h: 2, type: 'trees' },
      { x: 21, y: 1, w: 4, h: 3, type: 'trees' }, { x: 22, y: 24, w: 4, h: 3, type: 'trees' },
      { x: 29, y: 6, w: 3, h: 4, type: 'trees' }, { x: 29, y: 18, w: 3, h: 4, type: 'trees' },
      { x: 35, y: 12, w: 3, h: 4, type: 'trees' }, { x: 37, y: 2, w: 3, h: 3, type: 'trees' }, { x: 37, y: 23, w: 3, h: 3, type: 'trees' },
      { x: 42, y: 8, w: 2, h: 3, type: 'rocks' }, { x: 42, y: 18, w: 2, h: 3, type: 'rocks' },
    ],
    mud: [{ x: 23, y: 11, w: 5, h: 6 }, { x: 14, y: 12, w: 3, h: 4 }],
    roads: [{ x: 0, y: 13, w: 14, h: 2 }],
    debris: [{ cx: 26, cy: 5 }, { cx: 26, cy: 22 }],
    lamps: [{ cx: 10, cy: 10 }, { cx: 10, cy: 18 }, { cx: 20, cy: 14 }, { cx: 32, cy: 14 }],
    deployMaxCol: 22, escortStart: { cx: 34, cy: 25 },
  },
  mine: {
    id: 'mine', name: 'Galerias', cols: COLS, rows: ROWS,
    core: { cx: 4, cy: 14 }, nest: { cx: 47, cy: 14 }, spawns: SPAWNS,
    obstacles: [
      { x: 8, y: 0, w: 1, h: 10, type: 'wall' }, { x: 8, y: 18, w: 1, h: 10, type: 'wall' },
      { x: 11, y: 0, w: 29, h: 4, type: 'rocks' }, { x: 11, y: 24, w: 29, h: 4, type: 'rocks' },
      { x: 14, y: 8, w: 8, h: 3, type: 'rocks' }, { x: 14, y: 17, w: 8, h: 3, type: 'rocks' },
      { x: 27, y: 8, w: 6, h: 3, type: 'machine' }, { x: 27, y: 17, w: 6, h: 3, type: 'machine' },
      { x: 38, y: 12, w: 2, h: 4, type: 'rocks' },
    ],
    mud: [{ x: 23, y: 12, w: 3, h: 4 }],
    roads: [{ x: 9, y: 13, w: 41, h: 2 }],
    debris: [{ cx: 24, cy: 6 }, { cx: 24, cy: 21 }],
    lamps: [{ cx: 10, cy: 12 }, { cx: 10, cy: 16 }, { cx: 18, cy: 5 }, { cx: 18, cy: 22 }, { cx: 30, cy: 14 }, { cx: 36, cy: 6 }, { cx: 36, cy: 21 }],
    deployMaxCol: 22, escortStart: { cx: 36, cy: 5 },
  },
};

export interface ThemeDef {
  id: string;
  ground: number;
  groundAlt: number;
  road: number;
  accent: number;
  fogColor: number;
  fog: number;
  darkness: number;
  tree: number;
  building: number;
  rain: boolean;
  props: ('corpse' | 'grave' | 'cross' | 'barrel' | 'tire' | 'bones' | 'crate' | 'rail')[];
}

export const THEMES: Record<string, ThemeDef> = {
  shelter: { id: 'shelter', ground: 0x1c2219, groundAlt: 0x262d1f, road: 0x2a2a2c, accent: 0xffb347, fogColor: 0x8899aa, fog: 0.22, darkness: 0.62, tree: 0x0e140f, building: 0x2b2826, rain: false, props: ['corpse', 'crate', 'barrel', 'tire'] },
  road: { id: 'road', ground: 0x221f1a, groundAlt: 0x2b261f, road: 0x29292b, accent: 0xff6b3d, fogColor: 0x9a9080, fog: 0.2, darkness: 0.6, tree: 0x13140f, building: 0x302a26, rain: true, props: ['tire', 'barrel', 'corpse', 'crate'] },
  hospital: { id: 'hospital', ground: 0x1d2224, groundAlt: 0x252b2e, road: 0x2d3033, accent: 0x6ee7ff, fogColor: 0x9fb4c0, fog: 0.25, darkness: 0.66, tree: 0x101414, building: 0x34393b, rain: false, props: ['crate', 'corpse', 'barrel'] },
  junkyard: { id: 'junkyard', ground: 0x241d18, groundAlt: 0x2e241c, road: 0x2a2624, accent: 0xff8c42, fogColor: 0x9a8070, fog: 0.2, darkness: 0.62, tree: 0x141210, building: 0x3a2f28, rain: false, props: ['tire', 'barrel', 'crate', 'bones'] },
  forest: { id: 'forest', ground: 0x152016, groundAlt: 0x1c2a1b, road: 0x2a2620, accent: 0x9cff7a, fogColor: 0x8fa894, fog: 0.32, darkness: 0.68, tree: 0x0a120b, building: 0x2a2620, rain: false, props: ['bones', 'corpse', 'cross'] },
  station: { id: 'station', ground: 0x1f1d1b, groundAlt: 0x29251f, road: 0x2b2a2a, accent: 0xff4f4f, fogColor: 0x998888, fog: 0.2, darkness: 0.6, tree: 0x12110f, building: 0x3a3330, rain: true, props: ['barrel', 'tire', 'corpse'] },
  village: { id: 'village', ground: 0x1e211d, groundAlt: 0x272b24, road: 0x2c2b28, accent: 0xffd27f, fogColor: 0xa0a8a0, fog: 0.3, darkness: 0.7, tree: 0x0f130f, building: 0x2f2a25, rain: false, props: ['cross', 'grave', 'corpse', 'crate'] },
  mine: { id: 'mine', ground: 0x1d1a17, groundAlt: 0x26221d, road: 0x2e2a25, accent: 0xffa53d, fogColor: 0x7d746a, fog: 0.18, darkness: 0.76, tree: 0x100e0c, building: 0x2a2520, rain: false, props: ['rail', 'crate', 'bones'] },
  sanctuary: { id: 'sanctuary', ground: 0x1a1820, groundAlt: 0x221f2a, road: 0x2b2833, accent: 0xc59bff, fogColor: 0x9a8fb0, fog: 0.3, darkness: 0.7, tree: 0x0e0c14, building: 0x2c2733, rain: false, props: ['grave', 'cross', 'bones'] },
  origin: { id: 'origin', ground: 0x1d1416, groundAlt: 0x271a1c, road: 0x2a2022, accent: 0xff3355, fogColor: 0xa07a80, fog: 0.28, darkness: 0.72, tree: 0x120a0c, building: 0x2e2224, rain: false, props: ['bones', 'grave', 'corpse'] },
};
