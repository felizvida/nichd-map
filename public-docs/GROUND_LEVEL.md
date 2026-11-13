# Ground-level movement, fictional roles and brief conversations

The reference modules use caller-supplied geometry and fictional inputs. They include no place-specific network, character roster, factual corpus, operational endpoint, model client or credentials. Tests create a small invented graph and controllable asynchronous replies at runtime.

## Movement and contact

`methods/ground.mjs` separates four decisions:

1. **Where a mode may go.** `RouteGraph` stores directed links with mode labels and nonnegative costs. Add a reverse link explicitly or mark a link bidirectional. A walk-only shortcut must not become a driving route.
2. **Which path to follow.** `shortest` uses Dijkstra search with a linear pending-set scan. It returns null for an unreachable destination. Costs may differ from physical lengths; a zero heuristic avoids assuming that geometric distance is an admissible cost estimate. The small reference favours clarity; use a priority queue for a large graph.
3. **Where the observer sits.** `pose` samples physical distance along the selected links, clamps to the endpoints, and adds a caller-supplied eye height to a caller-supplied surface height. Route costs do not control animation distance. Buildings, bridges and overlapping surfaces need a surface resolver in the consuming application.
4. **How movement meets an obstruction.** `sweepBox` computes continuous contact for a translating axis-aligned box against stationary axis-aligned boxes. Expanding the obstacle by the moving half-extents turns the calculation into two slab intervals. It catches a thin wall crossed within one frame. `slideBox` travels to contact, removes the inward normal component of the remainder, and repeats with a bounded contact count.

```js
import {RouteGraph} from '../methods/ground.mjs';

const graph = new RouteGraph(
  [{id: 'start', x: 0, y: 0}, {id: 'finish', x: 6, y: 2}],
  [{from: 'start', to: 'finish', modes: ['walk'], bidirectional: true}]
);
const route = graph.shortest('start', 'finish', 'walk');
const pose = graph.pose(route, 3, (x, y) => (x + y) / 10, 2);
```

All distances, velocities and accelerations must use consistent units. Link access is not a lane model. Obstacles need positive area; the moving box can be a point. The sweep reference has no rotation, dynamic-body solver, curved footprint or automatic escape from initial overlap. An initial overlap is reported as unresolved. The sliding result is a limited contact projection, not a rigid-body simulation. Its skin is in caller coordinate units and must be suitable for those units. Detected arithmetic overflow fails explicitly; a stopping-distance calculation that underflows gives a conservative zero-speed cap.

`stoppingSpeed` gives a conservative forward cap before a stationary obstruction. For usable gap `g`, reaction interval `t` and positive braking magnitude `a`, it solves `v*t + v*v/(2*a) <= g`, then clamps to the desired speed. A sensor must measure distance along the intended path and subtract suitable clearance. A moving obstacle, turning vehicle, junction priority and discrete control delay need additional handling. The formula alone does not establish collision safety for an entire traffic simulation.

An application can layer Auto, assisted and manual intent on these primitives. Keep mode-specific rules, lane placement, junction choices and vehicle dynamics separate from the observer camera. A temporary user look offset should not change the underlying route heading.

## Fictional roles and stops

`methods/roles.mjs` contains weighted selection, a one-step Markov transition over caller-provided stop IDs, and an explicit brief builder. Randomness is injected so tests can select exact branches. Zero-weight choices are excluded, invalid totals and draws fail, and missing target stops are rejected. A stop with no outgoing choices stays in place.

The consuming simulation owns dwell timers and requests a route between the selected stops. If a route is unavailable, keep the person in a valid state and report that outcome rather than inventing a connection. The module does not choose a frame rate or advance missed dwell intervals.

`roleBrief` copies only the role label, fact strings and current place label and marks the character simulated. It leaves out unrelated metadata keys. This is a field-selection boundary, not an anonymizer: supplied strings still need to be authorized and appropriate. Public examples should use fictional identities, jobs and settings. Keep personal records and local factual corpora out of a methods publication.

## Conversation ownership and order

`methods/conversation.mjs` owns one active conversation for a shared panel. `open` snapshots a brief, replaces the previous owner and resets the view through a callback. `send` queues a turn. The next adapter request starts only after the previous reply completes, with a fresh snapshot of the ordered history.

Closing or replacing the conversation aborts the old adapter and immediately settles its active and queued jobs as discarded. The identity guard also rejects a late result when an adapter ignores abort. A newly opened conversation has its own queue, so it does not wait for the old adapter to finish. A callback that closes the conversation cannot start a subsequent request from that closed owner.

The caller supplies a reply adapter and view callbacks:

```js
import {ConversationPanel} from '../methods/conversation.mjs';
import {roleBrief} from '../methods/roles.mjs';

const log = [];
const panel = new ConversationPanel({
  reply: async request => `I repair imaginary clocks near ${request.brief.place}.`,
  onReset: () => { log.length = 0; },
  onMessage: message => log.push(message)
});
panel.open(roleBrief({label: 'a fictional repairer', facts: ['I repair imaginary clocks.']}, {place: 'the invented workshop'}));
await panel.send('What do you do?');
```

The reply adapter may use local scripted responses or an independently authorized server. No hosted service is required for the reference. If using a model, keep provider credentials on the server, pass only an approved brief, set a request deadline and size limits, and supply the policy to the model. Select an approved lightweight model when it meets the task's accuracy and latency needs. The module itself sends nothing over the network. An adapter that ignores abort and never settles remains the adapter's resource-management responsibility, although the discarded caller promises settle immediately.

The normal reply budget is 25 whitespace-separated words and the expanded budget is 45. Guidance asks for one simple sentence; an occasional interesting supplied fact can justify two short sentences. After an expanded answer, three successful short replies are required before expansion is offered again. An over-budget or empty reply produces an error result; text is not cut mid-sentence. Word counting does not verify factual grounding, sentence structure, interest or tone. The caller must handle `ok`, `error` and `discarded` results explicitly. Failed user turns remain in the conversation history; an error is not fabricated into an assistant answer. Do not let view callbacks throw.

## Integration and review workflow

Use a fixed synthetic scene before attaching any local data. Verify directed/mode-aware routing, endpoint clamping, thin-wall sweeps, sliding, initial overlap, speed caps and weighted transitions. Then test queued sends, stale responses after panel replacement, an adapter ignoring abort, and error recovery. The bundled tests cover these invariants without a service account.

Browser integration needs separate checks. Test pointer hit targets as well as GPU object IDs: a transparent overlay can intercept input even when GPU picking finds the correct person. Give noninteractive HUD layers an explicit pointer-events rule with enough specificity; re-enable interaction on the controls themselves. An invisible fade layer must not intercept scene input.

Measure the actual toolbar, minimap, status, panel and card rectangles at the target viewport. Use the complete current markup, including newly added buttons. Check all controls for reachability and test real taps and swipes in touch emulation. Verify entry/exit, Auto and manual help levels, drag-look, destination setting, person selection, scripted fallback, conversation closure and return to the map. Observe the entry fade finish. Do not infer physical-phone performance from a desktop GPU with a phone-sized viewport.

Freeze the artifact after functional and visual checks. Rebuild, compare hashes, package and review the exact exported tree. Any source change renews those checks. The [release method](RELEASE_METHOD.md) and [publication boundary](PUBLICATION.md) keep runtime delivery and a data-free methods publication as separate, reviewable operations.
