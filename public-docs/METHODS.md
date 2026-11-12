# Terrain-aware isometric map methods

These implementations generalise engineering techniques from a mapping project. They have no geographic origin, building identifiers, real camera calibration, provider adapter or real-world model parameters. The [hands-on tutorial](../tutorial/README.md) applies them to a small public-data sample.

## Terrain before appearance

A digital terrain model represents bare earth. A surface model includes objects such as trees and buildings. Surface height alone does not establish roof shape or identify a building. Record horizontal reference system, vertical datum, units, date, classification quality and gaps before combining sources. Do not mix ellipsoidal and orthometric heights without a documented conversion.

`terrainMesh` accepts a precomputed partition of axis-aligned square leaves. It gathers all corners, inserts fine-neighbour corners on each coarse boundary and triangulates from the cell centre. Both sides then share coordinates and sampled heights. A coarse triangle must retain collinear boundary vertices: skipping one produces a T-junction and possible cracks when terrain is lifted.

Inputs must use one consistent coordinate lattice. Exact equality does not repair noisy coordinates. The implementation rejects overlapping leaves but does not prove coverage of an intended domain. Its quadratic scans favour clarity in small examples; production code should index edges spatially and enforce domain coverage. Height sampling at shared coordinates must be deterministic.

## One projection contract

`camera` rotates horizontal coordinates by heading and applies an orthographic tilt. Angles are radians; screen coordinates point down. True isometric foreshortening uses a 45-degree horizontal heading and tilt `atan(1/sqrt(2))`, about 35.264 degrees. Other headings change which horizontal directions are equally foreshortened.

Use one camera, datum, terrain multiplier, dimensions and pixel origin for beauty, semantic, object-ID, shadow, painting, tiles and labels. Test both numerical round trips and a height-aware overlay. The inverse needs elevation: two screen coordinates alone cannot identify an unknown 3D point.

## Evidence-led building forms

Footprints constrain plan shape, point clouds can constrain height, and dated imagery can constrain facade and roof form. Record uncertain bearings, connectors, renovations and photo dates. Keep actual evidence and parameters in the owner's private workspace.

`saddleMesh` implements a generic bilinear patch with four caller-supplied corner heights. Tests use invented dimensions. It has a top surface only: thickness, glazing, fascia, normals, materials, collision and picking belong to the consuming renderer. A primitive is not evidence that a real roof has that form.

## Guarded painting

1. Freeze geometry and export settings; hash settings in each private run record.
2. Export overlapping frames with exact alpha, semantic classes and object IDs. Keep IDs separate from generated pixels.
3. Review representative spots for layout, materials, landscape, current geometry and edge coverage.
4. Obtain the owner's appearance choice before an expensive full run.
5. Paint with neighbouring context. Use neutral descriptive direction such as textured foliage, soft atmospheric colour and restrained architectural detail.
6. When treatments differ, paint landscape and architecture separately. Select architecture through its export mask and restore exact alpha.
7. Reject layout changes or missing coverage. Retry from frozen inputs; do not change run settings while resuming.

An image model controls appearance. Its output is not authoritative geometry, text, object IDs, scientific measurement or proof of a current building. No particular model or hosted service is required here.

## Alignment and overlap checks

`alignment` searches small integer translations using masked Pearson correlation. Supply a stable structural anchor, often a grayscale edge pass. Flat or ambiguous matches fail closed. The margin is measured against the next best shift of any kind, which is usually an immediate neighbour of the winning shift; a broad, correct peak on smooth imagery therefore gives a small margin. Choose `min_margin` on reviewed examples, or compare against shifts outside the peak's neighbourhood in your own variant. Direct search suits small patches, not large optical-flow tasks. Appearance changes, repetitive texture, occlusion and deformation can break correlation. Do not apply a rejected shift. Translation cannot repair warped geometry.

`translate` zero-fills exposed strips instead of wrapping them. `composite_landscape` selects RGB by a boolean building mask and restores exact alpha. `fit_overlap_gain` fits bounded independent channel gains from a nonempty overlap; it does not solve a global mosaic graph or correct shadows. `feather_blend` takes straight (non-premultiplied) RGBA tiles on a common canvas and weights each pixel's colour by the caller's weight times its alpha, so transparent pixels contribute nothing. Zero-weight pixels stay transparent. Restore authoritative export coverage after stitching when exact coverage is required.

`frame_metrics` defines coverage as retained expected nonzero-alpha pixels divided by expected covered pixels. `ctx_diff` is masked mean absolute RGB difference divided by 255. These are explicit reference metrics; other tools may use different formulas. Choose thresholds on reviewed, authorised examples. Report context flags, coverage flags and execution failures separately. Coverage alone cannot prove alignment.

## Confirmed live motion

Keep provider access outside the renderer. Normalise coordinate units and timestamps before passing fixes to `ConfirmedMotion`. Wall-clock seconds govern freshness; monotonic milliseconds govern animation. Duplicate and older timestamps cannot rewind or restart motion. Excessive gaps or speed snap to a confirmed location; stale fixes disappear. Interpolation stops at the newest fix with no extrapolation. This module has no route estimation, map matching or network poller.

## Release and visual checks

Hash immutable inputs and settings. A frozen artifact should list selected regular files, sizes and hashes; reject traversal and symlinks before packaging. Rebuild and compare bytes before transferring the reviewed artifact. Operational hosts, credentials, environment files and release logs stay private.

[RELEASE_METHOD.md](RELEASE_METHOD.md) describes the full gated release, including the browser capture routine. Browser checks must observe the map draw, not metadata readiness alone. Wait for the intended view, advancing frames, uploaded textures, no pending loads and no errors. Use an isolated foreground page for software-rendered WebGL. Inspect desktop/mobile placement, seams, picking and controls. A non-blank pixel check catches empty captures but cannot replace inspection; fog, snow and lighting affect colour metrics.
