# 🚀 Worklane + Pipedream Email Notification Setup Guide

This guide provides step-by-step instructions for configuring automated email notifications in **Worklane Kanban** using **Pipedream HTTP Webhooks**.

---

## 📌 Architecture Overview

Worklane uses a zero-configuration, webhook-driven architecture for outgoing notifications:

```
[ Worklane Kanban Board Event ]
           │
           ▼
[ HTTP POST with Pre-Rendered HTML Template ]
           │
           ▼
[ Pipedream HTTP Webhook Endpoint ]
           │
           ▼
[ Email Action: Gmail / Resend / SendGrid / SMTP ]
           │
           ▼
[ Team Member's Inbox (Responsive Email Card) ]
```

1. **Board Events**: Actions such as card assignments, due date alerts, status movements, and @mentions trigger an event.
2. **Pre-Rendered HTML**: Worklane generates a responsive, branded HTML email card and dispatches it via an HTTP POST request to the webhook endpoint configured in your deployment environment.
3. **Pipedream Delivery**: Pipedream receives the webhook payload and routes the email through your connected provider (Gmail, Resend, SendGrid, or custom SMTP).
4. **Zero End-User Friction**: End-users do not need to configure URLs or technical settings. Once deployed with the environment variable, the system works automatically out of the box.

---

## 🛠️ Step-by-Step Pipedream Setup

### Step 1: Create a Free Pipedream Account
1. Visit [pipedream.com](https://pipedream.com) and sign up for a free account.

### Step 2: Create a New Workflow
1. From your Pipedream Dashboard, click **"New Workflow"** in the top-right corner.
2. Under **Trigger**, select **"HTTP / Webhook"**.
3. Choose **"HTTP Requests (Instant)"**.
4. Keep the default settings (HTTP Method: `POST` / `ANY`), and click **"Save and continue"**.
5. Pipedream will generate a unique endpoint URL, for example:
   ```text
   https://eoxxxxxxxxxx.m.pipedream.net
   ```
   *Copy this URL to your clipboard.*

---

### Step 3: Add the Webhook URL to Your Environment
1. Open your `.env` file in the Worklane project root (or configure it in your deployment platform, such as Vercel, Netlify, or Railway):
   ```env
   VITE_PIPEDREAM_WEBHOOK_URL=https://eoxxxxxxxxxx.m.pipedream.net
   ```
2. Restart your local development server or trigger a deployment so the environment variable takes effect.

---

### Step 4: Dispatch a Test Event from Worklane
1. Open your Worklane application.
2. Click the **Mail (Email)** icon in the top navigation bar or go to **Settings &rarr; Email Updates**.
3. Under **"Send Direct Update or Test"**, enter your email address.
4. Click **"Send Notification"** / **"Send Test"**.
5. Return to your Pipedream workflow canvas. Under **"Select an event to test your workflow"**, you will see the incoming request (e.g., `POST /`). Select it to inspect the payload.

---

### Step 5: Add a "Send Email" Action in Pipedream
1. In the workflow canvas, click the **"+" (Add a step)** button below your Trigger step.
2. Choose your preferred email provider:
   - **Option A: Gmail** *(Recommended for personal or Google Workspace accounts)*:
     - Search for **"Gmail"** &rarr; select **"Send Email"**.
     - Connect your Google account via OAuth.
   - **Option B: Resend** *(Recommended for high deliverability and transactional reliability)*:
     - Search for **"Resend"** &rarr; select **"Send Email"**.
   - **Option C: SendGrid**:
     - Search for **"SendGrid"** &rarr; select **"Send Email"**.
   - **Option D: Pipedream Built-in Email** *(Ideal for initial testing)*:
     - Search for **"Email"** &rarr; select **"Send Yourself an Email"**.

3. **Map the Fields in the Step Configuration**:
   Set the action parameters using the dynamic trigger expressions below:

   | Field in Pipedream | Value / Mapping Expression |
   | :--- | :--- |
   | **To / Recipient** | `{{steps.trigger.event.body.recipient.email}}` |
   | **Subject** | `{{steps.trigger.event.body.subject}}` |
   | **Email Body (HTML)** | `{{steps.trigger.event.body.html}}` |

   > ⚠️ **Important**: Ensure that you set the email body format to **HTML** (not Plain Text) so that the full modern layout, branding, event badge, and action button are rendered correctly.

---

### Step 6: Deploy Your Workflow
1. Click **"Deploy"** in the top-right corner of the Pipedream editor.
2. **Setup is complete!** All board activity configured by users will now dispatch automated email alerts to team members without requiring any client-side setup.

---

## 📦 Webhook Payload Specification

Each event dispatched by Worklane sends the following JSON structure:

```json
{
  "event": "card_assigned",
  "timestamp": "2026-09-04T09:15:00.000Z",
  "recipient": {
    "name": "Maria Santos",
    "email": "maria@company.com"
  },
  "sender": "notifications@worklane.app",
  "subject": "Task Assigned: Design system tokens",
  "body": "Hi Maria! You have been assigned to 'Design system tokens' on board 'Frontend Sprint'.",
  "html": "<!DOCTYPE html><html>...<!-- Responsive Worklane HTML Template -->...</html>",
  "metadata": {
    "cardTitle": "Design system tokens",
    "boardName": "Frontend Sprint",
    "actorName": "Alex Chen",
    "dueDate": "Sep 12, 2026"
  },
  "source": "Worklane Kanban"
}
```

### Event Types (`event`):
- `card_assigned`: A member was assigned to a task card.
- `due_reminder`: A card deadline is approaching or overdue.
- `status_changed`: A task status changed (e.g., moved to Done or reopened).
- `mention`: A team member was tagged with `@name` in a card comment.
- `test_ping`: A manual test notification sent from the Settings modal.

---

## 🎨 Built-in Email Design & Aesthetic

Worklane pre-renders an email template with inline styles optimized for all major email clients (Gmail, Apple Mail, Outlook, mobile):

- **Brand Styling**: Worklane indigo gradient (`#4f46e5` to `#6366f1`) with signature "W" emblem.
- **Dynamic Event Badges**:
  - 🔵 `TASK ASSIGNED`
  - 🟠 `DUE DATE REMINDER`
  - 🟢 `STATUS MOVEMENT`
  - 🟣 `MENTIONED YOU`
- **Context Details Card**: Displays task card title, board name, due date (highlighted if approaching), and author.
- **Call-to-Action (CTA)**: Prominent button linking directly to the board workspace (`Open in Worklane ->`).
- **Standard Footer**: Clarifies why the recipient received the notification with instructions for managing alert preferences.

---

## ❓ Frequently Asked Questions (FAQ)

#### Do end-users ever need to configure the Webhook URL in the UI?
**No.** The Webhook URL is strictly an environment variable (`VITE_PIPEDREAM_WEBHOOK_URL`). Once set in your hosting platform (Vercel, Netlify, Docker, etc.), it applies across the workspace automatically.

#### What happens if `VITE_PIPEDREAM_WEBHOOK_URL` is omitted?
Worklane safely bypasses outgoing email network calls without generating fake or simulated logs in the history feed.

#### Can I use services other than Pipedream?
Yes. Any webhook receiver (such as Make.com, n8n, Zapier, or a custom Express/Next.js API route) that accepts an HTTP POST with a JSON payload can be used as your endpoint.
