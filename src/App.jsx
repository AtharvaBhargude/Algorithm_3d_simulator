import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Clone, Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Crosshair,
  Edit3, Eraser, Flag, GitBranch, Home, Map, Minus, MousePointer2, Pause,
  PanelRightClose, PanelRightOpen, Play, Plus, RotateCcw, Route, SkipForward,
  Sparkles, Trash2, Truck, Weight, X, Zap,
} from 'lucide-react';
import { calculateDijkstraSteps } from './algorithms.js';
import { DEFAULT_KNAPSACK_CONFIG, KnapsackSetup, KnapsackSimulation } from './Knapsack.jsx';

const tools = [
  { id: 'select', label: 'Move / select', icon: MousePointer2 },
  { id: 'add', label: 'Add node', icon: Plus },
  { id: 'connect', label: 'Connect nodes', icon: GitBranch },
  { id: 'delete', label: 'Delete', icon: Eraser },
];
const positionsFor = (graph) => Object.fromEntries(graph.nodes.map((node) => [node.id, node]));
const pairKey = (a, b) => [a, b].sort().join('-');
const nodeName = (index) => index < 26 ? String.fromCharCode(65 + index) : `N${index + 1}`;
const BUILDING_MODELS = [
  '/models/apartment-block-01.glb',
  '/models/corner-store-01.glb',
  '/models/farm-stand.glb',
  '/models/porch-house-front-01.glb',
];
const DESTINATION_MODELS = [
  '/models/ruined-house-shell.glb',
  '/models/refuge-hut.glb',
];
const VEHICLE_MODEL = '/models/family-sedan.glb';
const modelMetricsCache = new WeakMap();
const nextNodeName = (nodes) => {
  const existing = new Set(nodes.map((node) => node.id));
  for (let index = 0; ; index += 1) {
    const candidate = nodeName(index);
    if (!existing.has(candidate)) return candidate;
  }
};
const infinityLabel = (distance) => Number.isFinite(distance) ? distance : '∞';

function findCanvasPosition(event, element) {
  const bounds = element.getBoundingClientRect();
  return {
    x: Math.max(26, Math.min(874, ((event.clientX - bounds.left) / bounds.width) * 900)),
    y: Math.max(26, Math.min(564, ((event.clientY - bounds.top) / bounds.height) * 590)),
  };
}

function GraphEditor({ graph, setGraph, startId, setStartId, destinationId, setDestinationId, onGenerate, error, setError }) {
  const [tool, setTool] = useState('select');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [connectFirst, setConnectFirst] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [newWeight, setNewWeight] = useState('4');
  const [weightDraft, setWeightDraft] = useState('');
  const [weightError, setWeightError] = useState('');
  const canvasRef = useRef(null);
  const positions = positionsFor(graph);
  const activeEdge = graph.edges.find((edge) => edge.id === selectedEdge);

  useEffect(() => {
    setWeightDraft(activeEdge ? String(activeEdge.weight) : '');
    setWeightError('');
  }, [activeEdge?.id]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.key === 'Delete' || event.key === 'Backspace') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        if (selectedNode) removeNode(selectedNode);
        else if (selectedEdge) removeEdge(selectedEdge);
      }
      if (event.key === 'Escape') setConnectFirst(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function updateGraph(updater) {
    setGraph((current) => updater(current));
    setError('');
    setWeightError('');
  }

  function removeNode(id) {
    updateGraph((current) => ({
      nodes: current.nodes.filter((node) => node.id !== id),
      edges: current.edges.filter((edge) => edge.from !== id && edge.to !== id),
    }));
    setSelectedNode(null);
    setSelectedEdge(null);
    if (startId === id) setStartId(null);
    if (destinationId === id) setDestinationId(null);
  }

  function removeEdge(id) {
    updateGraph((current) => ({ ...current, edges: current.edges.filter((edge) => edge.id !== id) }));
    setSelectedEdge(null);
    setWeightDraft('');
  }

  function selectEdge(edge) {
    setSelectedEdge(edge.id);
    setSelectedNode(null);
    setWeightDraft(String(edge.weight));
    setWeightError('');
    setTool('select');
  }

  function addNodeAt(event) {
    if (tool !== 'add' || !canvasRef.current) return;
    const point = findCanvasPosition(event, canvasRef.current);
    const id = nextNodeName(graph.nodes);
    updateGraph((current) => ({ ...current, nodes: [...current.nodes, { id, ...point }] }));
    setSelectedNode(id);
  }

  function onNodePointerDown(event, id) {
    event.preventDefault();
    event.stopPropagation();
    if (tool === 'add') return;
    if (tool === 'delete') {
      removeNode(id);
      return;
    }
    if (tool === 'connect') {
      if (!connectFirst) {
        setConnectFirst(id);
        setSelectedNode(id);
        setSelectedEdge(null);
        return;
      }
      if (connectFirst === id) {
        setConnectFirst(null);
        return;
      }
      const duplicate = graph.edges.find((edge) => pairKey(edge.from, edge.to) === pairKey(connectFirst, id));
      if (duplicate) {
        setError(`A road already connects ${connectFirst} and ${id}. Select the existing road to edit its weight.`);
        setConnectFirst(null);
        selectEdge(duplicate);
        return;
      }
      const weight = Number(newWeight);
      if (!Number.isFinite(weight) || weight < 0) {
        setWeightError('Enter a non-negative number.');
        return;
      }
      const edge = { id: pairKey(connectFirst, id), from: connectFirst, to: id, weight };
      updateGraph((current) => ({ ...current, edges: [...current.edges, edge] }));
      setSelectedEdge(edge.id);
      setWeightDraft(String(edge.weight));
      setSelectedNode(null);
      setConnectFirst(null);
      return;
    }
    setSelectedEdge(null);
    setSelectedNode(id);
    setDragging(id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onCanvasPointerMove(event) {
    if (!dragging || !canvasRef.current) return;
    const point = findCanvasPosition(event, canvasRef.current);
    setGraph((current) => ({
      ...current,
      nodes: current.nodes.map((node) => node.id === dragging ? { ...node, ...point } : node),
    }));
  }

  function onCanvasPointerUp() {
    setDragging(null);
  }

  function onCanvasClick(event) {
    if (tool === 'add') addNodeAt(event);
    else if (tool === 'select' && event.target === canvasRef.current) {
      setSelectedNode(null);
      setSelectedEdge(null);
    }
  }

  function resetGraph() {
    setGraph({ nodes: [], edges: [] });
    setStartId(null);
    setDestinationId(null);
    setSelectedNode(null);
    setSelectedEdge(null);
    setConnectFirst(null);
    setError('');
  }

  function editWeight(value) {
    setWeightDraft(value);
    if (!activeEdge) return;
    if (value.trim() === '' || value === '.' || value === '-') {
      setWeightError('');
      return;
    }
    const weight = Number(value);
    if (!Number.isFinite(weight) || weight < 0) {
      setWeightError('Weight must be a non-negative number.');
      return;
    }
    setWeightError('');
    setGraph((current) => ({
      ...current,
      edges: current.edges.map((edge) => edge.id === activeEdge.id ? { ...edge, weight } : edge),
    }));
    setError('');
  }

  function commitWeight() {
    if (!activeEdge) return;
    const weight = Number(weightDraft);
    if (weightDraft.trim() === '' || !Number.isFinite(weight) || weight < 0) {
      setWeightError('Enter a non-negative number.');
      setWeightDraft(String(activeEdge.weight));
      return;
    }
    setGraph((current) => ({
      ...current,
      edges: current.edges.map((edge) => edge.id === activeEdge.id ? { ...edge, weight } : edge),
    }));
    setWeightDraft(String(weight));
    setWeightError('');
  }

  return (
    <div className="editor-screen">
      <header className="sub-header">
        <button className="back-button" onClick={() => window.dispatchEvent(new Event('relief-home'))} aria-label="Return home"><ArrowLeft size={16} /></button>
        <span className="mini-brand-mark"><Truck size={20} /></span>
        <div className="sub-brand"><strong>Disaster Relief Logistics</strong><small>Interactive Algorithm Visualization</small></div>
        <span className="sub-header-tag"><Map size={13} /> DIJKSTRA SIMULATION</span>
      </header>

      <div className="editor-heading">
        <div><span className="overline">YOUR ROAD NETWORK</span><h1>Build a weighted graph</h1><p>Add locations, connect them with roads, then find the safest shortest route.</p></div>
        <div className="graph-counts"><span><i className="count-node" />{graph.nodes.length} nodes</span><span><i className="count-edge" />{graph.edges.length} roads</span></div>
      </div>

      <div className="editor-layout">
        <section className="graph-workspace">
          <div className="canvas-toolbar">
            <div className="tool-group">{tools.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`tool-button ${tool === id ? 'selected' : ''}`} title={label} onClick={() => { setTool(id); setConnectFirst(null); }}>
                <Icon size={15} /><span>{label}</span>
              </button>
            ))}</div>
            <div className="canvas-toolbar-end"><span className="canvas-hint">{tool === 'add' ? 'Click canvas to add a location' : tool === 'connect' ? connectFirst ? `Now select the other end of ${connectFirst}` : 'Select two locations to connect' : tool === 'delete' ? 'Select a location or road to remove' : 'Drag locations to rearrange'}</span>
              <button className="reset-graph" onClick={resetGraph}><RotateCcw size={13} /> Reset</button>
            </div>
          </div>

          <div
            ref={canvasRef}
            className={`graph-canvas tool-${tool}`}
            onClick={onCanvasClick}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerLeave={onCanvasPointerUp}
            aria-label="Blank graph editing canvas"
          >
            <svg className="graph-edges" viewBox="0 0 900 590" preserveAspectRatio="none" role="presentation">
              {graph.edges.map((edge) => {
                const first = positions[edge.from];
                const second = positions[edge.to];
                if (!first || !second) return null;
                const midX = (first.x + second.x) / 2;
                const midY = (first.y + second.y) / 2;
                return (
                  <g key={edge.id}>
                    <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} className={`edge-visible ${selectedEdge === edge.id ? 'edge-selected' : ''}`} />
                    <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} className="edge-hit" onClick={(event) => { event.stopPropagation(); if (tool === 'delete') removeEdge(edge.id); else selectEdge(edge); }} />
                    <g className="weight-label" transform={`translate(${midX},${midY})`} onClick={(event) => { event.stopPropagation(); if (tool === 'delete') removeEdge(edge.id); else selectEdge(edge); }}>
                      <rect x="-16" y="-12" width="32" height="24" rx="8" />
                      <text textAnchor="middle" dominantBaseline="central">{edge.weight}</text>
                    </g>
                  </g>
                );
              })}
            </svg>
            {graph.nodes.map((node) => (
              <button
                key={node.id}
                className={`graph-node ${node.id === startId ? 'is-start' : ''} ${node.id === destinationId ? 'is-destination' : ''} ${node.id === selectedNode ? 'is-selected' : ''} ${node.id === connectFirst ? 'is-connecting' : ''}`}
                style={{ left: `${node.x / 9}%`, top: `${node.y / 5.9}%` }}
                onPointerDown={(event) => onNodePointerDown(event, node.id)}
                onClick={(event) => event.stopPropagation()}
                aria-label={`Node ${node.id}${node.id === startId ? ', start' : ''}${node.id === destinationId ? ', destination' : ''}`}
              >
                <span className="node-letter">{node.id}</span>
                <span className="node-role">{node.id === startId ? 'RELIEF CENTER' : node.id === destinationId ? 'AFFECTED VILLAGE' : ''}</span>
              </button>
            ))}
            {graph.nodes.length === 0 && (
              <div className="canvas-empty"><span><Plus size={19} /></span><strong>Your graph canvas is ready</strong><small>Choose “Add node”, then click anywhere on this white canvas.</small></div>
            )}
          </div>
          <div className="canvas-legend"><span><i className="legend-start" /> Relief center</span><span><i className="legend-destination" /> Affected village</span><span><i className="legend-road-sample" /> Road weight</span><span><i className="legend-hint" /> Undirected connection</span></div>
          {error && <div className="editor-error"><CircleHelp size={14} />{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={13} /></button></div>}
          <div className="editor-bottom">
            <div className="editor-tip"><Sparkles size={14} /><span>Add locations and roads. <strong>A single location can be both start and destination.</strong></span></div>
            <button className="generate-button" onClick={onGenerate}><span><Play size={14} fill="currentColor" /></span> Generate 3D Simulation <ArrowRight size={15} /></button>
          </div>
        </section>

        <aside className="editor-sidebar">
          <section className="side-card">
            <div className="side-card-heading"><span className="side-icon"><Crosshair size={15} /></span><div><strong>Mission locations</strong><small>Choose start and destination</small></div></div>
            <div className="location-selects">
              <label><span className="location-dot start-dot" />Relief center<select value={startId || ''} onChange={(event) => setStartId(event.target.value || null)}><option value="">Select start node</option>{graph.nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}</select></label>
              <label><span className="location-dot destination-dot" />Affected village<select value={destinationId || ''} onChange={(event) => setDestinationId(event.target.value || null)}><option value="">Select destination</option>{graph.nodes.map((node) => <option key={node.id} value={node.id}>{node.id}</option>)}</select></label>
            </div>
            <div className="side-separator" />
            <div className="assign-title">OR SELECT A NODE ON THE CANVAS</div>
            <div className="assign-buttons"><button onClick={() => selectedNode && setStartId(selectedNode)} disabled={!selectedNode}><Crosshair size={12} />Set start</button><button onClick={() => selectedNode && setDestinationId(selectedNode)} disabled={!selectedNode}><Flag size={12} />Set destination</button></div>
            {selectedNode && <div className="selected-notice">Selected location <strong>{selectedNode}</strong></div>}
          </section>

          <section className="side-card road-card">
            <div className="side-card-heading"><span className="side-icon weight-icon"><Weight size={15} /></span><div><strong>Road segments</strong><small>Set travel cost per connection</small></div></div>
            {activeEdge ? (
              <div className="selected-road">
                <div className="road-name"><span>{activeEdge.from}</span><ArrowRight size={13} /><span>{activeEdge.to}</span><small>undirected road</small></div>
                <label>Travel weight<input aria-label="Selected road weight" type="text" inputMode="decimal" min="0" value={weightDraft} onChange={(event) => editWeight(event.target.value)} onBlur={commitWeight} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} aria-invalid={Boolean(weightError)} /></label>
                {weightError && <small className="validation-error">{weightError}</small>}
                <button className="remove-road" onClick={() => removeEdge(activeEdge.id)}><Trash2 size={12} />Remove road</button>
              </div>
            ) : (
              <div className="no-selection"><span><Edit3 size={14} /></span>Click a road or weight on the canvas to edit it.</div>
            )}
            <div className="new-road-weight"><label htmlFor="new-road-weight">Weight for new roads</label><input id="new-road-weight" type="number" min="0" step="0.1" value={newWeight} onChange={(event) => { setNewWeight(event.target.value); setWeightError(''); }} /><span>units</span></div>
          </section>

          <section className="side-card graph-summary">
            <div className="side-card-heading"><span className="side-icon"><GitBranch size={15} /></span><div><strong>Graph summary</strong><small>Live network overview</small></div></div>
            <div className="summary-line"><span>Locations</span><strong>{graph.nodes.length}</strong></div>
            <div className="summary-line"><span>Roads</span><strong>{graph.edges.length}</strong></div>
            <div className="summary-line"><span>Start → destination</span><strong>{startId || '—'} → {destinationId || '—'}</strong></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function graphPosition(node, nodes) {
  const xs = nodes.map((item) => item.x);
  const ys = nodes.map((item) => item.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  return [
    ((node.x - minX) / spanX - 0.5) * 14,
    ((node.y - minY) / spanY - 0.5) * -9,
  ];
}

function modelForNode(node, isStart, isDestination) {
  if (isStart) return BUILDING_MODELS[1];
  let seed = 0;
  for (const character of node.id) seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  if (isDestination) return DESTINATION_MODELS[seed % DESTINATION_MODELS.length];
  return BUILDING_MODELS[seed % BUILDING_MODELS.length];
}

function getModelMetrics(scene) {
  const cached = modelMetricsCache.get(scene);
  if (cached) return cached;
  const bounds = new Box3().setFromObject(scene);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const metrics = {
    center: [center.x, bounds.min.y, center.z],
    width: Math.max(size.x, size.z, 0.001),
    height: Math.max(size.y, 0.001),
  };
  modelMetricsCache.set(scene, metrics);
  return metrics;
}

const FittedModel = React.memo(function FittedModel({ url, maxFootprint, maxHeight, rotation = 0 }) {
  const { scene } = useGLTF(url);
  const metrics = getModelMetrics(scene);
  const scale = Math.min(maxFootprint / metrics.width, maxHeight / metrics.height);

  return (
    <group scale={scale} rotation={[0, rotation, 0]}>
      <Clone object={scene} position={[-metrics.center[0], -metrics.center[1], -metrics.center[2]]} />
    </group>
  );
});

const CityBuilding = React.memo(function CityBuilding({ node, position, status }) {
  const start = status === 'start';
  const destination = status === 'destination';
  const current = status === 'current';
  const finalized = status === 'finalized';
  const modelUrl = modelForNode(node, start, destination);
  const { scene } = useGLTF(modelUrl);
  const metrics = getModelMetrics(scene);
  const modelHeight = metrics.height * Math.min(1.8 / metrics.width, 2.25 / metrics.height);
  const platformColor = start ? '#3988d6' : destination ? '#dc9847' : current ? '#3988d6' : finalized ? '#40a676' : '#89989c';
  const seed = [...node.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.92, 6]} />
        <meshStandardMaterial color={platformColor} roughness={0.85} />
      </mesh>
      {(finalized || status === 'current') && !start && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
          <ringGeometry args={[0.79, 0.86, 6]} />
          <meshBasicMaterial color={current ? '#318bda' : '#38a975'} />
        </mesh>
      )}
      <group position={[0, 0.08, 0]}>
        <FittedModel url={modelUrl} maxFootprint={1.72} maxHeight={2.25} rotation={(seed % 4) * Math.PI / 2} />
      </group>
      <Html position={[0, Math.max(1.3, modelHeight + 0.35), 0]} center distanceFactor={14} zIndexRange={[2, 1]}>
        <span className={`city-node-label ${start ? 'label-start' : destination ? 'label-destination' : finalized ? 'label-finalized' : ''}`}>
          {start ? 'RELIEF CENTER' : destination ? 'AFFECTED VILLAGE' : `LOCATION ${node.id}`}
          <b>{node.id}</b>
        </span>
      </Html>
      {current && <pointLight position={[0, 0.7, 0]} intensity={1.2} color="#358de6" distance={3} />}
    </group>
  );
});

function ReliefTruck({ path, nodes, positions, edges }) {
  const truck = useRef();
  const segmentRef = useRef(0);
  const elapsed = useRef(0);
  const previousPath = useRef(path);
  const waypoints = useMemo(() => {
    const clearance = 1.05;
    const pointToward = (nodeId, towardId) => {
      const origin = positions[nodeId];
      const target = positions[towardId];
      const dx = target[0] - origin[0];
      const dz = target[1] - origin[1];
      const length = Math.hypot(dx, dz) || 1;
      return [origin[0] + (dx / length) * clearance, origin[1] + (dz / length) * clearance];
    };
    if (path.length === 1) {
      const firstRoad = edges.find((edge) => edge.from === path[0] || edge.to === path[0]);
      if (!firstRoad) return path.map((nodeId) => positions[nodeId]).filter(Boolean);
      const nextNode = firstRoad.from === path[0] ? firstRoad.to : firstRoad.from;
      return [pointToward(path[0], nextNode)];
    }
    if (path.length === 0) return [];
    const points = [pointToward(path[0], path[1])];
    for (let index = 1; index < path.length - 1; index += 1) {
      const node = positions[path[index]];
      const previous = positions[path[index - 1]];
      const next = positions[path[index + 1]];
      const startAngle = Math.atan2(previous[1] - node[1], previous[0] - node[0]);
      const endAngle = Math.atan2(next[1] - node[1], next[0] - node[0]);
      let angleDelta = ((endAngle - startAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      for (let step = 1; step <= 6; step += 1) {
        const angle = startAngle + (angleDelta * step) / 6;
        points.push([node[0] + Math.cos(angle) * clearance, node[1] + Math.sin(angle) * clearance]);
      }
    }
    points.push(pointToward(path[path.length - 1], path[path.length - 2]));
    return points;
  }, [path, positions, edges]);
  const { scene } = useGLTF(VEHICLE_MODEL);
  const vehicleMetrics = getModelMetrics(scene);
  const vehicle = {
    center: vehicleMetrics.center,
    scale: Math.min(1.55 / vehicleMetrics.width, 0.85 / vehicleMetrics.height),
    height: vehicleMetrics.height * Math.min(1.55 / vehicleMetrics.width, 0.85 / vehicleMetrics.height),
  };
  useEffect(() => {
    const extendsPath = previousPath.current.every((nodeId, index) => path[index] === nodeId);
    if (!extendsPath) {
      segmentRef.current = 0;
      elapsed.current = 0;
    }
    previousPath.current = path;
  }, [path]);
  const invalidate = useThree((state) => state.invalidate);
  useFrame((_, delta) => {
    if (!truck.current || waypoints.length === 0) return;
    if (waypoints.length > 1 && segmentRef.current < waypoints.length - 1) {
      elapsed.current += delta * 0.38;
      if (elapsed.current >= 1) {
        elapsed.current = 0;
        segmentRef.current = Math.min(segmentRef.current + 1, waypoints.length - 1);
      }
      invalidate();
    }
    const index = Math.min(segmentRef.current, waypoints.length - 1);
    const from = waypoints[index];
    const to = waypoints[Math.min(index + 1, waypoints.length - 1)];
    if (!from || !to) return;
    const progress = index === waypoints.length - 1 ? 0 : elapsed.current;
    truck.current.position.set(
      from[0] + (to[0] - from[0]) * progress,
      0.32,
      from[1] + (to[1] - from[1]) * progress,
    );
    truck.current.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1]);
  });
  if (!path.length || !nodes.length || !waypoints.length) return null;
  return (
    <group ref={truck} position={[waypoints[0][0], 0.12, waypoints[0][1]]}>
      <group scale={vehicle.scale}>
        <Clone object={scene} position={[-vehicle.center[0], -vehicle.center[1], -vehicle.center[2]]} />
      </group>
      <mesh position={[0, vehicle.height + 0.09, 0]}>
        <cylinderGeometry args={[0.075, 0.075, 0.11, 8]} />
        <meshStandardMaterial color="#287fd0" emissive="#2d8fe8" emissiveIntensity={0.6} />
      </mesh>
      <pointLight position={[0, vehicle.height + 0.18, 0]} intensity={0.4} color="#53aaff" distance={2.4} />
    </group>
  );
}

function SyncCanvasSize() {
  const { camera, gl, setSize, invalidate } = useThree();
  useEffect(() => {
    const container = gl.domElement.parentElement;
    if (!container) return undefined;

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      setSize(width, height);
      if (camera.isPerspectiveCamera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
      invalidate();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [camera, gl, invalidate, setSize]);
  return null;
}

function CityScene({ graph, startId, destinationId, state, finalPath, truckPath, shadowMapSize }) {
  const positions = useMemo(() => Object.fromEntries(graph.nodes.map((node) => [node.id, graphPosition(node, graph.nodes)])), [graph]);
  const current = state?.nodeId || null;
  const evaluatingEdge = state?.edgeId || null;
  const finalized = new Set(state?.visited || []);
  const routeEdges = new Set(finalPath.slice(1).map((id, index) => pairKey(finalPath[index], id)));
  const completedEdgeSet = new Set(truckPath.slice(1).map((id, index) => pairKey(truckPath[index], id)));
  return (
    <>
      <color attach="background" args={['#e7eef3']} />
      <fog attach="fog" args={['#e7eef3', 20, 42]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[-7, 12, 7]} intensity={2.6} castShadow shadow-mapSize-width={shadowMapSize} shadow-mapSize-height={shadowMapSize} />
      <pointLight position={[4, 7, -5]} color="#acd9f7" intensity={1} distance={28} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[30, 24]} />
        <meshStandardMaterial color="#bbcbb9" roughness={0.94} />
      </mesh>
      <gridHelper args={[24, 24, '#c2d0d1', '#d2dcda']} position={[0, -0.1, 0]} />
      {graph.edges.map((edge) => {
        const from = positions[edge.from];
        const to = positions[edge.to];
        if (!from || !to) return null;
        const dx = to[0] - from[0];
        const dz = to[1] - from[1];
        const length = Math.hypot(dx, dz);
        const directionX = length > 0 ? dx / length : 0;
        const directionZ = length > 0 ? dz / length : 0;
        const roadInset = Math.min(1.05, length / 2);
        const startPoint = [from[0] + directionX * roadInset, 0.09, from[1] + directionZ * roadInset];
        const endPoint = [to[0] - directionX * roadInset, 0.09, to[1] - directionZ * roadInset];
        const isRoute = routeEdges.has(pairKey(edge.from, edge.to)) && state?.type === 'complete';
        const travelled = completedEdgeSet.has(pairKey(edge.from, edge.to));
        const evaluating = edge.id === evaluatingEdge;
        const color = isRoute || travelled ? '#3ab27a' : evaluating ? '#e5b64e' : '#82939a';
        const roadLength = Math.max(0.05, length - roadInset * 2);
        const center = [(startPoint[0] + endPoint[0]) / 2, 0.07, (startPoint[2] + endPoint[2]) / 2];
        const angle = Math.atan2(-dz, dx);
        return (
          <group key={edge.id}>
            <mesh position={center} rotation={[0, angle, 0]} receiveShadow>
              <boxGeometry args={[roadLength, 0.11, 0.57]} />
              <meshStandardMaterial color={color} roughness={0.8} emissive={evaluating ? '#c59b35' : isRoute || travelled ? '#1e704b' : '#000000'} emissiveIntensity={evaluating || isRoute || travelled ? 0.12 : 0} />
            </mesh>
            <Line points={[startPoint, endPoint]} color={color} lineWidth={isRoute || travelled ? 3 : evaluating ? 2.4 : 1.3} transparent opacity={evaluating || isRoute || travelled ? 0.95 : 0.4} />
            <Html position={[center[0], 0.72, center[2]]} center distanceFactor={13} zIndexRange={[2, 1]}>
              <span className={`city-weight ${evaluating ? 'weight-evaluating' : ''}`}>{edge.weight}</span>
            </Html>
          </group>
        );
      })}
      {graph.nodes.map((node) => (
        <CityBuilding
          key={node.id}
          node={node}
          position={positions[node.id]}
          status={node.id === startId ? 'start' : node.id === destinationId ? 'destination' : node.id === current ? 'current' : finalized.has(node.id) ? 'finalized' : 'pending'}
        />
      ))}
      <ReliefTruck path={truckPath} nodes={graph.nodes} positions={positions} edges={graph.edges} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={8} maxDistance={30} maxPolarAngle={1.42} target={[0, 0, 0]} />
    </>
  );
}

function CityView(props) {
  const renderProfile = useMemo(() => {
    const compactScreen = window.matchMedia('(max-width: 700px)').matches;
    const limitedMemory = Number(navigator.deviceMemory || 0) > 0 && Number(navigator.deviceMemory) <= 4;
    const limitedCores = Number(navigator.hardwareConcurrency || 0) > 0 && Number(navigator.hardwareConcurrency) <= 4;
    const lowPower = limitedMemory || limitedCores;
    return {
      dpr: lowPower ? [0.75, 1] : compactScreen ? [1, 1.2] : [1, 1.4],
      antialias: !lowPower,
      shadowMapSize: lowPower ? 512 : 1024,
      powerPreference: lowPower ? 'low-power' : 'high-performance',
    };
  }, []);
  return (
    <Canvas frameloop="demand" camera={{ position: [12, 12, 14], fov: 43, near: 0.1, far: 80 }} shadows dpr={renderProfile.dpr} gl={{ antialias: renderProfile.antialias, powerPreference: renderProfile.powerPreference }}>
      <SyncCanvasSize />
      <Suspense fallback={null}><CityScene {...props} shadowMapSize={renderProfile.shadowMapSize} /></Suspense>
    </Canvas>
  );
}

function Graph2DView({ graph, startId, destinationId, state, finalPath, truckPath, mapInfoVisible, zoom, onZoomChange }) {
  const scrollRef = useRef(null);
  const zoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const current = state?.nodeId || null;
  const visited = new Set(state?.visited || []);
  const routeEdges = new Set(finalPath.slice(1).map((id, index) => pairKey(finalPath[index], id)));
  const travelledEdges = new Set(truckPath.slice(1).map((id, index) => pairKey(truckPath[index], id)));
  const currentPosition = positionsFor(graph)[truckPath.at(-1)] || graph.nodes[0];

  useEffect(() => {
    zoomRef.current = zoom;
    onZoomChangeRef.current = onZoomChange;
  }, [zoom, onZoomChange]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return undefined;
    let previousTouchDistance = null;

    const zoomAt = (nextZoom, clientX, clientY) => {
      const currentZoom = zoomRef.current;
      const boundedZoom = Math.max(0.5, Math.min(2.5, nextZoom));
      if (boundedZoom === currentZoom) return;

      const bounds = viewport.getBoundingClientRect();
      const anchorX = clientX - bounds.left;
      const anchorY = clientY - bounds.top;
      const scale = boundedZoom / currentZoom;
      const scrollLeft = (viewport.scrollLeft + anchorX) * scale - anchorX;
      const scrollTop = (viewport.scrollTop + anchorY) * scale - anchorY;
      zoomRef.current = boundedZoom;
      onZoomChangeRef.current(boundedZoom);
      requestAnimationFrame(() => {
        viewport.scrollLeft = scrollLeft;
        viewport.scrollTop = scrollTop;
      });
    };

    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomAt(zoomRef.current * Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
    };
    const touchDistance = (touches) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const onTouchStart = (event) => {
      previousTouchDistance = event.touches.length === 2 ? touchDistance(event.touches) : null;
    };
    const onTouchMove = (event) => {
      if (event.touches.length !== 2) {
        previousTouchDistance = null;
        return;
      }
      event.preventDefault();
      const nextDistance = touchDistance(event.touches);
      if (previousTouchDistance) {
        const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
        const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
        zoomAt(zoomRef.current * (nextDistance / previousTouchDistance), centerX, centerY);
      }
      previousTouchDistance = nextDistance;
    };
    const clearTouchDistance = () => { previousTouchDistance = null; };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('touchstart', onTouchStart, { passive: true });
    viewport.addEventListener('touchmove', onTouchMove, { passive: false });
    viewport.addEventListener('touchend', clearTouchDistance, { passive: true });
    viewport.addEventListener('touchcancel', clearTouchDistance, { passive: true });
    return () => {
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('touchstart', onTouchStart);
      viewport.removeEventListener('touchmove', onTouchMove);
      viewport.removeEventListener('touchend', clearTouchDistance);
      viewport.removeEventListener('touchcancel', clearTouchDistance);
    };
  }, []);

  return (
    <div className="graph-2d-view">
      <div ref={scrollRef} className="graph-2d-scroll" aria-label="Scrollable graph canvas">
        <div className="graph-2d-content" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
          <svg viewBox="0 0 900 590" preserveAspectRatio="none" role="img" aria-label="Two-dimensional view of your weighted graph">
            {graph.edges.map((edge) => {
              const first = graph.nodes.find((node) => node.id === edge.from);
              const second = graph.nodes.find((node) => node.id === edge.to);
              if (!first || !second) return null;
              const edgeKey = pairKey(edge.from, edge.to);
              const evaluating = state?.edgeId === edge.id;
              const completeRoute = state?.type === 'complete' && routeEdges.has(edgeKey);
              const travelled = travelledEdges.has(edgeKey);
              const stroke = completeRoute || travelled ? '#36a66f' : evaluating ? '#e1ac39' : '#8898a2';
              const midX = (first.x + second.x) / 2;
              const midY = (first.y + second.y) / 2;
              return (
                <g key={edge.id}>
                  <line x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke={stroke} strokeWidth={completeRoute || travelled ? 5 : evaluating ? 4 : 3} strokeLinecap="round" />
                  <rect x={midX - 15} y={midY - 12} width="30" height="24" rx="8" fill="#fff" stroke={evaluating ? '#e1ac39' : '#d5dee4'} />
                  <text x={midX} y={midY + 4} fill="#455a6a" fontSize="13" fontWeight="700" textAnchor="middle">{edge.weight}</text>
                </g>
              );
            })}
            {graph.nodes.map((node) => {
              const isStart = node.id === startId;
              const isDestination = node.id === destinationId;
              const isCurrent = state?.type === 'select' && current === node.id;
              const isChecking = state?.type === 'examine' && state.neighborId === node.id;
              const isFinalized = visited.has(node.id);
              const routeNode = state?.type === 'complete' && finalPath.includes(node.id);
              const color = isStart ? '#267fe0' : isDestination ? '#df9537' : isChecking ? '#e0ad39' : routeNode || isFinalized ? '#3aa673' : '#788993';
              return (
                <g key={node.id}>
                  {(isCurrent || isChecking) && <circle cx={node.x} cy={node.y} r="29" fill={isCurrent ? 'rgba(44,132,221,.12)' : 'rgba(224,173,57,.15)'} />}
                  <circle cx={node.x} cy={node.y} r="21" fill={color} stroke="#fff" strokeWidth="4" />
                  <text x={node.x} y={node.y + 5} fill="#fff" fontSize="14" fontWeight="800" textAnchor="middle">{node.id}</text>
                  <text x={node.x} y={node.y + 38} fill={isStart ? '#246fb9' : isDestination ? '#a76617' : '#566e7d'} fontSize="9" fontWeight="700" textAnchor="middle">{isStart ? 'RELIEF CENTER' : isDestination ? 'AFFECTED VILLAGE' : `LOCATION ${node.id}`}</text>
                </g>
              );
            })}
          </svg>
          {currentPosition && (
            <div className="graph-2d-truck" style={{ left: `${currentPosition.x / 9}%`, top: `${currentPosition.y / 5.9}%` }}>
              <Truck size={20} />
            </div>
          )}
        </div>
      </div>
      {mapInfoVisible && <div className="graph-2d-label map-info-popup"><span><i />2D GRAPH VIEW</span><small>Every road and weight comes from your graph</small></div>}
    </div>
  );
}

function DijkstraSimulation({ graph, startId, destinationId, onBack, onHome }) {
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [speed, setSpeed] = useState(850);
  const [viewMode, setViewMode] = useState('3d');
  const [graphZoom, setGraphZoom] = useState(1);
  const [learningMode, setLearningMode] = useState(false);
  const [algorithmPanelVisible, setAlgorithmPanelVisible] = useState(true);
  const [mapInfoVisible, setMapInfoVisible] = useState(false);
  const mapInfoTimeout = useRef(null);
  const state = cursor >= 0 ? events[cursor] : null;
  const completion = events.at(-1)?.type === 'complete' ? events.at(-1) : null;
  const finalPath = useMemo(() => completion?.path || [], [completion]);
  const routeSet = new Set(finalPath);
  const visited = state?.visited || [];
  const edgesExamined = events.slice(0, cursor + 1).filter((event) => event.type === 'examine').length;
  const truckPath = useMemo(() => {
    if (!finalPath.length) return [startId];
    if (state?.type === 'complete') return finalPath;
    const finalized = new Set(events.slice(0, cursor + 1)
      .filter((event) => event.type === 'finalize')
      .map((event) => event.nodeId));
    const reached = [];
    for (const nodeId of finalPath) {
      if (!finalized.has(nodeId)) break;
      reached.push(nodeId);
    }
    return reached.length ? reached : [startId];
  }, [startId, finalPath, events, cursor, state]);

  function prepareSimulation() {
    try {
      const result = calculateDijkstraSteps(graph, startId, destinationId);
      setEvents(result);
      setCursor(0);
      setPlaying(false);
      setError('');
      return true;
    } catch (problem) {
      setError(problem.message);
      return false;
    }
  }

  useEffect(() => {
    prepareSimulation();
    // The simulation receives an immutable graph snapshot from the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => window.clearTimeout(mapInfoTimeout.current), []);

  function showMapInfo() {
    window.clearTimeout(mapInfoTimeout.current);
    setMapInfoVisible(true);
    mapInfoTimeout.current = window.setTimeout(() => setMapInfoVisible(false), 2000);
  }

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setCursor((current) => {
        const next = Math.min(current + 1, events.length - 1);
        if (next >= events.length - 1) setPlaying(false);
        return next;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [playing, events.length, speed]);

  function stepForward() {
    setPlaying(false);
    setCursor((current) => Math.min(current + 1, events.length - 1));
  }

  function stepBackward() {
    setPlaying(false);
    setCursor((current) => Math.max(current - 1, 0));
  }

  const explanation = state
    ? state.message
    : 'Press Start to initialize Dijkstra. The start is set to 0; all other locations are set to infinity.';
  const eventTitle = (event) => {
    switch (event.type) {
      case 'initialize': return 'Initialize distances';
      case 'select': return `Select location ${event.nodeId}`;
      case 'examine': return `Check road ${event.nodeId} → ${event.neighborId}`;
      case 'update': return `Update distance to ${event.neighborId}`;
      case 'keep': return `Keep distance to ${event.neighborId}`;
      case 'finalize': return `Finalize location ${event.nodeId}`;
      case 'complete': return 'Shortest route found';
      default: return 'Algorithm step';
    }
  };

  return (
    <div className="simulation-screen">
      <header className="sim-header">
        <button className="back-button" onClick={onBack} title="Back to graph editor"><ArrowLeft size={16} /></button>
        <span className="mini-brand-mark"><Truck size={20} /></span>
        <div className="sub-brand"><strong>Dijkstra Simulation</strong><small>Graph-generated response network</small></div>
        <div className="sim-mode-switch" role="group" aria-label="Simulation mode">
          <button className={!learningMode ? 'active' : ''} aria-pressed={!learningMode} onClick={() => setLearningMode(false)}><Zap size={13} />Simulation Mode</button>
          <button className={learningMode ? 'active' : ''} aria-pressed={learningMode} onClick={() => setLearningMode(true)}><BookOpen size={13} />Learning Mode</button>
        </div>
        <div className="sim-route-summary"><span className="sim-start"><i />{startId}</span><ArrowRight size={13} /><span className="sim-destination"><i />{destinationId}</span></div>
        <button className="sim-home" onClick={onHome} title="Home"><Home size={16} /></button>
      </header>

      <div className={`simulation-content ${algorithmPanelVisible ? '' : 'algorithm-panel-hidden'}`}>
        <section className={`city-panel ${mapInfoVisible ? 'map-info-visible' : ''}`}>
          {viewMode === '3d'
            ? <div className="city-view"><CityView graph={graph} startId={startId} destinationId={destinationId} state={state} finalPath={finalPath} truckPath={truckPath} /></div>
            : <Graph2DView graph={graph} startId={startId} destinationId={destinationId} state={state} finalPath={finalPath} truckPath={truckPath} mapInfoVisible={mapInfoVisible} zoom={graphZoom} onZoomChange={setGraphZoom} />}
          <button className="map-info-toggle" onClick={showMapInfo} aria-label="Show map information" title="Show map information"><Truck size={18} /></button>
          {mapInfoVisible && (
            <>
              <div className="city-title-card map-info-popup"><div><strong>{viewMode === '3d' ? '3D response zone' : '2D graph simulation'}</strong><small>Your graph, visualized as a relief network</small></div><span className="city-live"><i /> LIVE</span></div>
              <div className="city-legend map-info-popup">
                <span><i className="legend-road-unvisited" />Unvisited road</span><span><i className="legend-road-evaluating" />Evaluating</span><span><i className="legend-road-finalized" />Shortest path</span><span><i className="legend-road-truck" />Truck</span>
              </div>
            </>
          )}
          {!algorithmPanelVisible && (
            <button className="algorithm-panel-toggle map-panel-toggle" onClick={() => setAlgorithmPanelVisible(true)} aria-label="Show algorithm panel" title="Show algorithm panel">
              <PanelRightOpen size={16} /><span>Show algorithm panel</span>
            </button>
          )}
          <div className={`graph-step-caption ${state?.type === 'complete' ? 'caption-complete' : ''}`}>
            <div className="caption-heading">
              <span className="caption-step-number">{state ? cursor + 1 : '—'}</span>
              <div><span className="overline">{state?.type === 'examine' ? 'CHECKING THIS ROAD' : state?.type === 'complete' ? 'FINAL RESULT' : state?.type === 'initialize' ? 'START HERE' : state?.type === 'finalize' ? 'LOCATION CONFIRMED' : 'WHAT IS HAPPENING?'}</span>
                <strong>{state?.type === 'examine' || state?.type === 'update' || state?.type === 'keep' ? `${state.nodeId} → ${state.neighborId}` : state?.nodeId ? `Location ${state.nodeId}` : 'Your simulation guide'}</strong>
              </div>
            </div>
            <p>{explanation}</p>
            {(state?.type === 'examine' || state?.type === 'update' || state?.type === 'keep') && (
              <div className="caption-calculation">
                <span>DISTANCE VIA {state.nodeId}</span>
                <strong>{state.currentDistance} <i>+</i> {state.edgeWeight} <i>=</i> {state.candidate}</strong>
                <small>{state.improved ? `This is shorter than ${infinityLabel(state.previousDistance)} — update ${state.neighborId}'s distance.` : `The current distance (${infinityLabel(state.previousDistance)}) is shorter — keep it.`}</small>
              </div>
            )}
            {state?.type === 'complete' && state.path.length > 0 && (
              <div className="caption-calculation caption-route-result">
                <span>SHORTEST ROUTE · TOTAL WEIGHT {state.distance}</span>
                <strong>{state.path.join('  →  ')}</strong>
                <small>{state.visited.length} locations visited · {state.exploredEdges} road connections examined.</small>
              </div>
            )}
          </div>
          {viewMode === '3d' && mapInfoVisible && <div className="camera-hint map-info-popup">DRAG TO ROTATE <i /> SCROLL TO ZOOM <i /> RIGHT-DRAG TO PAN</div>}
        </section>

        <aside className="algorithm-panel">
          <div className="algorithm-panel-heading"><div className="algorithm-heading-icon"><GitBranch size={16} /></div><div className="algorithm-heading-copy"><span className="overline">SHORTEST PATH</span><h1>Dijkstra Algorithm</h1><p>Step-by-step walkthrough</p></div><button className="algorithm-panel-toggle" onClick={() => setAlgorithmPanelVisible(false)} aria-label="Hide algorithm panel" title="Hide algorithm panel"><PanelRightClose size={16} /></button></div>
          <div className="distance-section">
            <div className="distance-heading"><div><strong>Distance table</strong><small>Shortest known distance from start</small></div><span>{visited.length} visited</span></div>
            <div className="distance-table">
              <div className="distance-header"><span>NODE</span><span>DISTANCE</span><span>PREVIOUS</span><span>STATUS</span></div>
              {graph.nodes.map((node) => {
                const distance = state?.distances?.[node.id] ?? Infinity;
                const previous = state?.previous?.[node.id] ?? null;
                const isCurrent = state?.nodeId === node.id && (state.type === 'select' || state.type === 'initialize');
                const isEvaluating = state?.neighborId === node.id && state.type === 'examine';
                const status = visited.includes(node.id) ? 'Visited' : isCurrent ? 'Current' : isEvaluating ? 'Checking' : Number.isFinite(distance) ? 'Pending' : 'Unvisited';
                return <div key={node.id} className={`distance-row ${isCurrent ? 'row-current' : ''} ${isEvaluating ? 'row-evaluating' : ''} ${visited.includes(node.id) ? 'row-visited' : ''} ${routeSet.has(node.id) && state?.type === 'complete' ? 'row-route' : ''}`}><span className="distance-node"><i>{node.id}</i>{node.id === startId ? 'Start' : node.id === destinationId ? 'Destination' : `Location ${node.id}`}</span><strong>{infinityLabel(distance)}</strong><span>{previous || '—'}</span><span className={`node-status ${status.toLowerCase()}`}>{status}</span></div>;
              })}
            </div>
            <div className="distance-key"><span><i className="key-current" />Current</span><span><i className="key-checking" />Checking</span><span><i className="key-visited" />Visited</span><span>∞ = not reached</span></div>
          </div>

          {learningMode ? (
            <section className="learning-timeline" aria-label="Complete Dijkstra walkthrough">
              <div className="learning-timeline-heading">
                <div><strong>Every algorithm step</strong><small>Select a step to see it on the map</small></div>
                <span>{events.length} steps</span>
              </div>
              {events.map((event, index) => (
                <button
                  key={`${event.type}-${index}`}
                  className={`learning-timeline-step ${index === cursor ? 'active' : ''} ${event.type}`}
                  onClick={() => { setPlaying(false); setCursor(index); }}
                  aria-current={index === cursor ? 'step' : undefined}
                >
                  <span className="learning-timeline-number">{index + 1}</span>
                  <span className="learning-timeline-copy">
                    <strong>{eventTitle(event)}</strong>
                    <small>{event.message}</small>
                    {(event.type === 'examine' || event.type === 'update' || event.type === 'keep') && (
                      <span className="learning-timeline-calculation">
                        {event.currentDistance} + {event.edgeWeight} = {event.candidate}
                        {event.type !== 'examine' && ` · ${event.improved ? 'shorter: update' : 'not shorter: keep'}`}
                      </span>
                    )}
                    {event.type === 'complete' && (
                      <span className="learning-timeline-calculation">
                        {event.path.length ? `${event.path.join(' → ')} · total weight ${event.distance}` : 'No valid route exists'}
                      </span>
                    )}
                  </span>
                </button>
              ))}
              <small className="complexity-note">Binary min-heap: <b>O((V + E) log V)</b></small>
            </section>
          ) : (
            <>
              <div className="step-progress"><div><span>ALGORITHM PROGRESS</span><strong>Step {cursor >= 0 ? `${cursor + 1}` : '—'}<small> / {events.length}</small></strong></div><span className="progress-track"><i style={{ width: `${events.length ? ((cursor + 1) / events.length) * 100 : 0}%` }} /></span></div>
              <section className="beginner-info">
                <div className="learning-section-title"><span className="section-number"><BookOpen size={14} /></span><div><strong>How to read this simulation</strong><small>Follow the route and live algorithm status</small></div></div>
                <p><b>1.</b> The blue location is being processed right now.</p>
                <p><b>2.</b> Check the distance table to see updated route costs.</p>
                <p><b>3.</b> Use Next step or Previous step to explore at your pace.</p>
                <small className="complexity-note">Binary min-heap: <b>O((V + E) log V)</b></small>
              </section>
              <div className="simulation-stats"><span><Weight size={13} />Edges examined <strong>{edgesExamined}</strong></span><span><Crosshair size={13} />Visited <strong>{visited.length}</strong></span></div>
            </>
          )}
          {error && <div className="sim-error">{error}</div>}
        </aside>
      </div>

      <footer className="sim-controls">
        <div className="sim-control-left"><button className="sim-home-taskbar" onClick={onHome} title="Go to home"><Home size={13} /><span>Home</span></button><button className="sim-back-editor" onClick={onBack}><ArrowLeft size={14} /> Graph editor</button><span className="control-separator" /><span className="control-step-label">STEP <b>{cursor >= 0 ? cursor + 1 : 0}</b> OF {events.length}</span></div>
        <div className="sim-control-buttons">
          <button
            className={`sim-button play-button ${playing ? 'is-playing' : ''}`}
            onClick={() => {
              if (playing) setPlaying(false);
              else {
                if (cursor >= events.length - 1 || cursor < 0) prepareSimulation();
                setPlaying(true);
              }
            }}
            disabled={!events.length}
            aria-label={playing ? 'Pause simulation' : 'Play simulation'}
          >
            {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}{playing ? 'Pause' : 'Play'}
          </button>
          <button className="sim-button" onClick={prepareSimulation} disabled={!events.length} aria-label="Restart simulation" title="Restart from the first step"><RotateCcw size={14} />Restart</button>
          <button className="sim-button" onClick={stepBackward} disabled={!events.length || cursor <= 0}><ArrowLeft size={14} />Previous step</button>
          <button className="sim-button" onClick={stepForward} disabled={!events.length || cursor >= events.length - 1}><SkipForward size={14} />Next step</button>
        </div>
        <div className="sim-control-right"><div className="view-switch" role="group" aria-label="Simulation view"><button className={viewMode === '2d' ? 'active' : ''} onClick={() => setViewMode('2d')} title="Switch to 2D graph simulation">2D view</button><button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')} title="Switch to 3D city simulation">3D view</button></div><label><span>Speed</span><input type="range" min="250" max="1600" step="150" value={1800 - speed} onChange={(event) => setSpeed(1800 - Number(event.target.value))} /><span>FAST</span></label></div>
      </footer>
    </div>
  );
}

function HomeScreen({ onDijkstra, onKnapsack }) {
  return (
    <main className="home-screen">
      <header className="home-header"><div className="home-brand"><span><Truck size={23} /></span><div><strong>Disaster Relief Logistics</strong><small>Interactive Algorithm Visualization</small></div></div><div className="home-mode"><BookOpen size={14} /> Learn by doing</div></header>
      <div className="home-body">
        <section className="home-hero"><span className="home-kicker"><i /> PLAN <b>/</b> OPTIMIZE <b>/</b> DELIVER</span><h1>Disaster Relief<br /><em>Logistics</em></h1><p>Build a road network. Find the shortest route. Make every delivery count.</p><span className="hero-rule" /></section>
        <div className="option-grid">
          <article className="option-card dijkstra-option">
            <div className="option-icon"><GitBranch size={22} /></div><span className="option-index">01 / ROUTE PLANNING</span>
            <h2>Dijkstra<br />Simulation</h2><p>Create your own weighted graph and watch Dijkstra's algorithm find a shortest path through an interactive 3D city.</p>
            <div className="option-points"><span><Check size={12} /> Build your own road network</span><span><Check size={12} /> Step through real calculations</span><span><Check size={12} /> Explore the graph as a 3D city</span></div>
            <button onClick={onDijkstra}>Start Dijkstra Simulation <ArrowRight size={15} /></button>
            <div className="option-graphic graph-graphic"><i /><i /><i /><i /><i /><i /><svg viewBox="0 0 300 120" preserveAspectRatio="none"><path d="M20 83 92 31 144 84 224 30 280 65M92 31 224 30M144 84 280 65" /></svg></div>
          </article>
          <article className="option-card knapsack-option">
            <div className="option-icon"><Weight size={22} /></div><span className="option-index">02 / CARGO PLANNING</span>
            <h2>Knapsack<br />Simulation</h2><p>Choose supply priorities, available kilograms, and a container limit to build an optimized relief load.</p>
            <div className="option-points"><span><Check size={12} /> Set grains, water, medicine, and clothes</span><span><Check size={12} /> Compare divisible and indivisible cargo</span><span><Check size={12} /> Explore the load in 2D or 3D</span></div>
            <button onClick={onKnapsack}>Start Knapsack Simulation <ArrowRight size={15} /></button>
            <div className="option-graphic cargo-graphic"><span /><span /><span /><span /><span /></div>
          </article>
        </div>
        <div className="home-foot"><span><i /> A hands-on algorithms learning experience</span><span>BUILT FOR BETTER RELIEF PLANNING</span></div>
      </div>
    </main>
  );
}

export default function App() {
  const [page, setPage] = useState('home');
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [startId, setStartId] = useState(null);
  const [destinationId, setDestinationId] = useState(null);
  const [error, setError] = useState('');
  const [knapsackConfig, setKnapsackConfig] = useState(DEFAULT_KNAPSACK_CONFIG);

  useEffect(() => {
    function goHome() { setPage('home'); }
    window.addEventListener('relief-home', goHome);
    return () => window.removeEventListener('relief-home', goHome);
  }, []);

  function generate() {
    if (graph.nodes.length < 1) {
      setError('Add at least one location before generating a simulation.');
      return;
    }
    if (graph.nodes.length > 1 && graph.edges.length < 1) {
      setError('Connect at least one pair of locations with a road.');
      return;
    }
    if (!startId || !destinationId || !graph.nodes.some((node) => node.id === startId) || !graph.nodes.some((node) => node.id === destinationId)) {
      setError('Select an existing relief center and affected village.');
      return;
    }
    if (graph.nodes.length > 1 && startId === destinationId) {
      setError('Choose different locations for the relief center and affected village.');
      return;
    }
    try {
      calculateDijkstraSteps(graph, startId, destinationId);
      setError('');
      setPage('simulation');
    } catch (problem) {
      setError(problem.message);
    }
  }

  if (page === 'home') return <HomeScreen onDijkstra={() => setPage('editor')} onKnapsack={() => setPage('knapsack-setup')} />;
  if (page === 'knapsack-setup') return <KnapsackSetup config={knapsackConfig} setConfig={setKnapsackConfig} onBack={() => setPage('home')} onStart={() => setPage('knapsack-simulation')} />;
  if (page === 'knapsack-simulation') return <KnapsackSimulation config={knapsackConfig} onBack={() => setPage('knapsack-setup')} onHome={() => setPage('home')} />;
  if (page === 'simulation') return <DijkstraSimulation graph={graph} startId={startId} destinationId={destinationId} onBack={() => setPage('editor')} onHome={() => setPage('home')} />;
  return <GraphEditor graph={graph} setGraph={setGraph} startId={startId} setStartId={setStartId} destinationId={destinationId} setDestinationId={setDestinationId} onGenerate={generate} error={error} setError={setError} />;
}
