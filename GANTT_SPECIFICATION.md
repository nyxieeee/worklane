# 📊 Universal Gantt & Roadmap Specification

A comprehensive standard for designing and implementing cross-industry Gantt charts and project roadmaps in **Worklane**. This document outlines the data model, visual elements, mathematical variance formulas, and UI specifications designed to serve software engineering, construction, creative marketing, manufacturing, and general corporate operations alike.

---

## 🎯 1. Design Philosophy: Cross-Industry Neutrality

A generalized Gantt chart must avoid rigid, single-industry jargon while preserving the mathematical rigor and visual clarity required for professional project scheduling.

### The Three Golden Principles:
1. **Dual-Track Visibility**: Always contrast the **Planned Baseline** (the contractual or planned target) with the **Actual Accomplishment** (the reality of execution).
2. **Suspension & Interruption Awareness**: Distinguish between *laziness/inefficiency* and *legitimate work stoppage* (weather holds, client review delays, holiday shutdowns, supply shortages).
3. **Progressive Disclosure**: Deliver executive-level status at a glance while making granular audit details (dependencies, suspensions, daily logs) accessible on demand.

---

## 🏛️ 2. Cross-Industry Terminology Mapping

Use neutral, universal terminology across the UI and export files so all departments feel at home:

| Universal Standard (Worklane) | Software Engineering (Agile/Scrum) | Construction & Civil Engineering | Creative Marketing & Media | Manufacturing & Supply Chain |
| :--- | :--- | :--- | :--- | :--- |
| **Phase / Package** | Sprint / Epic / Milestone | Construction Phase / WBS Stage | Campaign / Production Phase | Production Batch / Stage Gate |
| **Task / Activity** | User Story / Bug / Task | Work Package / Activity Item | Deliverable / Creative Asset | Work Order / Operation |
| **Owner / Assignee** | Developer / QA Engineer | Subcontractor / Lead Foreman | Art Director / Copywriter | Line Operator / Plant Manager |
| **Target Baseline** | Story Commitment / Sprint Goal | Contract Baseline Schedule | Scope of Work (SOW) Plan | Master Production Schedule |
| **Actual / Projected Date** | Velocity Burn-down Completion | Actual Site Progress / Lookahead | Delivery Date / Launch Date | Actual Completion Date |
| **Work Suspension** | Blocker / Client Hold | Weather Delay / Permit Hold | Client Review / Feedback Pause | Downtime / Material Delay |
| **Milestone (`◆`)** | Release / Version Handover | Inspection / Permit Sign-off | Campaign Go-Live / Client Debut | Factory Acceptance Test (FAT) |

---

## 📋 3. Left Data Pane Specification (The Grid)

The left pane provides structural context and precise metrics aligned 1:1 with timeline rows.

| Column | Data Type | Default Visibility | Purpose & Formatting |
| :--- | :--- | :--- | :--- |
| **Status Checkbox** | Boolean | Always visible | Direct completion toggle (`Square` / `CheckSquare`). |
| **Milestone Indicator** | Flag (`boolean`) | Always visible | Purple diamond (`◆`) for zero-duration key deliverables. |
| **Task Title** | String | Always visible | Left-aligned, bold, clickable to open detailed card modal. |
| **Dependencies Badge** | Integer count | Desktop & Mobile | Link icon (`🔗 2`) indicating predecessor count. |
| **Owner / Assignees** | Avatar chip(s) | Desktop | Up to 2 avatar circles with initials or profile photos. |
| **Progress %** | Integer (0–100) | Desktop & Mobile | Percentage complete based on subtasks or workflow stage. |
| **Target Due Date** | Date (`MMM D`) | Desktop & Mobile | The target deadline agreed upon in planning. |
| **Actual / Projected Date**| Date (`MMM D`) | Desktop | Green if completed, red if delayed, neutral if on track. |
| **Variance Badge** | Days (`+Nd` / `-Nd`) | Desktop & Mobile | Visual pill: Green (`Ahead`), Red (`Delayed`), Slate (`On Track`). |

---

## 🎨 4. Right Timeline Canvas Specification (The Visuals)

The right pane renders an interactive, horizontal calendar grid scaled by **Days**, **Weeks**, or **Months**.

### 4.1 Dual-Track Bar Anatomy
Each task row renders up to two parallel visual tracks:

```
Row Height: 38px
┌────────────────────────────────────────────────────────────────────────┐
│  [■■■■■■■■■■■■■■■ Planned Target Baseline (Solid Emerald) ■■■■■■■■■■■■] │ ← Top Track (3.5px)
│                                                                        │
│  [█████████████░░░░░░░░░ Actual / Projected (Orange / Slate) ░░░░░░░░░] │ ← Bottom Track (6px)
└──────────────────────────────────▲─────────────────────────────────────┘
                                   │
                           [TODAY Vertical Line]
```

1. **Top Track (Target Baseline)**:
   - Thin, sleek horizontal bar (3.5px height).
   - Solid emerald/teal or theme color.
   - Represents contractual start to target due date.
2. **Bottom Track (Actual & Accomplished Progress)**:
   - Prominent bar (6px height, rounded corners).
   - Filled with vivid orange/amber showing elapsed work.
   - **Present-Day Cap Rule**: For active (in-progress) tasks, the orange accomplishment fill **MUST NOT exceed the TODAY vertical line**. Work that has not happened yet cannot be shown as "accomplished".
   - **Projected Extension**: The remaining duration from Today to Projected Completion renders in a muted translucent track.

### 4.2 The "Today" Marker Line
- A vertical accented dashed or solid line with a top badge labeled `TODAY`.
- Extends through the entire vertical height of the timeline canvas.
- Provides immediate visual orientation of whether tasks are lagging behind today's date.

### 4.3 Work Suspension Bands
- Visual segments on the timeline showing dates where work was officially paused.
- Rendered with diagonal hazard stripes (`repeating-linear-gradient`) or dimmed amber tone.
- On hover, displays tooltip: `Paused: [From] to [To] — Reason: [Reason]`.

### 4.4 Milestone Markers (`◆`)
- Rotated 45° diamond element placed precisely on the target completion day.
- Highlighted with a subtle glow or gradient.
- Does not have a start/end duration bar (zero duration).

---

## 📐 5. Mathematical Formulas & Variance Engine

Accurate variance tracking prevents false alarms when work was paused for legitimate, approved reasons.

### 5.1 Calendar Days vs. Working Days
$$\text{Calendar Duration} = (\text{End Date} - \text{Start Date}) + 1$$

### 5.2 Suspended Days Computation
For any task with suspensions $S = \{s_1, s_2, \dots, s_n\}$ intersecting an evaluation window $[W_{\text{start}}, W_{\text{end}}]$:

$$\text{Suspended Days} = \sum_{s \in S} \max\left(0, \min(W_{\text{end}}, s.\text{to}) - \max(W_{\text{start}}, s.\text{from}) + 1\right)$$

*Overlapping or duplicate suspension intervals are normalized to avoid double-counting.*

### 5.3 Schedule Variance ($\text{SV}$) Formula
$$\text{Net Elapsed Duration} = \text{Gross Elapsed Days} - \text{Suspended Days}$$

$$\text{Variance (Days)} = \text{Actual / Projected End Date} - \text{Target Due Date} - \text{Suspended Days}$$

### 5.4 Variance Classification Rules
- **$\text{Variance} < 0$**: **Ahead of Schedule** (or *Completed Early* if done) &rarr; `Green` badge (`-Xd`).
- **$\text{Variance} = 0$**: **On Track** (or *Completed On Time* if done) &rarr; `Slate/Neutral` badge (`On Track`).
- **$\text{Variance} > 0$**: **Delayed / Behind Schedule** (or *Completed Late* if done) &rarr; `Red` badge (`+Xd`).

---

## 🗄️ 6. TypeScript Data Models

The universal schema implemented in Worklane:

```typescript
/** A contiguous period when work was paused */
export interface WorkSuspension {
  id?: string;
  from: string;       // ISO date: YYYY-MM-DD
  to: string;         // ISO date: YYYY-MM-DD
  reason?: string;    // e.g. "Weather hold", "Client review", "Material delay"
  approvedBy?: string;// Optional approver ID/name
}

export interface GanttTask {
  id: string;
  title: string;
  phaseId?: string;               // Group / Phase / Sprint ID
  assigneeIds: string[];
  
  // Baseline Schedule
  targetStartDate: string;        // YYYY-MM-DD
  targetDueDate: string;          // YYYY-MM-DD
  
  // Actual Progress
  actualStartDate?: string | null;// YYYY-MM-DD
  actualEndDate?: string | null;  // YYYY-MM-DD (set when complete)
  progress: number;               // 0 to 100 percentage
  completed: boolean;
  completedAt?: string | null;

  // Interruption Tracking
  workSuspensions?: WorkSuspension[];

  // Relationships & Milestones
  isMilestone?: boolean;          // Zero-duration deliverable
  dependencies?: string[];        // Prerequisite task IDs
}
```

---

## 📤 7. Microsoft Excel & CSV Export Schema

When exporting data for stakeholders, clients, or audits, include UTF-8 Byte Order Mark (`\uFEFF`) to ensure Excel preserves date formatting and special characters.

### Standard Export Columns:
1. `Title`: Task or deliverable name
2. `Group / Column`: Phase, stage, or workflow column
3. `Phase / Package`: Sprint or high-level milestone package
4. `Assignee`: Comma-separated member names
5. `Actual Start Date`: Formatted `YYYY-MM-DD`
6. `Target Start Date`: Formatted `YYYY-MM-DD`
7. `Target Due Date`: Formatted `YYYY-MM-DD`
8. `Actual / Projected Date`: Effective completion date
9. `Progress %`: Value from 0 to 100
10. `Variance (Days)`: Signed integer (`+3`, `-1`, `0`)
11. `Variance Status`: `Ahead of Schedule`, `On Track`, `Delayed`, `Completed Early`, `Completed Late`
12. `Status`: `In Progress`, `Overdue`, `Completed`
13. `Milestone`: `Yes` or `No`
14. `Work Suspensions`: Semicolon-delimited summary (e.g. `2026-10-01 to 2026-10-04 (Client hold)`)

---

## 📱 8. Responsive & Mobile Viewport Guidelines

On smartphones and narrow tablets:
1. **Sticky Task Labels**: A floating title pill on the left of each Gantt bar so users never lose track of which row they are viewing while scrolling horizontally.
2. **Compact Metric Stack**: On mobile, collapse Progress %, Target Date, and Variance into a tidy 2-line right-aligned stack:
   ```
   [100%] [Sep 28]
   [Done] [+2d]
   ```
3. **Modal Dialog Safety**: Never dismiss input dialogs or phase creators on backdrop tap without user confirmation. Modal closing must be triggered explicitly via `Cancel` or `✕`.
4. **Stacked Input Rows**: Suspension date pickers (`From`, `To`) and text inputs (`Reason`) must stack vertically to prevent horizontal cropping on screens narrower than 480px.

---

## 🔮 9. Future Recommended Enhancements

- [ ] **Interactive Dependency Links**: Canvas SVG bezier curves connecting dependent bars with collision-avoidance paths.
- [ ] **Zoom Granularity Selector**: Instant toggle between `Days`, `Weeks`, `Months`, and `Quarters`.
- [ ] **Critical Path Highlighting**: Automatically calculate and highlight in red the sequence of dependent tasks that directly impacts the project finish date.
- [ ] **Daily Work Log Toggle**: Option to automatically advance in-progress bars only on days confirmed via check-in or board activity.
