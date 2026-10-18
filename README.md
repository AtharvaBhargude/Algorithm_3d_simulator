# Disaster Relief Logistics

A small React + Vite learning app for building an undirected weighted graph and watching the real Dijkstra shortest-path algorithm solve it. The graph editor is the source of truth: its node locations, road connections and weights are used in both the calculation and generated 3D city.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. To build the production app, run `npm run build`. To run the algorithm tests, run `npm test`.

## Use the Dijkstra simulation

1. Choose **Start Dijkstra Simulation** on the home screen.
2. Choose **Add node**, then click the white canvas to create locations. Choose **Connect nodes** and select two locations to create a two-way road.
3. Select a road or its weight label to edit its non-negative travel weight. Drag nodes to rearrange the graph.
4. Assign a relief-center start and an affected-village destination. Select a location first to use the quick assignment buttons.
5. Choose **Generate 3D Simulation**. The city is built from the graph you entered: each building is centered on its graph location, road ends stop at the buildings, and each 3D road displays its travel weight.
6. Use **Next step** or **Previous step** to inspect each real Dijkstra event. The single **Play/Pause** control runs or pauses the sequence; **Restart** is always available to return to the first step. The distance table stays above the step guide; the plain-language explanation and worked distance calculation appear in the large caption over the map.
7. Choose **2D view** or **3D view** in the bottom controls to switch between the graph and its generated city. The 2D graph opens at 100%; use a trackpad pinch gesture or two-finger touch pinch to zoom out to 50% or in to 250%, centered on the pointer/fingers. Ordinary scrolling still pans the canvas to reveal obscured nodes. Use **Home** to return to the landing page.
8. Use **Simulation Mode** for the current concise controls and live status, or **Learning Mode** to show every generated Dijkstra event in order in the right panel. Select any event to inspect that exact step on the map; the bottom simulation controls remain available in either mode.
9. Use the panel-toggle button beside the Dijkstra heading to hide the right panel and expand the map; use the floating **Show algorithm panel** button to restore it.
10. The algorithm panel and map smoothly collapse and expand together. In 3D mode, the renderer and camera resize continuously with the map. The home and graph-editor headers stay pinned to the top while scrolling.
11. Map guidance is hidden by default. Click the fixed truck button to show the map title, legend, and camera/2D-view hints for two seconds. In 2D mode, the graph keeps its normal size; scroll below it through a blank area to reveal nodes that sit behind the step caption.

The 3D city uses the models in `public/models/`: the relief center uses the corner store, ordinary locations use a deterministic mix of the apartment block, corner store, farm stand, and porch house, and the affected village uses a ruined house or refuge hut. The family sedan model represents the relief vehicle. Models are loaded through Three.js's shared GLTF cache and their fitted bounds are calculated once per source model. Rendering is on-demand while idle, with device-adaptive pixel ratio, antialiasing, and shadow-map settings; resize and truck animation frames are explicitly scheduled. Keep these GLB files in place when running or building the app.

The editor starts with an empty graph. Dijkstra supports disconnected graphs, zero-weight roads, equal-cost routes, and a single node selected as both start and destination. Road weights must be finite and non-negative; duplicate undirected roads are rejected. Knapsack runs as a separate cargo-planning simulation and does not affect graph editing or routing.

## Use the Knapsack simulation

1. Choose **Start Knapsack Simulation** on the home screen.
2. Set the container capacity in kilograms. For grains, water, medicines, and clothes, set the available kilograms and a priority from **Low** to **Critical**.
3. For each supply independently, choose **Divisible** or **Indivisible**. The optimizer checks every combination of indivisible supplies, then fills the remaining capacity with divisible supplies in priority order. It chooses the combination with the greatest feasible priority score, so mixed loads are supported.
4. Choose **Generate simulation**. Use **Play**, **Next step**, **Previous step**, and **Restart** to control the walkthrough. **Learning Mode** lists every algorithm event and lets you jump to a step.
5. Switch between **2D view** and **3D view** in the bottom controls. The 3D view uses the supply models in `public/models/`; partial grain loads use the divided sack, while partial water loads use the bottle. Drag to rotate the container, scroll to zoom, or right-drag to pan.

The priority score is the kilograms loaded multiplied by the supply's priority level (1–4), summed across the load. For `m` indivisible supplies and `n` total supplies, the mixed optimizer checks **2^m** indivisible combinations and optimizes the divisible supplies for each one (**O(2^m · n log n)**).

## Algorithm complexity

The reusable min-heap implementation uses Dijkstra's algorithm with complexity **O((V + E) log V)**, where `V` is the number of locations and `E` is the number of roads.
