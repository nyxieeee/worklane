# 📘 Worklane Roadmap & Gantt Chart: Official User Manual

Welcome to the **Worklane Roadmap & Gantt Timeline** user guide. This manual provides complete, step-by-step instructions on how to plan delivery schedules, track task execution, log work suspensions, monitor schedule variances, and export reports for stakeholders.

---

## 📑 Table of Contents
1. [Navigating to the Roadmap View](#1-navigating-to-the-roadmap-view)
2. [Interface Overview: The Dual-Pane Layout](#2-interface-overview-the-dual-pane-layout)
3. [Managing Phases & Milestones](#3-managing-phases--milestones)
4. [Scheduling Tasks & Setting Baselines](#4-scheduling-tasks--setting-baselines)
5. [Tracking Actual Progress & Accomplishments](#5-tracking-actual-progress--accomplishments)
6. [Logging Work Suspensions & Pauses](#6-logging-work-suspensions--pauses)
7. [Understanding Schedule Variance & Health](#7-understanding-schedule-variance--health)
8. [Filtering, Grouping & Time Scale Controls](#8-filtering-grouping--time-scale-controls)
9. [Exporting Roadmap Data to Microsoft Excel](#9-exporting-roadmap-data-to-microsoft-excel)
10. [Mobile & Touch Device Tips](#10-mobile--touch-device-tips)

---

## 🚀 1. Navigating to the Roadmap View

You can access the Gantt timeline from any board:

1. Look at the **Topbar Navigation** at the top of your workspace.
2. In the view selector pill, click on **Roadmap** (next to **Board** and **Calendar**).
3. On mobile devices, tap the **Roadmap** tab either in the top navigation bar or the bottom navigation drawer.

---

## 🖥️ 2. Interface Overview: The Dual-Pane Layout

The Roadmap view is organized into two synchronized panes that scroll together:

```
┌──────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
│ LEFT PANE: Tabular Deliverables Table        │ RIGHT PANE: Interactive Gantt Canvas                  │
├──────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
│ [✓] Task Name          Done    Due     Status │   Mon 14     Tue 15     Wed 16     Thu 17   │ TODAY   │
│  ☐  Foundation Layout   45%   Sep 20   2d late│  [■■■ Planned Goal ■■■]                     │    │    │
│                                              │  [████ Work Done ░░░░░]                     │    │    │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┴────▲────┘
                                                                                                   │
                                                                                           Today Guideline
```

### 1. Left Pane: Work Breakdown Structure (Table)
- **Status Toggle (`☐` / `☑`)**: Quickly mark a task complete without opening the card.
- **Milestone Diamond (`◆`)**: Indicates key checkpoint deliverables.
- **Task Name**: Click any title to open the full task editor modal.
- **Assignee Avatars**: Shows who is responsible for the task.
- **Done (%)**: Reflects current task completion percentage.
- **Due Date**: Planned contractual deadline.
- **Status**: Plain-language schedule health (e.g. **On schedule**, **3d late**, or **2d ahead**).

### 2. Right Pane: Visual Timeline Canvas
- **Calendar Headers**: Divided into Days, Weeks, or Months.
- **Today Guideline**: A blue vertical line that marks the exact current calendar day.
- **Dual-Track Gantt Bars**: Contrasts your initial plan against real-world progress.
- **10-Second Explainer Guide (`(?) How it works`)**: Click anytime in the legend bar for an instant visual summary.

---

## 🚩 3. Managing Phases & Milestones

Phases allow you to group tasks into meaningful delivery stages (e.g. Sprints, Construction Stages, Production Batches).

### Creating a New Phase:
1. In the Roadmap top header, click the **`+ Phase`** button.
2. In the **Create Project Phase** dialog:
   - **Phase / Package Name**: Enter a title (e.g., *Phase 1: Civil Works*, *Sprint 4*, *Pre-Production*).
   - **Scope & Key Objectives**: Provide a summary of deliverables for this phase.
   - **Start Date & End Date**: Set the planned time boundary.
   - **Color Theme**: Choose a color accent to visually brand the phase.
3. Click **Create Phase**.

> **Tip**: The phase creation dialog is protected against accidental dismissal. You must explicitly click **Cancel** or the top-right **✕** button to close it, preventing data loss.

### Creating a Milestone Deliverable:
1. Open any task by clicking its title.
2. Under the **Schedule** tab, check the **Milestone** checkbox.
3. Milestones automatically display as a vibrant purple diamond (`◆`) on the timeline rather than a duration bar.

---

## 📅 4. Scheduling Tasks & Setting Baselines

To establish an accurate schedule baseline:

1. Click on a task to open the **Card Modal**.
2. Switch to the **Schedule** tab.
3. Set your baseline target:
   - **Target Start Date**: The day work is scheduled to commence.
   - **Target Due Date**: The contractual deadline.
4. Set the initial **Progress %** slider (0% to 100%).

Your task will now render on the Gantt timeline with a solid **green baseline bar** (Top Track).

---

## ⏱️ 5. Tracking Actual Progress & Accomplishments

Worklane features an intelligent **Dual-Track Engine** that distinguishes between what was planned and what has actually happened.

### Understanding the Dual Bars:
- **Top Track (Green)**: The **Planned Goal**. This bar stays fixed as a reference point for your original commitment.
- **Bottom Track (Orange)**: The **Work Done**. This bar tracks the real elapsed time spent working on the deliverable.

### The Automated Work Tracking & Line Advancement Rule:
The orange accomplishment line **only moves on days confirmed as worked**:
- **If work is NOT marked for today**: The orange line **DOES NOT MOVE**. It remains held at the date of the last recorded work or activity, displaying a `Paused` tag so you know progress is temporarily on hold.
- **Option A (Manual Daily Check-in)**: Open the task modal and click **`Mark Worked Today`**. The button turns green (**`✓ Worked Today`**) and the orange bar immediately advances to today.
- **Option B (Automatic Activity Detection)**: Adding comments, uploading attachments, or updating the task automatically registers today as worked—zero manual effort needed!

---

## ⏸️ 6. Automated & Manual Work Suspensions

Worklane distinguishes between delay caused by true inefficiency versus legitimate work stoppages (weather, client review, holiday shutdowns).

### 1. Automated Work Suspensions (Zero Friction)
- Any day between your task's start date and today that has **no logged work and no activity** is **automatically treated as a paused day**.
- These unworked days are automatically excluded from the elapsed working time, ensuring schedule variance calculates true active velocity.

### 2. Manual Multi-Day Work Suspensions
For structured pauses with documented reasons (e.g. *Client hold*, *Holiday shutdown*):
1. Open the task in the **Card Modal**.
2. Navigate to the **Schedule** tab.
3. Scroll to the **Work Suspensions** section and click **`+ Add Pause`**.
4. Set the **From** and **To** dates, and enter an optional **Reason**.
5. The pause is permanently logged and reflected in reports.

### How Suspensions Affect the Schedule:
- The system sums all approved manual pauses and automated unworked days, subtracting them from calendar elapsed time.
- Your **Schedule Variance** dynamically updates in real-time.

---

## 📊 7. Understanding Schedule Variance & Health

Worklane automatically calculates your **Schedule Variance ($\text{SV}$)** using the formula:

$$\text{Variance (Days)} = \text{Actual / Projected End} - \text{Target Due Date} - \text{Approved Suspended Days}$$

### Variance Badges Explained:

| Badge | Meaning | Status Action |
| :---: | :--- | :--- |
| <span style="color:#10b981; font-weight:bold;">2d ahead</span> | The task is progressing faster than the planned baseline schedule. | Excellent performance. Ahead of schedule. |
| <span style="color:#3b82f6; font-weight:bold;">On schedule</span> | The task is progressing exactly on schedule. | On target. No corrective action needed. |
| <span style="color:#ef4444; font-weight:bold;">3d late</span> | The task is lagging behind the target deadline after netting pauses. | Needs attention or resource reallocation. |

---

## 🔍 8. Filtering, Grouping & Time Scale Controls

Customize the view to match your workflow:

### 1. Grouping Modes
Use the **Group:** selector in the toolbar:
- **Sprint / Phase**: Organizes tasks under collapsible phase containers.
- **Workflow Column**: Groups tasks by status (e.g. *To Do*, *In Progress*, *Done*).
- **Assignee**: Groups deliverables by team member for workload auditing.
- **None**: Displays a unified flat list of all deliverables.

### 2. Time Scale Granularity
Toggle between zoom levels:
- **Days**: High-precision daily execution tracking.
- **Weeks**: Ideal for multi-month project overviews.
- **Months**: High-level executive roadmaps spanning 6 to 12 months.

### 3. Timeline Navigation
- Click **Today** to instantly center the timeline on the current date.
- Use the **`‹`** and **`›`** arrows to shift the viewing window backward or forward.
- Drag horizontally on the timeline canvas to pan smoothly.

### 4. Display Modes
- Click **Target vs Actual: ON** to toggle between the comparative dual-track display and a simplified single-bar view.

---

## 📥 9. Exporting Roadmap Data to Microsoft Excel

You can generate comprehensive audit reports with a single click:

1. In the top-right of the Roadmap toolbar, click the **Export** button.
2. Worklane generates a clean, pre-formatted `.csv` file formatted with a **UTF-8 Byte Order Mark (`\uFEFF`)** so dates and symbols open perfectly in Microsoft Excel, Google Sheets, or Apple Numbers.

### What is Included in the Export:
- Task Title, Phase/Sprint, and Workflow Status
- Assigned Team Members
- Target Start & Target Due Dates
- Actual Start & Actual/Projected End Dates
- Progress % (0–100)
- Net Schedule Variance in Days (`+3`, `-1`, `0`)
- Health Status (`Ahead of Schedule`, `On Track`, `Delayed`)
- Milestone Flag (`Yes` / `No`)
- Detailed Work Suspensions summary log with reasons

---

## 📱 10. Mobile & Touch Device Tips

Worklane is fully optimized for smartphones and touchscreens:

1. **Segmented Mobile Tabs**: At the top of your mobile screen, switch between:
   - **Deliverables**: A clean tabular checklist of tasks and statuses.
   - **Gantt Timeline**: The interactive visual bar view.
2. **Sticky Task Titles**: When scrolling horizontally across weeks or months, a floating title pill stays attached to the left of each row so you never lose track of which task you are viewing.
3. **Stacked Suspension Rows**: Work suspension date pickers and reason inputs stack vertically, preventing horizontal cut-off on narrow screens.
4. **Touch Gestures**: Tap any row to open the complete task inspection modal.
