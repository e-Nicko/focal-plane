# Why it works

Some of the grammar rests on perception research.
Some of it is only craft, handed down through stock templates and showreels.
This page keeps the two apart.

## Backed by research

### Blur tells size and distance

Held, Cooper, O'Brien and Banks (2010) showed that
the pattern of defocus blur in an image,
together with the other depth cues in it,
sets how far away and how big its contents appear.
Their paper also gives an algorithm that adds blur to a sharp image
to change the apparent distance and scale of what it shows.

**How we use it:** a strong blur gradient over a dashboard
makes it read as a small object close to the lens,
which is where the material presence comes from ([the lens](the-lens.md)).

### Sharp regions draw the eye

Enns and MacDonald (2013) tracked eyes on photographs.
When viewers attended to what a photo showed,
fixations went to its sharp regions sooner and more often than to comparable blurred ones,
even when viewers were told to look at both equally.
When viewers judged photo quality instead of content, the bias reversed.
Cole and colleagues (2006) tested a related idea on rendered 3D models:
emphasis made with local variations of shading and line quality drew viewers' gaze in an eye-tracking test.
Blur played no part in their emphasis.

**How we use it:** focus is the pointer.
Racking focus from the control to its effect tells the viewer where to look next.
**The limit:** the pull depends on the viewer's task.
Someone hunting for rendering flaws will look at the blur.

### Cause and effect are seen directly

Michotte (1946) found that when one object reaches another and the second starts to move at once,
people see the first one launch it.
The impression is perceptual and immediate.
A registered replication (White, 2025) confirmed the launching effect,
and found launching ratings falling as the delay grew from 0 to 200 ms,
though less sharply than Michotte had reported.

**How we use it:** the effect starts right after the click,
in the same frame, with no cut between them ([the shot](the-shot.md)).
In the forecast shot the projection starts growing 0.12 s after the click.

### Cuts hide behind motion

Smith and Henderson (2008) asked viewers to watch films and report every cut.
A quarter of the cuts between two views of the same scene went unnoticed,
and a third when the cut coincided with a sudden onset of motion.
Smith's attentional theory of cinematic continuity (2012)
explains continuity editing, match-action cuts included, through where attention goes.

**How we use it:** every shot with a cursor sets the cursor moving in its first frames,
so each cut lands on an onset of motion ([the edit](the-edit.md)).

### A hand moves smoothly

Flash and Hogan (1985) modelled point-to-point arm movements
as the smoothest possible path, the one that minimises jerk.
Their measurements confirmed the model's predictions:
nearly straight paths with bell-shaped speed profiles.

**How we use it:** cursor travel eases in and out ([the cursor](the-cursor.md)).
**The limits:** the kit's `ease.inOut` is a cubic,
while the minimum-jerk profile is a quintic;
at these durations the difference is hard to see.
And the slight bow in our cursor paths does not come from this paper,
whose paths are nearly straight.
The bow is craft, listed below.

## Only craft

These rules come from the reference reel and from stock conventions.
We know of no research behind them, and we have not tested them:

- shots of about two seconds;
- alternating steep diagonals with near-frontal shots;
- a giant soft shape in the foreground as mass;
- a slight bow in the cursor's path;
- lifted black and capped white;
- monochrome.

Treat them as a style you are free to change.
Full references: [sources](../sources.md).
