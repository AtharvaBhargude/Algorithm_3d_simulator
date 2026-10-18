import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDijkstraSteps, dijkstra } from './algorithms.js';

const graph = {
  nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
  edges: [
    { id: 'A-B', from: 'A', to: 'B', weight: 4 },
    { id: 'A-C', from: 'A', to: 'C', weight: 2 },
    { id: 'B-C', from: 'B', to: 'C', weight: 1 },
    { id: 'B-D', from: 'B', to: 'D', weight: 5 },
    { id: 'C-D', from: 'C', to: 'D', weight: 8 },
  ],
};

test('Dijkstra finds a shortest route from the entered weighted graph', () => {
  const result = dijkstra(graph, 'A', 'D');
  assert.deepEqual(result.path, ['A', 'C', 'B', 'D']);
  assert.equal(result.distance, 8);
  assert.equal(result.visited.at(-1), 'D');
  assert.ok(result.exploredEdges > 0);
});

test('step events expose real edge relaxations and updated predecessors', () => {
  const steps = calculateDijkstraSteps(graph, 'A', 'D');
  const update = steps.find((step) => step.type === 'update' && step.neighborId === 'C');
  assert.equal(update.candidate, 2);
  assert.equal(update.distances.C, 2);
  assert.equal(update.previous.C, 'A');
  assert.equal(steps.at(-1).type, 'complete');
});

test('the graph is undirected and unreachable destinations produce an empty route', () => {
  const disconnected = { nodes: graph.nodes, edges: graph.edges.filter((edge) => edge.from !== 'D' && edge.to !== 'D') };
  const result = dijkstra(disconnected, 'A', 'D');
  assert.deepEqual(result.path, []);
  assert.equal(result.distance, Infinity);
  assert.match(result.steps.at(-1).message, /No valid path exists/);
});

test('a one-node graph with the same start and destination has a zero-weight path', () => {
  const result = dijkstra({ nodes: [{ id: 'A' }], edges: [] }, 'A', 'A');
  assert.deepEqual(result.path, ['A']);
  assert.equal(result.distance, 0);
  assert.equal(result.exploredEdges, 0);
});

test('equal-weight alternatives produce a valid shortest path', () => {
  const equalRoutes = {
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
    edges: [
      { id: 'A-B', from: 'A', to: 'B', weight: 1 },
      { id: 'B-D', from: 'B', to: 'D', weight: 2 },
      { id: 'A-C', from: 'A', to: 'C', weight: 1 },
      { id: 'C-D', from: 'C', to: 'D', weight: 2 },
    ],
  };
  const result = dijkstra(equalRoutes, 'A', 'D');
  assert.equal(result.distance, 3);
  assert.equal(result.path[0], 'A');
  assert.equal(result.path.at(-1), 'D');
});

test('input validation rejects duplicate roads, invalid weights, and missing nodes', () => {
  assert.throws(() => dijkstra({ nodes: graph.nodes, edges: [...graph.edges, { id: 'B-A', from: 'B', to: 'A', weight: 2 }] }, 'A', 'D'), /Duplicate roads/);
  assert.throws(() => dijkstra({ nodes: graph.nodes, edges: [{ id: 'A-B', from: 'A', to: 'B', weight: -1 }] }, 'A', 'B'), /non-negative/);
  assert.throws(() => dijkstra(graph, 'missing', 'D'), /existing start/);
});
