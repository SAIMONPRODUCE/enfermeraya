# Graph Report - enfermeraya  (2026-11-18)

## Corpus Check
- 63 files · ~37,409 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .webmanifest 1, .css 1)

## Summary
- 282 nodes · 858 edges · 12 communities (9 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f9a48fda`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- wompi-webhook/index.ts
- Product
- package.json
- ui.tsx
- App.tsx
- Withdraw.tsx
- compilerOptions
- vite-env.d.ts
- AppContext.tsx
- MapView.tsx
- react

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 35 edges
2. `Button()` - 29 edges
3. `Card()` - 22 edges
4. `react` - 21 edges
5. `money()` - 20 edges
6. `App()` - 19 edges
7. `lucide-react` - 18 edges
8. `MapView()` - 17 edges
9. `Request()` - 17 edges
10. `Avatar()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Guard()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/store/AppContext.tsx
- `App()` --calls--> `Layout()`  [EXTRACTED]
  src/App.tsx → src/components/Layout.tsx
- `App()` --calls--> `Activity()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Activity.tsx
- `App()` --calls--> `PatientHome()`  [EXTRACTED]
  src/App.tsx → src/pages/patient/Home.tsx
- `App()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/store/AppContext.tsx

## Import Cycles
- None detected.

## Communities (12 total, 3 thin omitted)

### Community 1 - "Product"
Cohesion: 0.17
Nodes (11): Accessibility & Inclusion, Brand Commitments, Capabilities and Constraints, Evidence on Hand, Operating Context, Platform, Positioning, Product (+3 more)

### Community 2 - "package.json"
Cohesion: 0.05
Nodes (35): dependencies, @fontsource-variable/inter, leaflet, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js (+27 more)

### Community 3 - "ui.tsx"
Cohesion: 0.15
Nodes (42): LocationSheet(), MapView(), Avatar(), BtnProps, Card(), ESTADO_LABEL, ESTADO_STYLE, ICONS (+34 more)

### Community 4 - "App.tsx"
Cohesion: 0.16
Nodes (30): lucide-react, react-router-dom, adminTabs, App(), Earnings, Guard(), NurseHome, nurseTabs (+22 more)

### Community 5 - "Withdraw.tsx"
Cohesion: 0.19
Nodes (20): Props, Sheet(), cuentaResumen(), CuentaSheet(), EMPTY, ESTADO_RETIRO, METODO_LABEL, RetiroPill() (+12 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

### Community 9 - "AppContext.tsx"
Cohesion: 0.07
Nodes (49): @supabase/supabase-js, CATALOGO, CENTER, uid(), ERRORES, errorMsg(), supabase, PAGOS (+41 more)

### Community 10 - "MapView.tsx"
Cohesion: 0.19
Nodes (11): leaflet, DEFAULT_CENTER, esc(), Live, MapMarker, pinOf(), Props, zoomFor() (+3 more)

### Community 11 - "react"
Cohesion: 0.15
Nodes (11): @fontsource-variable/inter, react, react-dom, ErrorBoundary, Props, State, Layout(), Tab (+3 more)

## Knowledge Gaps
- **95 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 113 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `package.json`, `ui.tsx`, `App.tsx`, `Withdraw.tsx`, `AppContext.tsx`, `MapView.tsx`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05398110661268556 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `package.json`, `ui.tsx`, `Withdraw.tsx`, `AppContext.tsx`, `react`?**
  _High betweenness centrality (0.062) - this node is a cross-community bridge._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `AppContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0655367231638418 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._