# Honest data

The company is fictional and the numbers are synthetic.
They are still true to one another,
because a viewer who pauses the film should find a consistent story in them.

## One data module

Every shot reads `src/film/data.ts`.
It is deterministic: a seeded generator and arithmetic,
no `Math.random`, no clock.
So a number seen in one shot is the same number in the next.

| Number | Where it appears |
|---|---|
| $4.28M, today's daily revenue | overview, tabs, forecast, the Sep cell in months, outro |
| +12.4% vs $3.81M | overview, forecast; the prior-period line ends exactly at $3.81M |
| $5.24M by Dec 25 | the 90-day value in horizon, the Dec cell in months |

The prior-period series is bent so that it ends at 4.28 / 1.124.
That is the $3.81M in "+12.4% vs $3.81M",
so the label names a value the chart actually reaches.
The five months before the series starts, January to May, are constants chosen to continue it;
every other month is read from the series or from the forecast.

## A detector finds the outliers

Three outliers are planted in the series.
The anomaly shot is not told where they are.
It detects them:

1. A day's expected value is the median of its three neighbours on each side.
2. Sigma is the median absolute deviation of the residuals,
   scaled by 1.4826 to match a normal σ.
3. An outlier is any day more than 2.5σ from its expected value.

Medians are barely moved by the outliers they are meant to find,
so the detector needs no list of clean days.
In the last 60 days it finds exactly two:
Sep 4 at +3.8σ and Aug 9 at −3.9σ.
The labels in the film print what the detector found.
If the data changes, the labels change with it.

## Labels name what the chart shows

- Axis labels are computed from the plotted domain.
- The projected value at the end of the forecast is the forecast's last point.
- The forecast band is an 80% band (±1.28σ of the recent trend's residuals,
  widening with the square root of time), and the page says "80% band".

## Why bother

A promo whose numbers disagree teaches the viewer that the numbers do not matter,
and an analytics product is nothing but its numbers.
When the data is one module, consistency costs nothing.

Next: [how we know](how-we-know.md).
