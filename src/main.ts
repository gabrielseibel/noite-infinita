import './ui/styles.css';
import { GameApp } from './app/GameApp';

const app = new GameApp(document.getElementById('game')!, document.getElementById('ui')!);
// Exposto para depuração no console e para testes de navegador.
(window as unknown as { __app: GameApp }).__app = app;
