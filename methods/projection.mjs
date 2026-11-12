/** Orthographic local coordinates; angles in radians, screen v points down. */
export const ISOMETRIC_TILT=Math.atan(1/Math.sqrt(2));
export function camera({heading=0,tilt=ISOMETRIC_TILT,scale=1,origin=[0,0],datum=0}={}) {
  if (![heading,tilt,scale,...origin,datum].every(Number.isFinite)||origin.length!==2||scale<=0||tilt<=0||tilt>=Math.PI/2) throw new RangeError('invalid camera');
  const c=Math.cos(heading),s=Math.sin(heading),st=Math.sin(tilt),ct=Math.cos(tilt);
  return {
    project([x,y,z]) {
      return [origin[0]+scale*(c*x-s*y),origin[1]+scale*(st*(s*x+c*y)-ct*(z-datum))];
    },
    unproject([u,v],z) {
      const a=(u-origin[0])/scale,b=((v-origin[1])/scale+ct*(z-datum))/st;
      return [c*a+s*b,-s*a+c*b,z];
    }
  };
}
