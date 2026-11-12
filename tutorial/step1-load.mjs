// Step 1: load the three layers and put them in one local metric frame.
//   node tutorial/step1-load.mjs
import {loadSample, localFrame, terrainGrid, localFeatures} from './lib.mjs';
import {options} from './args.mjs';

const o = options();
const sample = loadSample(undefined, {terrainFile: o.terrain});
const frame = localFrame(sample.terrain);
const grid = terrainGrid(sample.terrain);
const features = localFeatures(sample.features, frame);
const structures = localFeatures(sample.structures, frame);

const kinds = {};
for (const f of features) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
console.log('OpenStreetMap features by kind:', kinds);
console.log('USA Structures footprints:', structures.map((s) => s.props.height_m ?? 'no height'));
console.log(`Terrain: ${grid.nx} x ${grid.ny} nodes every ${grid.cell} m, x ${grid.x0}..${grid.x1} m, y ${grid.y0}..${grid.y1} m`);
console.log(`Ground height ${grid.min.toFixed(2)}..${grid.max.toFixed(2)} m (NAVD88), relief ${(grid.max - grid.min).toFixed(2)} m`);
const xs = features.flatMap((f) => (f.ring || f.line).map((p) => p[0])), ys = features.flatMap((f) => (f.ring || f.line).map((p) => p[1]));
console.log(`Features span x ${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)} m, y ${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)} m:`,
            Math.min(...xs) >= grid.x0 && Math.max(...xs) <= grid.x1 && Math.min(...ys) >= grid.y0 && Math.max(...ys) <= grid.y1
              ? 'inside the terrain grid' : 'NOT inside the terrain grid');
