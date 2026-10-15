import './style.css';
import { GameEngine } from './game/game-engine';
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const ui = document.getElementById('ui-layer')!;
  try { new GameEngine(canvas, ui); }
  catch {
    const panel = document.createElement('section'); panel.className = 'modal-overlay';
    const card = document.createElement('div'); card.className = 'modal-card';
    const title = document.createElement('h1'); title.textContent = 'Your garden needs WebGL';
    const copy = document.createElement('p'); copy.textContent = 'Try a current browser with graphics acceleration enabled. Reload after changing your browser settings.';
    card.append(title,copy); panel.append(card); ui.replaceChildren(panel);
  }
});
