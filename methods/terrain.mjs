/** Conforming triangles for a non-overlapping square-leaf terrain partition. */
export function terrainMesh(cells, height) {
  if (!Array.isArray(cells) || typeof height !== 'function') throw new TypeError('cells and height required');
  for (const c of cells) {
    if (![c.x,c.y,c.size].every(Number.isFinite) || c.size<=0) throw new RangeError('invalid cell');
  }
  for (let i=0;i<cells.length;i++) for (let j=0;j<i;j++) {
    const a=cells[i],b=cells[j];
    if (Math.min(a.x+a.size,b.x+b.size)>Math.max(a.x,b.x) &&
        Math.min(a.y+a.size,b.y+b.size)>Math.max(a.y,b.y)) throw new RangeError('overlapping leaves');
  }
  const corners=new Map();
  for (const {x,y,size:s} of cells) for (const p of [[x,y],[x+s,y],[x+s,y+s],[x,y+s]]) corners.set(p.join(','),p);
  const vertices=[],triangles=[],index=new Map();
  function vertex([x,y]) {
    const key=[x,y].join(',');
    if (!index.has(key)) {
      const z=height(x,y);
      if (!Number.isFinite(z)) throw new RangeError('non-finite terrain height');
      index.set(key,vertices.length); vertices.push([x,y,z]);
    }
    return index.get(key);
  }
  for (const {x,y,size:s} of cells) {
    const boundary=[...corners.values()].filter(([u,v]) =>
      u>=x&&u<=x+s&&v>=y&&v<=y+s&&(u===x||u===x+s||v===y||v===y+s));
    // Counter-clockwise perimeter distance retains every fine-neighbour corner.
    function distance([u,v]) {
      if (v===y) return u-x;
      if (u===x+s) return s+v-y;
      if (v===y+s) return 3*s-(u-x);
      return 4*s-(v-y);
    }
    boundary.sort((a,b)=>distance(a)-distance(b));
    const center=vertex([x+s/2,y+s/2]);
    for (let i=0;i<boundary.length;i++) triangles.push([center,vertex(boundary[i]),vertex(boundary[(i+1)%boundary.length])]);
  }
  return {vertices,triangles};
}
