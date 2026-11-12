---
name: terrain-map-review
description: Review terrain-aware isometric map geometry and projection consistency when terrain, labels, picking or painted layers drift or show cracks.
---

Establish the coordinate contract first: local horizontal origin, units, horizontal reference system, vertical datum, terrain multiplier, heading, tilt, screen origin and pixel scale. Do not infer real calibration from a screenshot alone.

Use the same geometry revision and camera for beauty, IDs, semantic classes and painted export. Test projection/inverse at a known elevation, then inspect a height-aware overlay. An inverse without elevation is underdetermined.

When coarse and fine terrain leaves meet, preserve every fine boundary vertex in the coarse triangulation. Compare interior edge pairs and projected coverage; a visually flat terrain can hide T-junctions that appear after lifting. Snap inputs to a common lattice rather than patching near-equality ad hoc.

Separate bare-earth terrain from surface returns. Verify datum, classification and dates before combining point clouds, raster heights and photographs. A footprint or high return alone does not establish roof form. Keep uncertainty and real evidence private unless the user explicitly authorises its destination.

For browser inspection, observe actual frames, uploaded textures and pending loads. Metadata readiness alone does not establish a drawn image. Check desktop/mobile placement, seams, object selection and controls. Colour metrics cannot replace visual review under changing lighting.

Return the demonstrated defect, evidence, correction and validation limit. Use synthetic fixtures for public tests; never move actual map evidence into a public repository as part of diagnosis.
