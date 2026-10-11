# Graph Report - enfermeraya  (2026-10-11)

## Corpus Check
- 40 files · ~20,868 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .webmanifest 1, .css 1)

## Summary
- 218 nodes · 687 edges · 13 communities (11 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `384578b9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- sim.ts
- Request.tsx
- package.json
- Activity.tsx
- App.tsx
- LocationSheet.tsx
- compilerOptions
- vite-env.d.ts
- AppContext.tsx
- nurse/Home.tsx
- main.tsx
- ui.tsx

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

## Communities (13 total, 2 thin omitted)

### Community 0 - "sim.ts"
Cohesion: 0.12
Nodes (22): MapBackground(), MapMarker, Pin(), Props, Streets, CENTER, haversine(), KM_PER_DEG_LAT (+14 more)

### Community 1 - "Request.tsx"
Cohesion: 0.29
Nodes (16): LocationSheet(), MapView(), Confetti(), Stars(), SuccessMark(), CATALOGO, etaMinutes(), formatKm() (+8 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (31): dependencies, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js, devDependencies, tailwindcss (+23 more)

### Community 3 - "Activity.tsx"
Cohesion: 0.39
Nodes (11): ServiceIcon(), StatusPill(), formatDate(), isSameDay(), money(), Operations(), DAYS, Earnings() (+3 more)

### Community 4 - "App.tsx"
Cohesion: 0.24
Nodes (16): react-router-dom, adminTabs, App(), Guard(), nurseTabs, patientTabs, Field(), inputCls (+8 more)

### Community 5 - "LocationSheet.tsx"
Cohesion: 0.27
Nodes (10): lucide-react, react, Layout(), Tab, PRESETS, Props, Sheet(), Toast() (+2 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

### Community 9 - "AppContext.tsx"
Cohesion: 0.09
Nodes (29): @supabase/supabase-js, uid(), ERRORES, errorMsg(), supabase, Actions, ActionsCtx, ACTIVOS (+21 more)

### Community 10 - "nurse/Home.tsx"
Cohesion: 0.33
Nodes (15): Avatar(), Button(), Card(), Switch(), docName(), Validations(), DocSlot(), NurseHome() (+7 more)

### Community 11 - "main.tsx"
Cohesion: 0.22
Nodes (4): react-dom, ErrorBoundary, Props, State

### Community 12 - "ui.tsx"
Cohesion: 0.33
Nodes (5): BtnProps, ESTADO_LABEL, ESTADO_STYLE, ICONS, initials()

## Knowledge Gaps
- **73 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+68 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 84 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `LocationSheet.tsx` to `sim.ts`, `Request.tsx`, `package.json`, `Activity.tsx`, `App.tsx`, `AppContext.tsx`, `nurse/Home.tsx`, `main.tsx`, `ui.tsx`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _73 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `sim.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `LocationSheet.tsx` to `sim.ts`, `Request.tsx`, `package.json`, `Activity.tsx`, `App.tsx`, `nurse/Home.tsx`, `ui.tsx`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06050420168067227 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `AppContext.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09247311827956989 - nodes in this community are weakly interconnected._