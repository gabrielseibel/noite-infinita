import type { ActorDef } from '../sim/types';

export interface BossConfig {
  /** Golpe pesado telegrafado (Açougueiro). */
  slam?: { interval: number; telegraph: number; radius: number; damage: number; vsStructures: number; vulnerable: number; vulnerableMult: number };
  /** Ninhada (Matriarca). */
  brood?: { interval: number; telegraph: number; count: number; actor: string; maxAlive: number; reductionPerBrood: number; maxReduction: number; radius: number };
  /** Teleporte e escuridão (Homem Sem Rosto). */
  faceless?: { interval: number; telegraph: number; jump: number; darkRadius: number };
}

export const BOSS_CONFIG: Record<string, BossConfig> = {
  butcher: { slam: { interval: 8.5, telegraph: 1.4, radius: 110, damage: 170, vsStructures: 2.5, vulnerable: 3, vulnerableMult: 2 } },
  matriarch: { brood: { interval: 8, telegraph: 1.1, count: 4, actor: 'brood', maxAlive: 12, reductionPerBrood: 0.12, maxReduction: 0.6, radius: 220 } },
  faceless: { faceless: { interval: 7, telegraph: 1.0, jump: 280, darkRadius: 170 } },
};

export const BOSS_ACTORS: ActorDef[] = [
  {
    id: 'butcher', name: 'O Açougueiro', kind: 'boss', hp: 4600, radius: 30, speed: 26, armor: 0.2, tags: ['boss', 'elite', 'heavy'], ai: 'butcher', aggroRange: 140, bounty: 30,
    attack: { kind: 'melee', damage: 60, range: 40, interval: 1.5, windup: 0.5, targets: 'ground', damageType: 'physical', vsStructures: 1.8, splash: 40 },
    blurb: 'Golpeia o chão em área. Fica vulnerável após o golpe pesado.',
  },
  {
    id: 'matriarch', name: 'A Matriarca', kind: 'boss', hp: 3900, radius: 28, speed: 18, armor: 0.1, tags: ['boss', 'elite', 'supernatural'], ai: 'matriarch', aggroRange: 170, bounty: 30,
    attack: { kind: 'projectile', damage: 32, range: 160, interval: 1.7, windup: 0.5, targets: 'ground', damageType: 'poison', splash: 34, projectileSpeed: 300, projectileFx: 'acid' },
    blurb: 'Invoca crias. Cada cria viva reduz o dano que ela recebe.',
  },
  {
    id: 'faceless', name: 'O Homem Sem Rosto', kind: 'boss', hp: 3700, radius: 22, speed: 40, armor: 0.1, tags: ['boss', 'elite', 'supernatural'], ai: 'faceless', aggroRange: 200, bounty: 30,
    attack: { kind: 'melee', damage: 92, range: 32, interval: 1.2, windup: 0.4, targets: 'ground', damageType: 'spectral' },
    blurb: 'Apaga as luzes, teleporta-se e caça a unidade mais isolada.',
  },
  {
    id: 'nest', name: 'Ninho Principal', kind: 'nest', hp: 3600, radius: 46, speed: 0, armor: 0.1, tags: ['blocker'], ai: 'tower', aggroRange: 215, bounty: 0,
    attack: { kind: 'projectile', damage: 30, range: 215, interval: 1.4, windup: 0, targets: 'both', damageType: 'poison', splash: 48, projectileSpeed: 420, projectileFx: 'acid' },
    blurb: 'De onde a noite brota. Cospe ácido em quem se aproxima e se regenera.',
  },
];
