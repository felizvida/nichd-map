/** Small planar routing and collision references. Coordinates and units come from the caller. */
const finite = values => values.every(Number.isFinite);

export class RouteGraph {
  constructor(nodes, links) {
    this.nodes = new Map();
    this.edges = new Map();
    for (const node of nodes) {
      if (typeof node.id !== 'string' || !node.id || !finite([node.x, node.y]) || this.nodes.has(node.id)) {
        throw new TypeError('unique node ids and finite coordinates required');
      }
      this.nodes.set(node.id, Object.freeze({id: node.id, x: node.x, y: node.y}));
      this.edges.set(node.id, []);
    }
    for (const link of links) {
      if (link.bidirectional !== undefined && typeof link.bidirectional !== 'boolean') throw new TypeError('bidirectional must be boolean');
      const a = this.nodes.get(link.from), b = this.nodes.get(link.to);
      if (!a || !b) throw new RangeError('link endpoint missing');
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const cost = link.cost ?? length;
      const modes = link.modes ?? ['walk', 'drive'];
      if (!(length > 0) || !Number.isFinite(length) || !Number.isFinite(cost) || cost < 0 || !Array.isArray(modes) ||
          !modes.length || modes.some(mode => typeof mode !== 'string' || !mode)) {
        throw new RangeError('positive link length, nonnegative cost and named modes required');
      }
      const edge = Object.freeze({from: a.id, to: b.id, length, cost, modes: Object.freeze([...modes])});
      this.edges.get(a.id).push(edge);
      if (link.bidirectional) this.edges.get(b.id).push(Object.freeze({...edge, from: b.id, to: a.id}));
    }
  }

  shortest(from, to, mode) {
    if (!this.nodes.has(from) || !this.nodes.has(to)) throw new RangeError('unknown node');
    const costs = new Map([[from, 0]]), previous = new Map(), pending = new Set([from]);
    while (pending.size) {
      let at;
      for (const id of pending) if (at === undefined || costs.get(id) < costs.get(at)) at = id;
      pending.delete(at);
      if (at === to) {
        const edges = [];
        for (let id = to; id !== from;) { const edge = previous.get(id); edges.push(edge); id = edge.from; }
        edges.reverse();
        const length = edges.reduce((sum, edge) => sum + edge.length, 0);
        if (!Number.isFinite(length)) throw new RangeError('route length overflow');
        return {nodes: [from, ...edges.map(edge => edge.to)], edges, cost: costs.get(to),
          length};
      }
      for (const edge of this.edges.get(at)) {
        if (!edge.modes.includes(mode)) continue;
        const candidate = costs.get(at) + edge.cost;
        if (!Number.isFinite(candidate)) throw new RangeError('route cost overflow');
        if (candidate < (costs.get(edge.to) ?? Infinity)) {
          costs.set(edge.to, candidate); previous.set(edge.to, edge); pending.add(edge.to);
        }
      }
    }
    return null;
  }

  pose(route, distance, surface, eyeHeight) {
    if (!route || !route.nodes.length || !Number.isFinite(distance) || !Number.isFinite(eyeHeight) || eyeHeight < 0) {
      throw new RangeError('route, finite distance and nonnegative eye height required');
    }
    let remaining = Math.max(0, Math.min(route.length, distance));
    let point = this.nodes.get(route.nodes[0]), heading = 0;
    for (const edge of route.edges) {
      const a = this.nodes.get(edge.from), b = this.nodes.get(edge.to);
      const fraction = Math.min(1, remaining / edge.length);
      point = {x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction};
      heading = Math.atan2(b.y - a.y, b.x - a.x);
      if (remaining <= edge.length) break;
      remaining -= edge.length;
    }
    const floor = surface(point.x, point.y);
    if (!Number.isFinite(floor)) throw new RangeError('finite surface height required');
    return {...point, z: floor + eyeHeight, heading};
  }
}

/** Speed cap for stopping before a stationary obstruction after a fixed reaction interval. */
export function stoppingSpeed({distance, buffer, braking, reactionTime, desired}) {
  if (!finite([distance, buffer, braking, reactionTime, desired]) || buffer < 0 || braking <= 0 || reactionTime < 0 || desired < 0) {
    throw new RangeError('finite distance, positive braking and nonnegative limits required');
  }
  const gap = Math.max(0, distance - buffer);
  if (!gap || !desired) return 0;
  const lag = braking * reactionTime;
  const stopping = 2 * braking * gap;
  if (!Number.isFinite(lag) || !Number.isFinite(stopping)) throw new RangeError('speed calculation overflow');
  if (stopping === 0) return 0; // Underflow produces a conservative stop, never NaN.
  const root = Math.hypot(lag, Math.sqrt(stopping));
  if (!Number.isFinite(root + lag)) throw new RangeError('speed calculation overflow');
  // Equivalent to root - lag, with less cancellation when the remaining gap is small.
  return Math.min(desired, stopping / (root + lag));
}

/** Earliest contact between translating axis-aligned boxes; rotations are outside this reference. */
export function sweepBox(body, delta, obstacles) {
  if (!finite([body.x, body.y, body.halfWidth, body.halfHeight, delta.x, delta.y]) ||
      body.halfWidth < 0 || body.halfHeight < 0) throw new RangeError('invalid body or displacement');
  let first = null;
  for (let index = 0; index < obstacles.length; index++) {
    const box = obstacles[index];
    if (!finite([box.x, box.y, box.halfWidth, box.halfHeight]) || box.halfWidth <= 0 || box.halfHeight <= 0) {
      throw new RangeError('invalid obstacle');
    }
    const low = [box.x - box.halfWidth - body.halfWidth, box.y - box.halfHeight - body.halfHeight];
    const high = [box.x + box.halfWidth + body.halfWidth, box.y + box.halfHeight + body.halfHeight];
    if (!finite([...low, ...high])) throw new RangeError('collision bounds overflow');
    const start = [body.x, body.y], step = [delta.x, delta.y];
    if (start.every((value, axis) => value > low[axis] && value < high[axis])) {
      return {fraction: 0, normal: null, index, startedInside: true};
    }
    let enter = -Infinity, leave = Infinity, normal = null, misses = false;
    for (let axis = 0; axis < 2; axis++) {
      if (step[axis] === 0) {
        // Sliding exactly along a face is permitted.
        if (start[axis] <= low[axis] || start[axis] >= high[axis]) misses = true;
        continue;
      }
      const t0 = (low[axis] - start[axis]) / step[axis], t1 = (high[axis] - start[axis]) / step[axis];
      const near = Math.min(t0, t1), far = Math.max(t0, t1);
      if (near > enter) { enter = near; normal = axis === 0 ? {x: -Math.sign(step[axis]), y: 0} : {x: 0, y: -Math.sign(step[axis])}; }
      leave = Math.min(leave, far);
    }
    if (misses || enter < 0 || enter > 1 || enter >= leave) continue;
    if (!first || enter < first.fraction) first = {fraction: enter, normal, index, startedInside: false};
  }
  return first;
}

export function slideBox(body, delta, obstacles, skin = 1e-6) {
  if (!Number.isFinite(skin) || skin < 0) throw new RangeError('invalid skin');
  let pose = {...body}, rest = {...delta};
  const contacts = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const hit = sweepBox(pose, rest, obstacles);
    if (!hit) {
      pose.x += rest.x; pose.y += rest.y;
      if (!finite([pose.x, pose.y])) throw new RangeError('motion overflow');
      return {pose, contacts, unresolved: false};
    }
    contacts.push(hit);
    if (hit.startedInside) return {pose, contacts, unresolved: true};
    const length = Math.hypot(rest.x, rest.y);
    const travel = Math.max(0, hit.fraction - (length ? skin / length : 0));
    pose.x += rest.x * travel; pose.y += rest.y * travel;
    if (!finite([pose.x, pose.y])) throw new RangeError('motion overflow');
    rest = {x: rest.x * (1 - hit.fraction), y: rest.y * (1 - hit.fraction)};
    const inward = rest.x * hit.normal.x + rest.y * hit.normal.y;
    if (inward < 0) { rest.x -= inward * hit.normal.x; rest.y -= inward * hit.normal.y; }
    if (Math.hypot(rest.x, rest.y) < skin) return {pose, contacts, unresolved: false};
  }
  return {pose, contacts, unresolved: true};
}
