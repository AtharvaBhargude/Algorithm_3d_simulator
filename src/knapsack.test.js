import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateKnapsackSteps } from './knapsack.js';

const supplies = [
  { id: 'grain', name: 'Grains', quantity: 6, priority: 4, divisible: true },
  { id: 'water', name: 'Water', quantity: 5, priority: 3, divisible: true },
  { id: 'medicine', name: 'Medicines', quantity: 3, priority: 5, divisible: true },
  { id: 'clothes', name: 'Clothes', quantity: 4, priority: 2, divisible: true },
];

test('fractional knapsack loads highest-priority supplies first and splits the last item', () => {
  const steps = calculateKnapsackSteps(supplies, 10);
  const result = steps.at(-1);
  assert.equal(result.allocations.grain, 6);
  assert.equal(result.allocations.medicine, 3);
  assert.equal(result.allocations.water, 1);
  assert.equal(result.allocations.clothes, 0);
  assert.equal(result.totalWeight, 10);
  assert.equal(steps.find((step) => step.type === 'decision' && step.itemId === 'water').fraction, 0.2);
});

test('indivisible knapsack finds the optimal feasible subset', () => {
  const indivisibleSupplies = supplies.map((item) => ({ ...item, divisible: false }));
  const steps = calculateKnapsackSteps(indivisibleSupplies, 10);
  const result = steps.at(-1);
  assert.equal(result.allocations.grain, 6);
  assert.equal(result.allocations.medicine, 3);
  assert.equal(result.allocations.water, 0);
  assert.equal(result.allocations.clothes, 0);
  assert.equal(result.totalWeight, 9);
  assert.equal(steps.filter((step) => step.type === 'evaluate').length, 16);
});

test('mixed knapsack chooses the best indivisible subset and fills its remaining space fractionally', () => {
  const mixedSupplies = [
    { id: 'grain', name: 'Grains', quantity: 6, priority: 4, divisible: false },
    { id: 'water', name: 'Water', quantity: 10, priority: 3, divisible: true },
    { id: 'medicine', name: 'Medicines', quantity: 5, priority: 5, divisible: false },
  ];
  const steps = calculateKnapsackSteps(mixedSupplies, 10);
  const result = steps.at(-1);
  assert.equal(result.allocations.grain, 0);
  assert.equal(result.allocations.medicine, 5);
  assert.equal(result.allocations.water, 5);
  assert.equal(result.totalWeight, 10);
  assert.equal(result.totalValue, 40);
  assert.equal(steps.filter((step) => step.type === 'evaluate').length, 4);
  assert.equal(steps.find((step) => step.type === 'decision' && step.itemId === 'water').divisible, true);
});

test('zero capacity and zero-quantity supplies remain valid', () => {
  const steps = calculateKnapsackSteps(supplies.map((item) => ({ ...item, quantity: 0 })), 0);
  assert.equal(steps.at(-1).totalWeight, 0);
  assert.equal(steps.at(-1).totalValue, 0);
});

test('invalid capacity, quantities, and priorities are rejected', () => {
  assert.throws(() => calculateKnapsackSteps(supplies, -1), /capacity/);
  assert.throws(() => calculateKnapsackSteps([{ ...supplies[0], quantity: -1 }], 10), /quantity/);
  assert.throws(() => calculateKnapsackSteps([{ ...supplies[0], priority: 0 }], 10), /priority/);
});
