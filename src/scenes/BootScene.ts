import Phaser from 'phaser';
import { generateTextures, preloadCardArt } from '../render/textures';

/** Gera as texturas procedurais com progresso real e então avisa o app. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  async create() {
    const onProgress = (this.registry.get('onProgress') as (p: number) => void) ?? (() => {});
    const onReady = this.registry.get('onReady') as () => void;
    try {
      await generateTextures(this, (p) => onProgress(p * 0.9));
      preloadCardArt();
      onProgress(1);
      onReady?.();
    } catch (err) {
      console.error('[boot] falha ao gerar texturas', err);
      const onError = this.registry.get('onError') as ((e: unknown) => void) | undefined;
      onError?.(err);
    }
  }
}
