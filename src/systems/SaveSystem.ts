import { GAME_CONFIG } from '../app/config';
import { CARD_BY_ID, STARTER_DECK, STARTER_UNLOCKED } from '../data/cards';
import { MISSION_BY_ID } from '../data/missions';
import { SKINS, UPGRADE_BY_ID } from '../data/upgrades';
import { validateDeck } from '../sim/deck';

export const SAVE_VERSION = 2;

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reduceFlashes: boolean;
  reduceShake: boolean;
  particles: 'high' | 'low';
  highContrast: boolean;
  damageNumbers: boolean;
  hitStop: boolean;
  weather: boolean;
  hints: boolean;
  fastDefault: boolean;
}

export interface LifetimeStats {
  matches: number;
  wins: number;
  losses: number;
  kills: Record<string, number>;
  cardsPlayed: Record<string, number>;
  bossesKilled: Record<string, number>;
  playTime: number;
  bestEndlessWave: number;
  energySpent: number;
  damageDealt: number;
  shardsEarned: number;
}

export interface SaveData {
  version: number;
  shards: number;
  completed: Record<string, { stars: number; bestTime: number }>;
  unlockedCards: string[];
  deck: string[];
  upgrades: Record<string, number>;
  skinsOwned: string[];
  skinsEquipped: Record<string, string>;
  purchasedMissions: string[];
  tutorialDone: boolean;
  /** Inimigos já apresentados ao jogador (dicas de primeira aparição). */
  seenEnemies: string[];
  stats: LifetimeStats;
  settings: Settings;
}

export const defaultSettings = (): Settings => ({
  musicVolume: 0.55, sfxVolume: 0.8, muted: false, reduceFlashes: false, reduceShake: false, particles: 'high',
  highContrast: false, damageNumbers: true, hitStop: true, weather: true, hints: true, fastDefault: false,
});

export const defaultStats = (): LifetimeStats => ({
  matches: 0, wins: 0, losses: 0, kills: {}, cardsPlayed: {}, bossesKilled: {}, playTime: 0, bestEndlessWave: 0,
  energySpent: 0, damageDealt: 0, shardsEarned: 0,
});

export const defaultSave = (): SaveData => ({
  version: SAVE_VERSION, shards: 0, completed: {}, unlockedCards: [...STARTER_UNLOCKED], deck: [...STARTER_DECK],
  upgrades: {}, skinsOwned: [], skinsEquipped: {}, purchasedMissions: [], tutorialDone: false, seenEnemies: [],
  stats: defaultStats(), settings: defaultSettings(),
});

const num = (v: unknown, def: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const numRecord = (v: unknown) => {
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(obj(v))) if (typeof x === 'number' && Number.isFinite(x) && x >= 0) out[k] = x;
  return out;
};

/** Migra versões antigas para a atual. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const v = num(raw.version, 1);
  if (v < 2) {
    // v1 usava "coins" e "deckCards".
    if (raw.coins !== undefined && raw.shards === undefined) raw.shards = raw.coins;
    if (raw.deckCards !== undefined && raw.deck === undefined) raw.deck = raw.deckCards;
  }
  raw.version = SAVE_VERSION;
  return raw;
}

/** Converte qualquer valor (inclusive lixo) em um SaveData válido. Nunca lança exceção. */
export function sanitize(input: unknown): SaveData {
  const d = defaultSave();
  const raw = migrate({ ...obj(input) });
  d.shards = Math.floor(num(raw.shards, 0, 0, 1e7));
  for (const [k, v] of Object.entries(obj(raw.completed))) {
    if (!MISSION_BY_ID[k]) continue;
    const o = obj(v);
    d.completed[k] = { stars: Math.floor(num(o.stars, 1, 0, 3)), bestTime: num(o.bestTime, 0, 0) };
  }
  const unlocked = new Set([...STARTER_UNLOCKED, ...strArr(raw.unlockedCards).filter((c) => CARD_BY_ID[c])]);
  d.unlockedCards = [...unlocked];
  const deck = strArr(raw.deck);
  d.deck = validateDeck(deck, d.unlockedCards).ok ? deck : [...STARTER_DECK];
  for (const [k, v] of Object.entries(numRecord(raw.upgrades))) {
    const u = UPGRADE_BY_ID[k];
    if (u) d.upgrades[k] = Math.min(u.maxLevel, Math.floor(v));
  }
  d.skinsOwned = strArr(raw.skinsOwned).filter((s) => SKINS.some((k) => k.id === s));
  for (const [card, skin] of Object.entries(obj(raw.skinsEquipped)))
    if (typeof skin === 'string' && d.skinsOwned.includes(skin)) d.skinsEquipped[card] = skin;
  d.purchasedMissions = strArr(raw.purchasedMissions).filter((m) => MISSION_BY_ID[m]);
  d.tutorialDone = bool(raw.tutorialDone, false) || !!d.completed.m1;
  d.seenEnemies = strArr(raw.seenEnemies).slice(0, 64);
  const st = obj(raw.stats);
  d.stats = {
    matches: Math.floor(num(st.matches, 0, 0)), wins: Math.floor(num(st.wins, 0, 0)), losses: Math.floor(num(st.losses, 0, 0)),
    kills: numRecord(st.kills), cardsPlayed: numRecord(st.cardsPlayed), bossesKilled: numRecord(st.bossesKilled),
    playTime: num(st.playTime, 0, 0), bestEndlessWave: Math.floor(num(st.bestEndlessWave, 0, 0)), energySpent: num(st.energySpent, 0, 0),
    damageDealt: num(st.damageDealt, 0, 0), shardsEarned: num(st.shardsEarned, 0, 0),
  };
  const s = obj(raw.settings);
  const ds = defaultSettings();
  d.settings = {
    musicVolume: num(s.musicVolume, ds.musicVolume, 0, 1), sfxVolume: num(s.sfxVolume, ds.sfxVolume, 0, 1), muted: bool(s.muted, ds.muted),
    reduceFlashes: bool(s.reduceFlashes, ds.reduceFlashes), reduceShake: bool(s.reduceShake, ds.reduceShake),
    particles: s.particles === 'low' ? 'low' : 'high', highContrast: bool(s.highContrast, ds.highContrast),
    damageNumbers: bool(s.damageNumbers, ds.damageNumbers), hitStop: bool(s.hitStop, ds.hitStop), weather: bool(s.weather, ds.weather),
    hints: bool(s.hints, ds.hints), fastDefault: bool(s.fastDefault, ds.fastDefault),
  };
  return d;
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class SaveSystem {
  data: SaveData;
  private storage: StorageLike | null;
  private key: string;

  constructor(storage: StorageLike | null = defaultStorage(), key: string = GAME_CONFIG.saveKey) {
    this.storage = storage;
    this.key = key;
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const txt = this.storage?.getItem(this.key);
      if (!txt) return defaultSave();
      return sanitize(JSON.parse(txt));
    } catch (err) {
      console.warn('[save] dados inválidos, usando padrão', err);
      return defaultSave();
    }
  }

  save() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[save] não foi possível salvar', err);
    }
  }

  reset() {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.save();
  }
}
