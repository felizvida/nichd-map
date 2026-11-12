# Reproduce the methods

Use Node.js 22+ and Python 3.12+ with the pinned NumPy dependency. CI tests Node.js 22 and 24 with Python 3.12 and 3.13. Follow the root README commands.

All checks create synthetic inputs; temporary-file contexts remove their files. They require neither the original application nor a map dataset. This reproduces reference methods, not a real campus map or prior painting output.

Tests cover:

- terrain triangle area, coverage and paired interior edges across a coarse/fine boundary;
- projection/inverse agreement, isometric foreshortening and saddle winding;
- duplicate, old, future, stale, implausible and reduced-motion fixes;
- known shift recovery, ambiguous rejection and non-wrapping translation;
- semantic selection, alpha, bounded gains and transparent-colour isolation;
- coverage/context metrics, settings hashes, resume rejection, unsafe paths and links.

Tests do not establish large-scale performance, real-world geographic accuracy, image-model quality or operational readiness.

## Record your own run privately

Record input checksums, CRS/datum/units, geometry revision, camera, dimensions, overlap, appearance direction, tool version, seed when supported, settings hash, attempts and accepted-frame hashes. A seed alone does not guarantee identical generated pixels.

On resume, verify settings and input hashes. Skip only outputs with accepted status and verified hashes. Preserve failed attempts separately. For a service usage limit, record the stop reason, wait for permitted availability and rerun the same immutable command. Do not silently change model, quality or parameters.

Report accepted-frame count, context flags, coverage flags, failures, mosaic location and replacement/backup verification. Keep actual run logs, outputs and paths in the private project outside the public methods tree.
