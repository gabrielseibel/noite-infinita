import type { Entity } from './types';

/** Hash espacial uniforme para consultas de vizinhança em O(k). */
export class SpatialHash {
  private cells = new Map<number, Entity[]>();
  constructor(private size: number) {}

  private key(cx: number, cy: number) {
    return (cx + 1024) * 4096 + (cy + 1024);
  }

  rebuild(list: Entity[]) {
    for (const arr of this.cells.values()) arr.length = 0;
    for (const e of list) if (e.alive) this.insert(e);
  }

  insert(e: Entity) {
    const k = this.key(Math.floor(e.x / this.size), Math.floor(e.y / this.size));
    let arr = this.cells.get(k);
    if (!arr) this.cells.set(k, (arr = []));
    arr.push(e);
  }

  query(x: number, y: number, r: number, cb: (e: Entity) => void) {
    const x0 = Math.floor((x - r) / this.size), x1 = Math.floor((x + r) / this.size);
    const y0 = Math.floor((y - r) / this.size), y1 = Math.floor((y + r) / this.size);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const arr = this.cells.get(this.key(cx, cy));
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) cb(arr[i]);
      }
  }
}
