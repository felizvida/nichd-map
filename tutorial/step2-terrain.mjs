// Step 2: an adaptive terrain mesh whose different-sized cells still share every edge vertex.
//   node tutorial/step2-terrain.mjs [--tolerance=0.25]
import {loadSample, terrainGrid, buildTerrain} from './lib.mjs';
import {options} from './args.mjs';

const o = options({tolerance: 0.25});
const grid = terrainGrid(loadSample(undefined, {terrainFile: o.terrain}).terrain);
const {leaves, check} = buildTerrain(grid, o.tolerance);
const full = 2 * (grid.nx - 1) * (grid.ny - 1);
const sizes = {};
for (const l of leaves) sizes[l.size + ' m'] = (sizes[l.size + ' m'] || 0) + 1;
console.log(`Tolerance ${o.tolerance} m: ${leaves.length} square leaves`, sizes);
console.log(`Mesh: ${check.vertices} vertices, ${check.triangles} triangles (a plain 2-triangles-per-cell grid would have ${full})`);
console.log(`Edges: ${check.interiorEdges} interior edges shared by two triangles, ${check.boundaryEdges} on the outer boundary,`,
            check.cracks ? `${check.cracks} CRACKS` : 'no cracks');
