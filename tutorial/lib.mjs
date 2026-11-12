// Tutorial helpers: load the sample, build a terrain mesh and building blocks, render a small isometric preview.
// Plain Node.js (22+), no dependencies. The two published methods do the core work: terrainMesh (conforming terrain
// triangles) and camera (orthographic projection). Everything else here is deliberately simple and readable.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {terrainMesh} from '../methods/terrain.mjs';
import {camera, ISOMETRIC_TILT} from '../methods/projection.mjs';

export const SAMPLE_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../sample');

// ------------------------------------------------------------------ 1. load and convert to local metres
export function loadSample(dir = SAMPLE_DIR, {terrainFile} = {}) {
  const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
  const terrain = read(terrainFile || path.join(dir, 'terrain.json'));
  if (terrain.format !== 'sample-terrain/1') throw new Error('unknown terrain format');
  return {features: read(path.join(dir, 'features.geojson')), structures: read(path.join(dir, 'structures.geojson')), terrain};
}

/** The sample's local frame: metres east (x) and north (y) of an origin, from WGS84 lon/lat (see terrain.json frame). */
export function localFrame(terrain) {
  const {origin_lon: lon0, origin_lat: lat0} = terrain.frame;
  const a = 6378137, e2 = 0.00669437999014, phi = lat0 * Math.PI / 180, s2 = Math.sin(phi) ** 2;
  const kx = a * Math.cos(phi) / Math.sqrt(1 - e2 * s2) * Math.PI / 180;
  const ky = a * (1 - e2) / (1 - e2 * s2) ** 1.5 * Math.PI / 180;
  return {kx, ky, toLocal: ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky]};
}

/** The terrain nodes as a height function: z(i, j) at nodes, heightAt(x, y) bilinear anywhere inside the grid. */
export function terrainGrid(t) {
  const {x0, y0, nx, ny, cell_m: cell, z_base_m: base} = t;
  const z = (i, j) => base + t.z[j][i] / 100;
  function heightAt(x, y) {
    const fi = (x - x0) / cell, fj = (y - y0) / cell;
    if (fi < -1e-9 || fj < -1e-9 || fi > nx - 1 + 1e-9 || fj > ny - 1 + 1e-9) throw new RangeError(`outside the terrain: ${x}, ${y}`);
    const i = Math.min(nx - 2, Math.max(0, Math.floor(fi))), j = Math.min(ny - 2, Math.max(0, Math.floor(fj)));
    const u = fi - i, v = fj - j;
    return (z(i, j) * (1 - u) + z(i + 1, j) * u) * (1 - v) + (z(i, j + 1) * (1 - u) + z(i + 1, j + 1) * u) * v;
  }
  let min = Infinity, max = -Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { min = Math.min(min, z(i, j)); max = Math.max(max, z(i, j)); }
  return {x0, y0, nx, ny, cell, z, heightAt, min, max, x1: x0 + (nx - 1) * cell, y1: y0 + (ny - 1) * cell};
}

/** GeoJSON features -> {kind, props, rings | line} in local metres. */
export function localFeatures(fc, frame) {
  return fc.features.map((f) => {
    const g = f.geometry, out = {kind: f.properties.kind, props: f.properties};
    if (g.type === 'Polygon') out.ring = g.coordinates[0].map(frame.toLocal);
    else if (g.type === 'LineString') out.line = g.coordinates.map(frame.toLocal);
    else throw new Error('unexpected geometry ' + g.type);
    return out;
  });
}

// ------------------------------------------------------------------ 2. adaptive terrain mesh
/**
 * Square leaves on the node lattice: a leaf is split while bilinear interpolation of its four corners misses any node
 * inside it by more than `tolerance` metres (or while it hangs over the grid edge). Leaves of different sizes meet;
 * terrainMesh then inserts the small neighbours' corners on the big leaf's edges, so the triangles share vertices and no
 * crack can open. Returns [{x, y, size}] in metres.
 */
export function quadLeaves(grid, tolerance = 0.25, maxCells = 16) {
  const cx = grid.nx - 1, cy = grid.ny - 1, leaves = [];
  let root = 1;
  while (root < Math.max(cx, cy)) root *= 2;
  function error(i, j, s) {
    const c = [grid.z(i, j), grid.z(i + s, j), grid.z(i, j + s), grid.z(i + s, j + s)];
    let worst = 0;
    for (let b = 0; b <= s; b++) for (let a = 0; a <= s; a++) {
      const u = a / s, v = b / s;
      const est = (c[0] * (1 - u) + c[1] * u) * (1 - v) + (c[2] * (1 - u) + c[3] * u) * v;
      worst = Math.max(worst, Math.abs(est - grid.z(i + a, j + b)));
    }
    return worst;
  }
  (function split(i, j, s) {
    if (i >= cx || j >= cy) return;                                  // entirely outside the grid
    const over = i + s > cx || j + s > cy;
    if (s > 1 && (over || s > maxCells || error(i, j, s) > tolerance)) {
      const h = s / 2;
      split(i, j, h); split(i + h, j, h); split(i, j + h, h); split(i + h, j + h, h);
    } else if (!over) {
      leaves.push({x: grid.x0 + i * grid.cell, y: grid.y0 + j * grid.cell, size: s * grid.cell});
    }
  })(0, 0, root);
  return leaves;
}

/** Every interior edge must be shared by exactly two triangles; an edge used once inside the domain is a crack. */
export function meshCheck(mesh, grid) {
  const edges = new Map();
  for (const [a, b, c] of mesh.triangles) for (const [p, q] of [[a, b], [b, c], [c, a]]) {
    const key = p < q ? p + ',' + q : q + ',' + p;
    edges.set(key, (edges.get(key) || 0) + 1);
  }
  let boundary = 0, interior = 0, cracks = 0;
  const onEdge = ([x, y]) => x === grid.x0 || x === grid.x1 || y === grid.y0 || y === grid.y1;
  for (const [key, n] of edges) {
    const [p, q] = key.split(',').map((k) => mesh.vertices[+k]);
    const outer = onEdge(p) && onEdge(q) && (p[0] === q[0] || p[1] === q[1]);
    if (outer) boundary += n === 1 ? 1 : 0;
    else if (n === 2) interior++;
    else cracks++;
  }
  return {vertices: mesh.vertices.length, triangles: mesh.triangles.length, interiorEdges: interior, boundaryEdges: boundary, cracks};
}

export function buildTerrain(grid, tolerance) {
  const leaves = quadLeaves(grid, tolerance);
  const mesh = terrainMesh(leaves, grid.heightAt);
  return {leaves, mesh, check: meshCheck(mesh, grid)};
}

// ------------------------------------------------------------------ 3. buildings
export function signedArea(ring) {
  let s = 0;
  for (let k = 0; k < ring.length - 1; k++) s += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1];
  return s / 2;
}

export function pointInRing([x, y], ring) {
  let inside = false;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [xa, ya] = ring[a], [xb, yb] = ring[b];
    if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside;
  }
  return inside;
}

function bbox(ring) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Share of ring A's area that lies inside ring B, by sampling A on a `step` metre lattice. */
export function overlapShare(a, b, step = 0.5) {
  const [x0, y0, x1, y1] = bbox(a);
  let n = 0, hit = 0;
  for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) {
    if (!pointInRing([x, y], a)) continue;
    n++;
    if (pointInRing([x, y], b)) hit++;
  }
  return n ? hit / n : 0;
}

function percentile(values, p) {
  const v = [...values].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.max(0, Math.round(p / 100 * (v.length - 1))))];
}

/**
 * Turn OSM footprints into blocks. Height: the matching USA Structures footprint (>= 50 % overlap) when it has one,
 * else building:levels x storey metres, else a default. The roof sits `height` above the pad (90th percentile of the
 * ground along the walls, so a block on a slope is not buried uphill); the walls reach down to the lowest ground.
 * Also reports structures that match no OSM building: a footprint dataset can contain things that are not buildings.
 */
export function makeBuildings(features, structures, grid, {heights = 'structures', storey = 3.0, fallback = 6.0} = {}) {
  const blocks = [];
  for (const f of features.filter((f) => f.kind === 'building')) {
    let ring = f.ring;
    if (signedArea(ring) < 0) ring = [...ring].reverse();             // counter-clockwise
    const match = structures.map((s) => ({s, share: overlapShare(ring, s.ring)})).sort((a, b) => b.share - a.share)[0];
    let height, source;
    if (heights === 'structures' && match && match.share >= 0.5 && Number.isFinite(match.s.props.height_m)) {
      height = match.s.props.height_m; source = 'USA Structures';
    } else if (f.props.levels) {
      height = f.props.levels * storey; source = `levels x ${storey} m`;
    } else {
      height = fallback; source = 'default';
    }
    const wall = [];
    for (let k = 0; k < ring.length - 1; k++) {
      const [ax, ay] = ring[k], [bx, by] = ring[k + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let t = 0; t < n; t++) wall.push(grid.heightAt(ax + (bx - ax) * t / n, ay + (by - ay) * t / n));
    }
    const pad = percentile(wall, 90), base = Math.min(...wall);
    blocks.push({osm: f.props.osm, ring, height: +height.toFixed(2), heightSource: source, matchShare: +(match ? match.share : 0).toFixed(2),
                 base: +base.toFixed(2), pad: +pad.toFixed(2), top: +(pad + height).toFixed(2),
                 area: +Math.abs(signedArea(ring)).toFixed(1)});
  }
  const unmatched = structures.filter((s) => !features.some((f) => f.kind === 'building' && overlapShare(s.ring, f.ring) >= 0.3))
    .map((s) => ({...s.props, area: +Math.abs(signedArea(s.ring)).toFixed(1),
                  centre: bbox(s.ring).reduce((acc, v, k) => (acc[k % 2] += v / 2, acc), [0, 0]).map((v) => +v.toFixed(1)),
                  coveredBy: features.filter((f) => f.ring && f.kind !== 'building' && overlapShare(s.ring, f.ring) >= 0.5).map((f) => f.props.sport || f.kind)}));
  return {blocks, unmatched};
}

/** Ear clipping for a simple counter-clockwise ring (closed: first point repeated last). Returns index triples. */
export function triangulate(ring) {
  const pts = ring.slice(0, -1), idx = pts.map((_, k) => k), tris = [];
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 10000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (cross(a, b, c) <= 0) continue;                                // reflex corner
      if (idx.some((m) => m !== ia && m !== ib && m !== ic && cross(a, b, pts[m]) >= 0 && cross(b, c, pts[m]) >= 0 && cross(c, a, pts[m]) >= 0)) continue;
      tris.push([ia, ib, ic]); idx.splice(k, 1); cut = true; break;
    }
    if (!cut) throw new Error('triangulation failed (self-intersecting footprint?)');
  }
  tris.push(idx);
  return tris;
}

/** Block -> triangles [[p, q, r], ...] in world coordinates (walls from base to top, flat roof). */
export function blockTriangles(b) {
  const tris = [], ring = b.ring;
  for (let k = 0; k < ring.length - 1; k++) {
    const [ax, ay] = ring[k], [bx, by] = ring[k + 1];
    tris.push({part: 'wall', p: [[ax, ay, b.base], [bx, by, b.base], [bx, by, b.top]]});
    tris.push({part: 'wall', p: [[ax, ay, b.base], [bx, by, b.top], [ax, ay, b.top]]});
  }
  const pts = ring.slice(0, -1);
  for (const [i, j, k] of triangulate(ring)) tris.push({part: 'roof', p: [[...pts[i], b.top], [...pts[j], b.top], [...pts[k], b.top]]});
  return tris;
}

// ------------------------------------------------------------------ 4. render
export const PALETTE = {
  lawn: [146, 166, 104], park: [98, 150, 80], playground: [212, 188, 140], basketball: [196, 128, 88], tennis: [86, 136, 112],
  pitch: [120, 150, 100], road: [94, 96, 102], service: [126, 126, 130], cycleway: [168, 158, 146], path: [214, 205, 188],
  footway: [214, 205, 188], sidewalk: [206, 202, 196], crossing: [232, 232, 228], wall: [214, 196, 176], roof: [168, 166, 162],
  sky: [240, 241, 236],
};
const HALF_WIDTH = {road: 4.0, service: 2.5, cycleway: 1.5, path: 1.2, footway: 1.2, sidewalk: 1.0, crossing: 1.5};

/** Surface class raster in world space (resolution `res` m): roads and paths by distance, areas by polygon. */
export function surfaceRaster(features, grid, res = 0.25) {
  const w = Math.ceil((grid.x1 - grid.x0) / res) + 1, h = Math.ceil((grid.y1 - grid.y0) / res) + 1;
  const cls = new Array(w * h).fill('lawn');
  const areas = features.filter((f) => f.ring && f.kind !== 'building');
  const order = ['park', 'playground', 'pitch'];
  areas.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = [grid.x0 + i * res, grid.y0 + j * res];
    for (const f of areas) if (pointInRing(p, f.ring)) cls[j * w + i] = f.kind === 'pitch' ? (f.props.sport in PALETTE ? f.props.sport : 'pitch') : f.kind;
  }
  const lines = features.filter((f) => f.line).sort((a, b) => HALF_WIDTH[b.kind] - HALF_WIDTH[a.kind]);   // narrow paths on top
  for (const f of lines) {
    const hw = HALF_WIDTH[f.kind] || 1;
    for (let k = 0; k < f.line.length - 1; k++) {
      const [ax, ay] = f.line[k], [bx, by] = f.line[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - hw - grid.x0) / res)), i1 = Math.min(w - 1, Math.ceil((Math.max(ax, bx) + hw - grid.x0) / res));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - hw - grid.y0) / res)), j1 = Math.min(h - 1, Math.ceil((Math.max(ay, by) + hw - grid.y0) / res));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = grid.x0 + i * res, y = grid.y0 + j * res, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
        if (Math.hypot(x - ax - t * dx, y - ay - t * dy) <= hw) cls[j * w + i] = f.kind;
      }
    }
  }
  return {at: (x, y) => cls[Math.round((y - grid.y0) / res) * w + Math.round((x - grid.x0) / res)] || 'lawn', w, h, res};
}

function normal([a, b, c]) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const l = Math.hypot(...n) || 1;
  return n.map((x) => x / l);
}

/**
 * Z-buffered orthographic render with the published camera. Pixels remember the world point they show, so ground colour
 * comes from the surface raster at that exact point (crisp paths on a coarse mesh). `ss` = supersampling factor.
 */
export function render({grid, terrain, features, blocks, heading = Math.PI / 4, width = 720, height = 540, ss = 2,
                        exaggeration = 1, light = null}) {
  const W = width * ss, H = height * ss, datum = grid.min;
  const lift = (p) => [p[0], p[1], datum + (p[2] - datum) * exaggeration];
  const tris = terrain.mesh.triangles.map(([a, b, c]) => ({part: 'ground', p: [a, b, c].map((k) => lift(terrain.mesh.vertices[k]))}));
  for (const b of blocks) for (const t of blockTriangles({...b, base: datum + (b.base - datum) * exaggeration - 0.5,
                                                         top: datum + (b.pad - datum) * exaggeration + b.height})) tris.push(t);
  // fit: project everything at scale 1, then scale and centre with a margin
  const probe = camera({heading, tilt: ISOMETRIC_TILT, scale: 1, datum});
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const t of tris) for (const p of t.p) { const [u, v] = probe.project(p); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  const scale = 0.92 * Math.min(W / (u1 - u0), H / (v1 - v0));
  const cam = camera({heading, tilt: ISOMETRIC_TILT, scale, datum,
                      origin: [W / 2 - scale * (u0 + u1) / 2, H / 2 - scale * (v0 + v1) / 2]});
  // depth towards the viewer: the third axis of the camera basis
  const c = Math.cos(heading), s = Math.sin(heading), st = Math.sin(ISOMETRIC_TILT), ct = Math.cos(ISOMETRIC_TILT);
  const depth = ([x, y, z]) => ct * (s * x + c * y) + st * (z - datum);
  const zbuf = new Float64Array(W * H).fill(-Infinity), owner = new Int32Array(W * H).fill(-1);
  const wx = new Float64Array(W * H), wy = new Float64Array(W * H);
  tris.forEach((t, id) => {
    const q = t.p.map((p) => cam.project(p)), d = t.p.map(depth);
    const area = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
    if (Math.abs(area) < 1e-9) return;
    const xmin = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), xmax = Math.min(W - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
    const ymin = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), ymax = Math.min(H - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
    for (let y = ymin; y <= ymax; y++) for (let x = xmin; x <= xmax; x++) {
      const px = x + 0.5, py = y + 0.5;
      const l1 = ((q[1][0] - px) * (q[2][1] - py) - (q[1][1] - py) * (q[2][0] - px)) / area;
      const l2 = ((q[2][0] - px) * (q[0][1] - py) - (q[2][1] - py) * (q[0][0] - px)) / area;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
      const dz = l1 * d[0] + l2 * d[1] + l3 * d[2], k = y * W + x;
      if (dz <= zbuf[k]) continue;
      zbuf[k] = dz; owner[k] = id;
      wx[k] = l1 * t.p[0][0] + l2 * t.p[1][0] + l3 * t.p[2][0];
      wy[k] = l1 * t.p[0][1] + l2 * t.p[1][1] + l3 * t.p[2][1];
    }
  });
  const surface = surfaceRaster(features, grid);
  // default light: from the viewer's right, 40 degrees above the horizon, so the two visible wall directions differ
  const az = heading - Math.PI / 3, el = 40 * Math.PI / 180;
  const lv = light || [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
  const L = Math.hypot(...lv), Ld = lv.map((v) => v / L);
  const shade = tris.map((t) => { const n = normal(t.p); return 0.55 + 0.5 * Math.max(0, n[0] * Ld[0] + n[1] * Ld[1] + n[2] * Ld[2]); });
  const big = new Uint8Array(W * H * 3);
  for (let k = 0; k < W * H; k++) {
    const id = owner[k];
    let col = PALETTE.sky, f = 1;
    if (id >= 0) {
      const t = tris[id];
      col = t.part === 'ground' ? PALETTE[surface.at(wx[k], wy[k])] : PALETTE[t.part];
      f = shade[id];
    }
    big[k * 3] = Math.min(255, Math.round(col[0] * f)); big[k * 3 + 1] = Math.min(255, Math.round(col[1] * f)); big[k * 3 + 2] = Math.min(255, Math.round(col[2] * f));
  }
  // box-filter the supersampled image down to the output size
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const acc = [0, 0, 0];
    for (let b = 0; b < ss; b++) for (let a = 0; a < ss; a++) { const k = ((y * ss + b) * W + x * ss + a) * 3; acc[0] += big[k]; acc[1] += big[k + 1]; acc[2] += big[k + 2]; }
    const o = (y * width + x) * 4;
    rgba[o] = Math.round(acc[0] / ss / ss); rgba[o + 1] = Math.round(acc[1] / ss / ss); rgba[o + 2] = Math.round(acc[2] / ss / ss); rgba[o + 3] = 255;
  }
  const visible = new Set(owner);
  return {rgba, width, height, camera: cam, ss, scale: scale / ss, triangles: tris.length,
          drawnTriangles: visible.size - (visible.has(-1) ? 1 : 0)};
}

// ------------------------------------------------------------------ PNG (no metadata chunks)
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** 8-bit RGBA PNG with only IHDR, IDAT and IEND (no text, time or colour-profile chunks). */
export function encodePNG(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
                        chunk('IDAT', zlib.deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]);
}

/** Decoder for 8-bit RGBA, non-interlaced PNGs (all five row filters). Returns {width, height, rgba, chunks}. */
export function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let o = 8, width, height, idat = [];
  const chunks = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('latin1', o + 4, o + 8), data = buf.subarray(o + 8, o + 8 + len);
    chunks.push(type);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('only 8-bit RGBA non-interlaced PNG');
    } else if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpr = width * 4, out = new Uint8Array(bpr * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (bpr + 1)], row = raw.subarray(y * (bpr + 1) + 1, (y + 1) * (bpr + 1));
    for (let x = 0; x < bpr; x++) {
      const a = x >= 4 ? out[y * bpr + x - 4] : 0, b = y ? out[(y - 1) * bpr + x] : 0, c = x >= 4 && y ? out[(y - 1) * bpr + x - 4] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      out[y * bpr + x] = (row[x] + pred) & 255;
    }
  }
  return {width, height, rgba: out, chunks};
}

/** Mean absolute difference per channel (0-255) and the share of pixels differing by more than `tol` in any channel. */
export function imageDiff(a, b, tol = 24) {
  if (a.width !== b.width || a.height !== b.height) return {mean: Infinity, share: 1};
  let sum = 0, bad = 0;
  for (let k = 0; k < a.rgba.length; k += 4) {
    let worst = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(a.rgba[k + c] - b.rgba[k + c]); sum += d; worst = Math.max(worst, d); }
    if (worst > tol) bad++;
  }
  const n = a.rgba.length / 4;
  return {mean: sum / n / 3, share: bad / n};
}

// ------------------------------------------------------------------ the whole pipeline
export function pipeline({dir = SAMPLE_DIR, terrainFile, tolerance = 0.25, heights = 'structures', heading = Math.PI / 4,
                          exaggeration = 1, width = 720, height = 540} = {}) {
  const sample = loadSample(dir, {terrainFile});
  const frame = localFrame(sample.terrain);
  const grid = terrainGrid(sample.terrain);
  const features = localFeatures(sample.features, frame);
  const structures = localFeatures(sample.structures, frame);
  const terrain = buildTerrain(grid, tolerance);
  const {blocks, unmatched} = makeBuildings(features, structures, grid, {heights});
  const image = render({grid, terrain, features, blocks, heading, exaggeration, width, height});
  return {sample, frame, grid, features, structures, terrain, blocks, unmatched, image};
}

/** The documented numbers of a pipeline run (what tutorial/expected.json records and the tests compare). */
export function summarize(r) {
  const kinds = {};
  for (const f of r.features) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
  const round = (x) => Math.round(x * 100) / 100;
  return {
    features: kinds, structures: r.structures.length,
    terrain: {nx: r.grid.nx, ny: r.grid.ny, cell_m: r.grid.cell, min_m: round(r.grid.min), max_m: round(r.grid.max)},
    mesh: {leaves: r.terrain.leaves.length, vertices: r.terrain.check.vertices, triangles: r.terrain.check.triangles,
           cracks: r.terrain.check.cracks},
    buildings: r.blocks.map((b) => ({osm: b.osm, height_m: b.height, source: b.heightSource, pad_m: round(b.pad), roof_m: round(b.top)})),
    unmatched_structures: r.unmatched.map((u) => ({area_m2: u.area, inside: u.coveredBy, height_m: u.height_m})),
    image: {width: r.image.width, height: r.image.height},
  };
}
