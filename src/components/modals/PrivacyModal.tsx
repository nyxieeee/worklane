import React, { useRef } from 'react';
import { Shield, X, Download, Upload, Trash2, Database, HardDrive, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkStore } from '../../store/useWorkStore';
import { useNotifStore } from '../../store/useNotifStore';
import { useEmailStore } from '../../store/useEmailStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import { useConfirmStore } from '../../store/useConfirmStore';

interface Props {
  onClose: () => void;
}

export default function PrivacyModal({ onClose }: Props) {
  const getVisibleBoards = useWorkStore(s => s.getVisibleBoards);
  const notifications = useNotifStore(s => s.notifications);
  const clearNotifications = useNotifStore(s => s.clearAll);
  const user = useAuthStore(s => s.user);
  const deleteAccount = useAuthStore(s => s.deleteAccount);
  const showToast = useToastStore(s => s.showToast);
  const showConfirm = useConfirmStore(s => s.showConfirm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const boards = getVisibleBoards(user?.email);

  const totalCards = boards.reduce((acc, b) => acc + (b.columns?.reduce((cAcc, c) => cAcc + (c.cards?.length || 0), 0) || 0), 0);
  const totalAttachments = boards.reduce((acc, b) => acc + (b.columns?.reduce((cAcc, c) => cAcc + (c.cards?.reduce((aAcc, a) => aAcc + (a.attachments?.length || 0), 0) || 0), 0) || 0), 0);

  const storageBytes = new Blob([
    localStorage.getItem('worklane_data_v4') || '',
    localStorage.getItem('worklane_notifs_v3') || '',
    localStorage.getItem('worklane_auth_v2') || '',
    localStorage.getItem('worklane_emails_v2') || '',
  ]).size;

  const storageKB = (storageBytes / 1024).toFixed(1);

  const handleExportData = () => {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      boards: useWorkStore.getState().boards,
      notifications: useNotifStore.getState().notifications,
      emailSettings: useEmailStore.getState().settings,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worklane-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.boards && Array.isArray(parsed.boards)) {
          useWorkStore.setState({ boards: parsed.boards, activeBoardId: parsed.boards[0]?.id || null });
          showToast('Boards imported successfully', 'success');
          onClose();
        } else {
          showToast('Invalid backup file structure', 'error');
        }
      } catch (err) {
        showToast('Failed to parse backup file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal small-modal"
        style={{ transformStyle: 'preserve-3d' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Privacy & Local Storage</h2>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}><X size={15} /></motion.button>
        </div>

        <div className="modal-body">
          {/* Privacy Note */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'hsl(var(--card))',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--neu-shadow-raised-sm)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10
            }}
          >
            <CheckCircle2 size={16} color="hsl(var(--primary))" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', lineHeight: 1.45 }}>
              <strong style={{ color: 'hsl(var(--foreground))' }}>Zero External Tracking:</strong> All your boards, task data, attachments, and settings remain stored strictly in your browser.
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--neu-shadow-raised-sm)',
                backgroundColor: 'hsl(var(--card))'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--primary))', marginBottom: 4 }}>
                <Database size={13} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{boards.length} Boards</span>
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                {totalCards} Tasks / {totalAttachments} Files
              </div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--neu-shadow-raised-sm)',
                backgroundColor: 'hsl(var(--card))'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--primary))', marginBottom: 4 }}>
                <HardDrive size={13} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{storageKB} KB</span>
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                Local Storage Used
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <div className="field-label">Data Management</div>

            <motion.button whileTap={{ scale: 0.97 }} className="btn btn-secondary" onClick={handleExportData} style={{ width: '100%', justifyContent: 'flex-start' }}>
              <Download size={14} />
              <span>Export Workspace Data (JSON)</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ width: '100%', justifyContent: 'flex-start' }}
            >
              <Upload size={14} />
              <span>Import Workspace Data (JSON)</span>
            </motion.button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleImportData}
            />

            {notifications.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="btn btn-secondary"
                onClick={() => {
                  clearNotifications();
                  showToast('Notification history cleared', 'info');
                }}
                style={{ width: '100%', justifyContent: 'flex-start', color: 'hsl(var(--destructive))' }}
              >
                <Trash2 size={14} />
                <span>Clear Notification History</span>
              </motion.button>
            )}

            {/* Danger Zone: Account Deletion */}
            {user && (
              <div
                style={{
                  marginTop: 6,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'hsl(var(--destructive) / 0.06)',
                  border: '1px solid hsl(var(--destructive) / 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--destructive))', fontWeight: 700, fontSize: 12.5 }}>
                  <AlertTriangle size={14} />
                  <span>Delete & Deactivate Account</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'hsl(var(--muted-foreground))', lineHeight: 1.4 }}>
                  Permanently erase your account, profile, notifications, and board memberships from the database.
                </p>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => {
                    if (!user?.email) return;
                    showConfirm({
                      title: 'Delete Account Permanently?',
                      message: `Are you sure you want to delete your account (${user.email})? All your profile information and board memberships will be erased from the database.`,
                      confirmText: 'Delete Account Forever',
                      variant: 'danger',
                      icon: 'trash',
                      onConfirm: async () => {
                        const res = await deleteAccount();
                        if (res.success) {
                          showToast('Account permanently deleted.', 'info');
                          onClose();
                        } else {
                          showToast(res.error || 'Failed to delete account', 'error');
                        }
                      }
                    });
                  }}
                  className="btn"
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: 'hsl(var(--destructive))',
                    color: '#fff',
                    fontSize: 11.5,
                    fontWeight: 700,
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    marginTop: 2,
                  }}
                >
                  <Trash2 size={12} />
                  <span>Delete My Account</span>
                </motion.button>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={onClose}>Close</motion.button>
        </div>
      </motion.div>
    </div>
  );
}
