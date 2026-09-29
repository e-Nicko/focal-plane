// Edit template: the shots in order, joined by hard cuts.
// Copy it to src/<film>/edit.ts and list your shots.

import { makeEdit } from '../engine/edit.js';
import roundUps from './shots/round-ups.js';

export default makeEdit({
  title: 'Round-ups',
  shots: [roundUps],
  // the still frame for viewers who prefer reduced motion:
  // pick the moment that tells the most on its own
  poster: 1.9,
  // grade: { grain: 0.02 },   // overrides DEFAULT_GRADE in src/engine/edit.ts
});
