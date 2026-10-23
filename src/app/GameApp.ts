import Phaser from 'phaser';
import { fullTitle } from './config';
import { CAMPAIGN, MISSION_BY_ID, type MissionDef } from '../data/missions';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { BattleScene, type BattleData, type BattleHost } from '../scenes/BattleScene';
import type { BattleSim } from '../sim/BattleSim';
import type { BattleResult } from '../sim/types';
import { AudioSystem } from '../systems/AudioSystem';
import { applyResult, computeRewards, isMissionUnlocked } from '../systems/ProgressionSystem';
import { SaveSystem } from '../systems/SaveSystem';
import { clear, h, isTyping } from '../ui/dom';
import {
  TUTORIAL_DECK, briefingScreen, campaignScreen, collectionScreen, confirmDialog, menuScreen, pauseOverlay, resultOverlay,
  settingsScreen, statsScreen, upgradesScreen, type ScreenHost,
} from '../ui/screens';

/** Orquestra o motor (Phaser), as telas HTML, o salvamento e o áudio. */
export class GameApp implements ScreenHost, BattleHost {
  readonly saveSys = new SaveSystem();
  readonly audio = new AudioSystem();
  readonly game: Phaser.Game;
  readonly uiRoot: HTMLElement;
  private screenHost: HTMLElement;
  private overlay: HTMLElement | null = null;
  private loading: HTMLElement;
  private mission: MissionDef | null = null;
  private lastScreen = 'menu';
  private lastArg?: string;
  private paused = false;
  private inBattle = false;

  get save() {
    return this.saveSys.data;
  }

  constructor(gameParent: HTMLElement, ui: HTMLElement) {
    document.title = fullTitle();
    this.uiRoot = ui;
    this.screenHost = h('div', { style: 'position:absolute;inset:0;pointer-events:none' });
    ui.append(this.screenHost);
    const bar = h('i', { style: 'transform:scaleX(0)' });
    this.loading = h('div', { class: 'loading' }, h('div', { class: 'box' },
      h('div', { class: 'logo', style: 'font-size:40px' }, 'NOITE INFINITA'),
      h('div', { style: 'color:var(--muted);margin-top:8px' }, 'Acendendo as lanternas…'),
      h('div', { class: 'bar' }, bar)));
    ui.append(this.loading);

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: gameParent,
      backgroundColor: '#050507',
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      render: { antialias: true, powerPreference: 'high-performance' },
      input: { activePointers: 3 },
      scene: [BootScene, MenuScene, BattleScene],
      fps: { target: 60 },
      banner: false,
    });
    this.game.registry.set('onProgress', (p: number) => (bar.style.transform = `scaleX(${p})`));
    this.game.registry.set('onReady', () => this.onReady());
    this.game.registry.set('onError', (e: unknown) => {
      clear(this.loading);
      this.loading.append(h('div', { class: 'box' }, h('h3', {}, 'Erro ao iniciar'), h('p', {}, String(e))));
    });
    this.applySettings();
    this.bindGlobal();
  }

  private onReady() {
    this.loading.remove();
    this.game.scene.stop('boot');
    this.game.scene.start('menu');
    this.go('menu');
  }

  private bindGlobal() {
    const unlock = () => {
      this.audio.unlock();
      this.applySettings();
      if (!this.inBattle) this.audio.startMusic('menu');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) unlock();
      if (isTyping()) return;
      if (e.key === 'm' || e.key === 'M') this.toggleMute();
      else if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
      else if (e.code === 'Space' && this.inBattle && this.paused && this.overlay) {
        e.preventDefault();
        this.resume();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.inBattle && !this.paused) this.openPause();
        this.audio.suspend();
      } else this.audio.resume();
    });
    window.addEventListener('blur', () => {
      if (this.inBattle && !this.paused) this.openPause();
    });
  }

  private toggleFullscreen() {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    } catch {
      /* não suportado */
    }
  }

  toggleMute() {
    this.save.settings.muted = !this.save.settings.muted;
    this.applySettings();
    this.persist();
    this.battleScene()?.hud?.toast(this.save.settings.muted ? 'Som desligado' : 'Som ligado', true);
  }

  // ---------------------------------------------------------------------------
  // ScreenHost
  // ---------------------------------------------------------------------------

  persist() {
    this.saveSys.save();
  }
  click() {
    this.audio.play('ui_click');
  }
  deny() {
    this.audio.play('ui_deny');
  }
  reward() {
    this.audio.play('reward');
  }

  applySettings() {
    const s = this.save.settings;
    this.audio.setVolumes(s.musicVolume, s.sfxVolume, s.muted);
    this.game?.registry.set('reduceFlashes', s.reduceFlashes);
    const b = this.battleScene();
    if (b?.sys.isActive() || b?.sys.isPaused()) {
      (b as any).views?.setHighContrast(s.highContrast);
      const fx = (b as any).fx;
      if (fx) fx.settings = { particles: s.particles, reduceFlashes: s.reduceFlashes, reduceShake: s.reduceShake, damageNumbers: s.damageNumbers };
    }
  }

  resetProgress() {
    this.saveSys.reset();
    this.go('menu');
  }

  go(screen: string, arg?: string): void {
    this.closeOverlay();
    clear(this.screenHost);
    if (this.inBattle) this.leaveBattle();
    this.lastScreen = screen;
    this.lastArg = arg;
    const host = this.screenHost;
    let el: HTMLElement;
    switch (screen) {
      case 'campaign': el = campaignScreen(this, host); break;
      case 'briefing': {
        const m = MISSION_BY_ID[arg ?? ''] ?? CAMPAIGN[0];
        if (!isMissionUnlocked(this.save, m)) return this.go('campaign');
        this.mission = m;
        el = briefingScreen(this, m);
        break;
      }
      case 'collection': el = this.save.tutorialDone ? collectionScreen(this, host, arg) : menuScreen(this); break;
      case 'upgrades': el = this.save.tutorialDone ? upgradesScreen(this, host) : menuScreen(this); break;
      case 'stats': el = statsScreen(this); break;
      case 'settings': el = settingsScreen(this, host); break;
      default: el = menuScreen(this);
    }
    // "voltar" da coleção aberta pelo briefing retorna ao briefing da missão.
    if (screen === 'collection' && arg) {
      const backBtn = el.querySelector('.screen-head .btn') as HTMLElement;
      if (backBtn) backBtn.onclick = () => { this.click(); this.go('briefing', arg); };
    }
    host.append(el);
    (el.querySelector('.btn') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------
  // Batalha
  // ---------------------------------------------------------------------------

  private battleScene(): BattleScene | undefined {
    return this.game?.scene.getScene('battle') as BattleScene | undefined;
  }

  startMission(id: string) {
    const m = MISSION_BY_ID[id];
    if (!m) return;
    this.mission = m;
    this.closeOverlay();
    clear(this.screenHost);
    this.audio.unlock();
    this.audio.stopMusic();
    const data: BattleData = { mission: m, deck: m.tutorial ? [...TUTORIAL_DECK] : [...this.save.deck], host: this };
    this.game.scene.stop('menu');
    const sm = this.game.scene;
    if (sm.isActive('battle') || sm.isPaused('battle')) sm.stop('battle');
    sm.start('battle', data);
    this.inBattle = true;
    this.paused = false;
  }

  private leaveBattle() {
    this.inBattle = false;
    this.paused = false;
    const sm = this.game.scene;
    if (sm.isActive('battle') || sm.isPaused('battle')) sm.stop('battle');
    if (!sm.isActive('menu')) sm.start('menu');
    this.audio.stopMusic();
    this.audio.startMusic('menu');
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  openPause() {
    const scene = this.battleScene();
    if (!scene || !this.inBattle || this.paused || scene.sim?.over) return;
    this.paused = true;
    this.game.scene.pause('battle');
    this.audio.play('ui_click');
    const m = this.mission!;
    this.overlay = pauseOverlay({
      mission: m,
      onResume: () => this.resume(),
      onRestart: () => confirmDialog(this.uiRoot, 'Reiniciar missão?', 'O progresso desta partida será perdido.', 'Reiniciar', () => this.startMission(m.id)),
      onSettings: () => {
        this.overlay?.remove();
        const el = settingsScreen(this, this.uiRoot, 'menu', () => {
          el.remove();
          this.paused = false;
          this.openPause();
        });
        el.style.zIndex = '20';
        this.overlay = el;
        this.uiRoot.append(el);
      },
      onQuit: () => confirmDialog(this.uiRoot, 'Abandonar partida?', 'A partida contará como derrota, sem recompensas.', 'Abandonar', () => {
        const sim = scene.sim;
        sim.forfeit();
        const result = sim.result!;
        this.save.stats.matches++;
        this.save.stats.losses++;
        this.save.stats.playTime += result.time;
        this.persist();
        this.go('menu');
      }),
    });
    this.uiRoot.append(this.overlay);
  }

  resume() {
    if (!this.paused) return;
    this.closeOverlay();
    this.paused = false;
    this.game.scene.resume('battle');
    this.audio.resume();
  }

  onBattleEnd(result: BattleResult, _sim: BattleSim, extra: { escortSaved: number }) {
    const m = this.mission!;
    const rewards = computeRewards(this.save, m, result, extra);
    applyResult(this.save, m, result, rewards);
    this.persist();
    this.game.scene.pause('battle');
    this.paused = true;
    const idx = CAMPAIGN.findIndex((c) => c.id === m.id);
    const next = idx >= 0 ? CAMPAIGN[idx + 1] : undefined;
    const hasNext = !!next && result.victory && isMissionUnlocked(this.save, next);
    this.overlay = resultOverlay({
      result, rewards, mission: m, hasNext,
      onRetry: () => { this.click(); this.startMission(m.id); },
      onNext: () => { this.click(); this.go('briefing', next!.id); },
      onMenu: () => { this.click(); this.go('menu'); },
    });
    this.uiRoot.append(this.overlay);
    if (rewards.shards > 0) window.setTimeout(() => this.audio.play('reward'), 600);
  }

  /** Para testes automatizados no navegador. */
  get debugState() {
    return { screen: this.lastScreen, arg: this.lastArg, inBattle: this.inBattle, paused: this.paused };
  }
}
