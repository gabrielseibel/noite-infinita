import type { MapDef, Rect } from '../data/maps';
import type { Vec } from './types';

/**
 * Grade de navegação: obstáculos estáticos, lama, ocupação por estruturas,
 * campos de fluxo (Dijkstra a partir do objetivo) e A* para perseguições.
 * Os campos só são recalculados quando estruturas mudam (flag `dirty`).
 */
export type FieldId = 'ground' | 'low' | 'flank' | 'free' | 'allyNest';

const INF = 1e9;
const NEIGHBORS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
const STRUCTURE_COST = 9;

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tile: number;
  readonly blocked: Uint8Array;
  readonly mud: Uint8Array;
  /** id da estrutura bloqueadora em cada célula (0 = livre). */
  readonly structureAt: Int32Array;
  /** 1 se a estrutura na célula é baixa (rastejantes passam). */
  readonly lowAt: Uint8Array;
  readonly fields: Record<FieldId, Float64Array>;
  readonly next: Record<FieldId, Int32Array>;
  dirty = true;
  private goalCore: number[] = [];
  private goalNest: number[] = [];
  private centerRows: [number, number];

  constructor(map: MapDef, tile: number) {
    this.cols = map.cols;
    this.rows = map.rows;
    this.tile = tile;
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.mud = new Uint8Array(n);
    this.structureAt = new Int32Array(n);
    this.lowAt = new Uint8Array(n);
    const mk = () => new Float64Array(n);
    const mki = () => new Int32Array(n);
    this.fields = { ground: mk(), low: mk(), flank: mk(), free: mk(), allyNest: mk() };
    this.next = { ground: mki(), low: mki(), flank: mki(), free: mki(), allyNest: mki() };
    for (const o of map.obstacles) this.fillRect(this.blocked, o, 1);
    for (const m of map.mud) this.fillRect(this.mud, m, 1);
    this.centerRows = [Math.floor(this.rows * 0.32), Math.ceil(this.rows * 0.68)];
    this.goalCore = this.cellsAround(map.core.cx, map.core.cy, 2);
    this.goalNest = this.cellsAround(map.nest.cx, map.nest.cy, 2);
  }

  private fillRect(arr: Uint8Array, r: Rect, v: number) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) if (this.inBounds(x, y)) arr[y * this.cols + x] = v;
  }

  private cellsAround(cx: number, cy: number, r: number): number[] {
    const out: number[] = [];
    for (let y = cy - r; y <= cy + r; y++)
      for (let x = cx - r; x <= cx + r; x++) if (this.inBounds(x, y)) out.push(y * this.cols + x);
    return out;
  }

  inBounds(cx: number, cy: number) {
    return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows;
  }
  cellOf(x: number, y: number): number {
    const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.tile)));
    const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.tile)));
    return cy * this.cols + cx;
  }
  cellCenter(c: number): Vec {
    return { x: ((c % this.cols) + 0.5) * this.tile, y: (Math.floor(c / this.cols) + 0.5) * this.tile };
  }
  isBlockedAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.cols * this.tile || y >= this.rows * this.tile) return true;
    return this.blocked[this.cellOf(x, y)] === 1;
  }
  isMudAt(x: number, y: number): boolean {
    return this.mud[this.cellOf(x, y)] === 1;
  }

  /** Marca as células cobertas por uma estrutura bloqueadora. */
  setStructure(id: number, x: number, y: number, radius: number, low: boolean, add: boolean) {
    const r = Math.max(0, radius - 4);
    const x0 = Math.floor((x - r) / this.tile), x1 = Math.floor((x + r) / this.tile);
    const y0 = Math.floor((y - r) / this.tile), y1 = Math.floor((y + r) / this.tile);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        if (!this.inBounds(cx, cy)) continue;
        const c = cy * this.cols + cx;
        if (add) {
          this.structureAt[c] = id;
          this.lowAt[c] = low ? 1 : 0;
        } else if (this.structureAt[c] === id) {
          this.structureAt[c] = 0;
          this.lowAt[c] = 0;
        }
      }
    this.dirty = true;
  }

  recompute() {
    this.dirty = false;
    this.dijkstra('ground', this.goalCore, (c) => (this.structureAt[c] ? STRUCTURE_COST : 0) + (this.mud[c] ? 0.8 : 0));
    this.dijkstra('low', this.goalCore, (c) => (this.structureAt[c] && !this.lowAt[c] ? STRUCTURE_COST : 0) + (this.mud[c] ? 0.8 : 0));
    this.dijkstra('flank', this.goalCore, (c) => {
      const row = Math.floor(c / this.cols);
      const col = c % this.cols;
      const center = row >= this.centerRows[0] && row <= this.centerRows[1] && col > 12 ? 2.2 : 0;
      return (this.structureAt[c] ? STRUCTURE_COST : 0) + center;
    });
    this.dijkstra('free', this.goalCore, () => 0);
    this.dijkstra('allyNest', this.goalNest, (c) => (this.mud[c] ? 0.5 : 0));
  }

  private dijkstra(id: FieldId, goals: number[], extra: (c: number) => number) {
    const dist = this.fields[id];
    const next = this.next[id];
    dist.fill(INF);
    next.fill(-1);
    // Fila de prioridade binária simples.
    const heap: number[] = [];
    const prio: number[] = [];
    const push = (c: number, d: number) => {
      heap.push(c);
      prio.push(d);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (prio[p] <= prio[i]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        [prio[p], prio[i]] = [prio[i], prio[p]];
        i = p;
      }
    };
    const pop = (): [number, number] => {
      const c = heap[0], d = prio[0];
      const lc = heap.pop()!, lp = prio.pop()!;
      if (heap.length) {
        heap[0] = lc;
        prio[0] = lp;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < heap.length && prio[l] < prio[m]) m = l;
          if (r < heap.length && prio[r] < prio[m]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          [prio[m], prio[i]] = [prio[i], prio[m]];
          i = m;
        }
      }
      return [c, d];
    };
    for (const gc of goals) {
      dist[gc] = 0;
      push(gc, 0);
    }
    while (heap.length) {
      const [c, d] = pop();
      if (d > dist[c] + 1e-6) continue;
      const cx = c % this.cols, cy = (c / this.cols) | 0;
      for (const [dx, dy, cost] of NEIGHBORS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        const nc = ny * this.cols + nx;
        if (this.blocked[nc]) continue;
        if (dx !== 0 && dy !== 0 && (this.blocked[cy * this.cols + nx] || this.blocked[ny * this.cols + cx])) continue;
        const nd = d + cost + extra(nc);
        if (nd < dist[nc]) {
          dist[nc] = nd;
          next[nc] = c;
          push(nc, nd);
        }
      }
    }
  }

  /** Próxima célula do campo de fluxo (-1 se já no objetivo ou isolado). */
  nextCell(field: FieldId, c: number): number {
    return this.next[field][c];
  }
  distance(field: FieldId, c: number): number {
    return this.fields[field][c];
  }

  /** Linha de visão entre dois pontos (sem obstáculos estáticos). */
  lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.ceil(len / (this.tile * 0.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isBlockedAt(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  /** A* em 8 direções com heurística octil. Retorna pontos (centros) até o destino. */
  findPath(sx: number, sy: number, tx: number, ty: number, maxNodes = 900): Vec[] | null {
    const start = this.cellOf(sx, sy);
    let goal = this.cellOf(tx, ty);
    if (this.blocked[goal]) goal = this.nearestFree(goal);
    if (goal < 0) return null;
    if (start === goal) return [{ x: tx, y: ty }];
    const n = this.cols * this.rows;
    const g = new Float32Array(n).fill(INF);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const open: number[] = [start];
    const f = new Float32Array(n).fill(INF);
    const gx = goal % this.cols, gy = (goal / this.cols) | 0;
    const h = (c: number) => {
      const ddx = Math.abs((c % this.cols) - gx), ddy = Math.abs(((c / this.cols) | 0) - gy);
      return Math.max(ddx, ddy) + (Math.SQRT2 - 1) * Math.min(ddx, ddy);
    };
    g[start] = 0;
    f[start] = h(start);
    let expanded = 0;
    while (open.length && expanded < maxNodes) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const c = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (c === goal) {
        const path: Vec[] = [];
        let k = c;
        while (k !== start && k >= 0) {
          path.push(this.cellCenter(k));
          k = came[k];
        }
        path.reverse();
        if (path.length) path[path.length - 1] = { x: tx, y: ty };
        return path;
      }
      closed[c] = 1;
      expanded++;
      const cx = c % this.cols, cy = (c / this.cols) | 0;
      for (const [dx, dy, cost] of NEIGHBORS) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.inBounds(nx, ny)) continue;
        const nc = ny * this.cols + nx;
        if (this.blocked[nc] || closed[nc]) continue;
        if (dx !== 0 && dy !== 0 && (this.blocked[cy * this.cols + nx] || this.blocked[ny * this.cols + cx])) continue;
        const ng = g[c] + cost;
        if (ng < g[nc]) {
          if (g[nc] === INF) open.push(nc);
          g[nc] = ng;
          f[nc] = ng + h(nc);
          came[nc] = c;
        }
      }
    }
    return null;
  }

  nearestFree(c: number): number {
    const cx = c % this.cols, cy = (c / this.cols) | 0;
    for (let r = 1; r < 6; r++)
      for (let y = cy - r; y <= cy + r; y++)
        for (let x = cx - r; x <= cx + r; x++)
          if (this.inBounds(x, y) && !this.blocked[y * this.cols + x]) return y * this.cols + x;
    return -1;
  }
}
