# Isometric Map Methods

![Fictional terrain becoming a geometric and painterly map](assets/banner.png)

Reusable methods for turning terrain and geometry into an aligned, illustrated isometric map. This repository shares algorithms, verification methods, public source references and reusable agent workflows developed during a campus-map project.

**Methods only.** No campus datasets, real building models, directory records, map tiles, operational endpoints or deployment are included. The banner is fictional. Tests create synthetic inputs in memory or temporary folders.

This is an independent methods reference, not an official NIH/NICHD product or endorsement.

## What you can use

| Module | Purpose |
| --- | --- |
| [terrain.mjs](methods/terrain.mjs) | Matching terrain edges across different leaf resolutions |
| [projection.mjs](methods/projection.mjs) | Orthographic projection and inverse at a known elevation |
| [roof.mjs](methods/roof.mjs) | Parametric saddle surface without a site-specific model |
| [motion.mjs](methods/motion.mjs) | Confirmed-fix animation with old and stale update guards |
| [raster.py](methods/raster.py) | Alignment, semantic compositing, bounded colour gains and overlap blending |
| [provenance.py](methods/provenance.py) | Immutable settings hashes and selected regular-file manifests |

These are small reference implementations. They do not include a complete map application, GIS ingestion stack, image-generation client or production orchestration.

## Run the synthetic checks

Use Node.js 22+ and Python 3.12+. There are no JavaScript dependencies. NumPy is the only Python dependency.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm test
.venv/bin/python -B -m unittest discover -s method-tests -p 'test_*.py' -v
python3 -B publication/check.py --ref HEAD
```

No dataset, account, API key, GPU or network service is needed after dependency installation.

```js
import {terrainMesh} from './methods/terrain.mjs';
import {camera} from './methods/projection.mjs';

const mesh = terrainMesh([{x: 0, y: 0, size: 4}], (x, y) => Math.sin(x) + y / 4);
const view = camera({heading: Math.PI / 4, scale: 2});
const screenVertices = mesh.vertices.map(p => view.project(p));
```

## Read the workflow

- [Methods and limits](public-docs/METHODS.md): terrain, geometry, guarded painting, stitching, motion and visual checks.
- [Public source references](public-docs/DATA_SOURCES.md): source roles and attribution; no copied data.
- [Reproducibility](public-docs/REPRODUCIBILITY.md): inputs, settings, resume rules and validation.
- [Publication boundary](public-docs/PUBLICATION.md): exact-file and history review.
- [Reusable skills](public-skills/README.md): terrain review, guarded painting and methods publication.
- [Banner provenance](public-docs/BANNER.md): fictional illustration and prompt.

## Licence and contributions

Code and documentation use [Apache-2.0](LICENSE). It does not grant rights to external datasets or institutional names and marks. The AI-generated banner is included under the same repository licence to the extent rights are available; no exclusive copyright claim is made for AI-generated content.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). Contributions must use synthetic examples and must not include real campus or personnel data.
