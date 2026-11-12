import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pipeline, summarize, decodePNG, encodePNG, imageDiff, quadLeaves, meshCheck, terrainGrid, loadSample,
        triangulate, signedArea} from '../tutorial/lib.mjs';
import {terrainMesh} from '../methods/terrain.mjs';

const T = new URL('../tutorial/', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, T));

test('tutorial pipeline reproduces the documented numbers and picture', () => {
  const r = pipeline();
  assert.deepEqual(summarize(r), JSON.parse(read('expected.json')));
  const ref = decodePNG(read('preview.png'));
  assert.deepEqual(ref.chunks, ['IHDR', 'IDAT', 'IEND']);              // no metadata chunks
  const d = imageDiff(r.image, ref);
  assert.ok(d.mean < 1 && d.share < 0.01, JSON.stringify(d));
});

test('the adaptive mesh is crack-free, and two triangles per leaf is not', () => {
  const grid = terrainGrid(loadSample().terrain);
  const leaves = quadLeaves(grid, 0.25);
  assert.equal(meshCheck(terrainMesh(leaves, grid.heightAt), grid).cracks, 0);
  const vertices = [], index = new Map(), triangles = [];
  const v = (x, y) => { const k = x + ',' + y; if (!index.has(k)) { index.set(k, vertices.length); vertices.push([x, y, grid.heightAt(x, y)]); } return index.get(k); };
  for (const {x, y, size: s} of leaves) { const a = v(x, y), b = v(x + s, y), c = v(x + s, y + s), e = v(x, y + s); triangles.push([a, b, c], [a, c, e]); }
  assert.ok(meshCheck({vertices, triangles}, grid).cracks > 0);
});

test('a fine tolerance costs more triangles than the plain grid', () => {
  const grid = terrainGrid(loadSample().terrain);
  const plain = 2 * (grid.nx - 1) * (grid.ny - 1);
  assert.ok(meshCheck(terrainMesh(quadLeaves(grid, 0.25), grid.heightAt), grid).triangles < plain);
  assert.ok(meshCheck(terrainMesh(quadLeaves(grid, 0.02), grid.heightAt), grid).triangles > plain);
});

test('PNG round trip and ear clipping of a concave footprint', () => {
  const rgba = new Uint8Array(3 * 2 * 4).map((_, k) => (k * 37) & 255);
  const back = decodePNG(encodePNG(rgba, 3, 2));
  assert.deepEqual([...back.rgba], [...rgba]);
  const L = [[0, 0], [4, 0], [4, 1], [1, 1], [1, 3], [0, 3], [0, 0]];
  const tris = triangulate(L), pts = L.slice(0, -1);
  const area = tris.reduce((s, [a, b, c]) => s + signedArea([pts[a], pts[b], pts[c], pts[a]]), 0);
  assert.equal(tris.length, pts.length - 2);
  assert.ok(Math.abs(area - signedArea(L)) < 1e-9);
});
