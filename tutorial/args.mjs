// Tiny option parser shared by the step scripts: --name=value (numbers converted); --heading is in degrees.
export function options(defaults = {}) {
  const o = {...defaults};
  for (const a of process.argv.slice(2)) {
    const m = /^--([a-z-]+)=(.*)$/.exec(a);
    if (!m) throw new Error(`unknown argument ${a} (use --name=value)`);
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()), num = Number(m[2]);
    o[key] = m[2] !== '' && Number.isFinite(num) ? num : m[2];
  }
  if (o.heading !== undefined) o.heading = o.heading * Math.PI / 180;
  return o;
}
