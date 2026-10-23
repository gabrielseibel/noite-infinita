import { CARD_BY_ID } from '../data/cards';
import { ENERGY } from '../data/balance';
import type { BattleSim } from '../sim/BattleSim';
import type { Entity } from '../sim/types';
import { cardEl, cardStats } from './cardView';
import { clear, fmtTime, h } from './dom';

export interface HudCallbacks {
  onSelectCard(slot: number): void;
  onCancel(): void;
  onPause(): void;
  onSpeed(): void;
  onMute(): void;
}

/** HUD de batalha em HTML/CSS. Lê o estado da simulação e envia intenções via callbacks. */
export class Hud {
  root: HTMLElement;
  private timeEl: HTMLElement;
  private waveEl: HTMLElement;
  private coreBar: HTMLElement;
  private coreFill: HTMLElement;
  private coreLbl: HTMLElement;
  private nestFill: HTMLElement;
  private nestLbl: HTMLElement;
  private nestWrap: HTMLElement;
  private events: HTMLElement;
  private hand: HTMLElement;
  private nextWrap: HTMLElement;
  private energyNum: HTMLElement;
  private segs: HTMLElement[] = [];
  private rateEl: HTMLElement;
  private bottom: HTMLElement;
  private top: HTMLElement;
  private cancelBtn: HTMLElement;
  private hint: HTMLElement;
  private speedBtn: HTMLElement;
  private muteBtn: HTMLElement;
  private bannerEl: HTMLElement;
  private info: HTMLElement;
  private tip: HTMLElement;
  private cards: HTMLElement[] = [];
  private handKey = '';
  private nextKey = '';
  private lastEvKey = '';
  private infoId = 0;
  private bannerTimer = 0;
  private rateKey = '';

  constructor(parent: HTMLElement, private cb: HudCallbacks) {
    this.timeEl = h('div', { class: 'hud-time' }, '0:00');
    this.waveEl = h('div', { class: 'hud-wave' }, 'Preparação');
    this.coreFill = h('i');
    this.coreBar = h('div', { class: 'bar' }, this.coreFill);
    this.coreLbl = h('span', {}, '');
    this.nestFill = h('i');
    this.nestLbl = h('span', {}, '');
    this.nestWrap = h('div', { class: 'hb' }, h('div', { class: 'lbl' }, this.nestLbl, h('span', {}, 'Ninho')), h('div', { class: 'bar enemy' }, this.nestFill));
    this.top = h('div', { class: 'hud-top' },
      h('div', { class: 'hb' }, h('div', { class: 'lbl' }, h('span', {}, 'Abrigo'), this.coreLbl), this.coreBar),
      h('div', { class: 'hud-center' }, this.timeEl, this.waveEl),
      this.nestWrap,
    );
    this.events = h('div', { class: 'hud-events' });
    this.speedBtn = h('button', { class: 'btn icon', title: 'Velocidade (x1/x2)', 'aria-label': 'Alternar velocidade', onclick: () => cb.onSpeed() }, '»');
    this.muteBtn = h('button', { class: 'btn icon', title: 'Som (M)', 'aria-label': 'Ativar ou desativar som', onclick: () => cb.onMute() }, '♪');
    const buttons = h('div', { class: 'hud-buttons' },
      h('button', { class: 'btn icon', title: 'Pausar (Espaço)', 'aria-label': 'Pausar', onclick: () => cb.onPause() }, 'Ⅱ'),
      this.speedBtn,
      this.muteBtn,
    );
    this.hand = h('div', { class: 'hand' });
    for (let i = 0; i < 4; i++) {
      const slot = h('div', { class: 'slot' });
      this.hand.append(slot);
    }
    this.nextWrap = h('div', { class: 'next' }, 'Próxima');
    this.energyNum = h('div', { class: 'num' }, '0');
    const segsEl = h('div', { class: 'segs' });
    for (let i = 0; i < ENERGY.max; i++) {
      const fill = h('i');
      segsEl.append(h('div', { class: 'seg' }, fill));
      this.segs.push(fill);
    }
    this.rateEl = h('div', { class: 'rate' });
    const energy = h('div', { class: 'energy', 'data-tut': 'energy' }, h('div', { class: 'row' }, this.energyNum, segsEl), this.rateEl);
    this.cancelBtn = h('button', { class: 'btn small cancel-btn hidden', onclick: () => cb.onCancel() }, '✕ Cancelar');
    this.hint = h('div', { class: 'place-hint hidden' });
    this.bottom = h('div', { class: 'hud-bottom' }, this.cancelBtn, this.hint, this.nextWrap, this.hand, energy);
    this.bannerEl = h('div', { class: 'banner' });
    this.info = h('div', { class: 'unit-info panel hidden' });
    this.tip = h('div', { class: 'tip panel hidden' });
    this.root = h('div', { class: 'hud', style: 'position:absolute;inset:0;pointer-events:none' }, this.top, this.events, buttons, this.bottom, this.bannerEl, this.info, this.tip,
      h('div', { class: 'rotate-hint' }, '↻ Gire o aparelho para a horizontal para uma visão melhor da arena.'));
    for (const el of [this.top, buttons, this.bottom]) el.style.pointerEvents = 'auto';
    this.top.style.pointerEvents = 'none';
    parent.append(this.root);
  }

  /** Alturas ocupadas no topo e na base (para a câmera não esconder a arena). */
  insets() {
    return { top: this.top.offsetHeight * 0.75, bottom: this.bottom.offsetHeight };
  }

  energyEl() {
    return this.root.querySelector('[data-tut=energy]') as HTMLElement;
  }

  cardSlotEl(slot: number) {
    return this.hand.children[slot] as HTMLElement;
  }

  findCardSlot(cardId: string) {
    return this.handKey.split(',').indexOf(cardId);
  }

  private buildHand(sim: BattleSim) {
    const key = sim.deck.hand.join(',');
    if (key === this.handKey) return;
    const prev = this.handKey.split(',');
    this.handKey = key;
    this.cards = [];
    sim.deck.hand.forEach((id, slot) => {
      const host = this.hand.children[slot] as HTMLElement;
      const card = CARD_BY_ID[id];
      let el = host.firstElementChild as HTMLElement | null;
      if (!el || prev[slot] !== id) {
        clear(host);
        el = cardEl(card);
        el.append(h('div', { class: 'charge' }));
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          this.cb.onSelectCard(slot);
        });
        el.addEventListener('pointerenter', (e) => {
          if (e.pointerType === 'mouse') this.showTip(el!, id);
        });
        el.addEventListener('pointerleave', () => this.tip.classList.add('hidden'));
        host.append(el);
        el.animate([{ transform: 'translateY(30px) scale(0.8)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'ease-out' });
      }
      this.cards[slot] = el;
    });
  }

  private showTip(anchor: HTMLElement, id: string) {
    const card = CARD_BY_ID[id];
    clear(this.tip);
    this.tip.append(h('h5', {}, card.name), h('div', {}, card.description), h('div', { style: 'color:var(--muted);margin-top:4px;font-size:12px' }, cardStats(card).slice(1, 5).map(([k, v]) => `${k}: ${v}`).join(' · ')));
    this.tip.classList.remove('hidden');
    const r = anchor.getBoundingClientRect();
    this.tip.style.left = `${Math.max(6, Math.min(window.innerWidth - 270, r.left))}px`;
    this.tip.style.top = `${r.top - this.tip.offsetHeight - 10}px`;
  }

  update(sim: BattleSim, selected: number, speed: number, muted: boolean) {
    this.buildHand(sim);
    // Topo
    const m = sim.mission;
    const w = sim.waves;
    if (m.timeLimit && !m.objectives.includes('survive')) {
      this.timeEl.textContent = fmtTime(m.timeLimit - sim.time);
      this.timeEl.style.color = m.timeLimit - sim.time < 30 ? '#ff6b6b' : '';
    } else this.timeEl.textContent = fmtTime(sim.time);
    const total = w.totalWaves;
    if (w.index === 0) this.waveEl.textContent = `1ª onda em ${Math.ceil(w.timeToNext)}s`;
    else if (total === Infinity) this.waveEl.textContent = `Onda ${w.index}${w.timeToNext > 0 ? ` · próxima ${Math.ceil(w.timeToNext)}s` : ''}`;
    else if (w.index >= total) this.waveEl.textContent = `Onda final · ${sim.hostileCount} restantes`;
    else this.waveEl.textContent = `Onda ${w.index}/${total} · próxima ${Math.ceil(w.timeToNext)}s`;
    const cp = Math.max(0, sim.core.hp / sim.core.maxHp);
    this.coreFill.style.transform = `scaleX(${cp})`;
    this.coreLbl.textContent = `${Math.ceil(sim.core.hp)}`;
    this.coreBar.classList.toggle('threat', cp < 0.35);
    const np = Math.max(0, sim.nest.hp / sim.nest.maxHp);
    this.nestFill.style.transform = `scaleX(${np})`;
    const sealed = !!sim.nest.special.invulnerable;
    this.nestLbl.textContent = sealed ? 'selado' : `${Math.ceil(sim.nest.hp)}`;
    this.nestWrap.style.opacity = sealed ? '0.55' : '1';
    // Eventos ativos e chefes
    const evKey = sim.director.active.map((a) => a.def.id + Math.ceil(a.remaining)).join() + sim.bosses.map((b) => b.id + ':' + Math.ceil(b.hp / 50)).join();
    if (evKey !== this.lastEvKey) {
      this.lastEvKey = evKey;
      clear(this.events);
      for (const a of sim.director.active) this.events.append(h('div', { class: 'ev-chip' }, h('b', {}, a.def.name), h('span', { class: 't' }, `${Math.ceil(a.remaining)}s`)));
      for (const b of sim.bosses) {
        const pct = Math.max(0, b.hp / b.maxHp);
        this.events.append(h('div', { class: 'ev-chip', style: 'flex-direction:column;align-items:stretch;min-width:180px' },
          h('div', {}, h('b', {}, '☠ ' + b.def.name)),
          h('div', { class: 'bar enemy', style: 'height:8px' }, h('i', { style: `transform:scaleX(${pct})` }))));
      }
    }
    // Energia
    const e = sim.energy.value;
    this.energyNum.textContent = String(Math.floor(e));
    for (let i = 0; i < this.segs.length; i++) {
      const f = Math.max(0, Math.min(1, e - i));
      this.segs[i].style.transform = `scaleX(${f})`;
      this.segs[i].style.opacity = f >= 1 ? '1' : '0.55';
    }
    const x2 = sim.energy.phaseMult > 1;
    const rateKey = `${(sim.energy.ratePerSecond * 60).toFixed(0)}|${x2}`;
    if (rateKey !== this.rateKey) {
      this.rateKey = rateKey;
      clear(this.rateEl);
      this.rateEl.append(h('span', {}, 'Energia'), h('span', {}, `${(sim.energy.ratePerSecond * 60).toFixed(0)}/min `, h('b', { class: x2 ? 'x2' : '' }, x2 ? '×2 FASE FINAL' : '×1')));
    }
    // Cartas
    sim.deck.hand.forEach((id, slot) => {
      const el = this.cards[slot];
      if (!el) return;
      const card = CARD_BY_ID[id];
      const cd = sim.deck.cooldownOf(id);
      const afford = sim.energy.canAfford(card.cost);
      el.classList.toggle('selected', selected === slot);
      el.classList.toggle('unaffordable', !afford || cd > 0);
      const charge = el.querySelector('.charge') as HTMLElement;
      charge.style.height = afford ? '0%' : `${Math.min(100, (e / card.cost) * 100)}%`;
      let cool = el.querySelector('.cool') as HTMLElement | null;
      if (cd > 0) {
        if (!cool) el.append((cool = h('div', { class: 'cool' })));
        cool.textContent = `${Math.ceil(cd)}s`;
      } else cool?.remove();
    });
    const next = sim.deck.nextCard ?? '';
    if (next !== this.nextKey) {
      this.nextKey = next;
      clear(this.nextWrap);
      this.nextWrap.append('Próxima');
      if (next) this.nextWrap.append(cardEl(CARD_BY_ID[next]));
    }
    this.cancelBtn.classList.toggle('hidden', selected < 0);
    this.speedBtn.textContent = speed > 1 ? '»»' : '»';
    this.speedBtn.style.borderColor = speed > 1 ? 'var(--amber)' : '';
    this.muteBtn.style.opacity = muted ? '0.4' : '1';
    if (this.infoId) {
      const ent = sim.get(this.infoId);
      if (!ent || !ent.alive) this.showUnitInfo(null);
      else (this.info.querySelector('.bar > i') as HTMLElement).style.transform = `scaleX(${Math.max(0, ent.hp / ent.maxHp)})`;
    }
    document.documentElement.style.setProperty('--hud-h', `${this.bottom.offsetHeight}px`);
  }

  setPlaceHint(text: string | null, bad = false) {
    this.hint.classList.toggle('hidden', !text);
    if (text) {
      this.hint.textContent = text;
      this.hint.style.color = bad ? '#ff8a80' : '#fff';
    }
  }

  banner(big: string, small = '', color = '') {
    clear(this.bannerEl);
    this.bannerEl.append(h('div', { class: 'big', style: color ? `text-shadow:0 0 20px ${color},0 2px 4px #000` : '' }, big), h('div', { class: 'small' }, small));
    this.bannerEl.classList.remove('show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    window.clearTimeout(this.bannerTimer);
  }

  toast(msg: string, good = false) {
    const t = h('div', { class: `toast${good ? ' good' : ''}` }, msg);
    this.root.append(t);
    window.setTimeout(() => t.remove(), 1900);
  }

  showUnitInfo(e: Entity | null) {
    this.infoId = e?.id ?? 0;
    this.info.classList.toggle('hidden', !e);
    if (!e) return;
    clear(this.info);
    const d = e.def;
    const rows: [string, string][] = [['Vida', `${Math.ceil(e.hp)}/${e.maxHp}`]];
    if (d.attack) rows.push(['Dano', `${Math.round(d.attack.damage * e.damageMult)}`], ['Alcance', `${Math.round(d.attack.range * e.rangeMult)}`], ['Cadência', `${(1 / d.attack.interval).toFixed(1)}/s`]);
    if (d.speed) rows.push(['Velocidade', `${d.speed}`]);
    if (d.armor) rows.push(['Armadura', `${Math.round(d.armor * 100)}%`]);
    if (e.kind === 'trap') rows.push(['Usos', `${e.charges}`]);
    const tags: string[] = [];
    if (e.elite) tags.push('ELITE');
    if (d.tags.includes('supernatural')) tags.push('Sobrenatural');
    if (d.tags.includes('flying')) tags.push('Voador');
    if (d.tags.includes('ethereal')) tags.push('Etéreo');
    if (e.statuses.length) tags.push(...e.statuses.map((s) => STATUS_NAMES[s.type] ?? s.type));
    this.info.append(
      h('h4', {}, d.name + (e.team === 'enemy' ? ' ☠' : '')),
      h('div', { style: 'color:var(--muted)' }, d.blurb),
      h('div', { class: 'bar' + (e.team === 'enemy' ? ' enemy' : '') }, h('i', { style: `transform:scaleX(${e.hp / e.maxHp})` })),
      h('div', { class: 'stats' }, ...rows.flatMap(([k, v]) => [h('span', {}, k), h('b', {}, v)])),
      tags.length ? h('div', { style: 'margin-top:6px;font-size:12px;color:var(--amber)' }, tags.join(' · ')) : '',
    );
  }

  destroy() {
    this.root.remove();
  }
}

export const STATUS_NAMES: Record<string, string> = {
  stun: 'Atordoado', slow: 'Lento', burn: 'Queimando', poison: 'Envenenado', enrage: 'Enfurecido', reinforced: 'Reforçado',
  vulnerable: 'Vulnerável', taunted: 'Provocado', disabled: 'Desligado',
};
