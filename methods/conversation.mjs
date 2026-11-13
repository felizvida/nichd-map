/** Provider-neutral conversation ownership, serialization and cancellation. No network adapter is included. */
export class ConversationPanel {
  constructor({reply, onMessage = () => {}, onReset = () => {}, normalWords = 25, expandedWords = 45, shortTurnGap = 3}) {
    if (typeof reply !== 'function' || !Number.isInteger(normalWords) || normalWords < 1 ||
        !Number.isInteger(expandedWords) || expandedWords < normalWords || !Number.isInteger(shortTurnGap) || shortTurnGap < 1) {
      throw new TypeError('reply adapter and positive word/turn limits required');
    }
    Object.assign(this, {reply, onMessage, onReset, normalWords, expandedWords, shortTurnGap});
    this.current = null; this.sequence = 0;
  }

  open(brief) {
    const snapshot = structuredClone(brief);
    const previous = this.current;
    const session = {id: ++this.sequence, brief: snapshot, history: [], queue: [], active: null,
      controller: null, busy: false, shortTurns: this.shortTurnGap};
    this.current = session;
    this.retire(previous);
    if (this.current === session) this.onReset({id: session.id, brief: structuredClone(snapshot)});
    return session.id;
  }

  close() {
    const session = this.current;
    this.current = null;
    this.retire(session);
  }

  retire(session) {
    if (!session) return;
    session.controller?.abort();
    session.active?.finish({status: 'discarded'});
    for (const job of session.queue.splice(0)) job.finish({status: 'discarded'});
  }

  send(text) {
    const session = this.current;
    if (!session) return Promise.reject(new Error('no active conversation'));
    if (typeof text !== 'string' || !text.trim()) return Promise.reject(new TypeError('nonempty text required'));
    return new Promise(resolve => {
      let settled = false;
      const finish = result => { if (!settled) { settled = true; resolve(result); } };
      session.queue.push({text: text.trim(), finish});
      if (!session.busy) void this.drain(session);
    });
  }

  async drain(session) {
    session.busy = true;
    try {
      while (this.current === session && session.queue.length) {
        const job = session.queue.shift(); session.active = job;
        try {
          const user = {role: 'user', content: job.text};
          session.history.push(user); this.onMessage({...user});
          if (this.current !== session) { job.finish({status: 'discarded'}); break; }
          const allowExpansion = session.shortTurns >= this.shortTurnGap;
          const policy = Object.freeze({normalWords: this.normalWords, maxWords: allowExpansion ? this.expandedWords : this.normalWords,
            allowExpansion, guidance: 'Use one simple sentence. Rarely, an interesting supplied fact may justify two short sentences. Do not invent facts.'});
          session.controller = new AbortController();
          const text = await this.reply({brief: structuredClone(session.brief),
            messages: session.history.map(message => ({...message})), policy}, {signal: session.controller.signal});
          if (this.current !== session) { job.finish({status: 'discarded'}); continue; }
          if (typeof text !== 'string' || !text.trim()) throw new TypeError('nonempty reply required');
          const answer = text.trim(), words = answer.split(/\s+/u).length;
          if (words > policy.maxWords) throw new RangeError('reply exceeds word budget');
          const message = {role: 'assistant', content: answer};
          session.history.push(message);
          session.shortTurns = words > this.normalWords ? 0 : session.shortTurns + 1;
          this.onMessage({...message}); job.finish({status: 'ok', text: answer});
        } catch (error) {
          job.finish(this.current === session ? {status: 'error', error} : {status: 'discarded'});
        } finally {
          session.active = null; session.controller = null;
        }
      }
    } finally { session.busy = false; }
  }
}
