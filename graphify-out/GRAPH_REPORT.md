# Graph Report - enfermeraya  (2026-11-22)

## Corpus Check
- 72 files · ~47,756 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .webmanifest 3, (none) 1, .css 1)

## Summary
- 299 nodes · 941 edges · 11 communities (8 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `de62fb73`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- wompi-webhook/index.ts
- Product
- package.json
- Request.tsx
- App.tsx
- useApp
- compilerOptions
- vite-env.d.ts
- AppContext.tsx
- react

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 39 edges
2. `Button()` - 31 edges
3. `Card()` - 24 edges
4. `money()` - 23 edges
5. `react` - 22 edges
6. `App()` - 20 edges
7. `Request()` - 20 edges
8. `lucide-react` - 19 edges
9. `MapView()` - 17 edges
10. `Avatar()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Guard()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/store/AppContext.tsx
- `OtraApp()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/store/AppContext.tsx
- `App()` --calls--> `Layout()`  [EXTRACTED]
  src/App.tsx → src/components/Layout.tsx
- `App()` --calls--> `Activity()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Activity.tsx
- `App()` --calls--> `PatientHome()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Home.tsx

## Import Cycles
- None detected.

## Communities (11 total, 3 thin omitted)

### Community 1 - "Product"
Cohesion: 0.17
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 2 - "package.json"
Cohesion: 0.05
Nodes (37): dependencies, @fontsource-variable/inter, leaflet, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js (+29 more)

### Community 3 - "Request.tsx"
Cohesion: 0.15
Nodes (31): Request, LocationSheet(), MapView(), zoomFor(), Avatar(), BtnProps, ESTADO_LABEL, ESTADO_STYLE (+23 more)

### Community 4 - "App.tsx"
Cohesion: 0.14
Nodes (34): lucide-react, react-router-dom, adminTabs, App(), Earnings, Guard(), NurseHome, nurseTabs (+26 more)

### Community 5 - "useApp"
Cohesion: 0.16
Nodes (41): Sheet(), TarifaSheet(), TarifasProfesional(), Card(), ServiceTile(), StatusPill(), Switch(), cuentaResumen() (+33 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

### Community 9 - "AppContext.tsx"
Cohesion: 0.05
Nodes (58): @supabase/supabase-js, PRESETS, DEFAULT_CENTER, esc(), Live, MapMarker, pinOf(), Props (+50 more)

### Community 11 - "react"
Cohesion: 0.13
Nodes (12): @fontsource-variable/inter, react, react-dom, ErrorBoundary, Props, State, Layout(), Tab (+4 more)

## Knowledge Gaps
- **98 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 116 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `package.json`, `Request.tsx`, `App.tsx`, `useApp`, `AppContext.tsx`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `package.json`, `Request.tsx`, `useApp`, `AppContext.tsx`, `react`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `Request.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14603174603174604 - nodes in this community are weakly interconnected._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13974358974358975 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._