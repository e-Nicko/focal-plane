# Composition

The grammar of a Focal Plane film, as rules you can check in a still.

## The shot

- **One idea.**
  Write it as one sentence with a cause and an effect.
  "And then" means two shots.
- **Cause and effect in one frame.**
  Place the control and the thing it changes so both fit the frame at once.
  Typical layout: the control small and far, the effect large and near.
- **Scale contrast.**
  Put a huge element next to a small one:
  a 210 px readout beside a 3 px slider track;
  a 330 px number in the foreground, soft, may run out of the frame.
- **A foreground mass.**
  An element nearer to the lens than the focal plane, large and soft,
  gives depth for free.
  In the example: the 330 px horizon digits (horizon), the giant month name (months),
  the blurred $4.28M below the tabs (tabs).
- **Negative space.**
  Most of the frame is empty page.
  Draw only what the shot needs; the rest of the dashboard does not exist in this shot.
- **Length.**
  1.8–2.6 s.
  The shot with the discovery may be the longest.

## Shot types

| Type | Camera | Use | Example |
|---|---|---|---|
| establishing | wide, `distance` 12–17, `aperture` 0.28–0.38 | the page and its headline | overview |
| steep diagonal | `elevation` 19–25°, `azimuth` ±45–60° | speed, a control in action | tabs, horizon |
| near-frontal | `elevation` 40–57°, `azimuth` within ±17° | legibility, rest, the answer | forecast, anomaly |
| other side | `azimuth` flipped in sign | a new subject | months |
| pull-back | `distance` growing through the shot | the page after the story | outro |

Alternate steep and calm.
Flip the side only when the subject changes.

## The cursor

- Travel 0.4–0.9 s with `ease.inOut`; a slight bow (up to about 40 px) reads less mechanical.
- Aim beside the target: the hotspot (fingertip) lands about 8 px right and 10 px below the control's centre,
  so the hand never covers what it touches.
- Arrow while travelling, hand when `hover > 0.35` (within about 50 px).
- `hover` = `1 − smoothstep(24, 70, distance)`.
- `press` = `pulse(t, click − 0.06, click + 0.14, 0.05, 0.08)`.
- `ripple` = `(t − click) / 0.8` after the click.
- The control settles into its new state over 0.3 s (`ease.out`).
- A damped wobble on arrival sells the weight:
  `sin((t − arrive) · 24) · exp(−(t − arrive) · 9) · 1.6` px.
- From `distance` 12 up, the 26 px cursor is a speck:
  raise its `scale` to about `distance` / 8 and move the hotspot offset out to 12–14 px.
- After the click, drift 25–40 px away from the effect over about 1.3 s.
- Draw the cursor last in `draw()`.

## Timing inside a shot

A shot with one click, 2.2–2.6 s long:

| Time | Beat |
|---|---|
| 0.0 | motion begins: the cursor sets off, the camera starts to drift |
| 0.5–0.6 | arrival, hover |
| 0.6 | click |
| 0.7 | the effect begins |
| 0.85–1.5 | focus racks from the cause to the effect |
| 1.5–2.0 | a label or value lands on the effect |
| the rest | hold; the cursor drifts; the camera keeps pushing in |

## The edit

- Arc: establish → act → read → discover → pull back.
- The outro can be the opening shot again with the story's consequences visible.
- Fades only at the very start (0.35 s) and end (0.7 s) of the film.
  They dim what falls inside them:
  keep the first shot's cursor travel and the last shot's landing beat out of them.
  The last shot needs about 2.4 s, or its beat must land before its end minus 0.7 s.
- One data module, so numbers agree across cuts.
- `poster`: the global time of the frame that tells the most on its own.

## The example's decisions

| Shot | Idea | Camera at t = 0 | Why this angle |
|---|---|---|---|
| overview 2.1 s | the page, the headline | d 13.2, az −40°, el 27°, K 0.38 | wide diagonal, the number found out of blur |
| tabs 1.8 s | pick Forecast | d 6.4, az −58°, el 20°, K 0.3 | steepest angle, speed along the nav |
| forecast 2.5 s | switch it on | d 9.4, az −17°, el 41°, K 0.42 | calm, the chart must read |
| horizon 2.3 s | look further | d 12.2, az −46°, el 25°, K 0.3 | steep again, slider and counter in one line |
| months 2.4 s | read the months | d 10.6, az +36°, el 28°, K 0.4 | the other side for a new subject |
| anomaly 2.6 s | find the outlier | d 12.6, az −7°, el 55°, K 0.42 | almost top-down, the answer |
| outro 2.4 s | the page, changed | d 13.6 → 17.2, az −24°, el 36°, K 0.32 | pull back, fade out |
