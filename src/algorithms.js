class MinHeap {
  constructor() {
    this.values = [];
  }

  push(value) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.values[parent].distance <= value.distance) break;
      this.values[index] = this.values[parent];
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    if (this.values.length === 0) return undefined;
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length > 0 && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.values.length && this.values[left].distance < this.values[smallest].distance) smallest = left;
        if (right < this.values.length && this.values[right].distance < this.values[smallest].distance) smallest = right;
        if (smallest === index) break;
        [this.values[index], this.values[smallest]] = [this.values[smallest], this.values[index]];
        index = smallest;
      }
      this.values[index] = last;
      let child = index;
      while (child > 0) {
        const parent = Math.floor((child - 1) / 2);
        if (this.values[parent].distance <= this.values[child].distance) break;
        [this.values[parent], this.values[child]] = [this.values[child], this.values[parent]];
        child = parent;
      }
    }
    return first;
  }

  get size() {
    return this.values.length;
  }
}

function validateGraph(graph, startId, destinationId) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error('Provide a graph with node and edge lists.');
  }
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (ids.size !== graph.nodes.length || graph.nodes.some((node) => !node.id)) {
    throw new Error('Every graph node must have a unique ID.');
  }
  if (!ids.has(startId) || !ids.has(destinationId)) {
    throw new Error('Choose an existing start node and destination.');
  }
  const seenEdges = new Set();
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) {
      throw new Error('Every road must connect two different existing nodes.');
    }
    if (!Number.isFinite(edge.weight) || edge.weight < 0) {
      throw new Error('Road weights must be non-negative finite numbers.');
    }
    const key = [edge.from, edge.to].sort().join('\u0000');
    if (seenEdges.has(key)) throw new Error('Duplicate roads are not supported.');
    seenEdges.add(key);
  }
}

export function calculateDijkstraSteps(graph, startId, destinationId) {
  validateGraph(graph, startId, destinationId);
  const distances = Object.fromEntries(graph.nodes.map(({ id }) => [id, Infinity]));
  const previous = Object.fromEntries(graph.nodes.map(({ id }) => [id, null]));
  const visited = new Set();
  const heap = new MinHeap();
  const events = [{
    type: 'initialize',
    nodeId: startId,
    distances: { ...distances, [startId]: 0 },
    previous: { ...previous },
    visited: [],
    message: `Set ${startId}'s distance to 0. Every other node starts at infinity.`,
  }];
  distances[startId] = 0;
  heap.push({ id: startId, distance: 0 });

  while (heap.size > 0) {
    const entry = heap.pop();
    if (!entry || visited.has(entry.id) || entry.distance !== distances[entry.id]) continue;
    const current = entry.id;
    events.push({
      type: 'select',
      nodeId: current,
      distance: distances[current],
      distances: { ...distances },
      previous: { ...previous },
      visited: [...visited],
      message: `${current} is selected because it has the smallest tentative distance (${distances[current]}).`,
    });

    if (current === destinationId) {
      visited.add(current);
      events.push({
        type: 'finalize',
        nodeId: current,
        distances: { ...distances },
        previous: { ...previous },
        visited: [...visited],
        message: `${current} is finalized. Its shortest distance is ${distances[current]}.`,
      });
      break;
    }

    for (const edge of graph.edges) {
      const neighbor = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
      if (neighbor === null || visited.has(neighbor)) continue;
      const candidate = distances[current] + edge.weight;
      const oldDistance = distances[neighbor];
      const improved = candidate < oldDistance;
      events.push({
        type: 'examine',
        nodeId: current,
        neighborId: neighbor,
        edgeId: edge.id,
        edgeWeight: edge.weight,
        currentDistance: distances[current],
        candidate,
        previousDistance: oldDistance,
        improved,
        distances: { ...distances },
        previous: { ...previous },
        visited: [...visited],
        message: `${current} is ${distances[current]} away. Check ${neighbor} via weight ${edge.weight}: ${distances[current]} + ${edge.weight} = ${candidate}.`,
      });
      if (improved) {
        distances[neighbor] = candidate;
        previous[neighbor] = current;
        heap.push({ id: neighbor, distance: candidate });
      }
      events.push({
        type: improved ? 'update' : 'keep',
        nodeId: current,
        neighborId: neighbor,
        edgeId: edge.id,
        edgeWeight: edge.weight,
        currentDistance: distances[current],
        candidate,
        previousDistance: oldDistance,
        improved,
        distances: { ...distances },
        previous: { ...previous },
        visited: [...visited],
        message: improved
          ? `${candidate} is shorter than ${Number.isFinite(oldDistance) ? oldDistance : 'infinity'}; update ${neighbor}'s distance and predecessor to ${current}.`
          : `${Number.isFinite(oldDistance) ? oldDistance : 'infinity'} is already no greater than ${candidate}; keep the existing distance.`,
      });
    }
    visited.add(current);
    events.push({
      type: 'finalize',
      nodeId: current,
      distances: { ...distances },
      previous: { ...previous },
      visited: [...visited],
      message: `${current} is finalized. Its shortest distance is ${distances[current]}.`,
    });
  }

  const reachable = Number.isFinite(distances[destinationId]);
  const path = [];
  if (reachable) {
    let current = destinationId;
    while (current !== null) {
      path.unshift(current);
      if (current === startId) break;
      current = previous[current];
    }
  }
  events.push({
    type: 'complete',
    path: reachable && path[0] === startId ? path : [],
    distance: reachable ? distances[destinationId] : Infinity,
    distances: { ...distances },
    previous: { ...previous },
    visited: [...visited],
    exploredEdges: events.filter((event) => event.type === 'examine').length,
    message: reachable
      ? `Shortest path: ${path.join(' → ')}. Total weight: ${distances[destinationId]}.`
      : 'No valid path exists between the selected nodes.',
  });

  return events;
}

export function dijkstra(graph, startId, destinationId) {
  const steps = calculateDijkstraSteps(graph, startId, destinationId);
  const result = steps.at(-1);
  return {
    path: result.path,
    distance: result.distance,
    visited: result.visited,
    distances: result.distances,
    steps,
    exploredEdges: result.exploredEdges,
  };
}
