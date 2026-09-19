import React, { useState } from 'react';
import { Mail, X, Send, Trash2, ExternalLink, CheckCircle2, ShieldCheck, Loader2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { NeumorphicSelect } from './ui/NeumorphicSelect';
import { useEmailStore } from '../store/useEmailStore';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { formatTime } from '../utils';

interface Props {
  onClose: () => void;
}

export default function EmailNotifModal({ onClose }: Props) {
  const board = useWorkStore(s => s.getActiveBoard());
  const settings = useEmailStore(s => s.settings);
  const logs = useEmailStore(s => s.logs).filter(l => l.status === 'sent' || l.status === 'failed');
  const updateSettings = useEmailStore(s => s.updateSettings);
  const sendEmailNotification = useEmailStore(s => s.sendEmailNotification);
  const isConfigured = useEmailStore(s => s.isConfigured());
  const clearLogs = useEmailStore(s => s.clearLogs);
  const deleteLog = useEmailStore(s => s.deleteLog);
  const showToast = useToastStore(s => s.showToast);

  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Task Update: Design review ready');
  const [testBody, setTestBody] = useState('Hello! Your assigned card "Design review ready" has been updated.');
  const [isSending, setIsSending] = useState(false);

  const members = board?.members || [];

  const handleSendTest = async () => {
    if (!testEmail.trim()) {
      showToast('Please enter a recipient email address', 'error');
      return;
    }
    const recipient = members.find(m => m.email.toLowerCase() === testEmail.trim().toLowerCase()) || {
      id: 'test',
      name: testEmail.split('@')[0],
      email: testEmail.trim(),
      color: '#2563eb',
    };

    setIsSending(true);
    try {
      await sendEmailNotification({
        recipient,
        subject: testSubject,
        body: testBody,
        eventType: 'status_changed',
        metadata: {
          cardTitle: testSubject,
          boardName: board?.name || 'Workspace',
        },
      });

      if (isConfigured) {
        showToast(`Email notification dispatched to ${testEmail.trim()}`, 'success');
      } else {
        showToast(`Email delivery service is not configured in this environment`, 'warning');
      }
    } catch {
      showToast('Failed to dispatch email notification', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenInGmail = (email: string, subject: string, body: string) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal"
        style={{ maxWidth: 620, maxHeight: '88vh', transformStyle: 'preserve-3d' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} className="text-primary" />
            <h2 className="modal-title">Email Notifications</h2>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}><X size={15} /></motion.button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Service Status Banner */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--neu-shadow-raised-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: isConfigured ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid hsl(var(--border) / 0.5)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: isConfigured ? 'rgba(16, 185, 129, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isConfigured ? '#10b981' : 'hsl(var(--primary))'
                }}
              >
                {isConfigured ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                  Automated Delivery Service
                </div>
                <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                  Real-time notifications for task assignments, due dates, & @mentions
                </div>
              </div>
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                backgroundColor: isConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(99, 102, 241, 0.12)',
                color: isConfigured ? '#10b981' : 'hsl(var(--primary))',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isConfigured ? '#10b981' : 'hsl(var(--primary))' }} />
              {isConfigured ? 'Active' : 'Ready'}
            </span>
          </div>

          {/* Automatic Settings Toggle */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--neu-shadow-raised-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Event Trigger Preferences</div>
                <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Choose which board actions dispatch email alerts</div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={e => {
                    updateSettings({ enabled: e.target.checked });
                    showToast(e.target.checked ? 'Email notifications enabled' : 'Email notifications paused', 'info');
                  }}
                  style={{ width: 16, height: 16, accentColor: 'hsl(var(--primary))' }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: settings.enabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                  {settings.enabled ? 'Enabled' : 'Paused'}
                </span>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 8, borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.notifyOnAssign}
                  onChange={e => updateSettings({ notifyOnAssign: e.target.checked })}
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
                Notify member on task assignment
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.notifyOnDue}
                  onChange={e => updateSettings({ notifyOnDue: e.target.checked })}
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
                Notify member on due dates & overdue alerts
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.notifyOnStatusChange}
                  onChange={e => updateSettings({ notifyOnStatusChange: e.target.checked })}
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
                Notify member on task status completed / reopened
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.notifyOnMention ?? true}
                  onChange={e => updateSettings({ notifyOnMention: e.target.checked })}
                  style={{ accentColor: 'hsl(var(--primary))' }}
                />
                Notify member on comment @mentions
              </label>
            </div>
          </div>

          {/* Test Email */}
          <div className="form-group" style={{ marginTop: 2 }}>
            <label className="field-label">Send Direct Update or Test</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <NeumorphicSelect
                value={testEmail}
                placeholder="Select a team member..."
                options={[
                  { value: '', label: 'Select a team member...' },
                  ...members.map(m => ({
                    value: m.email || '',
                    label: m.name,
                    subLabel: m.email || 'No email',
                    icon: <Users size={12} />,
                  })),
                ]}
                onChange={val => setTestEmail(val)}
                style={{ flex: 1 }}
              />
              <input
                type="email"
                className="text-input"
                style={{ flex: 1 }}
                placeholder="or enter email address..."
                value={testEmail}
                onChange={e => setTestEmail(e.target.value)}
              />
            </div>
            <input
              type="text"
              className="text-input"
              placeholder="Subject"
              value={testSubject}
              onChange={e => setTestSubject(e.target.value)}
            />
            <textarea
              className="textarea-input"
              rows={2}
              placeholder="Message body"
              value={testBody}
              onChange={e => setTestBody(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {testEmail && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="btn btn-secondary"
                  onClick={() => handleOpenInGmail(testEmail, testSubject, testBody)}
                  style={{ fontSize: 12 }}
                >
                  <ExternalLink size={13} /> Open in Gmail
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                className="btn btn-primary"
                onClick={handleSendTest}
                disabled={isSending}
                style={{ fontSize: 12, gap: 6 }}
              >
                {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Send Notification</span>
              </motion.button>
            </div>
          </div>

          {/* Logs */}
          <div style={{ marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="field-label">Notification Dispatch History ({logs.length})</label>
              {logs.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    clearLogs();
                  }}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '2px 6px', color: 'hsl(var(--destructive))' }}
                >
                  <Trash2 size={12} /> Clear history
                </motion.button>
              )}
            </div>

            <div style={{ maxHeight: 150, overflowY: 'auto', borderRadius: 'var(--radius)', backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-input)' }}>
              {logs.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                  No notification logs recorded yet.
                </div>
              ) : (
                logs.map(log => (
                  <div key={log.id} style={{ padding: '8px 12px', borderBottom: '1px solid hsl(var(--border) / 0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{log.recipientEmail}</span>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            textTransform: 'uppercase',
                            backgroundColor:
                              log.status === 'sent' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color:
                              log.status === 'sent' ? '#10b981' : '#ef4444',
                          }}
                        >
                          {log.status === 'sent' ? 'Sent' : 'Failed'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>{log.subject}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>{formatTime(log.sentAt)}</span>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        type="button"
                        className="icon-btn"
                        style={{ width: 18, height: 18, minWidth: 18, minHeight: 18, padding: 0, borderRadius: 3, color: 'hsl(var(--muted-foreground))' }}
                        onClick={() => deleteLog(log.id)}
                        title="Delete log entry"
                      >
                        <X size={11} />
                      </motion.button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={onClose}>Close</motion.button>
        </div>
      </motion.div>
    </div>
  );
}
