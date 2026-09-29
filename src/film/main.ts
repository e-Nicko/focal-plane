// Entry point of the example film.
import { boot } from '../engine/player.js';
import edit from './edit.js';

boot(edit).catch((e) => {
  console.error(e);
  const el = document.getElementById('fatal');
  if (el) {
    el.hidden = false;
    el.textContent = `This film needs WebGL 2. ${e.message}`;
  }
});
