/** A caller supplies fictional roles, permitted facts and transition weights. No cast is bundled. */
export function weightedChoice(items, random) {
  if (!Array.isArray(items) || !items.length || items.some(item => !Number.isFinite(item.weight) || item.weight < 0)) {
    throw new RangeError('nonempty choices with nonnegative finite weights required');
  }
  const total = items.reduce((sum, item) => sum + item.weight, 0), draw = random();
  if (!(total > 0) || !Number.isFinite(total) || !Number.isFinite(draw) || draw < 0 || draw >= 1) {
    throw new RangeError('positive total and random draw in [0, 1) required');
  }
  let threshold = draw * total;
  for (const item of items) { threshold -= item.weight; if (threshold < 0) return item.value; }
  return items.findLast(item => item.weight > 0).value;
}

export function nextStop(transitions, current, random) {
  const choices = transitions.get(current);
  if (!choices) throw new RangeError('unknown stop');
  const next = choices.length ? weightedChoice(choices, random) : current;
  if (!transitions.has(next)) throw new RangeError('unknown target stop');
  return next;
}

export function roleBrief(role, context) {
  if (!role || typeof role.label !== 'string' || !role.label.trim() || !Array.isArray(role.facts) ||
      role.facts.some(fact => typeof fact !== 'string') || typeof context.place !== 'string') {
    throw new TypeError('role label, fact strings and a place label required');
  }
  // Select fields explicitly; unrelated caller metadata does not enter the conversation request.
  return {label: role.label, facts: [...role.facts], place: context.place,
    simulated: true};
}
