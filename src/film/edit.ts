// The example film, "Q3 Revenue":
// establish the page, pick Forecast, switch it on, stretch the horizon,
// read the months, catch the outlier,
// and pull back over the page the story has changed.
// Seven shots, hard cuts, about sixteen seconds.

import { makeEdit } from '../engine/edit.js';
import { makeOverview } from './shots/overview.js';
import tabs from './shots/tabs.js';
import forecast from './shots/forecast.js';
import horizon from './shots/horizon.js';
import months from './shots/months.js';
import anomaly from './shots/anomaly.js';

export default makeEdit({
  title: 'Q3 Revenue',
  shots: [
    makeOverview({ id: 'overview', duration: 2.1 }),
    tabs,
    forecast,
    horizon,
    months,
    anomaly,
    makeOverview({ id: 'outro', duration: 2.4, outro: true }),
  ],
  poster: 5.8,        // the forecast drawn, its value labelled
});
