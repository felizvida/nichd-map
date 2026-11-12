// Step 3: footprints to blocks, with heights from a second dataset and a base that follows the ground.
//   node tutorial/step3-buildings.mjs [--heights=structures|levels]
import {loadSample, localFrame, terrainGrid, localFeatures, makeBuildings} from './lib.mjs';
import {options} from './args.mjs';

const o = options({heights: 'structures'});
const sample = loadSample(undefined, {terrainFile: o.terrain});
const frame = localFrame(sample.terrain), grid = terrainGrid(sample.terrain);
const {blocks, unmatched} = makeBuildings(localFeatures(sample.features, frame), localFeatures(sample.structures, frame), grid, {heights: o.heights});
console.table(blocks.map((b) => ({building: b.osm, 'area m2': b.area, 'height m': b.height, source: b.heightSource,
                                  'overlap with structure': b.matchShare, 'lowest ground': b.base, pad: b.pad, roof: b.top,
                                  'ground fall along walls m': +(b.pad - b.base).toFixed(2)})));
for (const u of unmatched) {
  console.log(`A structures footprint matches no OSM building: ${u.area} m2 at (${u.centre}), class ${u.occupancy_class},`,
              `height ${u.height_m ?? 'none'}, inside: ${u.coveredBy.join(' and ') || 'nothing mapped'}`);
}
