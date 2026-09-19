import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EmailNotificationLog, EmailSettings, Member } from '../types';
import { uid } from '../utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const PIPEDREAM_WEBHOOK_URL = (import.meta.env.VITE_PIPEDREAM_WEBHOOK_URL || '').trim();

function buildWorklaneEmailHtml({
  recipientName,
  subject,
  body,
  eventType,
  metadata,
}: {
  recipientName: string;
  subject: string;
  body: string;
  eventType: string;
  metadata?: {
    cardTitle?: string;
    boardName?: string;
    cardId?: string;
    boardId?: string;
    actorName?: string;
    dueDate?: string;
  };
}) {
  const eventBadgeMap: Record<string, { label: string; text: string; icon: string }> = {
    card_assigned: { label: 'Task Assigned', text: '#4f46e5', icon: 'card' },
    due_reminder: { label: 'Due Date Alert', text: '#dc2626', icon: 'alert' },
    status_changed: { label: 'Status Movement', text: '#059669', icon: 'clock' },
    mention: { label: 'Mentioned You', text: '#db2777', icon: 'user' },
    test_ping: { label: 'System Verification', text: '#4f46e5', icon: 'clock' },
  };

  const badge = eventBadgeMap[eventType] || { label: 'Notification', text: '#4f46e5', icon: 'clock' };
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://worklane.app';
  
  // Official Worklane assets hosted on CDN
  const logoUrl = 'https://cdn.jsdelivr.net/gh/nyxieeee/Worklane@main/public/logo.png';
  const calendarIconUrl = 'https://cdn.jsdelivr.net/gh/nyxieeee/Worklane@main/public/icons/calendar.png';
  const alertIconUrl = 'https://cdn.jsdelivr.net/gh/nyxieeee/Worklane@main/public/icons/alert.png';
  const userIconUrl = 'https://cdn.jsdelivr.net/gh/nyxieeee/Worklane@main/public/icons/user.png';
  
  // Strip emojis and escape HTML
  const cleanSubject = subject.replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '').trim();
  const cleanBody = body
    .replace(/[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
  const previewSnippet = (cleanBody || cleanSubject).slice(0, 110).replace(/(\r\n|\n|\r)/gm, ' ');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${cleanSubject}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 12px 6px !important; }
      .neu-card { border-radius: 16px !important; }
      .neu-card-content { padding: 22px 18px !important; }
      .cta-button { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 10px; background: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  
  <!-- Inbox Preheader Snippet -->
  <div style="display: none; max-height: 0px; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #ffffff; opacity: 0;">
    ${cleanSubject} &bull; ${previewSnippet}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-wrapper" style="max-width: 540px; margin: 0 auto;">
    <tr>
      <td>
        <!-- ── Neumorphic Outer Card ── -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="neu-card" style="background-color: #eef2f8; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.9); box-shadow: 4px 4px 12px rgba(166, 175, 195, 0.4), -4px -4px 12px rgba(255, 255, 255, 0.95); overflow: hidden;">
          <tr>
            <td class="neu-card-content" style="padding: 28px 28px 24px 28px;">
              
              <!-- Top Bar: Brand & Status Pill -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 22px;">
                <tr>
                  <td style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Raised Neumorphic Logo Tile -->
                        <td style="width: 40px; height: 40px; background-color: #eef2f8; border-radius: 12px; text-align: center; vertical-align: middle; box-shadow: 2px 2px 5px rgba(166, 175, 195, 0.35), -2px -2px 5px rgba(255, 255, 255, 0.9); border: 1px solid rgba(255, 255, 255, 0.8);">
                          <img 
                            src="${logoUrl}" 
                            alt="Worklane" 
                            width="30" 
                            height="30" 
                            style="display: block; margin: 0 auto; width: 30px; height: 30px; object-fit: contain;" 
                          />
                        </td>
                        <td style="padding-left: 12px; vertical-align: middle;">
                          <div style="font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; line-height: 1.15;">Worklane</div>
                          <div style="font-size: 11px; font-weight: 600; color: #64748b; letter-spacing: -0.01em; margin-top: 2px;">Simply get things done.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <!-- Raised Neumorphic Pill Badge -->
                    <span style="display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 10.5px; font-weight: 700; background-color: #eef2f8; color: ${badge.text}; box-shadow: 1.5px 1.5px 4px rgba(166, 175, 195, 0.35), -1.5px -1.5px 4px rgba(255, 255, 255, 0.9); border: 1px solid rgba(255, 255, 255, 0.8); text-transform: uppercase; letter-spacing: 0.04em;">
                      ${badge.label}
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Greeting -->
              <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #64748b;">
                Hello <span style="color: #0f172a; font-weight: 700;">${recipientName || 'there'}</span>,
              </p>

              <!-- Subject Title -->
              <h1 style="margin: 0 0 18px 0; font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1.35; letter-spacing: -0.02em;">
                ${cleanSubject}
              </h1>

              <!-- ── Recessed Neumorphic Message Box ── -->
              <div style="background-color: #e5eaf2; border-radius: 14px; border: 1px solid rgba(212, 220, 232, 0.8); box-shadow: inset 2px 2px 5px rgba(166, 175, 195, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.85); padding: 18px 20px; margin-bottom: 20px; font-size: 14px; line-height: 1.65; color: #334155; white-space: pre-line;">
                ${cleanBody}
              </div>

              ${(metadata?.cardTitle || metadata?.boardName || metadata?.dueDate || metadata?.actorName) ? `
              <!-- ── Recessed Neumorphic Spec Box ── -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #e5eaf2; border-radius: 14px; border: 1px solid rgba(212, 220, 232, 0.8); box-shadow: inset 2px 2px 5px rgba(166, 175, 195, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.85); margin-bottom: 24px; font-size: 13px; color: #475569; overflow: hidden;">
                ${metadata?.cardTitle ? `
                <tr>
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b; width: 95px; border-bottom: 1px solid rgba(220, 227, 238, 0.7);">Task Card:</td>
                  <td style="padding: 10px 16px; font-weight: 700; color: #0f172a; border-bottom: 1px solid rgba(220, 227, 238, 0.7);">${metadata.cardTitle}</td>
                </tr>` : ''}
                ${metadata?.boardName ? `
                <tr>
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid rgba(220, 227, 238, 0.7);">Board:</td>
                  <td style="padding: 10px 16px; font-weight: 600; color: #1e293b; border-bottom: 1px solid rgba(220, 227, 238, 0.7);">
                    <span style="display: inline-block; padding: 3px 9px; border-radius: 6px; background-color: #eef2f8; box-shadow: 1px 1px 3px rgba(166, 175, 195, 0.3), -1px -1px 3px rgba(255, 255, 255, 0.8); border: 1px solid rgba(255, 255, 255, 0.7); color: #4338ca; font-weight: 700; font-size: 11.5px;">${metadata.boardName}</span>
                  </td>
                </tr>` : ''}
                ${metadata?.dueDate ? `
                <tr>
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b; border-bottom: 1px solid rgba(220, 227, 238, 0.7);">Due Date:</td>
                  <td style="padding: 10px 16px; font-weight: 700; color: #dc2626; border-bottom: 1px solid rgba(220, 227, 238, 0.7);">
                    <img src="${calendarIconUrl}" alt="Due" width="14" height="14" style="vertical-align: -2px; margin-right: 6px; display: inline-block;" />
                    ${metadata.dueDate}
                  </td>
                </tr>` : ''}
                ${metadata?.actorName ? `
                <tr>
                  <td style="padding: 10px 16px; font-weight: 600; color: #64748b;">Updated by:</td>
                  <td style="padding: 10px 16px; font-weight: 600; color: #1e293b;">
                    <img src="${userIconUrl}" alt="User" width="14" height="14" style="vertical-align: -2px; margin-right: 6px; display: inline-block;" />
                    ${metadata.actorName}
                  </td>
                </tr>` : ''}
              </table>
              ` : ''}

              <!-- ── Raised Neumorphic CTA Button ── -->
              <div style="text-align: center; margin: 24px 0 20px 0;">
                <a href="${appUrl}" class="cta-button" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; padding: 13px 32px; border-radius: 12px; font-size: 13.5px; font-weight: 700; letter-spacing: 0.01em; box-shadow: 3px 3px 8px rgba(79, 70, 229, 0.35), -2px -2px 6px rgba(255, 255, 255, 0.7); border: 1px solid rgba(255, 255, 255, 0.2);">
                  Open in Worklane &rarr;
                </a>
              </div>

              <!-- Footer Note -->
              <p style="margin: 20px 0 0 0; font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center;">
                Sent automatically by Worklane. To customize notification triggers, open <strong>Settings &rarr; Email Notifications</strong>.
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

interface EmailState {
  settings: EmailSettings;
  logs: EmailNotificationLog[];
  updateSettings: (patch: Partial<EmailSettings>) => void;
  sendEmailNotification: (params: {
    recipient: Member;
    subject: string;
    body: string;
    eventType: EmailNotificationLog['eventType'];
    metadata?: {
      cardTitle?: string;
      boardName?: string;
      cardId?: string;
      boardId?: string;
      actorName?: string;
      dueDate?: string;
    };
  }) => Promise<void>;
  testEmailNotification: (recipientEmail: string) => Promise<{ success: boolean; message: string }>;
  isConfigured: () => boolean;
  clearLogs: () => void;
  deleteLog: (id: string) => void;
}

export const useEmailStore = create<EmailState>()(
  persist(
    (set, get) => ({
      settings: {
        enabled: true,
        notifyOnAssign: true,
        notifyOnDue: true,
        notifyOnStatusChange: true,
        notifyOnMention: true,
        senderEmail: 'notifications@worklane.app',
      },
      logs: [],

      updateSettings: (patch) => set(s => ({ settings: { ...s.settings, ...patch } })),

      isConfigured: () => Boolean(PIPEDREAM_WEBHOOK_URL),

      sendEmailNotification: async ({ recipient, subject, body, eventType, metadata }) => {
        const { settings } = get();
        if (!settings.enabled) return;

        if (eventType === 'card_assigned' && !settings.notifyOnAssign) return;
        if (eventType === 'due_reminder' && !settings.notifyOnDue) return;
        if (eventType === 'status_changed' && !settings.notifyOnStatusChange) return;
        if (eventType === 'mention' && settings.notifyOnMention === false) return;

        if (!recipient.email) return;

        // Only dispatch and log when a deployment webhook URL is configured
        if (!PIPEDREAM_WEBHOOK_URL) {
          return;
        }

        const logId = uid();

        try {
          const htmlContent = buildWorklaneEmailHtml({
            recipientName: recipient.name,
            subject,
            body,
            eventType,
            metadata,
          });

          const payload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            recipient: {
              name: recipient.name,
              email: recipient.email,
            },
            sender: settings.senderEmail || 'notifications@worklane.app',
            subject,
            body,
            html: htmlContent,
            metadata: metadata || {},
            source: 'Worklane Kanban',
          };

          const res = await fetch(PIPEDREAM_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/plain, */*',
            },
            body: JSON.stringify(payload),
          });

          const isSuccess = res.ok;
          const finalStatus: 'sent' | 'failed' = isSuccess ? 'sent' : 'failed';

          const newLog: EmailNotificationLog = {
            id: logId,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject,
            body,
            sentAt: new Date().toISOString(),
            status: finalStatus,
            eventType,
          };

          set(s => ({
            logs: [newLog, ...s.logs.filter(l => l.status === 'sent' || l.status === 'failed')].slice(0, 100)
          }));

          // Also record into Supabase email_logs table
          if (isSupabaseConfigured()) {
            supabase.from('email_logs').insert({
              id: logId,
              recipient_email: recipient.email,
              recipient_name: recipient.name,
              subject,
              body,
              status: finalStatus,
              event_type: eventType,
              sent_at: new Date().toISOString(),
            }).then();
          }
        } catch (err) {
          console.warn('[useEmailStore] Dispatch error:', err);
          const failLog: EmailNotificationLog = {
            id: logId,
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject,
            body,
            sentAt: new Date().toISOString(),
            status: 'failed',
            eventType,
          };
          set(s => ({
            logs: [failLog, ...s.logs.filter(l => l.status === 'sent' || l.status === 'failed')].slice(0, 100)
          }));
        }
      },

      testEmailNotification: async (recipientEmail: string) => {
        if (!PIPEDREAM_WEBHOOK_URL) {
          return { success: false, message: 'Pipedream webhook URL is not configured in the deployment environment (VITE_PIPEDREAM_WEBHOOK_URL).' };
        }

        try {
          const testHtml = buildWorklaneEmailHtml({
            recipientName: recipientEmail.split('@')[0] || 'Team Member',
            subject: 'Worklane Email Notification Test',
            body: 'Hello! This is an automated test notification from your Worklane Kanban workspace. If you can see this email, your Pipedream webhook is functioning perfectly!',
            eventType: 'test_ping',
            metadata: {
              cardTitle: 'Integration Verification Test',
              boardName: 'Worklane Kanban',
            },
          });

          const testPayload = {
            event: 'test_ping',
            timestamp: new Date().toISOString(),
            recipient: {
              name: recipientEmail.split('@')[0] || 'Team Member',
              email: recipientEmail,
            },
            sender: 'notifications@worklane.app',
            subject: 'Worklane Email Notification Test',
            body: 'Hello! This is an automated test notification from your Worklane Kanban workspace.',
            html: testHtml,
            metadata: {
              isTest: true,
              cardTitle: 'Integration Verification Test',
              boardName: 'Worklane Kanban',
            },
            source: 'Worklane Integration Test',
          };

          const res = await fetch(PIPEDREAM_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json, text/plain, */*',
            },
            body: JSON.stringify(testPayload),
          });

          if (res.ok) {
            return { success: true, message: `Email notification sent successfully to ${recipientEmail}!` };
          } else {
            return { success: false, message: `Webhook responded with HTTP status ${res.status}` };
          }
        } catch (err: any) {
          return { success: false, message: err?.message || 'Network request failed' };
        }
      },

      clearLogs: () => set({ logs: [] }),
      deleteLog: (id: string) => set(s => ({ logs: s.logs.filter(l => l.id !== id) })),
    }),
    {
      name: 'worklane_email_store_v1',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.logs = (state.logs || []).filter(l => l.status === 'sent' || l.status === 'failed');
        }
      }
    }
  )
);
