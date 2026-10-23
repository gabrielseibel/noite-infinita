import { DECK } from '../data/balance';
import { CARD_BY_ID } from '../data/cards';
import type { Rng } from './rng';

export interface DeckValidation {
  ok: boolean;
  errors: string[];
}

/** Regras de montagem: 8 cartas únicas, desbloqueadas, no máximo 1 épica e 4 estruturas. */
export function validateDeck(cards: string[], unlocked?: readonly string[]): DeckValidation {
  const errors: string[] = [];
  if (cards.length !== DECK.size) errors.push(`O baralho precisa de exatamente ${DECK.size} cartas (tem ${cards.length}).`);
  const seen = new Set<string>();
  for (const id of cards) {
    if (!CARD_BY_ID[id]) errors.push(`Carta desconhecida: ${id}.`);
    else if (seen.has(id)) errors.push(`Carta repetida: ${CARD_BY_ID[id].name}.`);
    else if (unlocked && !unlocked.includes(id)) errors.push(`${CARD_BY_ID[id].name} ainda não foi desbloqueada.`);
    seen.add(id);
  }
  const defs = cards.map((c) => CARD_BY_ID[c]).filter(Boolean);
  const epics = defs.filter((d) => d.rarity === 'epic').length;
  if (epics > DECK.maxEpic) errors.push(`Máximo de ${DECK.maxEpic} carta épica por baralho.`);
  const structures = defs.filter((d) => d.category === 'structure').length;
  if (structures > DECK.maxStructures) errors.push(`Máximo de ${DECK.maxStructures} estruturas por baralho.`);
  if (defs.length && defs.every((d) => d.category === 'structure' || d.category === 'ability'))
    errors.push('O baralho precisa de pelo menos uma unidade.');
  return { ok: errors.length === 0, errors };
}

export function averageCost(cards: string[]): number {
  const defs = cards.map((c) => CARD_BY_ID[c]).filter(Boolean);
  if (!defs.length) return 0;
  return defs.reduce((s, d) => s + d.cost, 0) / defs.length;
}

/**
 * Ciclo de cartas: mão de 4 cartas visíveis e fila com as restantes.
 * Ao jogar uma carta, ela vai para o fim da fila e a primeira da fila entra no mesmo slot.
 */
export class DeckSystem {
  hand: string[];
  queue: string[];
  /** Recarga restante por carta (s). */
  cooldowns: Record<string, number> = {};

  constructor(cards: string[], rng?: Rng, shuffle = true) {
    const order = [...cards];
    if (shuffle && rng) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    this.hand = order.slice(0, DECK.handSize);
    this.queue = order.slice(DECK.handSize);
  }

  get nextCard(): string | undefined {
    return this.queue[0];
  }

  play(slot: number, cooldown = 0): string | null {
    const card = this.hand[slot];
    if (!card) return null;
    const incoming = this.queue.shift();
    this.queue.push(card);
    if (incoming !== undefined) this.hand[slot] = incoming;
    if (cooldown > 0) this.cooldowns[card] = cooldown;
    return card;
  }

  cooldownOf(card: string): number {
    return this.cooldowns[card] ?? 0;
  }

  update(dt: number) {
    for (const k of Object.keys(this.cooldowns)) {
      this.cooldowns[k] -= dt;
      if (this.cooldowns[k] <= 0) delete this.cooldowns[k];
    }
  }
}
