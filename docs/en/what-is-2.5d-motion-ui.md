# What is 2.5D motion UI

**2.5D motion UI** is flat vector interface graphics
assembled and animated in three-dimensional space:
flat layers, a camera, perspective, parallax.
Depth of field gives it material presence.
It adds the feel of a lens
and turns screen graphics into an object filmed by a camera.

The technique has no single canonical name.
Its genre, its devices and its look are named separately,
and on stock sites it lives under the name of the genre:
*app promo*, *UI promo*, *website promo*, *3D screens promo*, *UI showcase*.
On 27 September 2026,
a Videohive search returned about 3,500 After Effects projects for "app promo"
and about 6,000 for "UI".
The [glossary](../glossary.md) lists the names in three languages.

## Why "2.5D"

The graphics are two-dimensional and the space is three-dimensional.
Nothing in the frame has thickness:
a card is a rectangle drawn on a page,
and the page is a plane the camera flies over.
The depth you see comes from perspective and from focus.

Full 3D, with glass slabs, reflections and studio lights,
is a neighbouring genre, the product render.
The two genres share only their optics.

## Where you have seen it

- Product launch films and the "hero film" on a landing page.
- App store previews and SaaS launch videos.
- Dashboard and design-system showcases on Behance and Dribbble.
- Type specimen videos from type foundries,
  where the same grammar is applied to letters instead of widgets.

## What this repository does with it

- The interface and the cursor are drawn with canvas 2D,
  the way shape layers are drawn in After Effects.
- The canvas lies on a plane in an empty dark space.
- three.js holds the plane, moves the camera and writes depth.
- A lens shader turns depth into bokeh,
  focused on the point of the page each shot names.
- A grade gives the frame its film look.
- Every frame is a function of time,
  rendered offline and encoded to MP4 in the browser.

The example is a sixteen-second film about a fictional revenue dashboard.
Next: [the shot](the-shot.md).
