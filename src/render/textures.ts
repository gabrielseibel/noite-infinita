import Phaser from 'phaser';
import { ALL_ACTORS } from '../data/actors';
import { CARDS } from '../data/cards';
import type { CardDef } from '../sim/types';
import { POSES, SMALL_TEXTURES, STATUS_ICONS, artExtent, drawActor, hasArt, makeCanvas } from './art';

/** Resolução interna das texturas (2x para nitidez com zoom). */
export const RES = 2;

export const actorKey = (id: string) => `actor_${id}`;

/** Gera todas as texturas procedurais. `onProgress` recebe 0..1. */
export async function generateTextures(scene: Phaser.Scene, onProgress: (p: number) => void) {
  const tasks: (() => void)[] = [];
  for (const a of ALL_ACTORS) {
    if (!hasArt(a.id)) continue;
    tasks.push(() => {
      const size = artExtent(a.id, a.radius) * RES;
      const cv = makeCanvas(size * POSES.length, size);
      const c = cv.getContext('2d')!;
      POSES.forEach((pose, i) => {
        c.save();
        c.translate(i * size, 0);
        c.scale(RES, RES);
        drawActor(c, a.id, pose, size / RES, a.radius);
        c.restore();
      });
      const key = actorKey(a.id);
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const tex = scene.textures.addCanvas(key, cv)!;
      POSES.forEach((pose, i) => tex.add(pose, 0, i * size, 0, size, size));
    });
  }
  for (const [key, [w, h, draw]] of Object.entries(SMALL_TEXTURES)) {
    tasks.push(() => {
      const cv = makeCanvas(w, h);
      draw(cv.getContext('2d')!, w, h);
      if (!scene.textures.exists(key)) scene.textures.addCanvas(key, cv);
    });
  }
  for (const [key, draw] of Object.entries(STATUS_ICONS)) {
    tasks.push(() => {
      const cv = makeCanvas(20, 20);
      const c = cv.getContext('2d')!;
      c.fillStyle = 'rgba(0,0,0,0.55)';
      c.beginPath();
      c.arc(10, 10, 9.5, 0, Math.PI * 2);
      c.fill();
      draw(c);
      if (!scene.textures.exists('st_' + key)) scene.textures.addCanvas('st_' + key, cv);
    });
  }
  tasks.push(() => makeFogTexture(scene));
  for (let i = 0; i < tasks.length; i++) {
    tasks[i]();
    if (i % 6 === 5) {
      onProgress((i + 1) / tasks.length);
      await new Promise((r) => setTimeout(r, 0)); // não bloqueia a interface
    }
  }
  onProgress(1);
}

function makeFogTexture(scene: Phaser.Scene) {
  const S = 512;
  const cv = makeCanvas(S, S);
  const c = cv.getContext('2d')!;
  // Nuvens suaves com repetição nas bordas (desenhadas 9 vezes deslocadas).
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 110;
    for (const ox of [-S, 0, S])
      for (const oy of [-S, 0, S]) {
        const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, `rgba(255,255,255,${0.05 + Math.random() * 0.08})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
  }
  if (!scene.textures.exists('fog')) scene.textures.addCanvas('fog', cv);
}

// ---------------------------------------------------------------------------
// Ilustrações das cartas (data URLs usadas pela interface HTML)
// ---------------------------------------------------------------------------

const CATEGORY_BG: Record<string, [string, string]> = {
  survivor: ['#3a2a1a', '#120c08'],
  creature: ['#2a1a3a', '#0c0812'],
  structure: ['#1a2a32', '#080e12'],
  ability: ['#3a1414', '#120606'],
};

const artCache: Record<string, string> = {};

export function cardArt(card: CardDef): string {
  if (artCache[card.id]) return artCache[card.id];
  const W = 180, H = 132;
  const cv = makeCanvas(W, H);
  const c = cv.getContext('2d')!;
  const [a, b] = CATEGORY_BG[card.category];
  const g = c.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // névoa / luz de fundo
  const lg = c.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, 70);
  lg.addColorStop(0, 'rgba(255,220,160,0.25)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = lg;
  c.fillRect(0, 0, W, H);
  if (card.ability) drawAbilityArt(c, card, W, H);
  else if (card.actor) {
    const actor = ALL_ACTORS.find((x) => x.id === card.actor)!;
    const ext = artExtent(actor.id, actor.radius);
    const scale = Math.min(3.4, (H * 0.95) / ext);
    c.save();
    c.translate(W / 2 - (ext * scale) / 2, H * 0.52 - (ext * scale) / 2);
    c.scale(scale, scale);
    drawActor(c, actor.id, 'attack', ext, actor.radius);
    c.restore();
    if ((card.count ?? 1) > 1) {
      c.save();
      c.globalAlpha = 0.7;
      c.translate(W * 0.18 - (ext * scale * 0.7) / 2, H * 0.6 - (ext * scale * 0.7) / 2);
      c.scale(scale * 0.7, scale * 0.7);
      drawActor(c, actor.id, 'walk1', ext, actor.radius);
      c.restore();
    }
  }
  // vinheta
  const vg = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.7)');
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);
  artCache[card.id] = cv.toDataURL('image/png');
  return artCache[card.id];
}

function drawAbilityArt(c: CanvasRenderingContext2D, card: CardDef, W: number, H: number) {
  if (card.ability!.type === 'fireZone') {
    const fg = c.createRadialGradient(W / 2, H * 0.75, 4, W / 2, H * 0.7, 60);
    fg.addColorStop(0, 'rgba(255,240,180,1)');
    fg.addColorStop(0.4, 'rgba(255,120,20,0.9)');
    fg.addColorStop(1, 'rgba(120,0,0,0)');
    c.fillStyle = fg;
    c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H * 0.45);
    c.rotate(-0.5);
    c.fillStyle = '#3a6a3a';
    c.beginPath();
    c.roundRect(-11, -8, 22, 34, 6);
    c.fill();
    c.fillStyle = 'rgba(160,255,160,0.35)';
    c.fillRect(-7, -2, 5, 24);
    c.fillStyle = '#3a6a3a';
    c.fillRect(-4, -22, 8, 16);
    c.fillStyle = '#e6d6b0';
    c.fillRect(-3, -32, 6, 12);
    const f = c.createRadialGradient(0, -36, 0, 0, -36, 14);
    f.addColorStop(0, '#fff6c0');
    f.addColorStop(0.5, '#ff9a1a');
    f.addColorStop(1, 'rgba(255,60,0,0)');
    c.fillStyle = f;
    c.beginPath();
    c.arc(0, -36, 14, 0, Math.PI * 2);
    c.fill();
    c.restore();
  } else {
    const cx = W / 2, cy = H / 2;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, 70);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(255,250,210,0.9)');
    g.addColorStop(0.6, 'rgba(150,200,255,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,230,0.8)';
    c.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
      c.lineTo(cx + Math.cos(a) * (40 + (i % 2) * 22), cy + Math.sin(a) * (40 + (i % 2) * 22));
      c.stroke();
    }
    // silhueta de espectro sendo dissipado
    c.fillStyle = 'rgba(20,24,40,0.6)';
    c.beginPath();
    c.ellipse(cx + 48, cy + 10, 9, 18, 0.2, 0, Math.PI * 2);
    c.fill();
  }
}

/** Gera as ilustrações de todas as cartas antecipadamente. */
export function preloadCardArt() {
  for (const c of CARDS) cardArt(c);
}
