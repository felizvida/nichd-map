// Maintainers: after changing the sample or the pipeline on purpose, rewrite expected.json and preview.png, then review
// the diff and the picture before committing.
//   node tutorial/update-expected.mjs
import fs from 'node:fs';
import path from 'node:path';
import {pipeline, summarize, encodePNG} from './lib.mjs';
import {options} from './args.mjs';

const here = path.dirname(new URL(import.meta.url).pathname);
const o = options();
const r = pipeline({terrainFile: o.terrain});
fs.writeFileSync(path.join(o.dir || here, 'expected.json'), JSON.stringify(summarize(r), null, 1) + '\n');
fs.writeFileSync(path.join(o.dir || here, 'preview.png'), encodePNG(r.image.rgba, r.image.width, r.image.height));
console.log('wrote expected.json and preview.png in', o.dir || here);
