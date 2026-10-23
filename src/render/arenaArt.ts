import type { MapDef, Obstacle, ThemeDef } from '../data/maps';
import { Rng } from '../sim/rng';

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

const hex = (n: number, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
const shade = (n: number, f: number, a = 1) => {
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgba(${r},${g},${b},${a})`;
};

/**
 * Pinta o cenário estático da arena (chão, estradas, lama, obstáculos e adereços) num canvas.
 * É gerado uma vez por partida e usado como textura de fundo.
 */
export function paintArena(map: MapDef, theme: ThemeDef, tile: number, seed = 3): HTMLCanvasElement {
  const W = map.cols * tile, H = map.rows * tile;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  const rng = new Rng(seed);

  // Chão base com manchas
  c.fillStyle = hex(theme.ground);
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    const x = rng.range(0, W), y = rng.range(0, H), r = rng.range(8, 60);
    c.fillStyle = rng.chance(0.5) ? hex(theme.groundAlt, rng.range(0.15, 0.4)) : shade(theme.ground, 0.7, rng.range(0.1, 0.3));
    c.beginPath();
    c.ellipse(x, y, r, r * rng.range(0.5, 1), rng.range(0, TAU), 0, TAU);
    c.fill();
  }
  // Grama seca
  for (let i = 0; i < 1600; i++) {
    const x = rng.range(0, W), y = rng.range(0, H);
    c.strokeStyle = shade(theme.groundAlt, rng.range(1.1, 1.7), rng.range(0.25, 0.6));
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + rng.range(-3, 3), y - rng.range(3, 8));
    c.stroke();
  }

  // Estradas
  for (const r of map.roads) {
    const x = r.x * tile, y = r.y * tile, w = r.w * tile, h = r.h * tile;
    c.fillStyle = hex(theme.road);
    c.fillRect(x, y + 3, w, h - 6);
    c.fillStyle = shade(theme.road, 0.7);
    c.fillRect(x, y, w, 3);
    c.fillRect(x, y + h - 3, w, 3);
    // asfalto granulado
    for (let i = 0; i < (w * h) / 220; i++) {
      c.fillStyle = shade(theme.road, rng.range(0.7, 1.35), 0.5);
      c.fillRect(x + rng.range(0, w), y + rng.range(0, h), 2, 2);
    }
    // faixa central tracejada e desgastada
    if (h >= tile * 3) {
      c.fillStyle = 'rgba(210,190,120,0.35)';
      for (let xx = x + 10; xx < x + w; xx += 46) if (rng.chance(0.8)) c.fillRect(xx, y + h / 2 - 2, 24, 3);
    }
    // rachaduras
    for (let i = 0; i < w / 40; i++) crack(c, rng, x + rng.range(0, w), y + rng.range(4, h - 4), rng.range(20, 60));
  }

  // Lama / poças com reflexo
  for (const m of map.mud) {
    const x = m.x * tile, y = m.y * tile, w = m.w * tile, h = m.h * tile;
    for (let i = 0; i < 14; i++) {
      c.fillStyle = `rgba(30,22,14,${rng.range(0.35, 0.6)})`;
      c.beginPath();
      c.ellipse(x + rng.range(w * 0.2, w * 0.8), y + rng.range(h * 0.2, h * 0.8), rng.range(w * 0.2, w * 0.5), rng.range(h * 0.2, h * 0.45), 0, 0, TAU);
      c.fill();
    }
    for (let i = 0; i < 5; i++) {
      const px = x + rng.range(w * 0.2, w * 0.8), py = y + rng.range(h * 0.2, h * 0.8);
      c.fillStyle = 'rgba(40,50,60,0.55)';
      c.beginPath();
      c.ellipse(px, py, rng.range(10, 26), rng.range(5, 12), 0, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(160,190,220,0.25)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(px - 3, py - 2, rng.range(4, 10), 2, 0, Math.PI * 1.1, Math.PI * 1.8);
      c.stroke();
    }
  }

  // Zona do abrigo: concreto rachado
  const coreX = (map.core.cx + 0.5) * tile, coreY = (map.core.cy + 0.5) * tile;
  c.fillStyle = 'rgba(70,70,72,0.35)';
  c.beginPath();
  c.ellipse(coreX, coreY, 120, 90, 0, 0, TAU);
  c.fill();
  for (let i = 0; i < 8; i++) crack(c, rng, coreX + rng.range(-90, 90), coreY + rng.range(-70, 70), 30);

  // Raízes do ninho
  const nestX = (map.nest.cx + 0.5) * tile, nestY = (map.nest.cy + 0.5) * tile;
  for (let i = 0; i < 24; i++) {
    const a = rng.range(Math.PI * 0.4, Math.PI * 1.6);
    const len = rng.range(80, 220);
    c.strokeStyle = `rgba(70,10,20,${rng.range(0.4, 0.8)})`;
    c.lineWidth = rng.range(2, 6);
    c.beginPath();
    c.moveTo(nestX, nestY);
    c.quadraticCurveTo(nestX + Math.cos(a + 0.3) * len * 0.6, nestY + Math.sin(a + 0.3) * len * 0.6, nestX + Math.cos(a) * len, nestY + Math.sin(a) * len);
    c.stroke();
  }
  const ng = c.createRadialGradient(nestX, nestY, 10, nestX, nestY, 160);
  ng.addColorStop(0, 'rgba(90,10,25,0.6)');
  ng.addColorStop(1, 'rgba(90,10,25,0)');
  c.fillStyle = ng;
  c.fillRect(nestX - 160, nestY - 160, 320, 320);

  // Adereços pelo chão (fora de obstáculos)
  const isBlocked = (x: number, y: number) =>
    map.obstacles.some((o) => x >= o.x * tile - 6 && x <= (o.x + o.w) * tile + 6 && y >= o.y * tile - 6 && y <= (o.y + o.h) * tile + 6);
  for (let i = 0; i < 70; i++) {
    const x = rng.range(40, W - 40), y = rng.range(30, H - 30);
    if (isBlocked(x, y) || Math.hypot(x - coreX, y - coreY) < 90) continue;
    prop(c, rng, rng.pick(theme.props), x, y, theme);
  }
  if (theme.props.includes('rail')) {
    c.strokeStyle = 'rgba(120,100,80,0.5)';
    c.lineWidth = 2;
    for (const yy of [13.2 * tile, 14.8 * tile]) {
      c.beginPath();
      c.moveTo(9 * tile, yy);
      c.lineTo(W, yy);
      c.stroke();
    }
    for (let x = 9 * tile; x < W; x += 18) {
      c.fillStyle = 'rgba(70,50,30,0.6)';
      c.fillRect(x, 12.9 * tile, 6, tile * 2.2);
    }
  }

  // Sombras dos obstáculos e depois os obstáculos
  for (const o of map.obstacles) {
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.fillRect(o.x * tile + 8, o.y * tile + 10, o.w * tile, o.h * tile);
  }
  for (const o of map.obstacles) obstacle(c, rng, o, tile, theme);

  // Vinheta
  const vg = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);
  return cv;
}

function crack(c: Ctx, rng: Rng, x: number, y: number, len: number) {
  c.strokeStyle = 'rgba(0,0,0,0.45)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x, y);
  let a = rng.range(0, TAU);
  for (let i = 0; i < 5; i++) {
    a += rng.range(-0.8, 0.8);
    x += Math.cos(a) * (len / 5);
    y += Math.sin(a) * (len / 5);
    c.lineTo(x, y);
  }
  c.stroke();
}

function prop(c: Ctx, rng: Rng, kind: string, x: number, y: number, theme: ThemeDef) {
  c.save();
  c.translate(x, y);
  c.rotate(rng.range(-0.6, 0.6));
  switch (kind) {
    case 'corpse': {
      // silhueta caída (não interativa)
      c.fillStyle = 'rgba(12,10,10,0.75)';
      c.beginPath();
      c.ellipse(0, 0, 11, 4.5, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.arc(13, -1, 4, 0, TAU);
      c.fill();
      c.fillRect(-4, 3, 3, 8);
      c.fillRect(2, -9, 3, 7);
      c.fillStyle = 'rgba(90,10,10,0.5)';
      c.beginPath();
      c.ellipse(4, 4, 14, 6, 0.3, 0, TAU);
      c.fill();
      break;
    }
    case 'barrel':
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.beginPath();
      c.ellipse(3, 4, 9, 5, 0, 0, TAU);
      c.fill();
      c.fillStyle = rng.chance(0.5) ? '#5a2a1a' : '#2a3a4a';
      c.beginPath();
      c.arc(0, 0, 8, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.6)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, 0, 5, 0, TAU);
      c.stroke();
      break;
    case 'tire':
      c.strokeStyle = '#141414';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(0, 0, 7, 0, TAU);
      c.stroke();
      break;
    case 'crate':
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(-6, -4, 16, 14);
      c.fillStyle = '#5a4634';
      c.fillRect(-8, -8, 14, 14);
      c.strokeStyle = '#2a1d12';
      c.lineWidth = 1.2;
      c.strokeRect(-8, -8, 14, 14);
      c.beginPath();
      c.moveTo(-8, -8);
      c.lineTo(6, 6);
      c.stroke();
      break;
    case 'bones':
      c.strokeStyle = 'rgba(210,200,180,0.65)';
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(rng.range(-8, 8), rng.range(-6, 6));
        c.lineTo(rng.range(-8, 8), rng.range(-6, 6));
        c.stroke();
      }
      c.fillStyle = 'rgba(220,210,190,0.7)';
      c.beginPath();
      c.arc(8, -2, 3.2, 0, TAU);
      c.fill();
      break;
    case 'cross':
      c.fillStyle = 'rgba(0,0,0,0.4)';
      c.fillRect(-1, 2, 12, 4);
      c.fillStyle = '#4a3a2a';
      c.fillRect(-2, -14, 4, 18);
      c.fillRect(-7, -9, 14, 3.5);
      break;
    case 'grave':
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(-4, 0, 16, 6);
      c.fillStyle = shade(theme.building, 1.8);
      c.beginPath();
      c.roundRect(-7, -14, 14, 16, [7, 7, 1, 1]);
      c.fill();
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(-3, -8, 6, 1.5);
      break;
  }
  c.restore();
}

function obstacle(c: Ctx, rng: Rng, o: Obstacle, tile: number, theme: ThemeDef) {
  const x = o.x * tile, y = o.y * tile, w = o.w * tile, h = o.h * tile;
  switch (o.type) {
    case 'building': {
      c.fillStyle = hex(theme.building);
      c.fillRect(x, y, w, h);
      // telhado em placas
      for (let yy = y + 4; yy < y + h - 4; yy += 12) {
        c.fillStyle = shade(theme.building, rng.range(0.8, 1.2));
        c.fillRect(x + 4, yy, w - 8, 10);
      }
      c.strokeStyle = shade(theme.building, 1.6, 0.8);
      c.lineWidth = 3;
      c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      // buraco no telhado
      if (w > 64 && h > 64) {
        const hx = x + rng.range(w * 0.25, w * 0.6), hy = y + rng.range(h * 0.25, h * 0.6);
        c.fillStyle = 'rgba(0,0,0,0.75)';
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU, r = rng.range(10, 22);
          c[i ? 'lineTo' : 'moveTo'](hx + Math.cos(a) * r, hy + Math.sin(a) * r);
        }
        c.fill();
        c.strokeStyle = '#3a2a1a';
        c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(hx - 20, hy - 10 + i * 10);
          c.lineTo(hx + 20, hy - 6 + i * 10);
          c.stroke();
        }
      }
      // janelas com luz fraca
      for (let i = 0; i < Math.max(1, w / 48); i++) {
        if (!rng.chance(0.5)) continue;
        const wx = x + 8 + i * 48;
        c.fillStyle = rng.chance(0.4) ? 'rgba(255,200,110,0.55)' : 'rgba(20,24,30,0.9)';
        c.fillRect(wx, y + h - 6, 14, 5);
      }
      // ar-condicionado / caixa d'água
      c.fillStyle = shade(theme.building, 1.4);
      c.fillRect(x + w - 24, y + 8, 14, 12);
      break;
    }
    case 'car': {
      const horiz = w >= h;
      const n = Math.max(1, Math.round((horiz ? w : h) / (tile * 2)));
      for (let i = 0; i < n; i++) {
        const cx = horiz ? x + (i + 0.5) * (w / n) : x + w / 2;
        const cy = horiz ? y + h / 2 : y + (i + 0.5) * (h / n);
        car(c, rng, cx, cy, horiz ? Math.min(58, w / n - 4) : Math.min(28, w - 4), horiz ? Math.min(28, h - 4) : Math.min(58, h / n - 4), horiz);
      }
      break;
    }
    case 'trees': {
      for (let i = 0; i < (o.w * o.h) * 2.2 + 2; i++) {
        const tx = x + rng.range(6, w - 6), ty = y + rng.range(6, h - 6), r = rng.range(14, 26);
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.beginPath();
        c.arc(tx + 6, ty + 8, r, 0, TAU);
        c.fill();
        c.fillStyle = hex(theme.tree);
        c.beginPath();
        c.arc(tx, ty, r, 0, TAU);
        c.fill();
        // galhos secos
        c.strokeStyle = shade(theme.tree, 2.6, 0.9);
        c.lineWidth = 1.5;
        for (let k = 0; k < 5; k++) {
          const a = rng.range(0, TAU);
          c.beginPath();
          c.moveTo(tx, ty);
          c.lineTo(tx + Math.cos(a) * r * 1.1, ty + Math.sin(a) * r * 1.1);
          c.stroke();
        }
        c.fillStyle = shade(theme.tree, 1.9, 0.6);
        c.beginPath();
        c.arc(tx - r * 0.3, ty - r * 0.3, r * 0.45, 0, TAU);
        c.fill();
      }
      break;
    }
    case 'rocks': {
      for (let i = 0; i < o.w * o.h + 2; i++) {
        const rx = x + rng.range(4, w - 4), ry = y + rng.range(4, h - 4), r = rng.range(12, 22);
        c.fillStyle = shade(theme.building, rng.range(0.9, 1.4));
        c.beginPath();
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * TAU, rr = r * rng.range(0.7, 1.1);
          c[k ? 'lineTo' : 'moveTo'](rx + Math.cos(a) * rr, ry + Math.sin(a) * rr * 0.8);
        }
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.5)';
        c.lineWidth = 1.5;
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.beginPath();
        c.arc(rx - r * 0.3, ry - r * 0.3, r * 0.35, 0, TAU);
        c.fill();
      }
      break;
    }
    case 'machine': {
      c.fillStyle = '#3a3530';
      c.fillRect(x, y, w, h);
      c.fillStyle = '#5a4a3a';
      for (let i = 0; i < 3; i++) c.fillRect(x + 6 + i * (w / 3), y + 6, w / 3 - 12, h - 12);
      c.strokeStyle = '#8a6a3a';
      c.lineWidth = 2;
      c.strokeRect(x + 2, y + 2, w - 4, h - 4);
      c.fillStyle = 'rgba(255,170,60,0.6)';
      c.fillRect(x + w - 14, y + 6, 6, 6);
      break;
    }
    case 'wall': {
      // paliçada de estacas + chapas
      const vertical = h > w;
      const len = vertical ? h : w;
      for (let k = 0; k < len; k += 9) {
        const px = vertical ? x + w / 2 : x + k + 4;
        const py = vertical ? y + k + 4 : y + h / 2;
        c.fillStyle = rng.chance(0.25) ? '#6f7680' : '#5a4130';
        c.beginPath();
        c.arc(px, py, 6, 0, TAU);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.6)';
        c.lineWidth = 1;
        c.stroke();
        c.fillStyle = 'rgba(255,230,180,0.12)';
        c.beginPath();
        c.arc(px - 2, py - 2, 2.4, 0, TAU);
        c.fill();
      }
      c.strokeStyle = 'rgba(160,160,170,0.55)';
      c.lineWidth = 1;
      c.beginPath();
      for (let k = 0; k < len; k += 6) {
        const px = vertical ? x + w / 2 + (k % 12 ? 4 : -4) : x + k;
        const py = vertical ? y + k : y + h / 2 + (k % 12 ? 4 : -4);
        c[k ? 'lineTo' : 'moveTo'](px, py);
      }
      c.stroke();
      break;
    }
    case 'graves': {
      for (let i = 0; i < o.w * o.h; i++) prop(c, rng, 'grave', x + rng.range(8, w - 8), y + rng.range(14, h - 4), theme);
      break;
    }
  }
}

function car(c: Ctx, rng: Rng, cx: number, cy: number, w: number, h: number, horiz: boolean) {
  c.save();
  c.translate(cx, cy);
  c.rotate((horiz ? 0 : Math.PI / 2) + rng.range(-0.15, 0.15));
  const L = horiz ? w : h, Wd = horiz ? h : w;
  const colors = ['#4a2a22', '#2a3540', '#3b3b2a', '#4a4a4a', '#2a2430'];
  c.fillStyle = colors[rng.int(0, colors.length - 1)];
  c.beginPath();
  c.roundRect(-L / 2, -Wd / 2, L, Wd, 6);
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.lineWidth = 1.5;
  c.stroke();
  // ferrugem
  for (let i = 0; i < 5; i++) {
    c.fillStyle = `rgba(120,60,20,${rng.range(0.2, 0.5)})`;
    c.beginPath();
    c.arc(rng.range(-L / 2, L / 2), rng.range(-Wd / 2, Wd / 2), rng.range(2, 6), 0, TAU);
    c.fill();
  }
  // para-brisa quebrado
  c.fillStyle = 'rgba(60,80,100,0.75)';
  c.fillRect(L * 0.08, -Wd / 2 + 3, L * 0.18, Wd - 6);
  c.fillRect(-L * 0.32, -Wd / 2 + 3, L * 0.12, Wd - 6);
  c.strokeStyle = 'rgba(200,220,240,0.35)';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(L * 0.1, -Wd / 4);
  c.lineTo(L * 0.24, Wd / 5);
  c.stroke();
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.fillRect(-L * 0.18, -Wd / 2 + 3, L * 0.24, Wd - 6);
  c.restore();
}
