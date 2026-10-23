import { REWARDS } from '../data/balance';
import { CARD_BY_ID, UNLOCK_PRICE } from '../data/cards';
import { CAMPAIGN, MISSION_BY_ID, type MissionDef } from '../data/missions';
import { SKINS, UPGRADE_BY_ID } from '../data/upgrades';
import type { BattleResult } from '../sim/types';
import type { SaveData } from './SaveSystem';

export interface RewardSummary {
  shards: number;
  firstClear: boolean;
  unlockedCards: string[];
  newMission?: string;
  endlessWave?: number;
}

export function isMissionUnlocked(save: SaveData, m: MissionDef): boolean {
  if (m.purchasePrice) return save.purchasedMissions.includes(m.id);
  if (!m.requires) return true;
  return !!save.completed[m.requires];
}

/** Próxima missão de campanha ainda não concluída (ou a última). */
export function nextCampaignMission(save: SaveData): MissionDef {
  return CAMPAIGN.find((m) => !save.completed[m.id] && isMissionUnlocked(save, m)) ?? CAMPAIGN[CAMPAIGN.length - 1];
}

export function computeRewards(save: SaveData, mission: MissionDef, result: BattleResult, extra: { escortSaved?: number } = {}): RewardSummary {
  const firstClear = result.victory && !save.completed[mission.id];
  let shards = 0;
  const unlockedCards: string[] = [];
  if (mission.endless) {
    const waves = result.stats.wavesCleared;
    shards = Math.round(waves * 6 + result.stats.bounty * 0.5);
    return { shards, firstClear: false, unlockedCards, endlessWave: waves };
  }
  if (result.victory) {
    // Repetições rendem menos para incentivar avanço, sem obrigar grind.
    const replayFactor = firstClear ? 1 : 0.5;
    shards = Math.round((REWARDS.victoryBase + mission.reward * 0.5 + result.stars * REWARDS.perStar) * replayFactor);
    if (firstClear) {
      shards += REWARDS.firstClearBonus;
      for (const c of mission.unlockCards) if (!save.unlockedCards.includes(c)) unlockedCards.push(c);
    }
  } else {
    shards = REWARDS.defeatConsolation + Math.min(30, Math.round(result.stats.bounty * 0.3));
  }
  shards += (extra.escortSaved ?? 0) * REWARDS.escortBonus;
  const idx = CAMPAIGN.findIndex((m) => m.id === mission.id);
  const newMission = firstClear && idx >= 0 && CAMPAIGN[idx + 1] ? CAMPAIGN[idx + 1].id : undefined;
  return { shards, firstClear, unlockedCards, newMission };
}

export function applyResult(save: SaveData, mission: MissionDef, result: BattleResult, rewards: RewardSummary) {
  save.shards += rewards.shards;
  save.stats.shardsEarned += rewards.shards;
  save.stats.matches++;
  if (result.victory) save.stats.wins++;
  else save.stats.losses++;
  save.stats.playTime += result.time;
  save.stats.energySpent += result.stats.energySpent;
  save.stats.damageDealt += result.stats.damageDealt;
  for (const [k, v] of Object.entries(result.stats.kills)) save.stats.kills[k] = (save.stats.kills[k] ?? 0) + v;
  for (const [k, v] of Object.entries(result.stats.cardsPlayed)) save.stats.cardsPlayed[k] = (save.stats.cardsPlayed[k] ?? 0) + v;
  for (const b of result.stats.bossesKilled) save.stats.bossesKilled[b] = (save.stats.bossesKilled[b] ?? 0) + 1;
  if (rewards.endlessWave !== undefined) save.stats.bestEndlessWave = Math.max(save.stats.bestEndlessWave, rewards.endlessWave);
  if (result.victory && !mission.endless) {
    const prev = save.completed[mission.id];
    save.completed[mission.id] = {
      stars: Math.max(prev?.stars ?? 0, result.stars),
      bestTime: prev?.bestTime ? Math.min(prev.bestTime, result.time) : result.time,
    };
    if (mission.tutorial) save.tutorialDone = true;
  }
  for (const c of rewards.unlockedCards) if (!save.unlockedCards.includes(c)) save.unlockedCards.push(c);
}

export type PurchaseResult = { ok: true } | { ok: false; reason: string };

export function cardUnlockPrice(cardId: string) {
  return UNLOCK_PRICE[CARD_BY_ID[cardId]?.rarity ?? 'common'];
}

export function buyCard(save: SaveData, cardId: string): PurchaseResult {
  if (!CARD_BY_ID[cardId]) return { ok: false, reason: 'Carta desconhecida.' };
  if (save.unlockedCards.includes(cardId)) return { ok: false, reason: 'Já desbloqueada.' };
  const price = cardUnlockPrice(cardId);
  if (save.shards < price) return { ok: false, reason: `Faltam ${price - save.shards} fragmentos.` };
  save.shards -= price;
  save.unlockedCards.push(cardId);
  return { ok: true };
}

export function upgradeCost(save: SaveData, id: string): number | null {
  const u = UPGRADE_BY_ID[id];
  if (!u) return null;
  const lvl = save.upgrades[id] ?? 0;
  return lvl >= u.maxLevel ? null : u.costs[lvl];
}

export function buyUpgrade(save: SaveData, id: string): PurchaseResult {
  const u = UPGRADE_BY_ID[id];
  if (!u) return { ok: false, reason: 'Melhoria desconhecida.' };
  if (u.requires && !(save.upgrades[u.requires] > 0)) return { ok: false, reason: `Requer ${UPGRADE_BY_ID[u.requires].name}.` };
  const cost = upgradeCost(save, id);
  if (cost === null) return { ok: false, reason: 'Nível máximo.' };
  if (save.shards < cost) return { ok: false, reason: `Faltam ${cost - save.shards} fragmentos.` };
  save.shards -= cost;
  save.upgrades[id] = (save.upgrades[id] ?? 0) + 1;
  return { ok: true };
}

export function buySkin(save: SaveData, skinId: string): PurchaseResult {
  const s = SKINS.find((k) => k.id === skinId);
  if (!s) return { ok: false, reason: 'Variante desconhecida.' };
  if (save.skinsOwned.includes(skinId)) return { ok: false, reason: 'Já adquirida.' };
  if (!save.unlockedCards.includes(s.cardId)) return { ok: false, reason: 'Desbloqueie a carta primeiro.' };
  if (save.shards < s.cost) return { ok: false, reason: `Faltam ${s.cost - save.shards} fragmentos.` };
  save.shards -= s.cost;
  save.skinsOwned.push(skinId);
  save.skinsEquipped[s.cardId] = skinId;
  return { ok: true };
}

export function buyMission(save: SaveData, missionId: string): PurchaseResult {
  const m = MISSION_BY_ID[missionId];
  if (!m?.purchasePrice) return { ok: false, reason: 'Missão não está à venda.' };
  if (save.purchasedMissions.includes(m.id)) return { ok: false, reason: 'Já liberada.' };
  if (save.shards < m.purchasePrice) return { ok: false, reason: `Faltam ${m.purchasePrice - save.shards} fragmentos.` };
  save.shards -= m.purchasePrice;
  save.purchasedMissions.push(m.id);
  return { ok: true };
}
