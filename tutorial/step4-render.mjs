// Step 4: one camera, a z-buffer and a PNG. Writes tutorial/out/preview.png (or --out=...).
//   node tutorial/step4-render.mjs [--heading=45] [--exaggeration=1] [--tolerance=0.25] [--heights=structures]
import fs from 'node:fs';
import path from 'node:path';
import {pipeline, encodePNG} from './lib.mjs';
import {options} from './args.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const o = options({out: path.join(here, 'out/preview.png')});
const r = pipeline({terrainFile: o.terrain, tolerance: o.tolerance, heights: o.heights, heading: o.heading, exaggeration: o.exaggeration});
fs.mkdirSync(path.dirname(o.out), {recursive: true});
fs.writeFileSync(o.out, encodePNG(r.image.rgba, r.image.width, r.image.height));
console.log(`${r.image.triangles} triangles, ${r.image.drawnTriangles} visible, ${r.image.scale.toFixed(2)} px per metre -> ${o.out}`);

// The inverse needs a height: take the tallest roof's first corner, project it, then unproject at the roof height.
// (The camera works on the supersampled image, ss times the output size.)
const b = r.blocks.reduce((m, x) => (x.top > m.top ? x : m));
const corner = [...b.ring[0], b.pad + b.height];
const [u, v] = r.image.camera.project(corner), back = r.image.camera.unproject([u, v], corner[2]);
console.log(`Roof corner (${corner.map((x) => x.toFixed(2))}) -> pixel (${(u / r.image.ss).toFixed(1)}, ${(v / r.image.ss).toFixed(1)}) -> back to`,
            `(${back.map((x) => x.toFixed(2))}); unprojecting at the wrong height lands`,
            `${Math.hypot(...r.image.camera.unproject([u, v], corner[2] - 10).slice(0, 2).map((x, k) => x - corner[k])).toFixed(1)} m away`);
