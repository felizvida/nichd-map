import test from 'node:test';
import assert from 'node:assert/strict';
import {terrainMesh} from '../methods/terrain.mjs';
import {camera,ISOMETRIC_TILT} from '../methods/projection.mjs';
import {saddleMesh} from '../methods/roof.mjs';
import {ConfirmedMotion} from '../methods/motion.mjs';

test('adaptive leaves have positive area and paired interior edges',()=>{
  const cells=[{x:0,y:0,size:2},{x:2,y:0,size:1},{x:2,y:1,size:1}];
  const {vertices:v,triangles}=terrainMesh(cells,(x,y)=>Math.sin(x)+y/3);
  const edges=new Map(); let area=0;
  for(const [i,j,k] of triangles) {
    const [a,b,c]=[v[i],v[j],v[k]];
    const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    assert.ok(cross>0); area+=cross/2;
    for(const [p,q] of [[i,j],[j,k],[k,i]]) {
      const key=[p,q].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||0)+1);
    }
  }
  assert.equal(area,6);
  for(const [key,count] of edges) {
    const [a,b]=key.split(',').map(i=>v[+i]);
    const boundary=(a[0]===b[0]&&(a[0]===0||a[0]===3)) || (a[1]===b[1]&&(a[1]===0||a[1]===2));
    assert.equal(count,boundary?1:2,`edge ${key}`);
  }
  assert.throws(()=>terrainMesh([...cells,{x:1,y:1,size:1}],()=>0),/overlapping/);
  assert.throws(()=>terrainMesh(cells,()=>NaN),/height/);
});

test('orthographic round trip and equal isometric axis foreshortening',()=>{
  // Equal axes require a 45-degree heading as well as the isometric tilt.
  const c=camera({heading:Math.PI/4,tilt:ISOMETRIC_TILT,scale:2.3,origin:[19,-7],datum:4});
  const p0=c.project([0,0,0]);
  const ls=[[1,0,0],[0,1,0],[0,0,1]].map(p=>c.project(p)).map(p=>Math.hypot(p[0]-p0[0],p[1]-p0[1]));
  assert.ok(Math.max(...ls)-Math.min(...ls)<1e-12);
  for(let i=0;i<40;i++) {
    const p=[i/3-6,Math.sin(i)*4,i%7];const q=c.unproject(c.project(p),p[2]);
    p.forEach((x,j)=>assert.ok(Math.abs(x-q[j])<1e-12));
  }
  assert.throws(()=>camera({tilt:0}),/camera/);
});

test('saddle interpolation preserves all corners and has no inverted faces',()=>{
  const {vertices:v,triangles:t}=saddleMesh({width:12,depth:8,corners:[2,5,1,4],segments:4});
  assert.deepEqual([v[0][2],v[4][2],v[24][2],v[20][2]],[2,5,1,4]);
  assert.equal(v[12][2],3);assert.equal(t.length,32);
  for(const [i,j,k] of t) {
    const [a,b,c]=[v[i],v[j],v[k]];
    assert.ok((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0);
  }
});

test('motion ignores duplicates and old fixes, never extrapolates, hides stale fixes',()=>{
  const m=new ConfirmedMotion();
  assert.equal(m.accept({id:'demo',x:0,y:0,time:100},0,100),true);
  m.accept({id:'demo',x:8,y:0,time:104},1000,104);
  assert.equal(m.sample('demo',2000,105).x,4);
  assert.equal(m.accept({id:'demo',x:99,y:0,time:104},2000,105),false);
  assert.equal(m.accept({id:'demo',x:99,y:0,time:103},2000,105),false);
  assert.equal(m.sample('demo',5000,108).x,8);
  assert.equal(m.sample('demo',6000,130),null);
  assert.equal(m.accept({id:'demo',x:9,y:0,time:132},6000,130),false);
  assert.throws(()=>m.sample('demo',5000,130),/monotonic/);
});

test('motion snaps implausible jumps, honours reduced motion and prunes',()=>{
  for(const reduced of [true,false]) {
    const m=new ConfirmedMotion({reduced});m.accept({id:'demo',x:0,y:0,time:200},0,200);
    m.accept({id:'demo',x:200,y:0,time:201},1000,201);
    assert.equal(m.sample('demo',1000,201).x,200);m.prune([]);
    assert.equal(m.sample('demo',1000,201),null);
  }
});
