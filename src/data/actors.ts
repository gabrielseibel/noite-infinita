import type { ActorDef } from '../sim/types';
import { PLAYER_ACTORS } from './units';
import { ENEMY_ACTORS } from './enemies';
import { BOSS_ACTORS } from './bosses';

export const ALL_ACTORS: ActorDef[] = [...PLAYER_ACTORS, ...ENEMY_ACTORS, ...BOSS_ACTORS];
export const ACTOR_BY_ID: Record<string, ActorDef> = Object.fromEntries(ALL_ACTORS.map((a) => [a.id, a]));

export function getActor(id: string): ActorDef {
  const a = ACTOR_BY_ID[id];
  if (!a) throw new Error(`Ator desconhecido: ${id}`);
  return a;
}

/** Inimigos e chefes que aparecem no bestiário. */
export const BESTIARY = [...ENEMY_ACTORS, ...BOSS_ACTORS.filter((b) => b.kind === 'boss')];
