import './style.css';
import { GameEngine } from './game/game-engine';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const uiContainer = document.getElementById('ui-layer') as HTMLElement;

  if (canvas && uiContainer) {
    new GameEngine(canvas, uiContainer);
  }
});
