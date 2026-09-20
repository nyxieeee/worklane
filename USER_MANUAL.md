# 📖 Worklane: Complete User Manual & Workspace Guide

Welcome to the **Worklane Official User Manual**. Worklane is a next-generation neumorphic project management and collaborative workspace engineered for agile development squads, engineering teams, and high-velocity product creators.

This manual covers all core features, workflows, administrative controls, and productivity tools available in Worklane.

---

## 📑 Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Getting Started & Authentication](#2-getting-started--authentication)
3. [Executive Workspace Dashboard](#3-executive-workspace-dashboard)
4. [Board & Workspace Management](#4-board--workspace-management)
5. [Multi-View Productivity Modes](#5-multi-view-productivity-modes)
   - [5.1 Kanban Board View](#51-kanban-board-view)
   - [5.2 Roadmap & Gantt Timeline View](#52-roadmap--gantt-timeline-view)
   - [5.3 Interactive Calendar Schedule](#53-interactive-calendar-schedule)
   - [5.4 Task Backlog & Inbox Drawer](#54-task-backlog--inbox-drawer)
6. [Card Inspector & Deliverable Details](#6-card-inspector--deliverable-details)
7. [Team Collaboration, Mentions & Discussion Proofs](#7-team-collaboration-mentions--discussion-proofs)
8. [Role-Based Access Control (RBAC) & Invitations](#8-role-based-access-control-rbac--invitations)
9. [Profile Personalization & Role Border Rings](#9-profile-personalization--role-border-rings)
10. [Automated Email Alerts via Pipedream](#10-automated-email-alerts-via-pipedream)
11. [Global Command Palette & Quick Search](#11-global-command-palette--quick-search)
12. [Workspace Settings, Themes & Custom Labels](#12-workspace-settings-themes--custom-labels)
13. [Mobile & Touch Device Experience](#13-mobile--touch-device-experience)
14. [Keyboard Shortcuts Quick Reference](#14-keyboard-shortcuts-quick-reference)

---

## 🌟 1. System Overview & Architecture

Worklane combines a tactile neumorphic interface with high-reliability data persistence:
- **Zero-Latency Optimistic State**: Instant local feedback powered by Zustand and `localStorage` caching.
- **Real-Time Cloud Synchronization**: PostgreSQL database storage and WebSocket subscriptions powered by **Supabase**.
- **Interactive 3D WebGL Atmosphere**: Real-time reactive Three.js canvas reacting to cursor movement and viewport tilt.
- **Transactional Notifications**: Automated email delivery pipeline via **Pipedream HTTP Webhooks**.

---

## 🔑 2. Getting Started & Authentication

### Sign In & Registration:
1. **Google OAuth (One-Click)**: Click **Continue with Google** for instant authenticated sign-in.
2. **Email Sign-In**: Enter your work email to receive an authentication magic link / OTP code.
3. **Guest / Offline Mode**: Instant zero-login evaluation mode with full local storage caching.

### Onboarding via Board Invite Links:
- When receiving a shareable invitation link (`?joinBoard=<id>&role=<role>`), you are directed to the **Invite Landing Page**.
- Sign in or sign up with Google/Email to automatically join the board with your assigned role permissions.

---

## 📊 3. Executive Workspace Dashboard

The Dashboard provides executive visibility across all projects and tasks:

### Key Metrics Summary:
- **Total Tasks**: Aggregate task volume across all boards.
- **Due Soon / Overdue**: Highlights active deadline risks requiring immediate squad focus.
- **Completion Rate**: Live completion percentage tracking squad velocity.
- **Active Workspaces**: Total count of active boards and roadmaps.

### Cross-Board Task Aggregator:
- View all deliverables across all boards in a unified table.
- Filter by: `All`, `Assigned to Me`, `Due Soon`, `Urgent`, or `Completed`.
- Toggle completion directly using the checkbox (`☐` / `☑`).
- Click any task title to jump directly into the card modal on its host board.

### Quick Actions:
- **`+ New Board`**: Launch the Board Creation modal.
- **`+ New Roadmap`**: Create a standalone strategic delivery roadmap.

---

## 🗂️ 4. Board & Workspace Management

### Creating Boards:
1. Click **`+`** in the Sidebar next to **Boards** or click **`+ New Board`** in the Dashboard.
2. Enter the **Board Name** and pick a **Color Theme** from the 12-color HSL palette (`Indigo`, `Purple`, `Pink`, `Rose`, `Orange`, `Amber`, `Emerald`, `Teal`, `Sky`, `Blue`, `Slate`, `Zinc`).
3. Click **Create Board**.

### Managing Columns:
- **Add Column**: Click **`+ Add Column`** at the right end of the Kanban board.
- **Rename Column**: Click the column title to edit.
- **Reorder Columns**: Drag columns horizontally to customize your workflow.
- **Delete Column**: Click the column settings icon and select delete (tasks can be moved to backlog or another column).

### Board Settings & Color Palette:
- Hover over any board in the sidebar to reveal the **Pencil (Rename)**, **Palette (Theme Color)**, or **Delete / Leave** options.

---

## 📋 5. Multi-View Productivity Modes

Switch between views in the topbar selector pill:

### 5.1 Kanban Board View
- **Drag-and-Drop Workflow**: Move cards between stages (e.g., *To Do*, *In Progress*, *Code Review*, *QA*, *Done*).
- **Auto-Complete**: Dropping a card into a completion column automatically updates its `completed` status and timestamps completion.
- **Quick Card Insertion**: Click **`+ Add Card`** at the bottom of any column to rapidly add tasks with keyboard shortcuts (`Enter` to save, `Shift+Enter` for newline).
- **Member Filters**: Click any avatar in the topbar or sidebar to filter the board to cards assigned to that team member.

### 5.2 Roadmap & Gantt Timeline View
- Dedicated dual-pane Gantt engine contrasting **Planned Goal (Green)** baselines with **Work Done (Orange)** execution.
- Multi-format document import (`.pdf`, `.docx`, `.md`, `.txt`, `.csv`) with auto-phase extraction.
- Automated inactive day tracking and formal multi-day **Work Suspensions**.
- Real-time mathematical **Schedule Variance** calculation.
- One-click export to **CSV / Microsoft Excel** with UTF-8 BOM.
- 📘 *For comprehensive Gantt documentation, see [`GANTT_USER_MANUAL.md`](GANTT_USER_MANUAL.md).*

### 5.3 Interactive Calendar Schedule
- Visual monthly matrix of all scheduled deliverables.
- Deadline badges color-coded by urgency: Green (On Schedule), Amber (Due Soon), Glowing Red (Overdue).
- Click any calendar date to add a card due on that day.
- Click any task chip to open the full card modal.

### 5.4 Task Backlog & Inbox Drawer
- Access by clicking the **Inbox** icon in the sidebar or topbar.
- Triage raw ideas, bug reports, and unstructured notes before promoting them to board columns.
- **Bidirectional Drag-and-Drop**: Drag cards freely between the Inbox drawer and Kanban columns.
- Isolated search and filter controls within the backlog.

---

## 📝 6. Card Inspector & Deliverable Details

Opening any card displays the comprehensive Card Modal:

### Key Sections:
1. **Title & Description**: Rich text descriptions with formatting support.
2. **Assignees & Role Borders**: Assign multiple squad members; member avatars render with their glowing custom role borders.
3. **Priority & Labels**: Set priority (`Urgent`, `High`, `Medium`, `Low`) and apply custom color-coded labels.
4. **Checklist Items**: Add subtasks with checkboxes; automatically computes parent task progress percentage.
5. **Due Date & Time Picker**: Set exact deadlines using the tactile 12-hour analog clock selector and instant presets (`Today`, `Tomorrow`, `End of Week`, `Next Week`).
6. **Schedule & Baseline Tracking**:
   - Set **Scheduled Start** and **Scheduled End (Due Date)**.
   - Configure **Actual Start** and **Actual End**.
   - Review live start variance and completion delay badges.
7. **Work Tracking**:
   - Click **`Mark Worked Today`** / **`✓ Worked Today`** to log active effort and advance Gantt progress.
   - View history of confirmed worked dates.
8. **Work Suspensions**: Log multi-day pauses with dates and documented reasons (e.g. *Client hold*).
9. **Milestone Toggle**: Mark deliverable as a milestone checkpoint.
10. **Dependencies**: Link prerequisite blocker tasks.
11. **Attachments & Cover Image**: Upload image, document, and code files; select any image to display as the card's visual cover banner.

---

## 💬 7. Team Collaboration, Mentions & Discussion Proofs

### Threaded Discussions:
- Post comments on cards to discuss execution with team members.
- Click **Reply** on any comment to create structured nested discussion threads.

### Proof & Screenshot Attachments:
- Attach verification screenshots, test outputs, or delivery proofs directly inside comment replies.

### Autocomplete `@Mentions`:
- Type `@` in any comment box to open the squad member dropdown.
- Selecting a member dispatches an instant in-app notification and automated email notification via Pipedream.

---

## 🛡️ 8. Role-Based Access Control (RBAC) & Invitations

Worklane enforces four distinct permission tiers:

| Role | Governance & Capabilities |
| :--- | :--- |
| 👑 **Owner** | Full board governance: rename/delete board, invite members, modify member roles, manage all columns and cards. |
| 🛡️ **Admin** | Full workflow management: manage columns, invite members, assign roles, create and edit all cards. |
| 👤 **Member** | Active squad contributor: create, edit, move, assign, comment, and complete cards. |
| 👁️ **Observer** | Read-only stakeholder access: view boards, roadmaps, and card details with interactive inspections (modifications disabled). |

### Inviting Team Members:
1. Click **Members** in the topbar or sidebar.
2. **Method A (Direct Search)**: Search registered users by email and assign their role.
3. **Method B (Shareable Invite Link)**: Generate a role-specific invite link (`Admin`, `Member`, or `Observer`) to share via Slack, Discord, or email.

---

## 🎭 9. Profile Personalization & Role Border Rings

Personalize your workspace avatar and signify your role in the engineering squad:

### Avatar Customization:
1. Open **Settings &rarr; Profile**.
2. **Upload Custom Picture**: Built-in **Avatar Cropper Modal** allows interactive pan, zoom, and circular crop.
3. **Preset Avatars**: Select from a library of high-resolution avatar illustrations.

### Role Border Rings:
Choose an illuminated gradient ring and badge that displays around your avatar across all cards, comments, and member lists:
- **Engineering Roles**: Frontend (`FE`), Backend (`BE`), Fullstack (`FS`), DevOps (`DevOps`), Mobile (`Mobile`), QA (`QA`), Data/AI (`Data`), Security (`SecOps`).
- **Product & Workplace Roles**: UI/UX Designer (`UI/UX`), Product Manager (`PM`), Scrum Master (`Scrum`), Tech Lead (`Lead`), Business Analyst (`BA`), Growth (`Growth`), IT Operations (`Ops`).

---

## 📧 10. Automated Email Alerts via Pipedream

Worklane integrates directly with Pipedream HTTP Webhooks for zero-maintenance transactional email notifications through Gmail, Resend, SendGrid, or custom SMTP.

### Event Triggers:
- **`card_assigned`**: Dispatched to assignees when added to a task.
- **`due_reminder`**: Dispatched when deadlines are approaching or overdue.
- **`status_changed`**: Dispatched when tasks move columns or get completed.
- **`mention`**: Dispatched when a squad member is tagged with `@username`.
- **`test_ping`**: Dispatched from settings to verify webhook connectivity.

### Webhook Configuration:
1. Open **Settings &rarr; Email Updates**.
2. Paste your **Pipedream Webhook URL**.
3. Toggle the notification triggers you want enabled.
4. Click **Send Test Email** to verify your pipeline.
5. Review the in-app **Email Audit Log** to inspect delivered messages.
6. 📘 *For complete webhook setup instructions, see [`PIPEDREAM_SETUP_GUIDE.md`](PIPEDREAM_SETUP_GUIDE.md).*

---

## 🔍 11. Global Command Palette & Quick Search

Access the global search engine anywhere in Worklane:
- **Shortcut**: <kbd>Ctrl</kbd> + <kbd>K</kbd> (Windows/Linux) or <kbd>Cmd</kbd> + <kbd>K</kbd> (macOS).
- **Fuzzy Search**: Instantly searches across:
  - Board and Roadmap titles
  - Card titles and rich descriptions
  - Assignee names and roles
  - Label tags and priority levels
- **Direct Navigation**: Press <kbd>Enter</kbd> or click any search result to open the card modal directly.

---

## ⚙️ 12. Workspace Settings, Themes & Custom Labels

Access settings via the gear icon in the sidebar:

### 1. Appearance & Theme Engine:
- Toggle between **Neumorphic Dark Mode** (deep slate hues with neon accents) and **Neumorphic Light Mode** (soft cream and tactile shadows).
- Toggle 3D WebGL background atmosphere animation.

### 2. Custom Labels Manager:
- Create custom project tags with custom names and background colors.
- Manage existing label presets across your workspace.

### 3. In-App Notification Feed:
- View real-time notifications for card assignments, due dates, mentions, and status transitions.
- Mark all as read or jump to relevant cards.

---

## 📱 13. Mobile & Touch Device Experience

Worklane features a touch-optimized mobile experience:
- **Mobile Bottom Navigation Bar**: One-touch access to Dashboard, Active Board, Calendar, and Inbox.
- **Neumorphic Floating Action Button (FAB)**: Rapidly create new boards and cards on mobile.
- **Mobile Board Switcher**: Bottom drawer for switching boards and roadmaps.
- **Roadmap Mobile Tabs**: Segmented tabs separating tabular deliverables from the interactive horizontal Gantt canvas.
- **Sticky Column & Task Headers**: Fixed title headers ensure you never lose context when panning.

---

## ⌨️ 14. Keyboard Shortcuts Quick Reference

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Open Global Command Palette / Search |
| <kbd>Esc</kbd> | Close active modal, drawer, or dropdown |
| <kbd>Enter</kbd> (in quick card input) | Save and create task card |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | Insert newline in text areas |

---

## 📚 Related Documentation

- 📘 **Roadmap & Gantt User Manual**: [`GANTT_USER_MANUAL.md`](GANTT_USER_MANUAL.md)
- 📐 **Gantt Technical & Variance Specification**: [`GANTT_SPECIFICATION.md`](GANTT_SPECIFICATION.md)
- 📧 **Pipedream Email Automation Guide**: [`PIPEDREAM_SETUP_GUIDE.md`](PIPEDREAM_SETUP_GUIDE.md)
- 🚀 **Project Overview & Developer Setup**: [`README.md`](README.md)
