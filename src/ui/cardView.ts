import { CATEGORY_LABEL } from '../data/cards';
import type { CardDef } from '../sim/types';
import { cardArt } from '../render/textures';
import { getActor } from '../data/actors';
import { h } from './dom';

export function cardEl(card: CardDef, extra: { locked?: boolean; inDeck?: boolean; onClick?: () => void } = {}) {
  const el = h('div', { class: `card ${card.rarity}${extra.locked ? ' locked' : ''}`, role: 'button', tabindex: 0, 'aria-label': `${card.name}, custo ${card.cost}`, 'data-card': card.id },
    h('img', { src: cardArt(card), alt: '' }),
    h('div', { class: 'cost' }, String(card.cost)),
    h('div', { class: 'rar' }),
    h('div', { class: 'name' }, card.name),
    h('div', { class: 'cat' }, CATEGORY_LABEL[card.category]),
    extra.locked ? h('div', { class: 'lock' }, '🔒') : null,
    extra.inDeck ? h('div', { class: 'in-deck' }, 'NO BARALHO') : null,
  );
  if (extra.onClick) {
    el.addEventListener('click', extra.onClick);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        extra.onClick!();
      }
    });
  }
  return el;
}

/** Linhas de atributos legíveis para cartas/unidades. */
export function cardStats(card: CardDef): [string, string][] {
  const out: [string, string][] = [['Custo', `${card.cost} energia`]];
  if (card.ability) {
    const a = card.ability;
    out.push(['Raio', `${a.radius}`]);
    if (a.type === 'fireZone') out.push(['Dano/s', `${a.dps}`], ['Duração', `${a.duration}s`]);
    else out.push(['Dano', `${a.damage} (x${a.supernaturalMult} sobren.)`], ['Atordoa', `${a.stun}s`]);
    if (card.cooldown) out.push(['Recarga', `${card.cooldown}s`]);
    return out;
  }
  if (!card.actor) return out;
  const d = getActor(card.actor);
  out.push(['Vida', `${d.hp}${(card.count ?? 1) > 1 ? ` ×${card.count}` : ''}`]);
  if (d.attack) {
    out.push(['Dano', `${d.attack.damage}${d.attack.splash ? ' (área)' : ''}`]);
    out.push(['Alcance', `${d.attack.range}`]);
    out.push(['Ataques/s', (1 / d.attack.interval).toFixed(2)]);
    out.push(['Alvos', d.attack.targets === 'both' ? 'Terra e ar' : d.attack.targets === 'air' ? 'Ar' : 'Terrestres']);
  }
  if (d.speed) out.push(['Velocidade', d.speed > 100 ? 'Muito rápida' : d.speed > 65 ? 'Média' : 'Lenta']);
  if (d.armor) out.push(['Armadura', `${Math.round(d.armor * 100)}%`]);
  if (d.charges) out.push(['Usos', `${d.charges}`]);
  return out;
}
