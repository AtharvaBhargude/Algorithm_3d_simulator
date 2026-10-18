import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Clone, Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import {
  ArrowLeft, ArrowRight, BookOpen, BriefcaseMedical, Check, ChevronDown,
  Droplets, Home, Info, Package, Pause, PanelRightClose, PanelRightOpen, Play,
  RotateCcw, ShieldCheck, Shirt, SkipForward, Wheat, Weight, X,
  Zap,
} from 'lucide-react';
import { calculateKnapsackSteps } from './knapsack.js';

const supplyModelUrl = (filename) => `${import.meta.env.BASE_URL}models/${filename}`;

export const SUPPLY_OPTIONS = [
  { id: 'grain', label: 'Grains', icon: Wheat, model: supplyModelUrl('full-wheat-sack.glb'), partialModel: supplyModelUrl('divided-wheat-sack.glb'), color: '#b9823d' },
  { id: 'water', label: 'Water', icon: Droplets, model: supplyModelUrl('water-jar.glb'), partialModel: supplyModelUrl('water-bottle.glb'), color: '#438bc9' },
  { id: 'medicine', label: 'Medicines', icon: BriefcaseMedical, model: supplyModelUrl('medicine-cupboard.glb'), color: '#59a47b' },
  { id: 'clothes', label: 'Clothes', icon: Shirt, model: supplyModelUrl('folded-clothes.glb'), color: '#9a78bd' },
];

export const DEFAULT_KNAPSACK_CONFIG = {
  capacity: '100',
  supplies: [
    { id: 'grain', name: 'Grains', quantity: '50', priority: '4', divisible: true },
    { id: 'water', name: 'Water', quantity: '30', priority: '3', divisible: true },
    { id: 'medicine', name: 'Medicines', quantity: '10', priority: '4', divisible: true },
    { id: 'clothes', name: 'Clothes', quantity: '20', priority: '2', divisible: true },
  ],
};

const displayWeight = (value) => Number(value.toFixed(2)).toLocaleString();

function KnapsackSetup({ config, setConfig, onBack, onStart }) {
  const [error, setError] = useState('');

  function updateSupply(id, field, value) {
    setConfig((current) => ({
      ...current,
      supplies: current.supplies.map((item) => item.id === id ? { ...item, [field]: value } : item),
    }));
  }

  function startSimulation(event) {
    event.preventDefault();
    const supplies = config.supplies.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      priority: Number(item.priority),
    }));
    const capacity = Number(config.capacity);
    try {
      calculateKnapsackSteps(supplies, capacity);
      setConfig((current) => ({ ...current, capacity: String(capacity), supplies }));
      setError('');
      onStart();
    } catch (problem) {
      setError(problem.message);
    }
  }

  return (
    <main className="knapsack-setup-screen">
      <header className="sub-header">
        <button className="back-button" onClick={onBack} aria-label="Back to simulations"><ArrowLeft size={16} /></button>
        <span className="mini-brand-mark"><Weight size={20} /></span>
        <div className="sub-brand"><strong>Knapsack Simulation</strong><small>Configure a relief cargo load</small></div>
        <span className="sub-header-tag"><ShieldCheck size={13} /> RELIEF CARGO PLANNER</span>
      </header>

      <form className="knapsack-setup-content" onSubmit={startSimulation}>
        <div className="knapsack-setup-heading">
          <span className="overline">CARGO OPTIMIZATION / SETUP</span>
          <h1>What should go in the container?</h1>
          <p>Set the carrying limit, available kilograms, priority, and divisibility for each relief supply.</p>
        </div>

        <section className="knapsack-capacity-card">
          <div className="knapsack-section-icon"><Package size={19} /></div>
          <div className="knapsack-capacity-copy"><strong>Container capacity</strong><small>Maximum total cargo weight</small></div>
          <label className="knapsack-number-input"><input type="number" min="0" step="0.1" required value={config.capacity} onChange={(event) => setConfig((current) => ({ ...current, capacity: event.target.value }))} /><span>kg</span></label>
        </section>

        <section className="knapsack-items-section">
          <div className="knapsack-items-heading"><div><strong>Available relief supplies</strong><small>Set each supply's priority and choose whether that item can be split.</small></div><span>4 SUPPLY TYPES</span></div>
          <div className="knapsack-item-grid">
            {SUPPLY_OPTIONS.map((option) => {
              const supply = config.supplies.find((item) => item.id === option.id);
              const Icon = option.icon;
              return (
                <article className="knapsack-item-card" key={option.id}>
                  <div className="knapsack-item-title">
                    <span className="knapsack-item-icon" style={{ '--supply-color': option.color }}><Icon size={18} /></span>
                    <div><strong>{option.label}</strong><small>Available quantity</small></div>
                  </div>
                  <label className="knapsack-field-label">Quantity <span>kg</span>
                    <input type="number" min="0" step="0.1" required value={supply.quantity} onChange={(event) => updateSupply(option.id, 'quantity', event.target.value)} />
                  </label>
                  <label className="knapsack-field-label">Priority
                    <span className="select-wrap"><select value={supply.priority} onChange={(event) => updateSupply(option.id, 'priority', event.target.value)}>
                      <option value="1">Low</option><option value="2">Medium</option><option value="3">High</option><option value="4">Critical</option>
                    </select><ChevronDown size={13} /></span>
                  </label>
                  <div className="knapsack-field-label knapsack-item-type"><span>Item type</span><div className="knapsack-item-type-switch" role="group" aria-label={`${option.label} divisibility`}>
                    <button type="button" className={supply.divisible !== false ? 'active' : ''} aria-pressed={supply.divisible !== false} onClick={() => updateSupply(option.id, 'divisible', true)}>Divisible</button>
                    <button type="button" className={supply.divisible === false ? 'active' : ''} aria-pressed={supply.divisible === false} onClick={() => updateSupply(option.id, 'divisible', false)}>Indivisible</button>
                  </div></div>
                </article>
              );
            })}
          </div>
        </section>

        {error && <p className="knapsack-setup-error" role="alert"><X size={14} />{error}</p>}
        <div className="knapsack-setup-actions"><button type="button" className="knapsack-cancel-button" onClick={onBack}>Cancel</button><button type="submit" className="knapsack-start-button">Generate simulation <ArrowRight size={16} /></button></div>
      </form>
    </main>
  );
}

function useModelMetrics(scene) {
  return useMemo(() => {
    const bounds = new Box3().setFromObject(scene);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    return {
      center: [center.x, bounds.min.y, center.z],
      width: Math.max(size.x, size.z, 0.001),
      height: Math.max(size.y, 0.001),
    };
  }, [scene]);
}

function CargoModelVisual({ url, partial }) {
  const { scene } = useGLTF(url);
  const metrics = useModelMetrics(scene);
  const scale = Math.min(1.45 / metrics.width, 1.5 / metrics.height);
  return (
    <group position={[0, 0.1, 0]} scale={scale * (partial ? 0.9 : 1)}>
      <Clone object={scene} position={[-metrics.center[0], -metrics.center[1], -metrics.center[2]]} />
    </group>
  );
}

function CargoModelPlaceholder({ option }) {
  const color = option.color;
  if (option.id === 'grain') {
    return (
      <mesh position={[0, 0.76, 0]} scale={[0.52, 0.72, 0.48]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
    );
  }
  if (option.id === 'water') {
    return (
      <group position={[0, 0.1, 0]}>
        <mesh position={[0, 0.6, 0]}><cylinderGeometry args={[0.36, 0.4, 1.15, 12]} /><meshStandardMaterial color={color} roughness={0.32} metalness={0.08} /></mesh>
        <mesh position={[0, 1.23, 0]}><cylinderGeometry args={[0.13, 0.16, 0.2, 10]} /><meshStandardMaterial color={color} roughness={0.32} /></mesh>
      </group>
    );
  }
  if (option.id === 'medicine') {
    return (
      <group position={[0, 0.64, 0]}>
        <mesh><boxGeometry args={[0.85, 1.15, 0.48]} /><meshStandardMaterial color={color} roughness={0.72} /></mesh>
        <mesh position={[0, 0, 0.25]}><boxGeometry args={[0.13, 0.48, 0.025]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[0, 0, 0.25]}><boxGeometry args={[0.44, 0.13, 0.025]} /><meshStandardMaterial color="#ffffff" /></mesh>
      </group>
    );
  }
  return (
    <group position={[0, 0.46, 0]}>
      <mesh><boxGeometry args={[1.15, 0.52, 0.82]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
      <mesh position={[0, 0.3, 0]}><boxGeometry args={[0.96, 0.12, 0.76]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
    </group>
  );
}

class CargoModelErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(`Could not load the ${this.props.option.label} cargo model; displaying its fallback model.`, error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <>
        <CargoModelPlaceholder option={this.props.option} />
        <Html position={[0, 1.85, 0]} center distanceFactor={11} zIndexRange={[2, 1]}>
          <span className="cargo-model-label cargo-model-error" title={this.state.error.message}>
            <b>{this.props.option.label}</b>
            <small>3D model unavailable · fallback shown</small>
          </span>
        </Html>
      </>
    );
  }
}

function CargoModel({ url, option, supply, amount, position }) {
  const partial = amount < supply.quantity - 1e-8;
  return (
    <group position={position}>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.09, 32]} />
        <meshStandardMaterial color={option.color} roughness={0.72} />
      </mesh>
      <CargoModelErrorBoundary key={url} option={option}>
        <Suspense fallback={<CargoModelPlaceholder option={option} />}>
          <CargoModelVisual url={url} partial={partial} />
        </Suspense>
      </CargoModelErrorBoundary>
      <Html position={[0, 1.85, 0]} center distanceFactor={11} zIndexRange={[2, 1]}>
        <span className="cargo-model-label"><b>{option.label}</b><small>{displayWeight(amount)} kg{partial ? ' · PARTIAL' : ''}</small></span>
      </Html>
    </group>
  );
}

function CargoScene({ supplies, allocations, capacity }) {
  const active = supplies.map((supply) => ({
    supply,
    amount: allocations[supply.id] || 0,
    option: SUPPLY_OPTIONS.find((item) => item.id === supply.id),
  })).filter((item) => item.amount > 0 && item.option);
  const positions = [[-2.15, 0, -1.15], [2.15, 0, -1.15], [-2.15, 0, 1.15], [2.15, 0, 1.15]];
  const { invalidate } = useThree();
  useEffect(() => { invalidate(); }, [active.length, allocations, invalidate]);
  return (
    <>
      <color attach="background" args={['#edf4fc']} />
      <fog attach="fog" args={['#edf4fc', 14, 30]} />
      <ambientLight intensity={1.7} />
      <directionalLight position={[-5, 9, 7]} intensity={2.3} />
      <pointLight position={[4, 5, -4]} color="#a9dcff" intensity={1.1} distance={22} />
      <mesh position={[0, -0.13, 0]} receiveShadow>
        <boxGeometry args={[8.6, 0.22, 5.6]} />
        <meshStandardMaterial color="#dbe6ef" roughness={0.9} />
      </mesh>
      <Line points={[[-4.3, 0.01, -2.8], [4.3, 0.01, -2.8], [4.3, 0.01, 2.8], [-4.3, 0.01, 2.8], [-4.3, 0.01, -2.8]]} color="#6a95bd" lineWidth={1.8} />
      <mesh position={[0, 0, -2.62]}>
        <boxGeometry args={[8.2, 0.25, 0.12]} />
        <meshStandardMaterial color="#7a9ab6" roughness={0.8} />
      </mesh>
      <mesh position={[-4.05, 0, 0]}>
        <boxGeometry args={[0.12, 0.25, 5.1]} />
        <meshStandardMaterial color="#7a9ab6" roughness={0.8} />
      </mesh>
      <mesh position={[4.05, 0, 0]}>
        <boxGeometry args={[0.12, 0.25, 5.1]} />
        <meshStandardMaterial color="#7a9ab6" roughness={0.8} />
      </mesh>
      {active.map(({ supply, amount, option }, index) => (
        <CargoModel
          key={supply.id}
          url={amount < supply.quantity - 1e-8 ? option.partialModel || option.model : option.model}
          option={option}
          supply={supply}
          amount={amount}
          position={positions[index]}
        />
      ))}
      <Html position={[0, 0.36, 2.43]} center distanceFactor={13} zIndexRange={[2, 1]}>
        <span className="cargo-capacity-label">CONTAINER LOAD · {displayWeight(Object.values(allocations).reduce((sum, amount) => sum + amount, 0))} / {displayWeight(capacity)} KG</span>
      </Html>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={7} maxDistance={17} maxPolarAngle={1.42} target={[0, 0.5, 0]} />
    </>
  );
}

function Knapsack3DView({ supplies, allocations, capacity }) {
  return (
    <Canvas frameloop="demand" camera={{ position: [8, 8, 10], fov: 43, near: 0.1, far: 60 }} dpr={[1, 1.35]} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <Suspense fallback={null}><CargoScene supplies={supplies} allocations={allocations} capacity={capacity} /></Suspense>
    </Canvas>
  );
}

function Knapsack2DView({ supplies, allocations, capacity, currentEvent }) {
  const total = Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
  return (
    <div className="knapsack-2d-view">
      <div className="knapsack-2d-container">
        <div className="knapsack-2d-container-heading"><span><Package size={16} /> RELIEF CONTAINER</span><strong>{displayWeight(total)} <small>/ {displayWeight(capacity)} kg</small></strong></div>
        <div className="knapsack-capacity-track"><i style={{ width: `${capacity > 0 ? Math.min(100, (total / capacity) * 100) : 0}%` }} /></div>
        <div className="knapsack-2d-items">
          {supplies.map((supply) => {
            const option = SUPPLY_OPTIONS.find((item) => item.id === supply.id);
            const Icon = option.icon;
            const amount = allocations[supply.id] || 0;
            const active = currentEvent?.itemId === supply.id && currentEvent.type === 'decision';
            return (
              <div key={supply.id} className={`knapsack-2d-item ${amount > 0 ? 'loaded' : ''} ${active ? 'current' : ''}`} style={{ '--supply-color': option.color }}>
                <span className="knapsack-2d-item-icon"><Icon size={25} /></span>
                <strong>{option.label}</strong>
                <small>{displayWeight(amount)} / {displayWeight(supply.quantity)} kg</small>
                <span className="knapsack-item-bar"><i style={{ width: `${supply.quantity > 0 ? Math.min(100, (amount / supply.quantity) * 100) : 0}%` }} /></span>
                {amount > 0 && <b className="knapsack-loaded-tag"><Check size={11} /> LOADED</b>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="knapsack-2d-note"><span><i />Loaded supply</span><span><i />Available, not loaded</span><span>Priority drives the selection</span></div>
    </div>
  );
}

function KnapsackStepInfo({ event, supplies, capacity, stepNumber, onClose }) {
  const stepAllocations = event.allocations || {};
  const rows = supplies
    .map((supply) => ({
      supply,
      amount: stepAllocations[supply.id] || 0,
      score: (stepAllocations[supply.id] || 0) * supply.priority,
    }))
    .filter(({ amount, supply }) => amount > 0 || (event.type === 'decision' && event.itemId === supply.id));
  const weight = event.type === 'evaluate'
    ? event.weight
    : rows.reduce((sum, row) => sum + row.amount, 0);
  const score = event.type === 'evaluate'
    ? event.value
    : rows.reduce((sum, row) => sum + row.score, 0);
  const fits = weight <= capacity + 1e-9;
  const heading = event.type === 'initialize'
    ? 'Starting values'
    : event.type === 'evaluate'
      ? `Combination ${event.combination} calculation`
      : event.type === 'decision'
        ? `${event.itemName} decision`
        : 'Final load calculation';

  return (
    <section className="knapsack-step-info" aria-label={`Calculations for step ${stepNumber}`}>
      <header className="knapsack-step-info-heading">
        <div><span>STEP {stepNumber} CALCULATIONS</span><strong>{heading}</strong></div>
        <button type="button" aria-label="Close calculations" onClick={onClose}><X size={15} /></button>
      </header>
      {event.type === 'initialize' ? (
        <>
          <p className="knapsack-info-note">Begin with an empty container and these configured supplies.</p>
          <div className="knapsack-info-rows">
            {supplies.map((supply) => (
              <div className="knapsack-info-row" key={supply.id}>
                <strong>{supply.name}</strong>
                <span>{displayWeight(supply.quantity)} kg · priority {supply.priority} · {supply.divisible === false ? 'indivisible' : 'divisible'}</span>
              </div>
            ))}
          </div>
          <div className="knapsack-info-total"><span>Starting load / priority score</span><strong>0 kg · 0 pts</strong></div>
          <div className="knapsack-info-capacity"><span>Capacity remaining</span><strong>{displayWeight(capacity)} kg left</strong></div>
        </>
      ) : (
        <>
          {event.type === 'evaluate' && <p className="knapsack-info-note">{event.feasible ? 'This combination fits; divisible supplies are added by descending priority to use the remaining capacity.' : 'The indivisible supplies in this combination already exceed capacity.'}</p>}
          {event.type === 'decision' && <p className="knapsack-info-note">{event.divisible ? 'Divisible amount can be selected partially.' : 'Indivisible amount must be either the entire supply lot or zero.'}</p>}
          <div className="knapsack-info-rows">
            {rows.length ? rows.map(({ supply, amount, score: itemScore }) => (
              <div className="knapsack-info-row" key={supply.id}>
                <strong>{supply.name}{event.type === 'decision' && event.itemId === supply.id ? ` · ${event.divisible ? 'divisible' : 'indivisible'}` : ''}</strong>
                <span>{displayWeight(amount)} kg × priority {supply.priority} = <b>{displayWeight(itemScore)} pts</b></span>
              </div>
            )) : <p className="knapsack-info-empty">No supplies selected in this step.</p>}
          </div>
          <div className="knapsack-info-total">
            <span>{event.type === 'evaluate' ? 'Combination load / priority score' : event.type === 'complete' ? 'Final load / priority score' : 'Current step load / priority score'}</span>
            <strong>{displayWeight(weight)} kg · {displayWeight(score)} pts</strong>
          </div>
          <div className={`knapsack-info-capacity ${fits ? '' : 'over-capacity'}`}>
            <span>{fits ? 'Capacity remaining' : 'Over capacity'}</span>
            <strong>{displayWeight(Math.abs(capacity - weight))} kg {fits ? 'left' : 'over'}</strong>
          </div>
        </>
      )}
    </section>
  );
}

function KnapsackSimulation({ config, onBack, onHome }) {
  const supplies = config.supplies.map((item) => ({ ...item, quantity: Number(item.quantity), priority: Number(item.priority) }));
  const capacity = Number(config.capacity);
  const events = useMemo(() => calculateKnapsackSteps(supplies, capacity), [capacity, config.supplies]);
  const hasDivisibleItems = supplies.some((item) => item.divisible !== false);
  const hasIndivisibleItems = supplies.some((item) => item.divisible === false);
  const modeLabel = hasDivisibleItems && hasIndivisibleItems
    ? 'Mixed item types'
    : hasDivisibleItems ? 'Divisible supplies' : 'Indivisible supplies';
  const algorithmLabel = hasDivisibleItems && hasIndivisibleItems
    ? 'Mixed Knapsack'
    : hasDivisibleItems ? 'Fractional Knapsack' : '0/1 Knapsack';
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(850);
  const [viewMode, setViewMode] = useState('3d');
  const [learningMode, setLearningMode] = useState(false);
  const [algorithmPanelVisible, setAlgorithmPanelVisible] = useState(true);
  const [cargoInfoVisible, setCargoInfoVisible] = useState(false);
  const [stepInfoVisible, setStepInfoVisible] = useState(false);
  const state = events[cursor];
  const completion = events.at(-1);
  const allocations = state?.allocations || Object.fromEntries(supplies.map((item) => [item.id, 0]));

  useEffect(() => {
    setCursor(0);
    setPlaying(false);
  }, [events]);

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

  function restart() {
    setPlaying(false);
    setCursor(0);
  }

  function moveStep(direction) {
    setPlaying(false);
    setCursor((current) => Math.max(0, Math.min(events.length - 1, current + direction)));
  }

  function playPause() {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (cursor >= events.length - 1) setCursor(0);
    setPlaying(true);
  }

  const heading = state?.type === 'evaluate'
    ? `Test combination ${state.combination}`
    : state?.type === 'decision'
      ? `${state.amount > 0 ? 'Loading' : 'Skipping'} ${state.itemName}`
      : state?.type === 'complete' ? 'Optimal load found' : 'Start with an empty container';

  return (
    <div className="simulation-screen knapsack-simulation-screen">
      <header className="sim-header">
        <button className="back-button" onClick={onBack} title="Back to cargo setup"><ArrowLeft size={16} /></button>
        <span className="mini-brand-mark"><Weight size={19} /></span>
        <div className="sub-brand"><strong>Knapsack Simulation</strong><small>{modeLabel} · priority optimized</small></div>
        <div className="sim-mode-switch" role="group" aria-label="Simulation mode">
          <button className={!learningMode ? 'active' : ''} aria-pressed={!learningMode} onClick={() => setLearningMode(false)}><Zap size={13} />Simulation Mode</button>
          <button className={learningMode ? 'active' : ''} aria-pressed={learningMode} onClick={() => setLearningMode(true)}><BookOpen size={13} />Learning Mode</button>
        </div>
        <div className="sim-route-summary"><span className="sim-start"><i />{displayWeight(capacity)} kg capacity</span><ArrowRight size={13} /><span className="sim-destination"><i />{modeLabel}</span></div>
        <button className="sim-home" onClick={onHome} title="Home"><Home size={16} /></button>
      </header>

      <div className={`simulation-content ${algorithmPanelVisible ? '' : 'algorithm-panel-hidden'}`}>
        <section className="city-panel knapsack-cargo-panel">
          {viewMode === '3d'
            ? <div className="city-view"><Knapsack3DView supplies={supplies} allocations={allocations} capacity={capacity} /></div>
            : <Knapsack2DView supplies={supplies} allocations={allocations} capacity={capacity} currentEvent={state} />}
          <button
            className={`city-title-card knapsack-cargo-title ${cargoInfoVisible ? 'info-visible' : 'info-hidden'}`}
            onClick={() => setCargoInfoVisible((visible) => !visible)}
            aria-label={cargoInfoVisible ? 'Hide cargo view information' : 'Show cargo view information'}
            aria-expanded={cargoInfoVisible}
            title={cargoInfoVisible ? 'Hide cargo view information' : 'Show cargo view information'}
          >
            <span className="knapsack-section-icon"><Package size={16} /></span>
            {cargoInfoVisible && <><span className="knapsack-cargo-title-copy"><strong>{viewMode === '3d' ? '3D cargo container' : '2D cargo plan'}</strong><small>Relief supplies loaded step by step</small></span><span className="city-live"><i /> LIVE</span></>}
          </button>
          {stepInfoVisible && (
            <KnapsackStepInfo
              event={state}
              supplies={supplies}
              capacity={capacity}
              stepNumber={cursor + 1}
              onClose={() => setStepInfoVisible(false)}
            />
          )}
          <button
            className={`knapsack-step-info-toggle ${stepInfoVisible ? 'active' : ''}`}
            onClick={() => setStepInfoVisible((visible) => !visible)}
            aria-label={stepInfoVisible ? 'Hide step calculations' : 'Show step calculations'}
            aria-expanded={stepInfoVisible}
            title={stepInfoVisible ? 'Hide step calculations' : 'Show step calculations'}
          ><Info size={17} /><span>Calculations</span></button>
          {!algorithmPanelVisible && <button className="algorithm-panel-toggle map-panel-toggle" onClick={() => setAlgorithmPanelVisible(true)} aria-label="Show algorithm panel" title="Show algorithm panel"><PanelRightOpen size={16} /><span>Show algorithm panel</span></button>}
          <div className={`graph-step-caption knapsack-step-caption ${state?.type === 'complete' ? 'caption-complete' : ''}`}>
            <div className="caption-heading"><span className="caption-step-number">{cursor + 1}</span><div><span className="overline">{state?.type === 'evaluate' ? 'SEARCHING FEASIBLE LOADS' : state?.type === 'decision' ? 'CARGO DECISION' : state?.type === 'complete' ? 'OPTIMAL LOAD' : 'KNAPSACK ALGORITHM'}</span><strong>{heading}</strong></div></div>
            <p>{state?.message}</p>
            {state?.type === 'evaluate' && <div className="caption-calculation"><span>COMBINATION WEIGHT / PRIORITY SCORE</span><strong>{displayWeight(state.weight)} <i>kg ·</i> {displayWeight(state.value)} <i>pts</i></strong><small>{state.feasible ? state.best ? 'A new best load that fits the container.' : 'This combination fits but does not improve the current best.' : `Over the ${displayWeight(capacity)} kg capacity.`}</small></div>}
            {state?.type === 'complete' && <div className="caption-calculation caption-route-result"><span>CAPACITY USED · PRIORITY SCORE</span><strong>{displayWeight(completion.totalWeight)} / {displayWeight(capacity)} kg <i>·</i> {displayWeight(completion.totalValue)} pts</strong><small>{hasIndivisibleItems ? `Best result found by checking ${2 ** supplies.filter((item) => item.divisible === false).length} combinations of indivisible supplies${hasDivisibleItems ? ', with divisible supplies optimized for each one.' : '.'}` : 'Divisible supplies loaded in priority order.'}</small></div>}
          </div>
          {viewMode === '3d' && <div className="camera-hint knapsack-camera-hint">DRAG TO ROTATE <i /> SCROLL TO ZOOM <i /> RIGHT-DRAG TO PAN</div>}
        </section>

        <aside className="algorithm-panel knapsack-algorithm-panel">
          <div className="algorithm-panel-heading"><div className="algorithm-heading-icon"><Weight size={16} /></div><div className="algorithm-heading-copy"><span className="overline">CARGO OPTIMIZATION</span><h1>{algorithmLabel}</h1><p>Priority-based load decisions</p></div><button className="algorithm-panel-toggle" onClick={() => setAlgorithmPanelVisible(false)} aria-label="Hide algorithm panel" title="Hide algorithm panel"><PanelRightClose size={16} /></button></div>
          <section className="knapsack-result-card">
            <div className="knapsack-result-heading"><div><strong>Container load</strong><small>Current load / total capacity</small></div><span>{displayWeight(allocations && Object.values(allocations).reduce((sum, amount) => sum + amount, 0))} kg</span></div>
            <div className="knapsack-capacity-track"><i style={{ width: `${capacity > 0 ? Math.min(100, (Object.values(allocations).reduce((sum, amount) => sum + amount, 0) / capacity) * 100) : 0}%` }} /></div>
            <div className="knapsack-load-stats"><span>PRIORITY SCORE <b>{displayWeight(state?.totalValue || 0)}</b></span><span>CAPACITY <b>{displayWeight(capacity)} kg</b></span></div>
          </section>

          <section className="knapsack-allocation-section">
            <div className="knapsack-allocation-heading"><strong>Supply allocations</strong><span>PER-ITEM TYPE</span></div>
            {supplies.map((supply) => {
              const option = SUPPLY_OPTIONS.find((item) => item.id === supply.id);
              const amount = allocations[supply.id] || 0;
              const isCurrent = state?.type === 'decision' && state.itemId === supply.id;
              const percentage = supply.quantity > 0 ? Math.min(100, (amount / supply.quantity) * 100) : 0;
              return <div key={supply.id} className={`knapsack-allocation-row ${amount > 0 ? 'allocated' : ''} ${isCurrent ? 'active' : ''}`}>
                <span className="knapsack-allocation-icon" style={{ '--supply-color': option.color }}><option.icon size={15} /></span>
                <div className="knapsack-allocation-copy"><strong>{supply.name}<small>Priority {supply.priority} · {displayWeight(supply.quantity)} kg · {supply.divisible === false ? 'Indivisible' : 'Divisible'}</small></strong><span className="knapsack-item-bar"><i style={{ width: `${percentage}%` }} /></span></div>
                <b>{displayWeight(amount)} <small>kg</small></b>
              </div>;
            })}
          </section>

          {learningMode ? (
            <section className="learning-timeline" aria-label="Complete knapsack walkthrough">
              <div className="learning-timeline-heading"><div><strong>Every algorithm step</strong><small>Select a step to inspect the load</small></div><span>{events.length} steps</span></div>
              {events.map((event, index) => (
                <button key={`${event.type}-${index}`} className={`learning-timeline-step ${index === cursor ? 'active' : ''} ${event.type}`} onClick={() => { setPlaying(false); setCursor(index); }} aria-current={index === cursor ? 'step' : undefined}>
                  <span className="learning-timeline-number">{index + 1}</span>
                  <span className="learning-timeline-copy"><strong>{event.type === 'initialize' ? 'Initialize container' : event.type === 'evaluate' ? `Check combination ${event.combination}` : event.type === 'decision' ? `${event.selected ? 'Load' : 'Skip'} ${event.itemName}` : 'Optimal load found'}</strong><small>{event.message}</small>
                    {event.type === 'evaluate' && <span className="learning-timeline-calculation">{displayWeight(event.weight)} kg · {displayWeight(event.value)} priority points{event.feasible ? ' · fits' : ' · too heavy'}</span>}
                    {event.type === 'decision' && <span className="learning-timeline-calculation">{displayWeight(event.amount)} / {displayWeight(event.available)} kg selected · {event.divisible ? 'divisible' : 'indivisible'}</span>}
                  </span>
                </button>
              ))}
              <small className="complexity-note">{hasIndivisibleItems ? 'Subset search + divisible fill: ' : 'Greedy sort: '}<b>{hasIndivisibleItems ? `O(2^${supplies.filter((item) => item.divisible === false).length} · n log n)` : 'O(n log n)'}</b></small>
            </section>
          ) : (
            <section className="knapsack-guide"><div className="learning-section-title"><span className="section-number"><BookOpen size={14} /></span><div><strong>How priorities work</strong><small>Higher priority items are more valuable.</small></div></div>
              <p><b>Priority score</b> = kilograms loaded × priority level.</p>
              <p>{hasIndivisibleItems ? `The algorithm compares every combination of the ${supplies.filter((item) => item.divisible === false).length} indivisible item${supplies.filter((item) => item.divisible === false).length === 1 ? '' : 's'} and fills remaining capacity with divisible supplies by priority.` : 'All items are divisible, so the algorithm loads them in priority order and can split a supply when capacity runs out.'}</p>
              <div className="knapsack-priority-legend"><span>1 · LOW</span><span>2 · MEDIUM</span><span>3 · HIGH</span><span>4 · CRITICAL</span></div>
            </section>
          )}
        </aside>
      </div>

      <footer className="sim-controls knapsack-sim-controls">
        <div className="sim-control-left"><button className="sim-home-taskbar" onClick={onHome} title="Go to home"><Home size={13} /><span>Home</span></button><button className="sim-back-editor" onClick={onBack}><ArrowLeft size={14} /> Cargo setup</button><span className="control-separator" /><span className="control-step-label">STEP <b>{cursor + 1}</b> OF {events.length}</span></div>
        <div className="sim-control-buttons">
          <button className={`sim-button play-button ${playing ? 'is-playing' : ''}`} onClick={playPause} aria-label={playing ? 'Pause simulation' : 'Play simulation'}>{playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}{playing ? 'Pause' : 'Play'}</button>
          <button className="sim-button" onClick={restart} aria-label="Restart simulation" title="Restart from the first step"><RotateCcw size={14} />Restart</button>
          <button className="sim-button" onClick={() => moveStep(-1)} disabled={cursor <= 0}><ArrowLeft size={14} />Previous step</button>
          <button className="sim-button" onClick={() => moveStep(1)} disabled={cursor >= events.length - 1}><SkipForward size={14} />Next step</button>
        </div>
        <div className="sim-control-right"><div className="view-switch" role="group" aria-label="Simulation view"><button className={viewMode === '2d' ? 'active' : ''} onClick={() => setViewMode('2d')} title="Switch to 2D cargo simulation">2D view</button><button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')} title="Switch to 3D cargo simulation">3D view</button></div><label><span>Speed</span><input type="range" min="250" max="1600" step="150" value={1800 - speed} onChange={(event) => setSpeed(1800 - Number(event.target.value))} /><span>FAST</span></label></div>
      </footer>
    </div>
  );
}

export { KnapsackSetup, KnapsackSimulation };
