# The lens

Depth of field is what makes the technique work.
It makes a flat interface in perspective look like an object on a desk,
filmed with a macro lens.

## Blur says "small and close"

The amount of blur tells the eye how far away things are and how big they are.
A strong blur gradient across a whole dashboard
makes it read as something small, close to the lens
(Held et al., 2010, in [why it works](why-it-works.md)).
That is the material presence the technique is after.

## The thin lens

Each pixel gets a circle of confusion, in pixels, from its depth:

```
c = K · (1/z_focus − 1/z) · H
```

- `z` is the pixel's distance along the view axis,
  `z_focus` is the focus distance,
  `H` is the frame height in pixels.
- `K` is the `aperture` field of a camera key: bigger is shallower.
  The example uses 0.28 to 0.42.
- `c` is negative in front of the focal plane and positive behind it,
  and is clamped to 3.8% of the frame height.

The lower the camera sits over the page, the smaller an `aperture` you need.
A steep diagonal, low over the page and off to one side, already spans a long depth range,
so 0.3 is plenty (tabs, horizon).
A near-frontal shot spans almost none,
so it needs 0.4 or more before any blur appears (forecast, anomaly).

## Focus is a point on the page

A shot does not set a focus distance.
Its `state(t)` returns `focus: [x, y]`, a point on the page in canvas pixels,
and the engine measures the distance to that point along the view axis.
When the camera moves, the focus stays on the thing.

## Rack focus: cause, then effect

Focus starts on the control and moves to what it changed.
In the forecast shot:

| Time | What happens |
|---|---|
| 0.0–0.52 s | the cursor travels to the toggle; focus is on the toggle |
| 0.6 s | the click |
| 0.72 s | the projection starts to grow |
| 0.85–1.5 s | focus racks from the toggle to the end of the projection |
| 1.55–2.0 s | the projected value fades in, in focus |

Start the rack after the effect has begun:
the eye should arrive where something is already happening.

## Bokeh

The gather pass samples a golden-angle spiral,
after Dennis Gustafsson's single-pass bokeh:
110 samples in draft, 260 in high, 720 in the master.
Towards the frame edges the bokeh turns into a cat's eye,
as in a real lens with mechanical vignetting.
A prefilter averages bright pixels with Karis weights,
so a single bright pixel does not flicker as a disc from frame to frame.

Next: [the cursor](the-cursor.md).
