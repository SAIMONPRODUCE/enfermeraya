# Graph Report - enfermeraya  (2026-11-16)

## Corpus Check
- 59 files · ~32,602 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .webmanifest 1, .css 1)

## Summary
- 261 nodes · 759 edges · 16 communities (13 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3fdb1067`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- wompi-webhook/index.ts
- Product
- package.json
- nurse/Home.tsx
- App.tsx
- react
- compilerOptions
- vite-env.d.ts
- AppContext.tsx
- Tracking.tsx
- main.tsx
- devDependencies
- dependencies
- vite
- scripts

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 30 edges
2. `Button()` - 24 edges
3. `react` - 20 edges
4. `App()` - 18 edges
5. `Card()` - 18 edges
6. `lucide-react` - 17 edges
7. `MapView()` - 17 edges
8. `Request()` - 17 edges
9. `Avatar()` - 16 edges
10. `money()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Guard()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/store/AppContext.tsx
- `App()` --calls--> `Layout()`  [EXTRACTED]
  src/App.tsx → src/components/Layout.tsx
- `App()` --calls--> `Activity()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Activity.tsx
- `App()` --calls--> `PatientHome()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Home.tsx
- `App()` --calls--> `Profile()`  [EXTRACTED]
  src/App.tsx → src/pages/Profile.tsx

## Import Cycles
- None detected.

## Communities (16 total, 3 thin omitted)

### Community 1 - "Product"
Cohesion: 0.17
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 2 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, type, version, tailwindcss, @types/leaflet, @types/react, @types/react-dom (+1 more)

### Community 3 - "nurse/Home.tsx"
Cohesion: 0.19
Nodes (31): Avatar(), BtnProps, Card(), ESTADO_LABEL, ESTADO_STYLE, ICONS, ServiceIcon(), ServiceTile() (+23 more)

### Community 4 - "App.tsx"
Cohesion: 0.20
Nodes (24): react-router-dom, adminTabs, App(), Earnings, Guard(), NurseHome, nurseTabs, Operations (+16 more)

### Community 5 - "react"
Cohesion: 0.27
Nodes (10): lucide-react, react, Layout(), Tab, PRESETS, Props, Sheet(), Toast() (+2 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

### Community 9 - "AppContext.tsx"
Cohesion: 0.07
Nodes (46): @supabase/supabase-js, Request, CATALOGO, CENTER, uid(), ERRORES, errorMsg(), supabase (+38 more)

### Community 10 - "Tracking.tsx"
Cohesion: 0.14
Nodes (27): leaflet, LocationSheet(), DEFAULT_CENTER, esc(), Live, MapMarker, MapView(), pinOf() (+19 more)

### Community 11 - "main.tsx"
Cohesion: 0.20
Nodes (5): @fontsource-variable/inter, react-dom, ErrorBoundary, Props, State

### Community 12 - "devDependencies"
Cohesion: 0.22
Nodes (9): devDependencies, tailwindcss, @tailwindcss/vite, @types/leaflet, @types/react, @types/react-dom, typescript, vite (+1 more)

### Community 13 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, @fontsource-variable/inter, leaflet, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js

### Community 14 - "vite"
Cohesion: 0.29
Nodes (4): @tailwindcss/vite, vite, @vitejs/plugin-react, root

### Community 15 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, test

## Knowledge Gaps
- **92 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+87 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 110 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `package.json`, `nurse/Home.tsx`, `App.tsx`, `AppContext.tsx`, `Tracking.tsx`, `main.tsx`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _92 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `react` to `package.json`, `nurse/Home.tsx`, `App.tsx`, `AppContext.tsx`, `Tracking.tsx`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `AppContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06641604010025062 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `Tracking.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14204545454545456 - nodes in this community are weakly interconnected._