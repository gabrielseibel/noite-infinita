import { fullTitle, GAME_CONFIG } from '../app/config';
import { BESTIARY, getActor } from '../data/actors';
import { CARDS, CARD_BY_ID, CATEGORY_LABEL, RARITY_LABEL } from '../data/cards';
import { EVENT_BY_ID } from '../data/events';
import { CAMPAIGN, MISSIONS, type MissionDef } from '../data/missions';
import { SKINS, UPGRADES, UPGRADE_TREES, UPGRADE_BY_ID } from '../data/upgrades';
import { averageCost, validateDeck } from '../sim/deck';
import type { BattleResult } from '../sim/types';
import {
  buyCard, buyMission, buySkin, buyUpgrade, cardUnlockPrice, isMissionUnlocked, nextCampaignMission, upgradeCost, type RewardSummary,
} from '../systems/ProgressionSystem';
import type { SaveData, Settings } from '../systems/SaveSystem';
import { cardEl, cardStats } from './cardView';
import { clear, fmtTime, h } from './dom';

export interface ScreenHost {
  save: SaveData;
  persist(): void;
  click(): void;
  deny(): void;
  reward(): void;
  go(screen: string, arg?: string): void;
  startMission(id: string): void;
  applySettings(): void;
  resetProgress(): void;
}

const head = (host: ScreenHost, title: string, back = 'menu') =>
  h('div', { class: 'screen-head' },
    h('button', { class: 'btn icon', 'aria-label': 'Voltar', onclick: () => { host.click(); host.go(back); } }, '←'),
    h('h2', {}, title),
    h('div', { class: 'shards', title: 'Fragmentos de Luz' }, String(host.save.shards)),
  );

export function confirmDialog(parent: HTMLElement, title: string, text: string, ok: string, onOk: () => void, cancel = 'Cancelar') {
  const wrap = h('div', { class: 'modal-wrap' });
  const close = () => wrap.remove();
  wrap.append(h('div', { class: 'modal panel', role: 'dialog', 'aria-modal': 'true' },
    h('h3', {}, title), h('p', {}, text),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: close }, cancel),
      h('button', { class: 'btn primary', onclick: () => { close(); onOk(); } }, ok)),
  ));
  parent.append(wrap);
  (wrap.querySelector('.btn.primary') as HTMLElement)?.focus();
}

// ---------------------------------------------------------------------------
// Menu principal
// ---------------------------------------------------------------------------

export function menuScreen(host: ScreenHost) {
  const s = host.save;
  const next = nextCampaignMission(s);
  const locked = !s.tutorialDone;
  const lockNote = 'Conclua “O Último Abrigo”';
  const btn = (label: string, sub: string, onClick: () => void, opts: { primary?: boolean; disabled?: boolean } = {}) =>
    h('button', { class: `btn${opts.primary ? ' primary' : ''}${opts.disabled ? ' locked' : ''}`, 'aria-disabled': opts.disabled ? 'true' : undefined, onclick: () => {
      if (opts.disabled) return host.deny();
      host.click();
      onClick();
    } }, label, h('span', { class: 'sub' }, sub));
  return h('div', { class: 'screen menu' },
    h('h1', { class: 'logo' }, GAME_CONFIG.title),
    h('div', { class: 'logo-sub' }, GAME_CONFIG.subtitle),
    h('div', { class: 'menu-buttons' },
      btn('Jogar', s.tutorialDone ? `Próxima: ${next.index}. ${next.name}` : 'Comece pelo tutorial', () => host.go('briefing', next.id), { primary: true }),
      btn('Campanha', `${Object.keys(s.completed).filter((k) => CAMPAIGN.some((m) => m.id === k)).length}/${CAMPAIGN.length} missões concluídas`, () => host.go('campaign')),
      btn('Coleção', locked ? lockNote : 'Cartas, baralho e bestiário', () => host.go('collection'), { disabled: locked }),
      btn('Melhorias', locked ? lockNote : `${s.shards} fragmentos disponíveis`, () => host.go('upgrades'), { disabled: locked }),
      btn('Estatísticas', `${s.stats.matches} partidas · ${s.stats.wins} vitórias`, () => host.go('stats')),
      btn('Configurações', 'Áudio, gráficos, acessibilidade', () => host.go('settings')),
    ),
    h('div', { class: 'menu-foot' },
      h('span', {}, `${fullTitle()} · v${GAME_CONFIG.version}`),
      h('span', {}, 'Atalhos: 1–4 cartas · Esc cancelar · Espaço pausar · M som · F tela cheia'),
    ),
  );
}

// ---------------------------------------------------------------------------
// Campanha
// ---------------------------------------------------------------------------

export function campaignScreen(host: ScreenHost, parent: HTMLElement) {
  const s = host.save;
  const grid = h('div', { class: 'grid-missions' });
  const card = (m: MissionDef) => {
    const unlocked = isMissionUnlocked(s, m);
    const done = s.completed[m.id];
    const bosses = m.waves.filter((w) => w.boss).map((w) => getActor(w.boss!).name);
    const el = h('div', { class: `mission panel${unlocked ? '' : ' locked'}`, role: 'button', tabindex: 0 },
      h('div', { class: 'idx' }, m.special ? '✦' : String(m.index)),
      h('h4', {}, m.name),
      h('div', { class: 'meta' },
        ...m.objectives.map((o) => h('span', { class: `tag ${o}` }, o === 'destroy' ? 'Destruir ninho' : 'Sobreviver')),
        m.timeLimit && !m.objectives.includes('survive') ? h('span', { class: 'tag' }, `limite ${fmtTime(m.timeLimit)}`) : null,
        ...bosses.map((b) => h('span', { class: 'tag boss' }, b)),
        m.endless ? h('span', { class: 'tag' }, 'Infinito') : null,
      ),
      h('div', { style: 'font-size:13px;color:var(--muted);line-height:1.35' }, m.intro),
      h('div', { class: 'meta', style: 'margin-top:auto' },
        done ? h('span', { class: 'stars' }, '★'.repeat(done.stars) + '☆'.repeat(3 - done.stars)) : null,
        done?.bestTime ? h('span', {}, `melhor ${fmtTime(done.bestTime)}`) : null,
        !unlocked && m.purchasePrice ? h('span', {}, `◆ ${m.purchasePrice} para liberar`) : null,
        !unlocked && m.requires ? h('span', {}, `Requer: ${MISSIONS.find((x) => x.id === m.requires)?.name}`) : null,
        m.unlockCards.length && !done ? h('span', { style: 'color:var(--ok)' }, `Libera: ${m.unlockCards.map((c) => CARD_BY_ID[c].name).join(', ')}`) : null,
      ),
    );
    const open = () => {
      if (unlocked) {
        host.click();
        host.go('briefing', m.id);
      } else if (m.purchasePrice) {
        confirmDialog(parent, m.name, `Liberar este desafio por ${m.purchasePrice} fragmentos?`, 'Liberar', () => {
          const r = buyMission(s, m.id);
          if (!r.ok) {
            host.deny();
            return alertDialog(parent, 'Não foi possível', r.reason);
          }
          host.reward();
          host.persist();
          host.go('campaign');
        });
      } else host.deny();
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => e.key === 'Enter' && open());
    return el;
  };
  for (const m of MISSIONS) grid.append(card(m));
  return h('div', { class: 'screen dim' }, head(host, 'Campanha'), grid);
}

export function alertDialog(parent: HTMLElement, title: string, text: string) {
  const wrap = h('div', { class: 'modal-wrap' });
  wrap.append(h('div', { class: 'modal panel', role: 'alertdialog' }, h('h3', {}, title), h('p', {}, text), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => wrap.remove() }, 'OK'))));
  parent.append(wrap);
}

// ---------------------------------------------------------------------------
// Briefing (seleção do baralho antes da batalha)
// ---------------------------------------------------------------------------

export function briefingScreen(host: ScreenHost, mission: MissionDef) {
  const s = host.save;
  const deck = mission.tutorial ? TUTORIAL_DECK : s.deck;
  const v = validateDeck(deck, mission.tutorial ? undefined : s.unlockedCards);
  const events = [...new Set(mission.events.map((e) => EVENT_BY_ID[e.id]?.name))].filter(Boolean);
  const bosses = mission.waves.filter((w) => w.boss).map((w) => getActor(w.boss!).name);
  const enemies = [...new Set(mission.waves.flatMap((w) => w.groups.map((g) => g.enemy)))].map((id) => getActor(id).name);
  const deckRow = h('div', { class: 'deck-row' }, ...deck.map((id) => cardEl(CARD_BY_ID[id])));
  return h('div', { class: 'screen dim' },
    head(host, mission.special ? 'Missão especial' : `Missão ${mission.index}`, 'campaign'),
    h('div', { class: 'briefing panel' },
      h('div', {},
        h('h3', {}, mission.name),
        h('p', { class: 'intro' }, mission.intro),
        h('div', { style: 'font-size:14px' }, h('b', {}, 'Objetivo: '),
          mission.objectives.length > 1 ? 'Destrua o ninho OU sobreviva a todas as ondas.' :
          mission.objectives[0] === 'destroy' ? `Destrua o ninho${mission.timeLimit ? ` em até ${fmtTime(mission.timeLimit)}` : ''}.` :
          mission.endless ? 'Resista o máximo possível.' : 'Sobreviva a todas as ondas com o abrigo de pé.'),
        h('ul', {},
          enemies.length ? h('li', {}, `Ameaças: ${enemies.join(', ')}`) : h('li', {}, 'Ameaças imprevisíveis a cada noite.'),
          bosses.length ? h('li', { style: 'color:#ff9a9a' }, `Chefe: ${bosses.join(', ')}`) : null,
          events.length ? h('li', {}, `Eventos previstos: ${events.join(', ')}`) : null,
          mission.randomEvents ? h('li', {}, 'Eventos aleatórios podem ocorrer.') : null,
          h('li', {}, `Recompensa: ◆ ${mission.reward || 'por onda'}`),
        ),
      ),
      h('div', {},
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px' },
          h('b', {}, mission.tutorial ? 'Baralho do tutorial' : `Seu baralho · custo médio ${averageCost(deck).toFixed(1)}`),
          !mission.tutorial && s.tutorialDone ? h('button', { class: 'btn small', onclick: () => { host.click(); host.go('collection', mission.id); } }, 'Editar') : null),
        deckRow,
        v.ok ? null : h('div', { class: 'err' }, v.errors.join(' ')),
        h('div', { style: 'display:flex;gap:8px;margin-top:14px;justify-content:flex-end' },
          h('button', { class: 'btn primary', onclick: () => {
            if (!v.ok) return host.deny();
            host.click();
            host.startMission(mission.id);
          } }, 'Iniciar ▶')),
      ),
    ),
  );
}

export const TUTORIAL_DECK = ['gunslinger', 'barricade', 'molotov', 'watchtower', 'wardog', 'medic', 'spike_trap', 'raven'];

// ---------------------------------------------------------------------------
// Coleção e montagem do baralho
// ---------------------------------------------------------------------------

export function collectionScreen(host: ScreenHost, parent: HTMLElement, returnMission?: string) {
  const s = host.save;
  let filterCat = 'all';
  let filterCost = 'all';
  let tab: 'cards' | 'bestiary' = 'cards';
  let selected: string = s.deck[0];
  let deck = [...s.deck];
  const root = h('div', { class: 'screen dim' });
  const render = () => {
    clear(root);
    root.append(head(host, 'Coleção', returnMission ? 'briefing' : 'menu'));
    const tabs = h('div', { class: 'filters', style: 'width:100%;max-width:1180px' },
      h('button', { class: `chip${tab === 'cards' ? ' on' : ''}`, onclick: () => { tab = 'cards'; render(); } }, 'Cartas'),
      h('button', { class: `chip${tab === 'bestiary' ? ' on' : ''}`, onclick: () => { tab = 'bestiary'; render(); } }, 'Bestiário'));
    root.append(tabs);
    if (tab === 'bestiary') {
      root.append(bestiary(host));
      return;
    }
    const filters = h('div', { class: 'filters' },
      ...[['all', 'Todas'], ['survivor', 'Sobreviventes'], ['creature', 'Criaturas'], ['structure', 'Estruturas'], ['ability', 'Habilidades']].map(([k, l]) =>
        h('button', { class: `chip${filterCat === k ? ' on' : ''}`, onclick: () => { filterCat = k; render(); } }, l)),
      h('span', { style: 'width:12px' }),
      ...[['all', 'Qualquer custo'], ['low', '≤ 3'], ['mid', '4–5'], ['high', '≥ 6']].map(([k, l]) =>
        h('button', { class: `chip${filterCost === k ? ' on' : ''}`, onclick: () => { filterCost = k; render(); } }, l)),
    );
    const grid = h('div', { class: 'card-grid' });
    for (const c of CARDS) {
      if (filterCat !== 'all' && c.category !== filterCat) continue;
      if (filterCost === 'low' && c.cost > 3) continue;
      if (filterCost === 'mid' && (c.cost < 4 || c.cost > 5)) continue;
      if (filterCost === 'high' && c.cost < 6) continue;
      const unlocked = s.unlockedCards.includes(c.id);
      const el = cardEl(c, { locked: !unlocked, inDeck: deck.includes(c.id), onClick: () => { host.click(); selected = c.id; render(); } });
      if (selected === c.id) el.classList.add('selected');
      grid.append(el);
    }
    const v = validateDeck(deck, s.unlockedCards);
    const deckGrid = h('div', { class: 'deck-row' });
    for (let i = 0; i < 8; i++) {
      const id = deck[i];
      if (id) {
        const el = cardEl(CARD_BY_ID[id], { onClick: () => { host.click(); deck = deck.filter((x) => x !== id); selected = id; render(); } });
        el.title = 'Clique para remover';
        deckGrid.append(el);
      } else deckGrid.append(h('div', { class: 'card', style: '--card-w:100%;border-style:dashed;opacity:0.35;display:grid;place-items:center' }, '+'));
    }
    const detail = cardDetail(host, selected, deck, (d) => { deck = d; render(); }, parent, render);
    const save = h('button', { class: 'btn primary small', onclick: () => {
      if (!v.ok) return host.deny();
      s.deck = [...deck];
      host.persist();
      host.reward();
      if (returnMission) host.go('briefing', returnMission);
      else render();
    } }, v.ok ? (deck.join() === s.deck.join() ? 'Baralho salvo ✓' : 'Salvar baralho') : 'Baralho inválido');
    root.append(h('div', { class: 'collection' },
      h('div', {}, filters, grid),
      h('div', {},
        h('div', { class: 'deck-panel panel' },
          h('h4', {}, `Baralho (${deck.length}/8) · custo médio ${averageCost(deck).toFixed(1)}`),
          deckGrid,
          v.ok ? null : h('div', { class: 'err', style: 'margin-top:6px' }, v.errors.join(' ')),
          h('div', { style: 'display:flex;gap:6px;margin-top:10px;justify-content:space-between' },
            h('button', { class: 'btn small', onclick: () => { deck = [...s.deck]; render(); } }, 'Desfazer'), save)),
        detail),
    ));
  };
  render();
  return root;
}

function cardDetail(host: ScreenHost, id: string, deck: string[], setDeck: (d: string[]) => void, parent: HTMLElement, rerender: () => void) {
  const s = host.save;
  const c = CARD_BY_ID[id];
  if (!c) return h('div');
  const unlocked = s.unlockedCards.includes(id);
  const inDeck = deck.includes(id);
  const unlockMission = MISSIONS.find((m) => m.unlockCards.includes(id));
  const skins = SKINS.filter((k) => k.cardId === id);
  const actions = h('div', { class: 'row' });
  if (unlocked) {
    actions.append(h('button', { class: 'btn small', onclick: () => {
      host.click();
      if (inDeck) setDeck(deck.filter((x) => x !== id));
      else if (deck.length < 8) setDeck([...deck, id]);
      else host.deny();
    } }, inDeck ? 'Remover do baralho' : deck.length < 8 ? 'Adicionar ao baralho' : 'Baralho cheio (remova uma)'));
  } else {
    const price = cardUnlockPrice(id);
    actions.append(h('button', { class: 'btn small primary', onclick: () => {
      const r = buyCard(s, id);
      if (!r.ok) {
        host.deny();
        return alertDialog(parent, 'Não foi possível', r.reason);
      }
      host.reward();
      host.persist();
      rerender();
    } }, `Desbloquear ◆ ${price}`));
  }
  for (const k of skins) {
    const owned = s.skinsOwned.includes(k.id);
    const equipped = s.skinsEquipped[id] === k.id;
    actions.append(h('button', { class: 'btn small', style: `border-color:#${k.tint.toString(16).padStart(6, '0')}`, onclick: () => {
      if (!owned) {
        const r = buySkin(s, k.id);
        if (!r.ok) {
          host.deny();
          return alertDialog(parent, 'Não foi possível', r.reason);
        }
        host.reward();
      } else if (equipped) delete s.skinsEquipped[id];
      else s.skinsEquipped[id] = k.id;
      host.persist();
      rerender();
    } }, owned ? (equipped ? `✓ ${k.name}` : `Usar ${k.name}`) : `Variante: ${k.name} ◆ ${k.cost}`));
  }
  const actor = c.actor ? getActor(c.actor) : undefined;
  return h('div', { class: 'detail panel' },
    h('h4', {}, c.name),
    h('div', { style: 'color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em' }, `${CATEGORY_LABEL[c.category]} · ${RARITY_LABEL[c.rarity]}`),
    h('p', { style: 'margin:6px 0' }, c.description),
    actor ? h('p', { style: 'margin:0;color:var(--muted);font-size:13px' }, actor.blurb) : null,
    h('div', { class: 'stats' }, ...cardStats(c).flatMap(([k, v]) => [h('span', {}, k), h('b', {}, v)])),
    !unlocked && unlockMission ? h('div', { style: 'font-size:13px;color:var(--ok);margin-bottom:6px' }, `Liberada ao vencer: ${unlockMission.name}`) : null,
    actions,
  );
}

function bestiary(host: ScreenHost) {
  const seen = new Set([...Object.keys(host.save.stats.kills), ...host.save.seenEnemies]);
  return h('div', { class: 'grid-missions' }, ...BESTIARY.map((a) => {
    const known = seen.has(a.id);
    return h('div', { class: 'mission panel' + (known ? '' : ' locked') },
      h('h4', {}, known ? a.name : '???'),
      h('div', { class: 'meta' },
        ...(known ? a.tags.filter((t) => ['elite', 'supernatural', 'flying', 'boss', 'low', 'ethereal'].includes(t)).map((t) => h('span', { class: 'tag' + (t === 'boss' ? ' boss' : '') }, TAG_LABEL[t])) : [])),
      h('div', { style: 'font-size:13px;color:var(--muted)' }, known ? a.blurb : 'Ainda não encontrado.'),
      known ? h('div', { class: 'meta', style: 'margin-top:auto' }, h('span', {}, `Vida ${a.hp}`), a.attack ? h('span', {}, `Dano ${a.attack.damage}`) : null, h('span', {}, `Abatidos: ${host.save.stats.kills[a.id] ?? 0}`)) : null,
    );
  }));
}

const TAG_LABEL: Record<string, string> = { elite: 'Elite', supernatural: 'Sobrenatural', flying: 'Voador', boss: 'Chefe', low: 'Rasteiro', ethereal: 'Etéreo' };

// ---------------------------------------------------------------------------
// Melhorias
// ---------------------------------------------------------------------------

export function upgradesScreen(host: ScreenHost, parent: HTMLElement) {
  const s = host.save;
  const root = h('div', { class: 'screen dim' });
  const render = () => {
    clear(root);
    root.append(head(host, 'Melhorias'));
    root.append(h('p', { style: 'color:var(--muted);max-width:800px;text-align:center;margin:0 0 12px' }, 'Melhorias são permanentes e modestas: a sua estratégia continua sendo o que decide a noite.'));
    const trees = h('div', { class: 'trees' });
    for (const [tree, name] of Object.entries(UPGRADE_TREES)) {
      const box = h('div', { class: 'tree panel' }, h('h3', {}, name));
      for (const u of UPGRADES.filter((x) => x.tree === tree)) {
        const lvl = s.upgrades[u.id] ?? 0;
        const cost = upgradeCost(s, u.id);
        const blocked = u.requires && !(s.upgrades[u.requires] > 0);
        box.append(h('div', { class: 'upg' },
          h('div', { class: 'info' },
            h('h5', {}, u.name),
            h('p', {}, u.description),
            blocked ? h('p', { style: 'color:#ff9a80' }, `Requer ${UPGRADE_BY_ID[u.requires!].name}`) : null,
            h('div', { class: 'pips' }, ...Array.from({ length: u.maxLevel }, (_, i) => h('i', { class: i < lvl ? 'on' : '' })))),
          h('button', { class: `btn small${cost === null || blocked ? ' locked' : ''}`, onclick: () => {
            const r = buyUpgrade(s, u.id);
            if (!r.ok) {
              host.deny();
              return alertDialog(parent, 'Não foi possível', r.reason);
            }
            host.reward();
            host.persist();
            render();
          } }, cost === null ? 'MÁX' : `◆ ${cost}`),
        ));
      }
      trees.append(box);
    }
    root.append(trees);
  };
  render();
  return root;
}

// ---------------------------------------------------------------------------
// Estatísticas
// ---------------------------------------------------------------------------

export function statsScreen(host: ScreenHost) {
  const st = host.save.stats;
  const totalKills = Object.values(st.kills).reduce((a, b) => a + b, 0);
  const fav = Object.entries(st.cardsPlayed).sort((a, b) => b[1] - a[1])[0];
  const stat = (v: string | number, l: string) => h('div', { class: 'stat panel' }, h('b', {}, String(v)), h('span', {}, l));
  const rows = BESTIARY.filter((a) => st.kills[a.id]).map((a) => h('tr', {}, h('td', {}, a.name), h('td', {}, String(st.kills[a.id]))));
  return h('div', { class: 'screen dim' },
    head(host, 'Estatísticas'),
    h('div', { class: 'stats-grid' },
      stat(st.matches, 'Partidas'), stat(st.wins, 'Vitórias'), stat(st.losses, 'Derrotas'),
      stat(totalKills, 'Monstros abatidos'), stat(Object.values(st.bossesKilled).reduce((a, b) => a + b, 0), 'Chefes derrotados'),
      stat(fmtTime(st.playTime), 'Tempo de jogo'), stat(Math.round(st.energySpent), 'Energia gasta'),
      stat(st.bestEndlessWave, 'Recorde Noite Sem Fim'), stat(fav ? CARD_BY_ID[fav[0]]?.name ?? '-' : '-', 'Carta favorita'),
      stat(st.shardsEarned, 'Fragmentos obtidos'),
    ),
    rows.length ? h('div', { class: 'table panel' }, h('table', {}, ...rows)) : h('p', { style: 'color:var(--muted)' }, 'Jogue uma partida para registrar estatísticas.'),
  );
}

// ---------------------------------------------------------------------------
// Configurações
// ---------------------------------------------------------------------------

export function settingsScreen(host: ScreenHost, parent: HTMLElement, back = 'menu', onClose?: () => void) {
  const st = host.save.settings;
  const root = h('div', { class: 'screen dim' });
  const sw = (key: keyof Settings, label: string, desc: string) => {
    const on = key === 'particles' ? st.particles === 'low' : !!st[key];
    const el = h('div', { class: `switch${on ? ' on' : ''}`, role: 'switch', tabindex: 0, 'aria-checked': on ? 'true' : 'false', 'aria-label': label });
    const toggle = () => {
      if (key === 'particles') st.particles = st.particles === 'low' ? 'high' : 'low';
      else (st as unknown as Record<string, boolean>)[key] = !st[key];
      host.click();
      host.applySettings();
      host.persist();
      render();
    };
    el.addEventListener('click', toggle);
    el.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
    return h('div', { class: 'setting' }, h('div', {}, h('div', {}, label), h('div', { class: 'd' }, desc)), el);
  };
  const slider = (key: 'musicVolume' | 'sfxVolume', label: string) => {
    const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(st[key] * 100), 'aria-label': label }) as HTMLInputElement;
    input.addEventListener('input', () => {
      st[key] = Number(input.value) / 100;
      host.applySettings();
    });
    input.addEventListener('change', () => {
      host.persist();
      host.click();
    });
    return h('div', { class: 'setting' }, h('div', {}, label), input);
  };
  const render = () => {
    clear(root);
    const backBtn = head(host, 'Configurações', back);
    if (onClose) (backBtn.firstElementChild as HTMLElement).onclick = () => { host.click(); onClose(); };
    root.append(backBtn,
      h('div', { class: 'settings panel' },
        slider('musicVolume', 'Música e ambiente'),
        slider('sfxVolume', 'Efeitos sonoros'),
        sw('muted', 'Silenciar tudo', 'Atalho: M'),
        sw('particles', 'Efeitos reduzidos', 'Menos partículas: mais clareza e desempenho.'),
        sw('reduceFlashes', 'Reduzir flashes', 'Suaviza relâmpagos e explosões luminosas.'),
        sw('reduceShake', 'Reduzir tremores', 'Desativa o tremor de câmera.'),
        sw('highContrast', 'Alto contraste', 'Anéis azuis (aliados) e vermelhos (inimigos) sob as unidades.'),
        sw('damageNumbers', 'Números de dano', 'Mostra valores de dano e cura.'),
        sw('hitStop', 'Câmera lenta dramática', 'Breve desaceleração ao derrotar chefes.'),
        sw('weather', 'Clima visual', 'Chuva decorativa (a Chuva Torrencial do evento sempre aparece).'),
        sw('hints', 'Dicas e tutorial', 'Mostra dicas na primeira aparição de cada inimigo.'),
        sw('fastDefault', 'Iniciar em velocidade ×2', 'Para missões que você já conhece.'),
        h('div', { class: 'keys' },
          h('span', {}, h('kbd', {}, '1–4')), h('span', {}, 'Selecionar carta'),
          h('span', {}, h('kbd', {}, 'Esc'), ' / botão direito'), h('span', {}, 'Cancelar seleção'),
          h('span', {}, h('kbd', {}, 'Espaço')), h('span', {}, 'Pausar / retomar'),
          h('span', {}, h('kbd', {}, 'M')), h('span', {}, 'Som liga/desliga'),
          h('span', {}, h('kbd', {}, 'F')), h('span', {}, 'Tela cheia'),
          h('span', {}, 'Roda / pinça'), h('span', {}, 'Zoom; arraste para mover a câmera'),
        ),
        h('div', { style: 'display:flex;justify-content:flex-end' },
          h('button', { class: 'btn small', onclick: () => confirmDialog(parent, 'Apagar progresso', 'Isto apaga missões, cartas, melhorias e estatísticas. As configurações são mantidas.', 'Apagar tudo', () => host.resetProgress()) }, 'Apagar progresso')),
      ));
  };
  render();
  return root;
}

// ---------------------------------------------------------------------------
// Pausa e resultados
// ---------------------------------------------------------------------------

export function pauseOverlay(opts: { onResume(): void; onRestart(): void; onSettings(): void; onQuit(): void; mission: MissionDef }) {
  return h('div', { class: 'modal-wrap' },
    h('div', { class: 'modal panel', role: 'dialog', 'aria-modal': 'true' },
      h('h3', {}, 'Pausado'),
      h('p', {}, `${opts.mission.name}`),
      h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        h('button', { class: 'btn primary', onclick: opts.onResume }, 'Retomar'),
        h('button', { class: 'btn', onclick: opts.onRestart }, 'Reiniciar missão'),
        h('button', { class: 'btn', onclick: opts.onSettings }, 'Configurações'),
        h('button', { class: 'btn', onclick: opts.onQuit }, 'Abandonar partida')),
      h('div', { class: 'keys', style: 'margin-top:14px' },
        h('span', {}, h('kbd', {}, '1–4')), h('span', {}, 'Cartas'),
        h('span', {}, h('kbd', {}, 'Esc')), h('span', {}, 'Cancelar'),
        h('span', {}, h('kbd', {}, 'Espaço')), h('span', {}, 'Pausar'),
        h('span', {}, h('kbd', {}, 'M')), h('span', {}, 'Som'))));
}

const REASON: Record<BattleResult['reason'], string> = {
  destroy: 'Você destruiu o ninho principal.',
  survive: 'Você resistiu a todas as ondas.',
  coreDestroyed: 'O núcleo do abrigo foi destruído.',
  timeout: 'O tempo acabou antes de o ninho cair.',
};

export function resultOverlay(opts: { result: BattleResult; rewards: RewardSummary; mission: MissionDef; hasNext: boolean; onRetry(): void; onNext(): void; onMenu(): void }) {
  const { result: r, rewards } = opts;
  const kills = Object.values(r.stats.kills).reduce((a, b) => a + b, 0);
  const st = (k: string, v: string | number) => h('div', {}, k, h('b', {}, String(v)));
  return h('div', { class: 'modal-wrap' },
    h('div', { class: `result panel ${r.victory ? 'win' : 'lose'}`, role: 'dialog' },
      h('h2', {}, opts.mission.endless ? 'FIM DA NOITE' : r.victory ? 'VITÓRIA' : 'DERROTA'),
      h('div', { class: 'reason' }, opts.mission.endless ? `Você resistiu a ${r.stats.wavesCleared} ondas.` : REASON[r.reason]),
      !opts.mission.endless ? h('div', { class: 'stars', 'aria-label': `${r.stars} estrelas` }, ...[0, 1, 2].map((i) => h('span', { class: i < r.stars ? 'on' : '', style: `animation-delay:${0.3 + i * 0.25}s` }, '★'))) : null,
      h('div', { class: 'grid' },
        st('Tempo', fmtTime(r.time)), st('Núcleo', `${Math.round(r.coreHpPct * 100)}%`),
        st('Monstros abatidos', kills), st('Chefes', r.stats.bossesKilled.length),
        st('Cartas jogadas', Object.values(r.stats.cardsPlayed).reduce((a, b) => a + b, 0)), st('Energia gasta', Math.round(r.stats.energySpent)),
        st('Dano causado', Math.round(r.stats.damageDealt)), st('Unidades perdidas', r.stats.unitsLost)),
      h('div', { class: 'reward' }, `+ ◆ ${rewards.shards} fragmentos`),
      rewards.firstClear ? h('div', { class: 'unlock' }, 'Primeira vitória nesta missão! Bônus incluído.') : null,
      ...rewards.unlockedCards.map((c) => h('div', { class: 'unlock' }, `Nova carta: ${CARD_BY_ID[c].name}`)),
      opts.mission.tutorial && r.victory ? h('div', { class: 'unlock' }, 'Montagem de baralho, coleção e melhorias liberadas!') : null,
      rewards.newMission ? h('div', { class: 'unlock' }, `Nova missão liberada: ${MISSIONS.find((m) => m.id === rewards.newMission)?.name}`) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: opts.onMenu }, 'Menu'),
        h('button', { class: 'btn', onclick: opts.onRetry }, 'Tentar de novo'),
        opts.hasNext ? h('button', { class: 'btn primary', onclick: opts.onNext }, 'Próxima missão ▶') : null)));
}
