import type { CardDef } from '../sim/types';

export const CARDS: CardDef[] = [
  // Sobreviventes
  { id: 'gunslinger', name: 'Pistoleiro', category: 'survivor', cost: 3, rarity: 'common', actor: 'gunslinger', placement: 'deploy', description: 'Atirador à distância, dano moderado e cadência alta.' },
  { id: 'huntress', name: 'Caçadora', category: 'survivor', cost: 4, rarity: 'rare', actor: 'huntress', placement: 'deploy', description: 'Tiros lentos e letais. Bônus contra elites e chefes.' },
  { id: 'medic', name: 'Médico de Campo', category: 'survivor', cost: 4, rarity: 'rare', actor: 'medic', placement: 'deploy', description: 'Cura gradualmente aliados próximos.' },
  { id: 'engineer', name: 'Engenheira', category: 'survivor', cost: 3, rarity: 'common', actor: 'engineer', placement: 'deploy', description: 'Repara estruturas e monta barricadas improvisadas.' },
  { id: 'shotgunner', name: 'Guarda c/ Escopeta', category: 'survivor', cost: 5, rarity: 'common', actor: 'shotgunner', placement: 'deploy', description: 'Curto alcance, dano em área contra grupos.' },
  { id: 'veteran', name: 'Veterano', category: 'survivor', cost: 5, rarity: 'rare', actor: 'veteran', placement: 'deploy', description: 'Tanque que provoca inimigos e protege o suporte.' },
  // Criaturas aliadas
  { id: 'wardog', name: 'Cão de Guerra', category: 'creature', cost: 3, rarity: 'common', actor: 'wardog', placement: 'deploy', description: 'Corre até o inimigo. Primeiro bote causa dano triplo.' },
  { id: 'raven', name: 'Corvo Espectral', category: 'creature', cost: 2, rarity: 'common', actor: 'raven', count: 2, placement: 'deploy', description: 'Dois corvos rápidos que caçam voadores e espectros.' },
  { id: 'bone_golem', name: 'Golem de Ossos', category: 'creature', cost: 6, rarity: 'rare', actor: 'bone_golem', placement: 'deploy', description: 'Tanque que ignora a horda e marcha para esmagar o ninho.' },
  { id: 'reaper', name: 'Ceifador', category: 'creature', cost: 7, rarity: 'epic', actor: 'reaper', placement: 'deploy', description: 'Foice em arco amplo que elimina grupos inteiros.' },
  // Estruturas
  { id: 'watchtower', name: 'Torre de Vigia', category: 'structure', cost: 4, rarity: 'common', actor: 'watchtower', placement: 'deploy', description: 'Atira em inimigos terrestres no alcance.' },
  { id: 'uv_tower', name: 'Torre de Luz UV', category: 'structure', cost: 5, rarity: 'rare', actor: 'uv_tower', placement: 'deploy', description: 'Dano extra e lentidão em sobrenaturais. Desliga no apagão.' },
  { id: 'barricade', name: 'Barricada Reforçada', category: 'structure', cost: 2, rarity: 'common', actor: 'barricade', placement: 'deploy', description: 'Bloqueia e desacelera a horda. Pode ser destruída.' },
  { id: 'spike_trap', name: 'Armadilha de Estacas', category: 'structure', cost: 3, rarity: 'common', actor: 'spike_trap', placement: 'deployPath', description: 'Dispara ao ser pisada. Dano em área, 4 usos.' },
  // Habilidades
  { id: 'molotov', name: 'Coquetel Incendiário', category: 'ability', cost: 3, rarity: 'common', placement: 'anywhere', cooldown: 4, ability: { type: 'fireZone', radius: 72, duration: 5, dps: 34, tick: 0.5 }, description: 'Área de fogo com dano contínuo. Fraco na chuva.' },
  { id: 'light_pulse', name: 'Pulso de Luz', category: 'ability', cost: 4, rarity: 'rare', placement: 'anywhere', cooldown: 6, ability: { type: 'lightBurst', radius: 115, damage: 40, supernaturalMult: 2.2, stun: 2.2 }, description: 'Explosão luminosa: dano e atordoamento em sobrenaturais.' },
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const CATEGORY_LABEL: Record<string, string> = {
  survivor: 'Sobrevivente',
  creature: 'Criatura',
  structure: 'Estrutura',
  ability: 'Habilidade',
};

export const RARITY_LABEL: Record<string, string> = { common: 'Comum', rare: 'Rara', epic: 'Épica' };

/** Baralho inicial sempre válido. */
export const STARTER_DECK = ['gunslinger', 'barricade', 'molotov', 'watchtower', 'wardog', 'medic', 'spike_trap', 'raven'];
export const STARTER_UNLOCKED = [...STARTER_DECK];

/** Preço em fragmentos para desbloquear uma carta antes da campanha liberá-la. */
export const UNLOCK_PRICE: Record<string, number> = { common: 80, rare: 160, epic: 320 };
