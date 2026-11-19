# Graph Report - enfermeraya  (2026-11-18)

## Corpus Check
- 66 files · ~40,715 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .webmanifest 1, .css 1)

## Summary
- 288 nodes · 908 edges · 17 communities (14 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47f1f03a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- wompi-webhook/index.ts
- Product
- package.json
- Request.tsx
- ui.tsx
- useApp
- compilerOptions
- vite-env.d.ts
- AppContext.tsx
- MapView.tsx
- main.tsx
- App.tsx
- devDependencies
- dependencies
- vite
- scripts

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 38 edges
2. `Button()` - 31 edges
3. `Card()` - 24 edges
4. `money()` - 23 edges
5. `react` - 22 edges
6. `Request()` - 20 edges
7. `lucide-react` - 19 edges
8. `App()` - 19 edges
9. `MapView()` - 17 edges
10. `Field()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Guard()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/store/AppContext.tsx
- `App()` --calls--> `Login()`  [EXTRACTED]
  src/App.tsx → src/pages/Login.tsx
- `App()` --calls--> `Activity()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Activity.tsx
- `App()` --calls--> `PatientHome()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Home.tsx
- `App()` --calls--> `Profile()`  [EXTRACTED]
  src/App.tsx → src/pages/Profile.tsx

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 1 - "Product"
Cohesion: 0.17
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 2 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, type, version, tailwindcss, @types/leaflet, @types/react, @types/react-dom (+1 more)

### Community 3 - "Request.tsx"
Cohesion: 0.13
Nodes (35): Request, LocationSheet(), PRESETS, MapView(), Props, Sheet(), ESTADO_LABEL, Stars() (+27 more)

### Community 4 - "ui.tsx"
Cohesion: 0.23
Nodes (21): lucide-react, react, react-router-dom, TarifaSheet(), BtnProps, Button(), ESTADO_STYLE, Field() (+13 more)

### Community 5 - "useApp"
Cohesion: 0.17
Nodes (35): TarifasProfesional(), Avatar(), Card(), ServiceIcon(), ServiceTile(), StatusPill(), Switch(), cuentaResumen() (+27 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

### Community 9 - "AppContext.tsx"
Cohesion: 0.07
Nodes (45): @supabase/supabase-js, EMPTY, ESTADO_RETIRO, RETIRO_CADA_DIAS, RETIRO_MINIMO, uid(), ERRORES, errorMsg() (+37 more)

### Community 10 - "MapView.tsx"
Cohesion: 0.21
Nodes (10): leaflet, DEFAULT_CENTER, esc(), Live, MapMarker, pinOf(), Props, zoomFor() (+2 more)

### Community 11 - "main.tsx"
Cohesion: 0.20
Nodes (5): @fontsource-variable/inter, react-dom, ErrorBoundary, Props, State

### Community 12 - "App.tsx"
Cohesion: 0.18
Nodes (17): adminTabs, App(), Earnings, Guard(), NurseHome, nurseTabs, Operations, patientTabs (+9 more)

### Community 13 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, tailwindcss, @tailwindcss/vite, @types/leaflet, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 14 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @fontsource-variable/inter, leaflet, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js

### Community 15 - "vite"
Cohesion: 0.29
Nodes (4): @tailwindcss/vite, vite, @vitejs/plugin-react, root

### Community 16 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, test

## Knowledge Gaps
- **95 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 113 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `ui.tsx` to `package.json`, `Request.tsx`, `useApp`, `AppContext.tsx`, `MapView.tsx`, `main.tsx`, `App.tsx`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Request.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12624584717607973 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `ui.tsx` to `package.json`, `Request.tsx`, `useApp`, `AppContext.tsx`, `App.tsx`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `AppContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06708595387840671 - nodes in this community are weakly interconnected._