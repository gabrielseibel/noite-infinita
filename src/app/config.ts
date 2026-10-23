// Configuração global do jogo. Altere o nome aqui e ele muda em todas as telas.
export const GAME_CONFIG = {
  title: 'NOITE INFINITA',
  subtitle: 'DEFESA FINAL',
  version: '0.1.0',
  saveKey: 'noite-infinita.save',
  world: { width: 1600, height: 896, tile: 32 },
  /** Ferramentas de depuração: ative com ?debug=1 na URL (somente desenvolvimento ou explícito). */
  debug: typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug'),
} as const;

export const fullTitle = () => `${GAME_CONFIG.title} — ${GAME_CONFIG.subtitle}`;
