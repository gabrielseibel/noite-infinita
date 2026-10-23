// Arte procedural em Canvas 2D. Cada ator é desenhado em uma pose (parado, passo A/B, ataque).
// Personagens são desenhados virados para a direita em vista 3/4 de cima; a renderização espelha no eixo X.
// Para substituir por arte final, basta carregar spritesheets com as mesmas chaves (ver README).

export type Pose = 'idle' | 'walk1' | 'walk2' | 'attack';
export const POSES: Pose[] = ['idle', 'walk1', 'walk2', 'attack'];

type Ctx = CanvasRenderingContext2D;
type Draw = (c: Ctx, p: PoseInfo) => void;
interface PoseInfo {
  pose: Pose;
  step: number; // -1, 0, 1 (fase da perna)
  atk: number; // 0..1
}

const TAU = Math.PI * 2;

function shadow(c: Ctx, w = 9, h = 3.2, y = 9) {
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.ellipse(0, y, w, h, 0, 0, TAU);
  c.fill();
}

function circle(c: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, lw = 1) {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = lw;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  c.fillStyle = fill;
  c.fill();
}

function line(c: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, w: number) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.strokeStyle = color;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.stroke();
}

function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = 0.8;
    c.strokeStyle = stroke;
    c.stroke();
  }
}

function poly(c: Ctx, pts: number[], fill: string, stroke?: string, lw = 0.8) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

function glow(c: Ctx, x: number, y: number, r: number, color: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

// ---------------------------------------------------------------------------
// Sobreviventes (humanoides)
// ---------------------------------------------------------------------------

interface HumanStyle {
  jacket: string;
  pants: string;
  skin: string;
  hair: string;
  hat?: 'cap' | 'helmet' | 'hood' | 'bandana' | 'hardhat' | 'none';
  hatColor?: string;
  weapon: 'pistol' | 'crossbow' | 'shotgun' | 'wrench' | 'medkit' | 'baton' | 'none';
  bulky?: boolean;
  backpack?: string;
  stripe?: string;
}

function human(s: HumanStyle): Draw {
  return (c, p) => {
    const bw = s.bulky ? 6.5 : 5;
    shadow(c, s.bulky ? 10 : 8.5);
    // pernas
    const lx = p.step * 2.6;
    line(c, -1.8, 2, -2.5 - lx, 9, s.pants, 2.8);
    line(c, 1.8, 2, 2.5 + lx, 9, s.pants, 2.8);
    circle(c, -2.5 - lx, 9.2, 1.4, '#151515');
    circle(c, 2.5 + lx, 9.2, 1.4, '#151515');
    if (s.backpack) rrect(c, -bw - 2.5, -5, 4, 7, 1.2, s.backpack, '#0008');
    // torso
    rrect(c, -bw, -6, bw * 2, 9.5, 2.5, s.jacket, '#000a');
    if (s.stripe) line(c, -bw + 1, -1, bw - 1, -1, s.stripe, 1.4);
    // braço de trás
    const reach = p.atk * 3;
    line(c, -2, -4, 2 + reach * 0.5, 0, s.jacket, 2.4);
    // cabeça
    circle(c, 1, -9.5, 3.9, s.skin, '#0009', 0.6);
    c.fillStyle = s.hair;
    c.beginPath();
    c.arc(0.4, -10.4, 3.9, Math.PI * 0.95, Math.PI * 2.05);
    c.fill();
    circle(c, 3.6, -9.6, 0.6, '#111');
    switch (s.hat) {
      case 'cap':
        ellipse(c, 0.5, -12.2, 4.3, 2, s.hatColor!);
        rrect(c, 1.5, -12.8, 4.8, 1.5, 0.7, s.hatColor!);
        break;
      case 'helmet':
        c.fillStyle = s.hatColor!;
        c.beginPath();
        c.arc(0.8, -10.5, 4.6, Math.PI, TAU);
        c.fill();
        rrect(c, -4, -11, 9.6, 1.6, 0.7, s.hatColor!, '#0008');
        break;
      case 'hardhat':
        c.fillStyle = s.hatColor!;
        c.beginPath();
        c.arc(0.8, -11, 4.3, Math.PI, TAU);
        c.fill();
        rrect(c, -4.2, -11.4, 10, 1.3, 0.6, s.hatColor!);
        break;
      case 'hood':
        c.fillStyle = s.hatColor!;
        c.beginPath();
        c.arc(0.4, -10, 4.8, Math.PI * 0.8, Math.PI * 2.1);
        c.fill();
        break;
      case 'bandana':
        line(c, -3, -11, 4.5, -11, s.hatColor!, 1.6);
        break;
    }
    // braço da frente + arma
    const ax = 4 + reach, ay = -3 - p.atk * 1.5;
    line(c, 2, -4, ax, ay, s.jacket, 2.6);
    circle(c, ax, ay, 1.3, s.skin);
    switch (s.weapon) {
      case 'pistol':
        rrect(c, ax - 0.5, ay - 1.8, 5.5, 1.8, 0.5, '#2b2b2f', '#000');
        break;
      case 'crossbow':
        line(c, ax - 2, ay, ax + 9, ay - 0.6, '#5b3b22', 1.8);
        line(c, ax + 6, ay - 4.5, ax + 6.6, ay + 3.8, '#3a2a1a', 1.2);
        line(c, ax + 6, ay - 4.5, ax + 1, ay - 0.3, '#ccc8', 0.4);
        line(c, ax + 6.6, ay + 3.8, ax + 1, ay - 0.3, '#ccc8', 0.4);
        break;
      case 'shotgun':
        line(c, ax - 3, ay + 0.5, ax + 8, ay - 0.5, '#3a2a20', 2.6);
        line(c, ax + 2, ay - 0.6, ax + 9.5, ay - 1.2, '#1c1c1f', 1.8);
        break;
      case 'wrench':
        line(c, ax, ay, ax + 5, ay - 4, '#9aa0a8', 1.5);
        circle(c, ax + 5.5, ay - 4.5, 1.6, '#9aa0a8');
        circle(c, ax + 5.9, ay - 4.9, 0.6, s.jacket);
        break;
      case 'medkit':
        rrect(c, ax - 1, ay - 1, 5, 4, 0.8, '#eeeeee', '#0008');
        line(c, ax + 1.5, ay, ax + 1.5, ay + 2, '#d32f2f', 0.9);
        line(c, ax + 0.5, ay + 1, ax + 2.5, ay + 1, '#d32f2f', 0.9);
        break;
      case 'baton':
        line(c, ax, ay, ax + 7, ay - 3, '#2a2a2a', 2);
        rrect(c, -9.5, -6, 4.5, 10, 1.2, '#4b5563', '#000b');
        break;
    }
  };
}

// ---------------------------------------------------------------------------
// Criaturas e monstros
// ---------------------------------------------------------------------------

const zombie = (skin: string, cloth: string, hunched = 0, eye = '#ffef9a'): Draw => (c, p) => {
  shadow(c, 8.5);
  const lx = p.step * 2.2;
  line(c, -1.5, 2, -2.5 - lx, 9, cloth, 2.6);
  line(c, 1.5, 2, 2.2 + lx, 9, '#3b3b3b', 2.6);
  c.save();
  c.rotate(0.15 + hunched * 0.2);
  rrect(c, -4.8, -6, 9.6, 9, 2.6, cloth, '#000a');
  line(c, -3, -1, 3, 0, '#000a', 0.8);
  c.restore();
  // braços estendidos
  const reach = 6 + p.atk * 3;
  line(c, 1, -4, 1 + reach, -3 + p.step, skin, 2.2);
  line(c, -1, -3, reach - 1, -1 - p.step, skin, 2.2);
  circle(c, 2.5 + hunched, -9.2 + hunched, 3.8, skin, '#000a', 0.6);
  circle(c, 4.3 + hunched, -9.8 + hunched, 0.8, eye);
  line(c, 2.6 + hunched, -7 + hunched, 5 + hunched, -7.3 + hunched, '#3a0d0d', 0.7);
};

const ART: Record<string, Draw> = {
  gunslinger: human({ jacket: '#7a4a2a', pants: '#2f3542', skin: '#d9a679', hair: '#2b1a10', hat: 'cap', hatColor: '#3c2a1c', weapon: 'pistol', stripe: '#c9a227' }),
  huntress: human({ jacket: '#3f5a3a', pants: '#2b2b26', skin: '#c99573', hair: '#7a2f1a', hat: 'hood', hatColor: '#2f4a2c', weapon: 'crossbow', backpack: '#4a3a28' }),
  medic: human({ jacket: '#d8d8d8', pants: '#3a4252', skin: '#e0b48c', hair: '#1a1a1a', hat: 'bandana', hatColor: '#d32f2f', weapon: 'medkit', stripe: '#d32f2f' }),
  engineer: human({ jacket: '#c76b1e', pants: '#2f3a48', skin: '#a8754f', hair: '#1d1410', hat: 'hardhat', hatColor: '#f2c230', weapon: 'wrench', backpack: '#555b63' }),
  shotgunner: human({ jacket: '#2f3f5a', pants: '#1f2430', skin: '#cf9e78', hair: '#3a2a1a', hat: 'helmet', hatColor: '#26324a', weapon: 'shotgun', stripe: '#9fb4d8' }),
  veteran: human({ jacket: '#4b5320', pants: '#2c301a', skin: '#b98a65', hair: '#8a8a8a', hat: 'helmet', hatColor: '#3d4419', weapon: 'baton', bulky: true }),
  refugee: human({ jacket: '#8a6d9e', pants: '#3a3a44', skin: '#e2b590', hair: '#b07a2a', hat: 'none', weapon: 'none', backpack: '#7a5a3a' }),
  wardog: (c, p) => {
    shadow(c, 10, 3, 7);
    const s = p.step * 2.2;
    for (const [x, ph] of [[-6, 1], [-3.5, -1], [3, -1], [5.5, 1]]) line(c, x, 2, x + s * ph, 7.5, '#3a2a1e', 2);
    ellipse(c, 0, 0, 8, 4.4, '#5b4030');
    ellipse(c, -1, -1.2, 6, 2.4, '#6e4f3a');
    line(c, -7.5, -1, -11, -4 + p.step, '#5b4030', 1.8);
    const hx = 8 + p.atk * 3;
    ellipse(c, hx, -3, 4, 3.2, '#5b4030');
    ellipse(c, hx + 3.2, -2.2, 2.4, 1.6, '#4a3326');
    poly(c, [hx - 2, -5, hx - 0.5, -8.5, hx + 0.8, -5], '#3d2b20');
    circle(c, hx + 1.2, -3.8, 0.7, '#ffd54f');
    if (p.atk > 0) line(c, hx + 2, -0.8, hx + 5, -0.5, '#fff', 0.7);
    line(c, -4, -3.4, 4, -3.4, '#b71c1c', 1.1);
  },
  raven: (c, p) => {
    shadow(c, 6, 2, 12);
    const flap = p.pose === 'walk1' ? -1 : p.pose === 'walk2' ? 1 : 0.2;
    glow(c, 0, -2, 11, 'rgba(120,200,255,0.25)');
    poly(c, [-2, -2, -11, -6 - flap * 5, -6, 0], '#1b1e2e', '#7fd3ff', 0.5);
    poly(c, [1, -2, 9, -7 - flap * 5, 5, 0], '#151827', '#7fd3ff', 0.5);
    ellipse(c, 0, -1, 4.5, 2.6, '#1f2335');
    circle(c, 4, -3, 2.3, '#22263a');
    poly(c, [6, -3.4, 9 + p.atk * 2, -2.8, 6, -2.2], '#d4b45a');
    circle(c, 4.8, -3.6, 0.6, '#7fe7ff');
    poly(c, [-4, -1, -8, 1, -4, 1], '#1b1e2e');
  },
  bone_golem: (c, p) => {
    shadow(c, 11, 3.6, 9.5);
    const s = p.step * 2;
    rrect(c, -6 - s * 0.3, 2, 4, 7.5, 1.5, '#d6cfbd', '#3d3a33');
    rrect(c, 2 + s * 0.3, 2, 4, 7.5, 1.5, '#d6cfbd', '#3d3a33');
    rrect(c, -8, -9, 16, 12, 4, '#cbc3ae', '#3d3a33');
    for (let i = -1; i <= 1; i++) line(c, -6, -5 + i * 3, 6, -5 + i * 3, '#8f8774', 0.9);
    circle(c, 0, -12, 4.2, '#e5dece', '#3d3a33', 0.8);
    circle(c, 1.4, -12.4, 1, '#62e0ff');
    circle(c, -1.4, -12.4, 1, '#62e0ff');
    const ax = 10 + p.atk * 3;
    line(c, 6, -6, ax, -1 + p.atk * 2, '#d6cfbd', 3.4);
    circle(c, ax, -1 + p.atk * 2, 2.6, '#bdb59f', '#3d3a33', 0.7);
    line(c, -6, -6, -9, 0, '#d6cfbd', 3);
    glow(c, 0, -5, 6, 'rgba(98,224,255,0.35)');
  },
  reaper: (c, p) => {
    ellipse(c, 0, 10, 8, 2.6, 'rgba(0,0,0,0.4)');
    glow(c, 0, -2, 14, 'rgba(140,90,255,0.25)');
    poly(c, [-7, 9, -5, -6, 0, -12, 5, -6, 7, 9, 3, 6.5, 0, 9.5, -3, 6.5], '#171221', '#8f6bff', 0.6);
    circle(c, 0.5, -9, 3.8, '#0a0810');
    circle(c, 1.6, -9.2, 0.8, '#c7a6ff');
    circle(c, -0.6, -9.2, 0.8, '#c7a6ff');
    // foice
    const a = -0.6 + p.atk * 1.6;
    c.save();
    c.translate(3, -3);
    c.rotate(a);
    line(c, 0, 4, 0, -14, '#4a3a2a', 1.4);
    c.beginPath();
    c.moveTo(0, -14);
    c.quadraticCurveTo(10, -14, 13, -6);
    c.quadraticCurveTo(8, -11, 0, -11.5);
    c.fillStyle = '#cfd6e6';
    c.fill();
    c.restore();
  },
  // Estruturas
  watchtower: (c) => {
    ellipse(c, 0, 10, 14, 4, 'rgba(0,0,0,0.5)');
    for (const [x0, x1] of [[-9, -6], [9, 6]]) line(c, x0, 10, x1, -6, '#5a4130', 2.2);
    line(c, -8, 4, 8, -2, '#4a3426', 1.2);
    line(c, 8, 4, -8, -2, '#4a3426', 1.2);
    rrect(c, -10, -12, 20, 8, 1.5, '#7a5a40', '#2a1d14');
    for (let i = -8; i <= 8; i += 4) line(c, i, -12, i, -4, '#5a4130', 0.7);
    poly(c, [-12, -12, 0, -20, 12, -12], '#3b2b20', '#1a120c');
    rrect(c, 4, -11, 10, 2, 0.6, '#222', '#000');
    circle(c, 0, -8, 1.4, '#ffd27f');
  },
  uv_tower: (c) => {
    ellipse(c, 0, 10, 12, 3.6, 'rgba(0,0,0,0.5)');
    rrect(c, -7, 4, 14, 6, 1.5, '#3b3f4a', '#111');
    line(c, 0, 5, 0, -12, '#707684', 2.4);
    line(c, -4, 5, 0, -6, '#555b66', 1);
    line(c, 4, 5, 0, -6, '#555b66', 1);
    glow(c, 0, -14, 12, 'rgba(170,110,255,0.6)');
    rrect(c, -5, -17, 10, 6, 2, '#2a2540', '#c9a6ff');
    rrect(c, -4, -16, 8, 4, 1.5, '#d9c4ff');
    rrect(c, -5, 6, 3, 2, 0.5, '#ffcf3a');
  },
  barricade: (c) => {
    ellipse(c, 0, 8, 15, 4, 'rgba(0,0,0,0.5)');
    for (const [x, r] of [[-10, -0.5], [10, 0.5]]) {
      c.save();
      c.translate(x, 2);
      c.rotate(r);
      rrect(c, -1.5, -8, 3, 14, 1, '#6b4b33', '#20140c');
      c.restore();
    }
    rrect(c, -14, -6, 28, 5, 1, '#8a6444', '#2a1a10');
    rrect(c, -13, 0, 26, 5, 1, '#7a5a3e', '#2a1a10');
    rrect(c, -6, -8, 12, 14, 1, '#6f7680', '#20242a');
    for (const [x, y] of [[-4, -6], [4, -6], [-4, 4], [4, 4]]) circle(c, x, y, 0.8, '#2a2d33');
    line(c, -14, -8, 14, 6, '#9aa0a8', 0.6);
  },
  mini_barricade: (c) => {
    ellipse(c, 0, 7, 11, 3, 'rgba(0,0,0,0.5)');
    for (const [x, y] of [[-6, 2], [0, 2], [6, 2], [-3, -2.5], [3, -2.5]]) ellipse(c, x, y, 4, 2.8, '#8c7a55', );
    for (const [x, y] of [[-6, 2], [0, 2], [6, 2], [-3, -2.5], [3, -2.5]]) line(c, x - 3, y, x + 3, y, '#5c4f35', 0.6);
  },
  spike_trap: (c) => {
    ellipse(c, 0, 1, 13, 7, '#3a3631');
    ellipse(c, 0, 1, 11, 5.6, '#4a453e');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      const x = Math.cos(a) * 7, y = Math.sin(a) * 3.5 + 1;
      poly(c, [x - 1.2, y, x, y - 5, x + 1.2, y], '#b0b6bf', '#333');
    }
    poly(c, [-1.4, 1, 0, -6, 1.4, 1], '#d0d6df', '#333');
  },
  core: (c) => {
    ellipse(c, 2, 14, 30, 8, 'rgba(0,0,0,0.55)');
    rrect(c, -26, -16, 52, 30, 3, '#3b3d40', '#121314');
    rrect(c, -26, -20, 52, 8, 2, '#4d5054', '#121314');
    for (let x = -22; x < 24; x += 8) line(c, x, -19, x + 4, -13, '#2b2d30', 0.8);
    rrect(c, -7, -2, 14, 16, 1.5, '#5a4a32', '#1a140c');
    line(c, 0, -2, 0, 14, '#2a2014', 0.8);
    for (const x of [-18, 13]) {
      rrect(c, x, -8, 6, 5, 0.8, '#ffcf7a');
      glow(c, x + 3, -5.5, 8, 'rgba(255,190,90,0.45)');
    }
    rrect(c, -24, 10, 10, 5, 1, '#6f6248', '#222');
    rrect(c, 15, 10, 10, 5, 1, '#6f6248', '#222');
    line(c, 18, -20, 22, -30, '#888', 0.8);
    circle(c, 22, -30, 1.2, '#ff3b3b');
    glow(c, 22, -30, 5, 'rgba(255,60,60,0.6)');
  },
  debris: (c) => {
    ellipse(c, 0, 8, 15, 4, 'rgba(0,0,0,0.5)');
    rrect(c, -12, -2, 12, 9, 1, '#5a4634', '#1d150e');
    rrect(c, -2, -8, 13, 10, 1, '#6a5440', '#1d150e');
    line(c, -2, -8, 11, 2, '#3a2c1f', 0.8);
    line(c, -14, 4, 12, -6, '#7a6a5a', 1.6);
    rrect(c, 2, 2, 10, 6, 1, '#555', '#222');
  },
  nest: (c, p) => {
    const pulse = p.pose === 'walk1' ? 1.06 : p.pose === 'walk2' ? 0.96 : 1;
    glow(c, 0, 0, 30, 'rgba(255,30,60,0.35)');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3;
      c.beginPath();
      c.moveTo(Math.cos(a) * 10, Math.sin(a) * 7);
      c.quadraticCurveTo(Math.cos(a + 0.4) * 22, Math.sin(a + 0.4) * 15, Math.cos(a) * 27, Math.sin(a) * 18);
      c.strokeStyle = '#3a0d17';
      c.lineWidth = 2.4;
      c.stroke();
    }
    ellipse(c, 0, 3, 22 * pulse, 14 * pulse, '#2a0a12');
    ellipse(c, 0, 0, 17 * pulse, 11 * pulse, '#4a1220');
    for (const [x, y, r] of [[-7, -2, 3], [6, 1, 4], [0, -5, 2.5], [-2, 4, 3.5], [9, -4, 2]]) {
      circle(c, x, y, r * pulse, '#7a1c2c');
      circle(c, x - r * 0.3, y - r * 0.3, r * 0.4, '#ff6b81');
    }
    ellipse(c, 0, 0, 5, 3.4, '#ff2e4d');
    glow(c, 0, 0, 9, 'rgba(255,80,100,0.8)');
  },
  // Inimigos
  wanderer: zombie('#9fb18a', '#4a4f3a', 0),
  runner: (c, p) => {
    shadow(c, 8);
    const lx = p.step * 3.6;
    line(c, -1, 1, -4 - lx, 9, '#5a3a3a', 2);
    line(c, 1, 1, 4 + lx, 9, '#5a3a3a', 2);
    c.save();
    c.rotate(0.5);
    rrect(c, -3.2, -7, 6.4, 9, 2, '#9c5b52', '#000a');
    for (let i = 0; i < 3; i++) line(c, -2, -5 + i * 2.5, 2, -5 + i * 2.5, '#5c2b26', 0.6);
    c.restore();
    line(c, 2, -4, 9 + p.atk * 3, -6, '#c2847a', 1.6);
    line(c, 0, -3, -6, 1 + p.step * 2, '#c2847a', 1.6);
    circle(c, 6, -8.5, 3, '#c2847a', '#000a', 0.6);
    line(c, 6.5, -6.8, 9, -7.4, '#3a0d0d', 0.9);
    circle(c, 7.5, -9.2, 0.7, '#ff5252');
  },
  brute: (c, p) => {
    shadow(c, 13, 4, 10);
    const lx = p.step * 2;
    rrect(c, -7 - lx, 2, 5, 8, 2, '#4d4a42', '#000');
    rrect(c, 2 + lx, 2, 5, 8, 2, '#4d4a42', '#000');
    ellipse(c, 0, -4, 11, 9, '#7c8a6a');
    ellipse(c, -1, -2, 8, 6, '#6a775a');
    for (const [x, y] of [[-5, -6], [3, -8], [5, -2]]) ellipse(c, x, y, 2, 1.4, '#a2b38a');
    line(c, -5, -9, 5, -1, '#3d2020', 0.8);
    const ax = 11 + p.atk * 4;
    line(c, 6, -6, ax, 0 - p.atk * 2, '#7c8a6a', 5);
    circle(c, ax, 0 - p.atk * 2, 4, '#6a775a', '#000', 0.7);
    line(c, -6, -6, -10, 2, '#7c8a6a', 4.5);
    circle(c, 4, -12, 3.2, '#8c9a78', '#000', 0.6);
    circle(c, 5.6, -12.4, 0.8, '#ffea7a');
    rrect(c, -8, -4, 16, 3, 1, '#3a3530');
  },
  crawler: (c, p) => {
    ellipse(c, 0, 4, 11, 3, 'rgba(0,0,0,0.45)');
    const s = p.step;
    for (let i = 0; i < 3; i++) {
      const x = -5 + i * 5;
      line(c, x, 1, x - 2 + s * (i % 2 ? 2 : -2), 5.5, '#6f7d60', 1.3);
      line(c, x, -1, x - 2 - s * (i % 2 ? 2 : -2), -5.5, '#6f7d60', 1.3);
    }
    ellipse(c, 0, 0, 10, 3.6, '#8a9a76');
    ellipse(c, 1, -0.6, 7, 2, '#a3b38c');
    circle(c, 9 + p.atk * 2, 0, 2.8, '#93a37f', '#000a', 0.6);
    circle(c, 10.5 + p.atk * 2, -0.8, 0.7, '#ffef9a');
    line(c, 10 + p.atk * 2, 1, 12 + p.atk * 3, 1.5, '#3a0d0d', 0.6);
  },
  spitter: (c, p) => {
    shadow(c, 9);
    const lx = p.step * 2;
    line(c, -2, 3, -3 - lx, 9, '#4f5a3f', 2.4);
    line(c, 2, 3, 3 + lx, 9, '#4f5a3f', 2.4);
    ellipse(c, 0, -2, 7, 7.5, '#6b7a4a');
    ellipse(c, -1, -1, 5.2, 5.5, '#9acd32');
    glow(c, -1, -1, 7, 'rgba(160,255,60,0.5)');
    for (const [x, y] of [[-3, -3], [1, 1], [-1, 2.5]]) circle(c, x, y, 1, '#d4ff7a');
    const mx = 5 + p.atk * 2;
    circle(c, mx, -9, 3.4, '#6b7a4a', '#000a', 0.6);
    ellipse(c, mx + 2.4, -8, 1.8, 1.2 + p.atk, '#2a3a10');
    circle(c, mx + 0.6, -10.2, 0.7, '#ffff8d');
  },
  parasite: (c, p) => {
    ellipse(c, 0, 5, 8, 2.4, 'rgba(0,0,0,0.45)');
    const s = p.step;
    for (let i = 0; i < 4; i++) {
      const a = 0.4 + i * 0.75;
      line(c, 0, 0, Math.cos(a + s * 0.2) * 9, Math.sin(a) * 5 + 1, '#5a2a6a', 1.2);
      line(c, 0, 0, -Math.cos(a - s * 0.2) * 9, Math.sin(a) * 5 + 1, '#5a2a6a', 1.2);
    }
    ellipse(c, 0, -1, 6, 4.5, '#7b3f8f');
    ellipse(c, -1, -2, 3.6, 2.4, '#b06fc4');
    glow(c, 0, -1, 7, 'rgba(200,100,255,0.35)');
    const mx = 5 + p.atk * 3;
    line(c, 4, -1, mx + 3, -2, '#3a1a44', 1.4);
    circle(c, 4.2, -2.6, 0.8, '#ff66ff');
    circle(c, 2.6, -2.9, 0.7, '#ff66ff');
  },
  specter: (c, p) => {
    const bob = p.pose === 'walk1' ? -1 : p.pose === 'walk2' ? 1 : 0;
    ellipse(c, 0, 12, 6, 2, 'rgba(0,0,0,0.3)');
    glow(c, 0, -3 + bob, 14, 'rgba(180,220,255,0.35)');
    c.globalAlpha = 0.85;
    c.beginPath();
    c.moveTo(-6, -4 + bob);
    c.quadraticCurveTo(-7, -14 + bob, 0, -14 + bob);
    c.quadraticCurveTo(7, -14 + bob, 6, -4 + bob);
    c.lineTo(5, 6 + bob);
    c.quadraticCurveTo(2, 3 + bob, 0, 8 + bob);
    c.quadraticCurveTo(-2, 3 + bob, -5, 7 + bob);
    c.closePath();
    const g = c.createLinearGradient(0, -14, 0, 8);
    g.addColorStop(0, '#e8f4ff');
    g.addColorStop(1, 'rgba(160,200,255,0.1)');
    c.fillStyle = g;
    c.fill();
    c.globalAlpha = 1;
    ellipse(c, 1, -9 + bob, 3.6, 3, '#1a2233');
    circle(c, 2.4, -9.5 + bob, 0.9, '#9ff');
    circle(c, -0.2, -9.5 + bob, 0.9, '#9ff');
    line(c, 4, -5 + bob, 9 + p.atk * 3, -3 + bob, 'rgba(220,240,255,0.8)', 1.4);
  },
  abyss_spider: (c, p) => {
    ellipse(c, 0, 4, 11, 3.4, 'rgba(0,0,0,0.5)');
    const s = p.step;
    for (let i = 0; i < 4; i++) {
      const x = -3 + i * 2.2;
      const ph = (i % 2 ? 1 : -1) * s;
      c.beginPath();
      c.moveTo(x, 0);
      c.quadraticCurveTo(x - 2 + ph * 2, -9, x - 5 + ph * 3, 5);
      c.moveTo(x, 0);
      c.quadraticCurveTo(x + 2 - ph * 2, 9, x + 4 - ph * 3, 6);
      c.strokeStyle = '#141018';
      c.lineWidth = 1.3;
      c.stroke();
    }
    ellipse(c, -4, 0, 5.5, 4.4, '#1d1622');
    ellipse(c, -5, -1, 2.6, 1.6, '#5a1a2a');
    ellipse(c, 3, -0.5, 3.6, 3, '#241b2b');
    for (const [x, y] of [[4.5, -1.6], [5.6, -0.6], [4.2, 0.4]]) circle(c, x + p.atk, y, 0.7, '#ff1744');
    glow(c, 5, -0.6, 4, 'rgba(255,30,70,0.6)');
  },
  screamer: (c, p) => {
    shadow(c, 8, 3, 10);
    const lx = p.step * 2;
    line(c, -1.5, 3, -2 - lx, 10, '#4a3a30', 1.8);
    line(c, 1.5, 3, 2 + lx, 10, '#4a3a30', 1.8);
    rrect(c, -4, -9, 8, 13, 3, '#8a5a3a', '#000a');
    line(c, -3, -7, -9, -13 - p.atk * 3, '#a57a5a', 1.4);
    line(c, 3, -7, 9, -13 - p.atk * 3, '#a57a5a', 1.4);
    ellipse(c, 0.5, -14, 4.2, 5, '#b0855f');
    ellipse(c, 1.2, -12.5, 2.4, 3 + p.atk * 1.5, '#2a0505');
    glow(c, 1.2, -12.5, 6, 'rgba(255,140,40,0.5)');
    circle(c, -0.5, -16.5, 0.7, '#ffcc80');
    circle(c, 2.6, -16.5, 0.7, '#ffcc80');
  },
  devourer: (c, p) => {
    shadow(c, 15, 5, 11);
    const lx = p.step * 2;
    rrect(c, -9 - lx, 2, 6, 9, 2, '#3a1414', '#000');
    rrect(c, 3 + lx, 2, 6, 9, 2, '#3a1414', '#000');
    ellipse(c, 0, -4, 14, 11, '#5a1a1e');
    ellipse(c, -2, -6, 9, 6, '#7a2228');
    glow(c, 4, -5, 12, 'rgba(255,40,40,0.35)');
    const open = 3 + p.atk * 4;
    ellipse(c, 7, -4, 6, open, '#120304');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      poly(c, [7 + Math.cos(a) * 5.5, -4 + Math.sin(a) * open, 7 + Math.cos(a) * 3, -4 + Math.sin(a) * open * 0.55, 7 + Math.cos(a + 0.3) * 5.5, -4 + Math.sin(a + 0.3) * open], '#eee2c8');
    }
    for (const [x, y] of [[-8, -10], [-4, -13], [1, -12]]) poly(c, [x - 1.5, y + 2, x, y - 3, x + 1.5, y + 2], '#2a0a0c');
    line(c, -12, -4, -16, 4, '#5a1a1e', 4);
    circle(c, -3, -9, 1, '#ffeb3b');
    circle(c, 0, -10, 0.8, '#ffeb3b');
  },
  brood: (c, p) => {
    ellipse(c, 0, 4, 6, 2, 'rgba(0,0,0,0.45)');
    const s = p.step;
    for (let i = 0; i < 3; i++) {
      line(c, -2 + i * 2, 0, -4 + i * 3 + s, 4, '#6a2a3a', 1);
      line(c, -2 + i * 2, 0, -4 + i * 3 - s, -4, '#6a2a3a', 1);
    }
    ellipse(c, 0, 0, 5, 3.4, '#9a3a52');
    circle(c, 4 + p.atk, -0.5, 2, '#b04a62');
    circle(c, 5 + p.atk, -1, 0.6, '#ffd0e0');
  },
  butcher: (c, p) => {
    shadow(c, 14, 4.5, 11);
    const lx = p.step * 2;
    rrect(c, -8 - lx, 2, 6, 9, 2, '#3a2a2a', '#000');
    rrect(c, 2 + lx, 2, 6, 9, 2, '#3a2a2a', '#000');
    ellipse(c, 0, -4, 13, 11, '#a0786a');
    rrect(c, -9, -10, 16, 15, 3, '#ddd3c0', '#3a302a');
    for (const [x, y, r] of [[-5, -6, 2], [2, -2, 2.6], [-2, 2, 1.8], [4, -8, 1.4]]) circle(c, x, y, r, '#8a1c1c');
    line(c, -12, -4, -14, 4, '#a0786a', 4);
    circle(c, 3, -15, 4.5, '#b88c7c', '#000', 0.7);
    rrect(c, 0, -16, 7, 3, 1, '#d9d0c0');
    circle(c, 5.8, -15.5, 0.8, '#ff3d00');
    const a = -1 + p.atk * 2.2;
    c.save();
    c.translate(10, -8);
    c.rotate(a);
    line(c, 0, 0, 0, -6, '#3a2a1a', 2);
    rrect(c, -1, -18, 9, 12, 1, '#b0b7c0', '#333');
    line(c, 7, -18, 7, -6, '#e6ebf2', 0.8);
    rrect(c, 1, -16, 3, 3, 0.5, '#8a1c1c');
    c.restore();
  },
  matriarch: (c, p) => {
    ellipse(c, 0, 11, 16, 5, 'rgba(0,0,0,0.5)');
    glow(c, 0, -2, 22, 'rgba(255,60,140,0.3)');
    const s = p.step;
    for (let i = 0; i < 4; i++) {
      const x = -8 + i * 5;
      line(c, x, 2, x - 4 + s * 2 * (i % 2 ? 1 : -1), 11, '#3a1428', 2);
      line(c, x, 2, x + 4 - s * 2 * (i % 2 ? 1 : -1), 11, '#3a1428', 2);
    }
    ellipse(c, -2, 0, 14, 8, '#6a2048');
    for (let i = 0; i < 6; i++) ellipse(c, -9 + i * 3, 1 + (i % 2), 2, 1.5, '#ffb0d8');
    ellipse(c, 6, -9, 6, 8, '#7a2a58');
    ellipse(c, 7, -15, 4, 4.6, '#8a3a68');
    line(c, 3, -12, -2, -20 - p.atk * 3, '#7a2a58', 2);
    line(c, 10, -12, 14, -20 - p.atk * 3, '#7a2a58', 2);
    for (const [x, y] of [[6, -16], [8.5, -16], [7.2, -14]]) circle(c, x, y, 0.8, '#ff4fa3');
    glow(c, 7, -15, 6, 'rgba(255,80,160,0.6)');
  },
  faceless: (c, p) => {
    ellipse(c, 0, 12, 9, 3, 'rgba(0,0,0,0.55)');
    glow(c, 0, -6, 20, 'rgba(20,0,40,0.6)');
    const lx = p.step * 1.6;
    line(c, -2, 3, -2.6 - lx, 12, '#0d0d12', 2.4);
    line(c, 2, 3, 2.6 + lx, 12, '#0d0d12', 2.4);
    poly(c, [-6, 4, -5, -12, 5, -12, 6, 4], '#14141c', '#3a3a50', 0.5);
    rrect(c, -1, -12, 2, 6, 0.4, '#e0e0e0');
    poly(c, [0, -10, -1.4, -7.5, 1.4, -7.5], '#8a0d0d');
    ellipse(c, 0, -17, 4, 5, '#e8e4dc');
    line(c, -5, -9, -9 - p.atk * 2, 4, '#14141c', 1.8);
    line(c, 5, -9, 10 + p.atk * 6, 0, '#14141c', 1.8);
    for (let i = 0; i < 4; i++) line(c, 10 + p.atk * 6, 0, 12 + p.atk * 6 + i, 2 + i * 0.8, '#0a0a0f', 0.6);
  },
};

/** Tamanho do sprite (em pixels do mundo) por ator. */
export function artExtent(id: string, radius: number): number {
  const base = id === 'core' ? 72 : id === 'nest' ? 64 : radius * 2;
  return Math.ceil(base * 1.9 + 10);
}

/** Desenha um quadro de ator num canvas. `scale` converte unidades de arte (raio 10) em pixels. */
export function drawActor(c: Ctx, id: string, pose: Pose, size: number, radius: number) {
  const draw = ART[id];
  const unit = id === 'core' ? 1.25 : id === 'nest' ? 1.55 : radius / 10;
  c.save();
  c.translate(size / 2, size / 2);
  c.scale(unit, unit);
  const p: PoseInfo = { pose, step: pose === 'walk1' ? 1 : pose === 'walk2' ? -1 : 0, atk: pose === 'attack' ? 1 : 0 };
  if (draw) draw(c, p);
  else circle(c, 0, 0, 9, '#f0f', '#000');
  c.restore();
}

export function hasArt(id: string) {
  return !!ART[id];
}

// ---------------------------------------------------------------------------
// Projéteis, partículas, ícones e utilidades
// ---------------------------------------------------------------------------

export function makeCanvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

export const SMALL_TEXTURES: Record<string, [number, number, (c: Ctx, w: number, h: number) => void]> = {
  light: [256, 256, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  }],
  dot: [16, 16, (c) => glow(c, 8, 8, 8, 'rgba(255,255,255,1)')],
  hard: [8, 8, (c) => circle(c, 4, 4, 3.5, '#fff')],
  spark: [16, 4, (c) => {
    const g = c.createLinearGradient(0, 0, 16, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, '#fff');
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 4);
  }],
  blood: [10, 10, (c) => {
    circle(c, 5, 5, 3.5, '#fff');
    circle(c, 7, 4, 2, '#fff');
  }],
  chip: [8, 4, (c) => rrect(c, 0, 0, 8, 4, 1, '#fff')],
  smoke: [64, 64, (c) => glow(c, 32, 32, 32, 'rgba(255,255,255,0.55)')],
  leaf: [10, 6, (c) => ellipse(c, 5, 3, 4.5, 2.2, '#fff', 0.3)],
  rain: [2, 18, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 18);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.8)');
    c.fillStyle = g;
    c.fillRect(0, 0, 2, 18);
  }],
  ring: [128, 128, (c) => {
    c.beginPath();
    c.arc(64, 64, 60, 0, TAU);
    c.strokeStyle = '#fff';
    c.lineWidth = 6;
    c.stroke();
  }],
  disc: [128, 128, (c) => circle(c, 64, 64, 63, '#fff')],
  p_bullet: [14, 4, (c) => {
    const g = c.createLinearGradient(0, 0, 14, 0);
    g.addColorStop(0, 'rgba(255,220,120,0)');
    g.addColorStop(1, '#fff6c0');
    c.fillStyle = g;
    rrect(c, 0, 0.5, 14, 3, 1.5, g as unknown as string);
  }],
  p_pellet: [6, 6, (c) => circle(c, 3, 3, 2.4, '#ffe08a')],
  p_arrow: [18, 5, (c) => {
    line(c, 1, 2.5, 15, 2.5, '#d9c7a0', 1.4);
    poly(c, [14, 0.5, 18, 2.5, 14, 4.5], '#e6e6e6');
    poly(c, [0, 0.5, 3, 2.5, 0, 4.5], '#b71c1c');
  }],
  p_acid: [12, 12, (c) => {
    glow(c, 6, 6, 6, 'rgba(170,255,60,0.9)');
    circle(c, 6, 6, 3, '#d4ff6a');
  }],
  p_uv: [18, 6, (c) => {
    glow(c, 12, 3, 6, 'rgba(200,140,255,0.9)');
    rrect(c, 0, 2, 18, 2, 1, '#e6d4ff');
  }],
  p_feather: [8, 8, (c) => circle(c, 4, 4, 3, '#9fe7ff')],
  p_spit: [12, 12, (c) => {
    glow(c, 6, 6, 6, 'rgba(255,150,40,0.9)');
    circle(c, 6, 6, 2.6, '#ffcc80');
  }],
  scorch: [64, 64, (c) => {
    glow(c, 32, 32, 30, 'rgba(10,6,4,0.85)');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      line(c, 32, 32, 32 + Math.cos(a) * 28, 32 + Math.sin(a) * 24, 'rgba(0,0,0,0.5)', 2);
    }
  }],
  splat: [48, 48, (c) => {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * TAU, d = Math.random() * 14;
      circle(c, 24 + Math.cos(a) * d, 24 + Math.sin(a) * d * 0.7, 3 + Math.random() * 6, 'rgba(255,255,255,0.9)');
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU;
      circle(c, 24 + Math.cos(a) * 20, 24 + Math.sin(a) * 15, 1.5, '#fff');
    }
  }],
  flame: [24, 32, (c) => {
    const g = c.createRadialGradient(12, 22, 1, 12, 20, 14);
    g.addColorStop(0, 'rgba(255,255,200,1)');
    g.addColorStop(0.4, 'rgba(255,160,40,0.9)');
    g.addColorStop(1, 'rgba(200,40,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(12, 0);
    c.quadraticCurveTo(24, 18, 18, 28);
    c.quadraticCurveTo(12, 32, 6, 28);
    c.quadraticCurveTo(0, 18, 12, 0);
    c.fill();
  }],
  firefly: [12, 12, (c) => glow(c, 6, 6, 6, 'rgba(220,255,140,1)')],
  eyes: [16, 8, (c) => {
    glow(c, 4, 4, 4, 'rgba(255,240,180,1)');
    glow(c, 12, 4, 4, 'rgba(255,240,180,1)');
  }],
};

/** Ícones de estado com formas distintas (não dependem só de cor). */
export const STATUS_ICONS: Record<string, (c: Ctx) => void> = {
  stun: (c) => {
    for (const [x, y] of [[5, 8], [11, 5], [16, 9]]) {
      c.save();
      c.translate(x, y);
      poly(c, [0, -3.5, 1, -1, 3.5, -1, 1.5, 0.8, 2.2, 3.5, 0, 2, -2.2, 3.5, -1.5, 0.8, -3.5, -1, -1, -1], '#ffe14d', '#3a2a00', 0.6);
      c.restore();
    }
  },
  slow: (c) => {
    c.beginPath();
    c.arc(10, 9, 5, Math.PI * 0.2, Math.PI * 1.9);
    c.strokeStyle = '#7fd3ff';
    c.lineWidth = 2.2;
    c.stroke();
    line(c, 2, 14, 18, 14, '#7fd3ff', 2);
  },
  burn: (c) => poly(c, [10, 1, 16, 10, 14, 16, 6, 16, 4, 10, 8, 8], '#ff7a1a', '#3a1000', 0.8),
  poison: (c) => {
    poly(c, [10, 1, 15, 10, 10, 16, 5, 10], '#7dff4a', '#103a00', 0.8);
    circle(c, 9, 10, 1.4, '#103a00');
  },
  enrage: (c) => poly(c, [10, 2, 17, 10, 13, 10, 13, 17, 7, 17, 7, 10, 3, 10], '#ff4d4d', '#3a0000', 0.8),
  taunted: (c) => {
    rrect(c, 8, 1, 4, 11, 1.5, '#ffb84d', '#3a2000');
    circle(c, 10, 15.5, 2, '#ffb84d', '#3a2000', 0.8);
  },
  reinforced: (c) => poly(c, [10, 1, 17, 4, 16, 11, 10, 17, 4, 11, 3, 4], '#9fb4d8', '#0a1a3a', 1),
  vulnerable: (c) => {
    poly(c, [10, 1, 17, 4, 16, 11, 10, 17, 4, 11, 3, 4], '#ff5252', '#3a0000', 1);
    line(c, 7, 5, 13, 13, '#3a0000', 1.6);
    line(c, 13, 5, 7, 13, '#3a0000', 1.6);
  },
  disabled: (c) => {
    c.beginPath();
    c.arc(10, 10, 6, -Math.PI * 0.3, Math.PI * 1.3);
    c.strokeStyle = '#c0c0c0';
    c.lineWidth = 2.2;
    c.stroke();
    line(c, 10, 2, 10, 9, '#c0c0c0', 2.2);
  },
};
