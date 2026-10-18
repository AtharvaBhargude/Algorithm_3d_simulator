const EPSILON = 1e-9;

function validateKnapsack(items, capacity) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Add at least one supply item.');
  }
  if (!Number.isFinite(capacity) || capacity < 0) {
    throw new Error('Container capacity must be a finite, non-negative number.');
  }
  const ids = new Set();
  for (const item of items) {
    if (!item.id || ids.has(item.id)) {
      throw new Error('Every supply item must have a unique ID.');
    }
    ids.add(item.id);
    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      throw new Error(`${item.name} quantity must be a finite, non-negative number.`);
    }
    if (!Number.isFinite(item.priority) || item.priority < 1) {
      throw new Error(`${item.name} priority must be a positive finite number.`);
    }
  }
}

function summarize(items, allocations) {
  const totalWeight = items.reduce((sum, item) => sum + allocations[item.id], 0);
  const totalValue = items.reduce((sum, item) => sum + allocations[item.id] * item.priority, 0);
  return { totalWeight, totalValue };
}

export function calculateKnapsackSteps(items, capacity) {
  validateKnapsack(items, capacity);
  const divisibleItems = items.filter((item) => item.divisible !== false)
    .map((item, index) => ({ ...item, originalIndex: index }))
    .sort((first, second) => second.priority - first.priority || first.originalIndex - second.originalIndex);
  const indivisibleItems = items.filter((item) => item.divisible === false);
  const allocations = Object.fromEntries(items.map((item) => [item.id, 0]));
  const combinations = 2 ** indivisibleItems.length;
  const events = [{
    type: 'initialize',
    allocations: { ...allocations },
    totalWeight: 0,
    totalValue: 0,
    message: `Start with an empty ${capacity} kg container. Compare ${combinations} combination${combinations === 1 ? '' : 's'} of indivisible supplies, then fill remaining capacity with divisible supplies by priority.`,
  }];

  let bestAllocations = { ...allocations };
  let bestWeight = 0;
  let bestValue = 0;
  for (let mask = 0; mask < combinations; mask += 1) {
    const candidateAllocations = Object.fromEntries(items.map((item) => [item.id, 0]));
    const included = [];
    let weight = 0;
    let value = 0;
    indivisibleItems.forEach((item, index) => {
      if ((mask & (1 << index)) === 0) return;
      candidateAllocations[item.id] = item.quantity;
      weight += item.quantity;
      value += item.quantity * item.priority;
      included.push(item.name);
    });
    const feasible = weight <= capacity + EPSILON;
    if (feasible) {
      let remaining = Math.max(0, capacity - weight);
      for (const item of divisibleItems) {
        const amount = Math.min(item.quantity, remaining);
        candidateAllocations[item.id] = amount;
        remaining = Math.max(0, remaining - amount);
        weight += amount;
        value += amount * item.priority;
      }
    }
    const best = feasible && (value > bestValue + EPSILON
      || (Math.abs(value - bestValue) <= EPSILON && weight > bestWeight + EPSILON));
    if (best) {
      bestWeight = weight;
      bestValue = value;
      bestAllocations = { ...candidateAllocations };
    }
    const chosenItems = items.filter((item) => candidateAllocations[item.id] > EPSILON);
    events.push({
      type: 'evaluate',
      combination: mask + 1,
      combinations,
      included: chosenItems.map((item) => item.name),
      weight,
      value,
      feasible,
      best,
      allocations: { ...candidateAllocations },
      totalWeight: feasible ? weight : 0,
      totalValue: feasible ? value : 0,
      message: feasible
        ? `Combination ${mask + 1}/${combinations}: ${included.length ? included.join(', ') : 'no indivisible supplies'} plus the best divisible supplies weighs ${weight} kg and scores ${value}.${best ? ' This is the best feasible load so far.' : ' It does not improve the best load so far.'}`
        : `Combination ${mask + 1}/${combinations}: ${included.join(', ')} already weighs ${weight} kg, above the ${capacity} kg limit.`,
    });
  }

  for (const item of items) {
    const amount = bestAllocations[item.id];
    allocations[item.id] = amount;
    const fraction = item.quantity > 0 ? amount / item.quantity : 0;
    const selected = amount > EPSILON;
    const { totalWeight, totalValue } = summarize(items, allocations);
    events.push({
      type: 'decision',
      itemId: item.id,
      itemName: item.name,
      priority: item.priority,
      available: item.quantity,
      divisible: item.divisible !== false,
      amount,
      fraction,
      selected,
      allocations: { ...allocations },
      totalWeight,
      totalValue,
      message: item.divisible === false
        ? selected
          ? `Load the complete ${item.quantity} kg ${item.name} lot; the best feasible combination includes it.`
          : `Leave the indivisible ${item.quantity} kg ${item.name} lot behind; it is not part of the best feasible load.`
        : selected
          ? amount + EPSILON < item.quantity
            ? `Take ${amount} kg of divisible ${item.name} (${Math.round(fraction * 100)}% of the available supply).`
            : `Take all ${amount} kg of divisible ${item.name}.`
          : `Skip ${item.name}; it is not part of the best feasible load.`,
    });
  }

  const { totalWeight, totalValue } = summarize(items, allocations);
  events.push({
    type: 'complete',
    allocations: { ...allocations },
    totalWeight,
    totalValue,
    capacity,
    message: `Loading complete: ${totalWeight} of ${capacity} kg used, with a priority score of ${totalValue}.`,
  });
  return events;
}
