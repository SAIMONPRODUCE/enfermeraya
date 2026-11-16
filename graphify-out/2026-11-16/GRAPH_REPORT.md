# Graph Report - enfermeraya  (2026-10-11)

## Corpus Check
- 58 files · ~31,632 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .webmanifest 1, .css 1)

## Summary
- 245 nodes · 741 edges · 11 communities (8 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eddd5374`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- wompi-webhook/index.ts
- Request.tsx
- package.json
- nurse/Home.tsx
- App.tsx
- useApp
- compilerOptions
- vite-env.d.ts
- AppContext.tsx
- MapView.tsx

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 30 edges
2. `Button()` - 24 edges
3. `react` - 20 edges
4. `Card()` - 20 edges
5. `App()` - 18 edges
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
- `App()` --calls--> `useApp()`  [EXTRACTED]
  src/App.tsx → src/store/AppContext.tsx

## Import Cycles
- None detected.

## Communities (11 total, 3 thin omitted)

### Community 1 - "Request.tsx"
Cohesion: 0.18
Nodes (17): Request, BtnProps, Confetti(), ESTADO_LABEL, ESTADO_STYLE, ICONS, Stars(), SuccessMark() (+9 more)

### Community 2 - "package.json"
Cohesion: 0.05
Nodes (35): dependencies, leaflet, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js, devDependencies (+27 more)

### Community 3 - "nurse/Home.tsx"
Cohesion: 0.16
Nodes (34): Avatar(), Card(), ServiceIcon(), StatusPill(), CATALOGO, docName(), formatDate(), isSameDay() (+26 more)

### Community 4 - "App.tsx"
Cohesion: 0.18
Nodes (27): lucide-react, react-router-dom, adminTabs, App(), Earnings, Guard(), NurseHome, nurseTabs (+19 more)

### Community 5 - "useApp"
Cohesion: 0.15
Nodes (14): react, ErrorBoundary, Props, State, Layout(), Tab, LocationSheet(), PRESETS (+6 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

### Community 9 - "AppContext.tsx"
Cohesion: 0.08
Nodes (36): @supabase/supabase-js, CENTER, uid(), ERRORES, errorMsg(), supabase, Actions, ActionsCtx (+28 more)

### Community 10 - "MapView.tsx"
Cohesion: 0.22
Nodes (11): leaflet, DEFAULT_CENTER, esc(), Live, MapMarker, MapView(), pinOf(), Props (+3 more)

## Knowledge Gaps
- **81 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+76 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 98 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `useApp` to `Request.tsx`, `package.json`, `nurse/Home.tsx`, `App.tsx`, `AppContext.tsx`, `MapView.tsx`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _81 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05398110661268556 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `App.tsx` to `Request.tsx`, `package.json`, `nurse/Home.tsx`, `useApp`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `useApp` be split into smaller, more focused modules?**
  _Cohesion score 0.14855072463768115 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `AppContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07676767676767676 - nodes in this community are weakly interconnected._