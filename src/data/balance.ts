// Parâmetros globais de economia e ritmo. Todos os números de balanceamento gerais ficam aqui.
export const ENERGY = {
  max: 10,
  start: 5,
  /** Segundos para regenerar 1 ponto na fase normal. */
  secondsPerPoint: 2.8,
  /** Multiplicador da regeneração na fase final. */
  finalPhaseMult: 2,
  /** A fase final começa quando faltam estes segundos para a última onda terminar / tempo limite. */
  finalPhaseSeconds: 60,
};

export const DECK = {
  size: 8,
  handSize: 4,
  maxEpic: 1,
  maxStructures: 4,
};

export const LIMITS = {
  maxPlayerUnits: 28,
  maxPlayerStructures: 14,
  maxEnemies: 140,
  maxProjectiles: 220,
};

export const CORE = {
  hp: 3000,
  threatThreshold: 0.35,
};

export const NEST = {
  hp: 3600,
  /** Ao perder cada fração da vida, o ninho expele guardiões. */
  rageSteps: [0.75, 0.5, 0.25],
  regenDelay: 8,
  regenPerSecond: 3,
};

export const COMBAT = {
  critMult: 1.75,
  etherealPhysicalMult: 0.5,
  /** Cura máxima por segundo que o núcleo pode receber (evita cura infinita). */
  coreHealCapPerSecond: 0,
  separationStrength: 0.6,
  aiTickSeconds: 0.25,
  pathRepathSeconds: 0.7,
  hitStopSeconds: 0.35,
  hitStopScale: 0.25,
};

export const REWARDS = {
  victoryBase: 60,
  perStar: 20,
  defeatConsolation: 10,
  firstClearBonus: 40,
  escortBonus: 15,
};

export const DIFFICULTY = {
  /** Crescimento suave de atributos por onda (multiplicativo). */
  hpPerWave: 0.07,
  damagePerWave: 0.03,
  eliteHpMult: 1.8,
  eliteDamageMult: 1.3,
};
