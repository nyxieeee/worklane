# 📘 Worklane Roadmap & Gantt Chart: Official User Manual

Welcome to the **Worklane Roadmap & Gantt Timeline** user manual. This guide provides comprehensive, step-by-step instructions on how to create project roadmaps, import delivery schedules from external documents, plan phases and milestones, track dual-track execution, log work suspensions, monitor live schedule variance, and export reports for stakeholders.

---

## 📑 Table of Contents
1. [Accessing & Creating Roadmaps](#1-accessing--creating-roadmaps)
2. [Document Import & AI Parsing (.pdf, .docx, .md, .txt, .csv)](#2-document-import--ai-parsing)
3. [Interface Overview: Synchronized Dual-Pane Layout](#3-interface-overview-synchronized-dual-pane-layout)
4. [Managing Phases, Packages & Milestones](#4-managing-phases-packages--milestones)
5. [Scheduling Tasks, Dependencies & Setting Baselines](#5-scheduling-tasks-dependencies--setting-baselines)
6. [Tracking Actual Progress & Accomplishments](#6-tracking-actual-progress--accomplishments)
7. [Automated & Manual Work Suspensions](#7-automated--manual-work-suspensions)
8. [Understanding Schedule Variance & Health Metrics](#8-understanding-schedule-variance--health-metrics)
9. [Filtering, Grouping & Time Scale Controls](#9-filtering-grouping--time-scale-controls)
10. [Exporting Roadmap Data to Microsoft Excel / CSV](#10-exporting-roadmap-data-to-microsoft-excel--csv)
11. [Cross-Board Roadmap Linking](#11-cross-board-roadmap-linking)
12. [Mobile & Touch Device Experience](#12-mobile--touch-device-experience)

---

## 🚀 1. Accessing & Creating Roadmaps

Worklane supports both **Dedicated Project Roadmaps** (standalone strategic delivery plans) and **Board Roadmap Views** (timeline view of any Kanban board).

### Accessing Roadmaps:
- **Dedicated Project Roadmaps**: In the left sidebar, expand the **Roadmaps** section to view and switch between your standalone roadmaps.
- **Board Roadmap View**: In any active task board, click **Roadmap** in the topbar view selector pill (located between **Board** and **Calendar**).
- **Mobile Navigation**: Tap **Roadmap** in the top navigation tab bar or open the mobile drawer.

### Creating a New Project Roadmap:
1. Click the **`+`** button next to **Roadmaps** in the left sidebar, or click **`+ New Roadmap`** on the executive Dashboard.
2. In the **Create Project Roadmap** modal:
   - **Roadmap Name**: Enter a descriptive project title (e.g., *Q3 Infrastructure Overhaul*, *Mobile App v2.0*).
   - **Description**: Add the scope, high-level objectives, or target milestones.
   - **Color Theme**: Select an accent theme to visually identify the roadmap in the sidebar and header.
3. You can either build phases manually or use **Document Import** to auto-generate phases (see Section 2).
4. Click **Create Roadmap**.

---

## 📄 2. Document Import & AI Parsing

Worklane includes built-in document parsing that converts project scope documents, meeting notes, specifications, or spreadsheets directly into phases and subtasks.

### Supported File Formats:
- **Markdown (`.md`)** & **Plain Text (`.txt`)**
- **Spreadsheets (`.csv`)**
- **Microsoft Word (`.docx`, `.doc`)**
- **PDF Documents (`.pdf`)**

### How to Import:
1. In the **Create Project Roadmap** modal, click **`Upload Project Document`** or drag and drop your file into the upload zone.
2. Worklane automatically extracts headings as **Phases** and bullet items/indented lines as **Subtasks**.
3. Review the parsed item hierarchy in the live preview list:
   - Toggle item types between **Phase** and **Subtask** using the dropdown selector.
   - Add additional phases or subtasks with the input field.
   - Remove unwanted items with the trash icon.
4. Click **Create Roadmap** to instantiate the roadmap with all parsed deliverables pre-populated.

---

## 🖥️ 3. Interface Overview: Synchronized Dual-Pane Layout

The Roadmap interface features a two-pane layout with synchronized vertical scrolling:

```
┌──────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ LEFT PANE: Tabular Deliverables (WBS)        │ RIGHT PANE: Interactive Gantt Canvas                  │
├──────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ [✓] Deliverable Name   Done    Due     Status│   Mon 14     Tue 15     Wed 16     Thu 17   │ TODAY   │
│  ☐  System Migration    45%   Sep 20   2d late│  [■■■ Planned Goal ■■■]                     │    │    │
│                                              │  [████ Work Done ░░░░░]                     │    │    │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┴────▲────┘
                                                                                                    │
                                                                                            Today Guideline
```

### 1. Left Pane: Work Breakdown Structure (Table)
- **Status Toggle (`☐` / `☑`)**: Mark deliverables completed directly from the table without opening modals.
- **Milestone Indicator (`◆`)**: Displays a purple diamond for zero-duration deliverables and major checkpoints.
- **Deliverable Title**: Click any title to open the full task editor modal.
- **Assignee Avatars**: Displays assigned team members with custom role borders.
- **Progress Bar (% Done)**: Real-time completion percentage (derived from checklists or slider).
- **Due Date**: Baseline contractual target deadline.
- **Schedule Health Badge**: Plain-language status (e.g., `On schedule`, `3d late`, `2d ahead`).

### 2. Right Pane: Visual Timeline Canvas
- **Calendar Headers**: Divided into Days, Weeks, or Months with weekend highlights.
- **Today Guideline**: A distinct vertical line marking the current calendar day.
- **Dual-Track Gantt Bars**: Contrasts planned targets against real-world progress.
- **Explainer Guide (`(?) How it works`)**: Interactive legend in the toolbar for instant visual reference.

---

## 🚩 4. Managing Phases, Packages & Milestones

Phases organize deliverables into sequential stages, sprints, or work packages.

### Adding a Phase:
1. In the Roadmap toolbar, click the **`+ Phase`** button.
2. In the **Create Project Phase** dialog:
   - **Phase / Package Name**: Title (e.g., *Phase 1: Architecture*, *Sprint 12*).
   - **Scope & Objectives**: Summary of key deliverables.
   - **Start Date & End Date**: Target boundary dates.
   - **Color Theme**: Select an accent color for the phase header.
3. Click **Create Phase**.

> **Note**: The phase creation modal is protected against accidental dismissal. Click **Cancel** or **✕** to exit.

### Adding Deliverables Directly to a Phase:
- Click the **`+ Add Task`** button inside any phase section to create a deliverable under that phase.

### Configuring Milestones:
1. Open the task in the **Card Modal**.
2. In the **Schedule** section, check the **Milestone** box.
3. Milestones render as vibrant purple diamonds (`◆`) at the target date rather than a duration bar.

---

## 📅 5. Scheduling Tasks, Dependencies & Setting Baselines

To maintain an accurate schedule baseline and track blockers:

### 1. Baseline Target Dates:
- **Scheduled Start**: Target date work is slated to begin.
- **Scheduled End (Due Date)**: Contractual deadline.
- When set, a solid **green baseline bar** renders on the top track of the Gantt canvas.

### 2. Actual Execution Dates:
- **Actual Start**: When work physically commenced. Shows variance indicators (e.g., `2d early` or `1d late`).
- **Actual End**: Date work was completed (or projected completion if ongoing). Shows `On Target`, `+Xd Delay`, or `Xd Early`.

### 3. Progress Tracking (% Done):
- **Checklist-Derived**: When checklist items exist, progress automatically calculates as:
  $$\text{Progress} = \left(\frac{\text{Completed Items}}{\text{Total Items}}\right) \times 100\%$$
- **Manual Progress**: Adjust the progress slider from 0% to 100% when no checklist is present.

### 4. Task Dependencies (Blockers):
- Open the card and navigate to **Dependencies**.
- Select prerequisite cards that must be completed before this deliverable can proceed.
- Dependency relationships display in the task inspector and export reports.

---

## ⏱️ 6. Tracking Actual Progress & Accomplishments

Worklane's **Dual-Track Engine** provides clear separation between agreed baselines and real-world execution.

### The Dual Bars Explained:
- **Top Track (Green Bar)**: **Planned Goal**. Represents the original baseline commitment and does not shift unless targets are renegotiated.
- **Bottom Track (Orange Bar)**: **Work Done**. Reflects actual elapsed working days and physical accomplishment.

### The Automated Work Tracking & Line Advancement Rule:
The orange accomplishment bar **advances only on confirmed working days**:
1. **No Activity on Current Day**: The orange bar remains held at the date of the last recorded activity, displaying a `Paused` tag.
2. **Manual Check-In**: Open the card and click **`Mark Worked Today`**. The button turns green (**`✓ Worked Today`**) and the orange bar immediately advances to today.
3. **Automatic Activity Detection**: Adding comments, attaching files, or updating task details automatically records today as a worked day without manual check-in.
4. **Historical Days Management**: Review or remove recorded worked dates in the card schedule inspector.

---

## ⏸️ 7. Automated & Manual Work Suspensions

Worklane separates delays caused by inefficiency from legitimate project pauses (e.g., client review holds, vendor delays, weather halts, holiday shutdowns).

### 1. Automated Inactive Day Detection:
- Days between task start and today with **no logged work and no activity** are treated as inactive pauses.
- These days are excluded from active elapsed working time, preventing false variance penalties.

### 2. Manual Multi-Day Suspensions:
For formal, documented stoppages:
1. Open the task in the **Card Modal**.
2. Scroll to the **Work Suspensions** section.
3. Click **`+ Add Pause`**.
4. Set the **From** and **To** dates, and enter a reason (e.g., *Waiting for Client Sign-off*, *Permit Approval Delay*).
5. Click save.

### Impact on Schedule:
- The engine calculates total approved suspension days and nets them against calendar elapsed duration:
  $$\text{Net Elapsed Work} = \text{Calendar Days} - \text{Total Suspended Days}$$

---

## 📊 8. Understanding Schedule Variance & Health Metrics

Worklane automatically computes **Schedule Variance ($\text{SV}$)** in real time:

$$\text{Schedule Variance (Days)} = (\text{Actual / Projected End} - \text{Target Due Date}) - \text{Approved Suspended Days}$$

### Health Badges on Timeline:

| Badge | Meaning | Operational Status |
| :---: | :--- | :--- |
| <span style="color:#10b981; font-weight:bold;">2d ahead</span> | Accomplishment is trending faster than the target schedule baseline. | Ahead of schedule. Excellent performance. |
| <span style="color:#3b82f6; font-weight:bold;">On schedule</span> | Deliverable is progressing strictly on target with the baseline plan. | On track. No corrective intervention required. |
| <span style="color:#ef4444; font-weight:bold;">3d late</span> | Deliverable is lagging behind schedule after deducting approved pauses. | Action required: adjust resources or scope. |
| <span style="color:#f59e0b; font-weight:bold;">Paused</span> | Work is temporarily suspended; orange accomplishment line is held. | Monitor blockers to resume execution. |

---

## 🔍 9. Filtering, Grouping & Time Scale Controls

Customize the timeline layout to suit different stakeholder needs:

### 1. Grouping Modes
Use the **Group:** selector in the toolbar:
- **Sprint / Phase**: Organizes deliverables into collapsible phase containers.
- **Workflow Column**: Groups deliverables by operational status (*To Do*, *In Progress*, *Review*, *Done*).
- **Assignee**: Groups deliverables by team member to audit workload distribution.
- **Label / None**: Flat unified list categorized by custom tags.

### 2. Status Filters
Filter timeline deliverables with quick-toggle buttons:
- **All**: Displays all deliverables.
- **Active**: Shows ongoing and uncompleted items.
- **Completed**: Filters for finished milestones and deliverables.
- **Overdue**: Highlights items whose due dates have breached without completion.

### 3. Time Scale Granularity
- **Days**: Granular day-by-day execution tracking.
- **Weeks**: Mid-range sprint and multi-week overviews.
- **Months**: High-level quarterly and annual executive roadmaps.

### 4. Canvas Navigation
- **Today**: Instantly centers the timeline canvas on today's guideline.
- **`‹` / `›` Step Arrows**: Shifts the visible timeline window backward or forward.
- **Horizontal Pan**: Click and drag across the canvas to pan smoothly across time.
- **Plan vs Actual Toggle**: Switch between the dual-track view and a single-track view.

---

## 📥 10. Exporting Roadmap Data to Microsoft Excel / CSV

Generate stakeholder-ready spreadsheet Gantt charts and offline reports with one click:

1. Click the **`Export Gantt CSV`** button in the top-right toolbar.
2. Worklane generates a `.csv` file with a **UTF-8 Byte Order Mark (`\uFEFF`)** ensuring symbols, accents, and dates render correctly in **Microsoft Excel**, **Google Sheets**, and **Apple Numbers**.

### Exported Data Columns:

#### Left Pane Metadata:
- **Task Name**: Deliverable title (with `↳ Work Done` sub-row indicator in Dual mode).
- **Phase / Group & Sprint**: Phase name and sprint identifier.
- **Assignee**: Team member names.
- **Track**: `Planned Goal` or `Work Done`.
- **Start Date & Due Date**: Baseline commitment dates.
- **Actual / Projected End**: Confirmed or forecasted completion date.
- **Done %**: Progress percentage (0–100%).
- **Schedule Health**: Status string (`On schedule`, `3d late`, `2d ahead`).
- **Status**: Board column status (`In Progress`, `Completed`, `Overdue`).
- **Milestone**: `Yes` or `No`.
- **Worked Days**: Total count of active working days.
- **Work Suspensions**: Itemized log of approved pauses and reasons.

#### Right Pane Calendar Grid (Day Columns):
Every day across the project schedule is rendered as a column header, with today marked as `[TODAY]`:
- **`■ Plan`**: Planned baseline duration cell.
- **`■ Done`**: Confirmed worked and completed day cell.
- **`■ Done (Late)`**: Day worked after the scheduled deadline.
- **`⏸ Paused`**: Approved work stoppage or inactive day cell.
- **`░ Delayed`**: Forecasted extension day cell.
- **`░ Projected`**: Remaining scheduled day cell.
- **`◆ Milestone`**: Zero-duration milestone checkpoint.

A complete **Timeline Legend** is automatically included at the bottom of the exported file.

---

## 🔗 11. Cross-Board Roadmap Linking

Tasks across different functional boards can be linked directly to strategic Roadmaps:
1. Open any task card on any board.
2. In the **Schedule** section, locate **Linked Project Roadmap**.
3. Select the target Roadmap from the dropdown list.
4. The deliverable is linked to the strategic roadmap, enabling unified cross-board governance.

---

## 📱 12. Mobile & Touch Device Experience

Worklane is optimized for smartphones, tablets, and touch screens:

1. **Segmented Mobile Navigation Tabs**:
   - **Deliverables**: A clean tabular checklist for quick status audits.
   - **Gantt Timeline**: Interactive horizontal timeline canvas.
2. **Sticky Task Title Pills**: When scrolling horizontally across weeks or months, task titles stay fixed on screen so context is never lost.
3. **Stacked Suspension Rows**: Date inputs and pause reasons stack vertically to prevent horizontal truncation on small viewports.
4. **Touch Interactions**: Tap any deliverable to open the complete inspection modal; swipe horizontally to pan across timeline dates.

---

*For technical specifications, variance algorithms, and mathematical definitions, see [`GANTT_SPECIFICATION.md`](GANTT_SPECIFICATION.md).*  
*For general workspace and board documentation, see [`README.md`](README.md).*
