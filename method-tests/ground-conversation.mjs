import test from 'node:test';
import assert from 'node:assert/strict';
import {RouteGraph, sweepBox, slideBox, stoppingSpeed} from '../methods/ground.mjs';
import {weightedChoice, nextStop, roleBrief} from '../methods/roles.mjs';
import {ConversationPanel} from '../methods/conversation.mjs';

const graph = () => new RouteGraph(
  [{id: 'a', x: 0, y: 0}, {id: 'b', x: 4, y: 0}, {id: 'c', x: 4, y: 3}, {id: 'd', x: 0, y: 3}],
  [{from: 'a', to: 'b', bidirectional: true}, {from: 'b', to: 'c'},
    {from: 'a', to: 'd', modes: ['walk'], cost: 1}, {from: 'd', to: 'c', modes: ['walk'], cost: 1}]);

test('routing honours directions, access modes and cost rather than geometric distance', () => {
  const g = graph();
  assert.deepEqual(g.shortest('a', 'c', 'walk').nodes, ['a', 'd', 'c']);
  assert.equal(g.shortest('a', 'c', 'walk').cost, 2);
  assert.deepEqual(g.shortest('a', 'c', 'drive').nodes, ['a', 'b', 'c']);
  assert.equal(g.shortest('c', 'a', 'drive'), null);
  assert.deepEqual(g.shortest('a', 'a', 'walk').nodes, ['a']);
  assert.throws(() => g.shortest('missing', 'a', 'walk'), /unknown/);
});

test('route sampling follows caller ground, heading and endpoint clamping', () => {
  const g = graph(), route = g.shortest('a', 'c', 'drive'), floor = (x, y) => x / 2 + y;
  const start = g.pose(route, -10, floor, 2), bend = g.pose(route, 5, floor, 2), end = g.pose(route, 100, floor, 2);
  assert.deepEqual([start.x, start.y, start.z], [0, 0, 2]);
  assert.deepEqual([bend.x, bend.y, bend.z], [4, 1, 5]);
  assert.equal(bend.heading, Math.PI / 2);
  assert.deepEqual([end.x, end.y, end.z], [4, 3, 7]);
  assert.throws(() => g.pose(route, 1, () => NaN, 2), /surface/);
});

test('ambiguous directions, numerical overflow and degenerate obstacles fail explicitly', () => {
  const nodes = [{id: 'a', x: 0, y: 0}, {id: 'b', x: 1, y: 0}];
  assert.throws(() => new RouteGraph(nodes, [{from: 'a', to: 'b', bidirectional: 'false'}]), /boolean/);
  const g = new RouteGraph([...nodes, {id: 'c', x: 2, y: 0}],
    [{from: 'a', to: 'b', cost: 1e308}, {from: 'b', to: 'c', cost: 1e308}]);
  assert.throws(() => g.shortest('a', 'c', 'walk'), /overflow/);
  const body = {x: 0, y: 0, halfWidth: 0, halfHeight: 0};
  assert.throws(() => sweepBox(body, {x: 1, y: 0}, [{x: 1, y: 0, halfWidth: 0, halfHeight: 1}]), /obstacle/);
  assert.throws(() => slideBox({...body, x: 1e308}, {x: 1e308, y: 0}, []), /overflow/);
  assert.equal(stoppingSpeed({distance: Number.MIN_VALUE, buffer: 0, braking: Number.MIN_VALUE, reactionTime: 0, desired: 1}), 0);
});

test('routing rejects broken geometry and negative weights; zero-cost cycles terminate', () => {
  assert.throws(() => new RouteGraph([{id: 'a', x: NaN, y: 0}], []), /node/);
  assert.throws(() => new RouteGraph([{id: 'a', x: 0, y: 0}], [{from: 'a', to: 'b'}]), /endpoint/);
  const nodes = [{id: 'a', x: 0, y: 0}, {id: 'b', x: 1, y: 0}];
  assert.throws(() => new RouteGraph(nodes, [{from: 'a', to: 'b', cost: -1}]), /cost/);
  const g = new RouteGraph(nodes, [{from: 'a', to: 'b', cost: 0, bidirectional: true}]);
  assert.equal(g.shortest('a', 'b', 'walk').cost, 0);
});

test('continuous box contact catches a thin wall without tunnelling', () => {
  const body = {x: 0, y: 0, halfWidth: .5, halfHeight: .5};
  const walls = [{x: 5, y: 0, halfWidth: .1, halfHeight: 2}];
  const hit = sweepBox(body, {x: 100, y: 0}, walls);
  assert.ok(Math.abs(hit.fraction - .044) < 1e-12);
  assert.deepEqual(hit.normal, {x: -1, y: 0});
  assert.equal(sweepBox(body, {x: -100, y: 0}, walls), null);
});

test('sliding preserves tangential motion, permits separation and reports initial overlap', () => {
  const body = {x: 0, y: 0, halfWidth: .5, halfHeight: .5};
  const walls = [{x: 5, y: 0, halfWidth: .5, halfHeight: 20}];
  const result = slideBox(body, {x: 10, y: 4}, walls);
  assert.ok(result.pose.x <= 4 && result.pose.x > 3.99);
  assert.ok(Math.abs(result.pose.y - 4) < 1e-5);
  assert.equal(result.unresolved, false);
  assert.equal(sweepBox({...body, x: 4}, {x: -2, y: 0}, walls), null);
  assert.equal(sweepBox({...body, x: 4}, {x: 0, y: 3}, walls), null);
  assert.equal(slideBox({...body, x: 5}, {x: 1, y: 0}, walls).unresolved, true);
  assert.deepEqual(body, {x: 0, y: 0, halfWidth: .5, halfHeight: .5});
});

test('nearest collision is selected independent of obstacle order', () => {
  const body = {x: 0, y: 0, halfWidth: 0, halfHeight: 0};
  const obstacles = [8, 3].map(x => ({x, y: 0, halfWidth: .5, halfHeight: 1}));
  assert.equal(sweepBox(body, {x: 10, y: 0}, obstacles).index, 1);
  assert.throws(() => sweepBox(body, {x: Infinity, y: 0}, obstacles), /invalid/);
});

test('forward speed cap leaves reaction and braking distance before an obstruction', () => {
  for (let gap = 0; gap < 60; gap += .5) {
    const speed = stoppingSpeed({distance: gap + 2, buffer: 2, braking: 3, reactionTime: .4, desired: 20});
    assert.ok(speed >= 0 && speed <= 20);
    assert.ok(speed * .4 + speed ** 2 / 6 <= gap + 1e-10);
  }
  assert.equal(stoppingSpeed({distance: 1, buffer: 2, braking: 3, reactionTime: 0, desired: 4}), 0);
  assert.throws(() => stoppingSpeed({distance: 2, buffer: 0, braking: 0, reactionTime: 0, desired: 4}), /braking/);
  assert.throws(() => stoppingSpeed({distance: 1e308, buffer: 0, braking: 1e308, reactionTime: 0, desired: 4}), /overflow/);
});

test('role transitions exclude zero weights and use deterministic injected randomness', () => {
  const choices = [{value: 'never', weight: 0}, {value: 'workshop', weight: 1}, {value: 'garden', weight: 3}];
  assert.equal(weightedChoice(choices, () => 0), 'workshop');
  assert.equal(weightedChoice(choices, () => .25), 'garden');
  const transitions = new Map([['workshop', choices.slice(1)], ['garden', []]]);
  assert.equal(nextStop(transitions, 'workshop', () => .9), 'garden');
  assert.equal(nextStop(transitions, 'garden', () => 0), 'garden');
  assert.throws(() => weightedChoice(choices, () => 1), /random/);
  assert.throws(() => weightedChoice([{value: 'x', weight: 0}], () => 0), /total/);
  assert.throws(() => nextStop(new Map([['a', [{value: 'missing', weight: 1}]]]), 'a', () => 0), /target/);
});

test('role briefs select permitted fields and detach the fact array', () => {
  const role = {label: 'a fictional repairer', facts: ['I repair wind-up toys.'], unrelated: 'do not copy'};
  const brief = roleBrief(role, {place: 'the invented workshop', extra: 'do not copy'});
  role.facts.push('Later addition.');
  assert.deepEqual(brief, {label: 'a fictional repairer', facts: ['I repair wind-up toys.'], place: 'the invented workshop', simulated: true});
});

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return {promise, resolve, reject}; };
const flush = () => new Promise(resolve => setImmediate(resolve));

test('queued sends carry complete ordered history and immutable request snapshots', async () => {
  const calls = [], messages = [];
  const panel = new ConversationPanel({reply: (request, options) => { const d = deferred(); calls.push({request, options, ...d}); return d.promise; }, onMessage: m => messages.push(m)});
  const brief = {facts: ['A fictional fact.']}; panel.open(brief); brief.facts.length = 0;
  const first = panel.send('Hello'), second = panel.send('And then?');
  assert.equal(calls.length, 1);
  calls[0].resolve('Hello there.'); await flush();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].request.messages.map(m => m.role), ['user', 'assistant', 'user']);
  assert.deepEqual(calls[1].request.brief.facts, ['A fictional fact.']);
  calls[0].request.messages[0].content = 'Changed by adapter';
  assert.equal(calls[1].request.messages[0].content, 'Hello');
  calls[1].resolve('Then we continue.');
  assert.deepEqual((await Promise.all([first, second])).map(r => r.status), ['ok', 'ok']);
  assert.deepEqual(messages.map(m => m.role), ['user', 'assistant', 'user', 'assistant']);
});

test('closing settles active and queued jobs even if the old adapter ignores abort', async () => {
  const calls = [], shown = [];
  const panel = new ConversationPanel({reply: (request, {signal}) => { const d = deferred(); calls.push({...d, signal}); return d.promise; }, onMessage: m => shown.push(m.content), onReset: () => { shown.length = 0; }});
  panel.open({label: 'first'}); const old = panel.send('old input'), queued = panel.send('never sent');
  panel.open({label: 'second'}); const current = panel.send('new input');
  assert.equal(calls[0].signal.aborted, true);
  assert.deepEqual(await old, {status: 'discarded'}); assert.deepEqual(await queued, {status: 'discarded'});
  calls[0].resolve('Late old reply.'); await flush(); assert.deepEqual(shown, ['new input']);
  calls[1].resolve('Current reply.'); await current;
  assert.deepEqual(shown, ['new input', 'Current reply.']);
});

test('a callback that closes the panel prevents a request from starting', async () => {
  let calls = 0, panel;
  panel = new ConversationPanel({reply: async () => { calls++; return 'Never.'; }, onMessage: () => panel.close()});
  panel.open({}); assert.deepEqual(await panel.send('close now'), {status: 'discarded'}); assert.equal(calls, 0);
});

test('reentrant abort replacement keeps the newest conversation owner', async () => {
  const pending = deferred(); let panel, first = true;
  panel = new ConversationPanel({reply: (request, {signal}) => {
    if (!first) return Promise.resolve('Newest reply.');
    first = false; signal.addEventListener('abort', () => panel.open({label: 'newest'})); return pending.promise;
  }});
  panel.open({label: 'old'}); const old = panel.send('first'); panel.open({label: 'middle'});
  assert.equal(panel.current.brief.label, 'newest'); assert.equal((await old).status, 'discarded');
  assert.equal((await panel.send('last')).status, 'ok'); pending.resolve('Too late.'); await flush();
});

test('word budget allows rare expansion, then requires short replies; rejects excess without truncation', async () => {
  const policies = [], answers = ['one two three four five', 'one two three four five', 'short reply', 'short reply', 'one two three four five'];
  const panel = new ConversationPanel({normalWords: 3, expandedWords: 5, shortTurnGap: 2,
    reply: async request => { policies.push(request.policy); return answers.shift(); }});
  panel.open({});
  assert.equal((await panel.send('a')).status, 'ok');
  assert.equal((await panel.send('b')).status, 'error');
  assert.equal((await panel.send('c')).status, 'ok'); assert.equal((await panel.send('d')).status, 'ok');
  assert.equal((await panel.send('e')).status, 'ok');
  assert.deepEqual(policies.map(p => p.maxWords), [5, 3, 3, 3, 5]);
  assert.equal(panel.current.history.filter(m => m.role === 'assistant').length, 4);
});

test('adapter errors do not strand subsequent sends or a replacement session', async () => {
  let calls = 0;
  const panel = new ConversationPanel({reply: async () => { if (++calls === 1) throw new Error('synthetic failure'); return 'Recovered.'; }});
  panel.open({}); const one = panel.send('one'), two = panel.send('two');
  assert.equal((await one).status, 'error'); assert.equal((await two).status, 'ok');
  panel.close(); await assert.rejects(panel.send('closed'), /active/);
});

test('an adapter cannot enlarge the response budget by mutating its request policy', async () => {
  const panel = new ConversationPanel({normalWords: 1, expandedWords: 2, reply: async request => {
    assert.throws(() => { request.policy.maxWords = 100; }, TypeError);
    return 'one two three';
  }});
  panel.open({}); assert.equal((await panel.send('hello')).status, 'error');
});
