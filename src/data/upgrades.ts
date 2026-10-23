// Árvores de melhorias. Cada nível aplica `perLevel` ao modificador `stat`.
export type UpgradeStat =
  | 'barricadeHp'
  | 'coreHp'
  | 'watchtowerRange'
  | 'energyRegen'
  | 'medicHeal'
  | 'survivorHp'
  | 'abilityCooldown'
  | 'creatureDamage'
  | 'trapCharges';

export interface UpgradeDef {
  id: string;
  tree: 'fortification' | 'survivors' | 'occult';
  name: string;
  description: string;
  stat: UpgradeStat;
  perLevel: number;
  maxLevel: number;
  costs: number[];
  requires?: string;
}

export const UPGRADE_TREES: Record<UpgradeDef['tree'], string> = {
  fortification: 'Fortificação',
  survivors: 'Sobreviventes',
  occult: 'Ocultismo',
};

export const UPGRADES: UpgradeDef[] = [
  { id: 'treated_wood', tree: 'fortification', name: 'Madeira Tratada', description: '+15% de vida das barricadas por nível.', stat: 'barricadeHp', perLevel: 0.15, maxLevel: 3, costs: [50, 100, 170] },
  { id: 'shelter_walls', tree: 'fortification', name: 'Muralhas do Abrigo', description: '+8% de vida do núcleo por nível.', stat: 'coreHp', perLevel: 0.08, maxLevel: 3, costs: [70, 140, 220], requires: 'treated_wood' },
  { id: 'scope', tree: 'fortification', name: 'Lunetas', description: '+8% de alcance da Torre de Vigia por nível.', stat: 'watchtowerRange', perLevel: 0.08, maxLevel: 3, costs: [60, 120, 200], requires: 'treated_wood' },
  { id: 'patched_generator', tree: 'survivors', name: 'Gerador Remendado', description: '+4% de regeneração de energia por nível.', stat: 'energyRegen', perLevel: 0.04, maxLevel: 3, costs: [90, 180, 300] },
  { id: 'field_kits', tree: 'survivors', name: 'Kits de Campo', description: '+15% de cura do Médico por nível.', stat: 'medicHeal', perLevel: 0.15, maxLevel: 3, costs: [50, 100, 170] },
  { id: 'rations', tree: 'survivors', name: 'Rações Extras', description: '+6% de vida dos sobreviventes por nível.', stat: 'survivorHp', perLevel: 0.06, maxLevel: 3, costs: [70, 140, 220], requires: 'field_kits' },
  { id: 'quick_rituals', tree: 'occult', name: 'Rituais Rápidos', description: '-10% de recarga das habilidades por nível.', stat: 'abilityCooldown', perLevel: 0.1, maxLevel: 3, costs: [60, 120, 200] },
  { id: 'blood_pact', tree: 'occult', name: 'Pacto de Sangue', description: '+6% de dano das criaturas aliadas por nível.', stat: 'creatureDamage', perLevel: 0.06, maxLevel: 3, costs: [80, 160, 260], requires: 'quick_rituals' },
  { id: 'sharpened', tree: 'occult', name: 'Estacas Afiadas', description: '+1 uso das Armadilhas de Estacas por nível.', stat: 'trapCharges', perLevel: 1, maxLevel: 2, costs: [70, 150], requires: 'quick_rituals' },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export type UpgradeMods = Record<UpgradeStat, number>;

export function computeUpgradeMods(levels: Record<string, number>): UpgradeMods {
  const mods: UpgradeMods = {
    barricadeHp: 0, coreHp: 0, watchtowerRange: 0, energyRegen: 0, medicHeal: 0,
    survivorHp: 0, abilityCooldown: 0, creatureDamage: 0, trapCharges: 0,
  };
  for (const u of UPGRADES) {
    const lvl = Math.max(0, Math.min(u.maxLevel, Math.floor(levels[u.id] ?? 0)));
    mods[u.stat] += lvl * u.perLevel;
  }
  return mods;
}

/** Variantes visuais compráveis (puramente cosméticas). */
export interface SkinDef {
  id: string;
  cardId: string;
  name: string;
  tint: number;
  cost: number;
}

export const SKINS: SkinDef[] = [
  { id: 'gunslinger_crimson', cardId: 'gunslinger', name: 'Casaco Carmesim', tint: 0xff8a80, cost: 60 },
  { id: 'wardog_ash', cardId: 'wardog', name: 'Pelagem de Cinzas', tint: 0xb0bec5, cost: 60 },
  { id: 'raven_gold', cardId: 'raven', name: 'Corvo Dourado', tint: 0xffe082, cost: 80 },
  { id: 'watchtower_rust', cardId: 'watchtower', name: 'Torre Enferrujada', tint: 0xffab91, cost: 70 },
  { id: 'reaper_pale', cardId: 'reaper', name: 'Ceifador Pálido', tint: 0xe1f5fe, cost: 120 },
];
