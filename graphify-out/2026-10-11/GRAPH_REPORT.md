# Graph Report - enfermeraya  (2026-10-11)

## Corpus Check
- 44 files · ~22,542 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .webmanifest 1, .css 1)

## Summary
- 226 nodes · 696 edges · 10 communities (7 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `47728c10`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- wompi-webhook/index.ts
- Request.tsx
- package.json
- App.tsx
- ui.tsx
- react
- compilerOptions
- vite-env.d.ts
- AppContext.tsx

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 30 edges
2. `Button()` - 21 edges
3. `Card()` - 20 edges
4. `react` - 18 edges
5. `Request()` - 18 edges
6. `lucide-react` - 17 edges
7. `MapView()` - 17 edges
8. `NurseHome()` - 17 edges
9. `Tracking()` - 17 edges
10. `App()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `Layout()`  [EXTRACTED]
  src/App.tsx → src/components/Layout.tsx
- `App()` --calls--> `Login()`  [EXTRACTED]
  src/App.tsx → src/pages/Login.tsx
- `App()` --calls--> `Tracking()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Tracking.tsx
- `App()` --calls--> `Register()`  [EXTRACTED]
  src/App.tsx → src/pages/Register.tsx
- `Layout()` --calls--> `useApp()`  [EXTRACTED]
  src/components/Layout.tsx → src/store/AppContext.tsx

## Import Cycles
- None detected.

## Communities (10 total, 3 thin omitted)

### Community 1 - "Request.tsx"
Cohesion: 0.14
Nodes (30): lucide-react, LocationSheet(), PRESETS, MapBackground(), MapMarker, MapView(), Pin(), Props (+22 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (32): dependencies, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js, devDependencies, tailwindcss (+24 more)

### Community 3 - "App.tsx"
Cohesion: 0.21
Nodes (31): adminTabs, App(), Guard(), nurseTabs, patientTabs, Avatar(), Card(), ServiceIcon() (+23 more)

### Community 4 - "ui.tsx"
Cohesion: 0.22
Nodes (16): react-router-dom, BtnProps, Button(), ESTADO_LABEL, ESTADO_STYLE, Field(), ICONS, inputCls (+8 more)

### Community 5 - "react"
Cohesion: 0.14
Nodes (12): react, react-dom, ErrorBoundary, Props, State, Layout(), Tab, Props (+4 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

### Community 9 - "AppContext.tsx"
Cohesion: 0.08
Nodes (38): CATALOGO, CENTER, uid(), errorMsg(), Actions, ActionsCtx, ACTIVOS, AppProvider() (+30 more)

## Knowledge Gaps
- **75 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+70 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 89 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `Request.tsx`, `package.json`, `App.tsx`, `ui.tsx`, `AppContext.tsx`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _75 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Request.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `Request.tsx` to `package.json`, `App.tsx`, `ui.tsx`, `react`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05873015873015873 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._