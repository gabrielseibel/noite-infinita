// Eventos especiais. Os efeitos são aplicados como modificadores no estado da batalha.
export interface EventMods {
  enemyDamageMult?: number;
  enemySpeedMult?: number;
  fireMult?: number;
  allyRangeMult?: number;
  /** 0..1 escuridão adicional (renderização + alcance de visão). */
  darkness?: number;
  disablePowered?: boolean;
  watchtowerRangeMult?: number;
  rain?: boolean;
  fog?: number;
}

export interface EventDef {
  id: string;
  name: string;
  description: string;
  duration: number;
  mods: EventMods;
  /** Comportamentos com efeito imediato. */
  special?: 'scream' | 'escort';
}

export const EVENTS: EventDef[] = [
  { id: 'blackout', name: 'Apagão', description: 'As luzes caem. Torres UV desligadas, torres de vigia enxergam menos.', duration: 22, mods: { darkness: 0.45, disablePowered: true, watchtowerRangeMult: 0.7 } },
  { id: 'red_moon', name: 'Lua Vermelha', description: 'Os monstros ficam agressivos: +25% dano, +15% velocidade.', duration: 30, mods: { enemyDamageMult: 1.25, enemySpeedMult: 1.15 } },
  { id: 'storm', name: 'Chuva Torrencial', description: 'Fogo enfraquecido pela metade. Alcance das armas -10%.', duration: 35, mods: { fireMult: 0.5, allyRangeMult: 0.9, rain: true } },
  { id: 'dense_fog', name: 'Névoa Densa', description: 'Visão reduzida: alcance e percepção dos aliados -25%.', duration: 28, mods: { allyRangeMult: 0.75, fog: 0.55, darkness: 0.1 } },
  { id: 'distant_scream', name: 'Grito Distante', description: 'Algo grita na floresta… uma onda especial se aproxima!', duration: 8, mods: {}, special: 'scream' },
  { id: 'escape', name: 'Fuga do Abrigo', description: 'Um sobrevivente corre para o abrigo. Proteja-o!', duration: 40, mods: {}, special: 'escort' },
];

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
