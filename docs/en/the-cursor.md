# The cursor

The cursor is the only actor in the film.
It gives every shot a reason:
something changes because someone did something.

## It moves like a hand

- Travel eases in and out: a slow start, a fast middle, a slow arrival.
  Human reaching has this bell-shaped speed profile
  (Flash & Hogan, 1985, in [why it works](why-it-works.md)).
- The path bows slightly, by up to 40 px in the forecast shot.
  This one is craft; no study backs it:
  measured hand paths are nearly straight,
  but on screen a slight bow reads as less mechanical.
- On arrival it settles:
  a damped wobble of 1.6 px that dies out in about a quarter of a second.

## It aims beside the target

The hotspot is the fingertip,
and it lands 8 px right of and 10 px below the toggle's centre.
The hand's body falls down and to the right,
so the knob stays visible under the click.
After the click the cursor drifts away,
26 px left and 30 px down over 1.3 seconds,
and the effect is never under the hand.

## Arrow, then hand

The cursor is an arrow while it travels.
It becomes a hand within about 50 px of a control,
when the control's hover ring is already fading in.

## Four states of a control

Every control the cursor touches shows all four states on screen.

| State | What the viewer sees |
|---|---|
| hover | a ring fades in as the cursor comes from 70 px to 24 px away |
| press | a 0.2 s pulse: the pointer shrinks by 10%, a toggle's knob stretches by 8 px, a slider's knob grows by 12% |
| ripple | a ring spreads from the control over 0.8 s |
| settle | the control eases into its new state in 0.3 s |

Skip one and the click reads as a jump in the animation.

## One cursor per shot, scripted

Each shot writes its own cursor path in `state(t)`:
start, target, click time, drift.
There is no path planner.
A path is a few lines of arithmetic you can read and tune,
and it is the same on every render.

Next: [the edit](the-edit.md).
