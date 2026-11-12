/** Interpolate confirmed fixes only. Feed adapters and credentials are external. */
export class ConfirmedMotion {
  constructor({maxAge=20,maxGap=20,maxSpeed=18,durationMs=2000,reduced=false}={}) {
    if (![maxAge,maxGap,maxSpeed,durationMs].every(v=>Number.isFinite(v)&&v>0)) throw new RangeError('invalid limits');
    Object.assign(this,{maxAge,maxGap,maxSpeed,durationMs,reduced}); this.states=new Map(); this.clock=-Infinity;
  }
  checkClock(now) {
    if (!Number.isFinite(now)||now<this.clock) throw new RangeError('monotonic milliseconds required');
    this.clock=now;
  }
  sample(id,now,wallSeconds) {
    this.checkClock(now);
    if (!Number.isFinite(wallSeconds)) throw new RangeError('wall seconds required');
    const s=this.states.get(id);
    if (!s||wallSeconds-s.fix.time>this.maxAge||wallSeconds<s.fix.time) return null;
    const t=Math.min(1,Math.max(0,(now-s.at)/s.duration));
    return {x:s.from.x+(s.fix.x-s.from.x)*t,y:s.from.y+(s.fix.y-s.from.y)*t,
      gliding:t<1&&(s.from.x!==s.fix.x||s.from.y!==s.fix.y)};
  }
  accept(fix,now,wallSeconds) {
    this.checkClock(now);
    if (!fix||typeof fix.id!=='string'||!fix.id||![fix.x,fix.y,fix.time,wallSeconds].every(Number.isFinite)) throw new TypeError('invalid fix');
    if (wallSeconds-fix.time>this.maxAge||fix.time>wallSeconds) return false;
    const old=this.states.get(fix.id);
    // Equal timestamps cannot alter coordinates or restart animation.
    if (old&&fix.time<=old.fix.time) return false;
    const dt=old?fix.time-old.fix.time:0,pose=this.sample(fix.id,now,wallSeconds);
    const snap=!pose||this.reduced||dt>this.maxGap||Math.hypot(fix.x-old.fix.x,fix.y-old.fix.y)/dt>this.maxSpeed;
    this.states.set(fix.id,{fix:{...fix},from:snap?{x:fix.x,y:fix.y}:pose,at:now,duration:snap?1:this.durationMs});
    return true;
  }
  prune(ids) { const keep=new Set(ids); for(const id of this.states.keys()) if(!keep.has(id)) this.states.delete(id); }
}
