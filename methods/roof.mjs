/** Generic bilinear saddle patch, independent of any real building. */
export function saddleMesh({width,depth,corners,segments=8,heading=0,center=[0,0]}) {
  if (![width,depth,heading,...center,...corners].every(Number.isFinite)||width<=0||depth<=0||center.length!==2||corners.length!==4||!Number.isInteger(segments)||segments<1||segments>512) throw new RangeError('invalid patch');
  const vertices=[],triangles=[],c=Math.cos(heading),s=Math.sin(heading);
  for(let j=0;j<=segments;j++) for(let i=0;i<=segments;i++) {
    const u=i/segments,v=j/segments,x=(u-.5)*width,y=(v-.5)*depth;
    const z=corners[0]*(1-u)*(1-v)+corners[1]*u*(1-v)+corners[2]*u*v+corners[3]*(1-u)*v;
    vertices.push([center[0]+c*x-s*y,center[1]+s*x+c*y,z]);
  }
  for(let j=0;j<segments;j++) for(let i=0;i<segments;i++) {
    const a=j*(segments+1)+i,b=a+1,d=a+segments+1,e=d+1;
    triangles.push([a,b,e],[a,e,d]);
  }
  return {vertices,triangles};
}
