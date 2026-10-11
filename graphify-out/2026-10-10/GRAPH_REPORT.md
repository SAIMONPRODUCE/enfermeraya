# Graph Report - enfermeraya  (2026-10-10)

## Corpus Check
- 35 files · ~18,617 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .webmanifest 1, .css 1)

## Summary
- 208 nodes · 694 edges · 9 communities (7 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cf12a7e0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AppContext.tsx
- Request.tsx
- package.json
- ui.tsx
- App.tsx
- react
- compilerOptions

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 31 edges
2. `Button()` - 20 edges
3. `Card()` - 20 edges
4. `Request()` - 19 edges
5. `react` - 18 edges
6. `lucide-react` - 17 edges
7. `MapView()` - 17 edges
8. `NurseHome()` - 17 edges
9. `Tracking()` - 17 edges
10. `App()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Guard()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/store/AppContext.tsx
- `App()` --calls--> `Layout()`  [EXTRACTED]
  src/App.tsx → src/components/Layout.tsx
- `App()` --calls--> `Operations()`  [EXTRACTED]
  src/App.tsx → src/pages/admin/Admin.tsx
- `App()` --calls--> `Validations()`  [EXTRACTED]
  src/App.tsx → src/pages/admin/Admin.tsx
- `App()` --calls--> `Earnings()`  [EXTRACTED]
  src/App.tsx → src/pages/nurse/Earnings.tsx

## Import Cycles
- None detected.

## Communities (9 total, 2 thin omitted)

### Community 0 - "AppContext.tsx"
Cohesion: 0.10
Nodes (35): CENTER, nurse(), seedState(), user(), uid(), stepToward(), Actions, ActionsCtx (+27 more)

### Community 1 - "Request.tsx"
Cohesion: 0.16
Nodes (30): LocationSheet(), PRESETS, MapBackground(), MapMarker, MapView(), Pin(), Props, Streets (+22 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (30): dependencies, lucide-react, react, react-dom, react-router-dom, devDependencies, tailwindcss, @tailwindcss/vite (+22 more)

### Community 3 - "ui.tsx"
Cohesion: 0.25
Nodes (24): Avatar(), BtnProps, Card(), ESTADO_LABEL, ESTADO_STYLE, ICONS, ServiceIcon(), StatusPill() (+16 more)

### Community 4 - "App.tsx"
Cohesion: 0.20
Nodes (21): lucide-react, react-router-dom, adminTabs, App(), Guard(), nurseTabs, patientTabs, Button() (+13 more)

### Community 5 - "react"
Cohesion: 0.14
Nodes (12): react, react-dom, ErrorBoundary, Props, State, Layout(), Tab, Props (+4 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

## Knowledge Gaps
- **66 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+61 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 76 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `AppContext.tsx`, `Request.tsx`, `package.json`, `ui.tsx`, `App.tsx`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _66 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AppContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10299003322259136 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `Request.tsx`, `package.json`, `ui.tsx`, `react`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.062388591800356503 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._