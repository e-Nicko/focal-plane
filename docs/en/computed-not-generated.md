# Every frame is computed

Every frame of the film is a function of time.
Nothing is sampled from a model, captured from a screen or keyed by hand.

## A frame is `f(t)`

- A shot's `state(t)` is pure: the same `t` gives the same cursor, focus and values.
- Camera keys are interpolated with a spline, never simulated.
- The data is generated once from fixed seeds.
- Grain depends on the frame index; the clock is never read.

So frames can be rendered in any order, in parallel, or one at a time.
The in-browser player and the offline renderer run the same code
and differ only in which times they ask for.

## What that buys

| | Generated video | Computed film |
|---|---|---|
| first frame | seconds after a prompt | hours of writing code |
| text | legible where the model managed it | crisp at 4K, everywhere |
| numbers | whatever looked plausible | true to one another ([honest data](honest-data.md)) |
| a change | a new prompt and a new roll of the dice | edit a value and render again |
| the same frame twice | not guaranteed | the same, give or take one level in a few pixels |
| a review | watch it | watch it, diff it, read the code |

## The genre has been learned by generators

Video models know this genre.
The Seedance 2.0 prompt guide has a template for it:
a SaaS app preview in which a cursor takes the interface
from an empty state to a success state.
The reference reel we studied was most likely generated:
in its blurred zones the text dissolves into mush.

A generator is a good way to find a mood.
It is a poor way to show a product,
because the product's text and numbers are the point.

## Why an agent fits

The grammar in these pages is explicit enough to write down,
so it can be written as code.
An agent that writes a shot can render a still, look at it and correct the camera,
the same loop a motion designer runs in After Effects.
The [skill](../../skills/focal-plane/SKILL.md) gives an agent that loop.

Next: [honest data](honest-data.md).
