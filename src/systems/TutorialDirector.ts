import type { BattleSim } from '../sim/BattleSim';
import type { BattleEvent } from '../sim/types';
import { h } from '../ui/dom';
import type { Hud } from '../ui/Hud';

interface Step {
  html: string;
  /** Elemento da interface a destacar. */
  highlight?: (hud: Hud) => HTMLElement | null;
  /** Ponto do mundo a destacar. */
  world?: (sim: BattleSim) => { x: number; y: number; r: number } | null;
  /** Libera a linha do tempo das ondas até esta onda iniciar. */
  releaseWave?: number;
  /** Condição para avançar. */
  until?: (sim: BattleSim, t: Tutorial) => boolean;
  /** Avança automaticamente após N segundos (também mostra "Continuar"). */
  auto?: number;
  /** Ao terminar este passo, libera o restante da partida. */
  releaseAll?: boolean;
}

type Tutorial = TutorialDirector;

/** Tutorial interativo e contextual da primeira missão. Ensina por ações reais, sem bloquear a tela. */
export class TutorialDirector {
  private i = -1;
  private t = 0;
  private panel: HTMLElement;
  private txt: HTMLElement;
  private cont: HTMLElement;
  private lit: HTMLElement | null = null;
  played = new Set<string>();
  done = false;
  worldMarker: { x: number; y: number; r: number } | null = null;

  private steps: Step[] = [
    { html: 'Este é o <b>núcleo do abrigo</b>. Se a vida dele chegar a zero, a noite vence.', world: (s) => ({ x: s.core.x, y: s.core.y, r: 70 }), auto: 6 },
    { html: 'Cartas custam <b>energia</b>. Ela se regenera sozinha até <b>10</b>. Fique de olho na barra.', highlight: (hud) => hud.energyEl(), auto: 6 },
    { html: 'Toque no <b>Pistoleiro</b> e depois em um ponto da <b>área clara</b> perto do portão.', highlight: (hud) => hud.cardSlotEl(hud.findCardSlot('gunslinger')), until: (_s, t) => t.played.has('gunslinger') },
    { html: 'Errantes estão vindo! Seu Pistoleiro atira <b>sozinho</b> em quem entrar no alcance.', releaseWave: 0, until: (s) => s.waves.index >= 1 && s.hostileCount === 0 },
    { html: 'Agora posicione uma <b>Barricada</b> na estrada, em frente ao portão. Ela bloqueia e desacelera a horda.', highlight: (hud) => hud.cardSlotEl(hud.findCardSlot('barricade')), until: (_s, t) => t.played.has('barricade') },
    { html: 'Os monstros atacam o que bloqueia o caminho. Enquanto isso, seus atiradores trabalham.', releaseWave: 1, until: (s) => s.waves.index >= 2 && s.hostileCount === 0 },
    { html: 'Uma <b>horda compacta</b>! Use o <b>Coquetel Incendiário</b> sobre o grupo: fogo causa dano contínuo em área.', highlight: (hud) => hud.cardSlotEl(hud.findCardSlot('molotov')), releaseWave: 2, until: (s, t) => t.played.has('molotov') && s.hostileCount === 0 },
    { html: 'Cartas <b>acinzentadas</b> ainda não podem ser pagas. Gastar tudo de uma vez pode deixar você sem resposta — planeje!', highlight: (hud) => hud.energyEl(), auto: 7 },
    { html: '<b>Cuspidores</b> atacam de longe e derretem defesas. Elimine-os primeiro! Toque em um inimigo para ver detalhes.', releaseWave: 3, until: (s) => s.waves.index >= 4 && s.hostileCount === 0 },
    { html: 'Última onda! <b>Sobreviva</b> até eliminar todos para vencer. A energia regenera em dobro na fase final.', releaseAll: true, auto: 8 },
  ];

  constructor(private sim: BattleSim, private hud: Hud, private onSkip: () => void) {
    this.txt = h('div', { class: 'txt' });
    this.cont = h('button', { class: 'btn small', onclick: () => this.next() }, 'Continuar');
    this.panel = h('div', { class: 'tutor panel' },
      h('div', { class: 'avatar', 'aria-hidden': 'true' }, '☢'),
      this.txt,
      h('div', { class: 'actions' }, this.cont, h('button', { class: 'btn small', onclick: () => this.skip() }, 'Pular')),
    );
    hud.root.append(this.panel);
    sim.waves.hold = true;
    this.next();
  }

  onEvents(events: BattleEvent[]) {
    for (const ev of events) if (ev.type === 'cardPlayed') this.played.add(ev.cardId);
  }

  private next() {
    const prev = this.steps[this.i];
    if (prev?.releaseAll) return this.finish();
    this.i++;
    this.t = 0;
    const s = this.steps[this.i];
    if (!s) return this.finish();
    this.txt.innerHTML = s.html;
    this.cont.classList.toggle('hidden', !s.auto);
    this.sim.waves.hold = s.releaseWave === undefined && !s.releaseAll;
    if (s.releaseAll) this.sim.waves.hold = false;
    // Chama a onda imediatamente para não deixar o jogador esperando.
    if ((s.releaseWave !== undefined && this.sim.waves.index === s.releaseWave) || s.releaseAll) this.sim.waves.callNext();
    this.panel.animate([{ opacity: 0, transform: 'translate(-50%, -8px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 250 });
    this.refreshHighlight();
  }

  private refreshHighlight() {
    const s = this.steps[this.i];
    const el = s?.highlight?.(this.hud) ?? null;
    if (el !== this.lit) {
      this.lit?.classList.remove('highlight');
      el?.classList.add('highlight');
      this.lit = el;
    }
    this.worldMarker = s?.world?.(this.sim) ?? null;
  }

  update(dt: number) {
    if (this.done) return;
    const s = this.steps[this.i];
    if (!s) return;
    this.t += dt;
    if (s.releaseWave !== undefined) this.sim.waves.hold = this.sim.waves.index > s.releaseWave;
    // A energia nunca deve travar o tutorial.
    if (s.highlight && s.until && this.sim.energy.value < 4) this.sim.energy.gain(dt * 0.6);
    this.refreshHighlight();
    if (s.until?.(this.sim, this)) this.next();
    else if (s.auto && this.t >= s.auto) this.next();
  }

  skip() {
    this.finish();
    this.onSkip();
  }

  private finish() {
    this.done = true;
    this.sim.waves.hold = false;
    this.lit?.classList.remove('highlight');
    this.worldMarker = null;
    this.panel.remove();
  }

  destroy() {
    this.finish();
  }
}
