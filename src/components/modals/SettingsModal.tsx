import React, { useState, useRef } from 'react';
import {
  X, Sun, Moon, Bell, Shield, Sliders, Mail, Tag, Plus, Trash2, Check,
  AlertTriangle, Upload, Download, RefreshCw, Send, CheckCircle2, User, Camera, Image, Sparkles,
  Globe, AlertCircle, Loader2, Crop
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../../store/useThemeStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useWorkStore } from '../../store/useWorkStore';
import { useNotifStore } from '../../store/useNotifStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useEmailStore } from '../../store/useEmailStore';
import { useToastStore } from '../../store/useToastStore';
import { useConfirmStore } from '../../store/useConfirmStore';
import { avatarInitials } from '../../utils';
import ProfileBorderPicker from '../ui/ProfileBorderPicker';
import AvatarCropperModal from './AvatarCropperModal';

type TabKey = 'profile' | 'appearance' | 'notifications' | 'email' | 'privacy' | 'labels';

interface Props {
  initialTab?: TabKey;
  onClose: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=200&q=80',
];

export default function SettingsModal({ initialTab = 'profile', onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Stores
  const isDark = useThemeStore(s => s.isDark);
  const toggleTheme = useThemeStore(s => s.toggle);
  const labelMode = useSettingsStore(s => s.labelMode);
  const setLabelMode = useSettingsStore(s => s.setLabelMode);
  const customLabels = useSettingsStore(s => s.customLabels);
  const addLabel = useSettingsStore(s => s.addLabel);
  const removeLabel = useSettingsStore(s => s.removeLabel);

  const getVisibleBoards = useWorkStore(s => s.getVisibleBoards);
  const notifications = useNotifStore(s => s.notifications);
  const clearNotifications = useNotifStore(s => s.clearAll);
  const user = useAuthStore(s => s.user);
  const updateUserProfile = useAuthStore(s => s.updateUserProfile);
  const deleteAccount = useAuthStore(s => s.deleteAccount);
  const showToast = useToastStore(s => s.showToast);
  const showConfirm = useConfirmStore(s => s.showConfirm);

  const boards = getVisibleBoards(user?.email);

  const emailSettings = useEmailStore(s => s.settings);
  const updateEmailSettings = useEmailStore(s => s.updateSettings);
  const isEmailConfigured = useEmailStore(s => s.isConfigured());
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);

  // Profile Edit Local State
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [customAvatarUrl, setCustomAvatarUrl] = useState(user?.avatarUrl || '');
  const [borderStyle, setBorderStyle] = useState(user?.borderStyle || 'none');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string>('');
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Local state for adding custom label
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6366f1');

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [testSubject, setTestSubject] = useState('Task Update: Project Milestone');
  const [testBody, setTestBody] = useState('Hi! This is a test email notification dispatched from Worklane.');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Storage metrics
  const totalCards = boards.reduce((acc, b) => acc + (b.columns?.reduce((cAcc, c) => cAcc + (c.cards?.length || 0), 0) || 0), 0);
  const totalAttachments = boards.reduce((acc, b) => acc + (b.columns?.reduce((cAcc, c) => cAcc + (c.cards?.reduce((aAcc, a) => aAcc + (a.attachments?.length || 0), 0) || 0), 0) || 0), 0);

  const storageBytes = new Blob([
    localStorage.getItem('worklane_data_v4') || '',
    localStorage.getItem('worklane_notifs_v3') || '',
    localStorage.getItem('worklane_auth_v2') || '',
    localStorage.getItem('worklane_emails_v2') || '',
    localStorage.getItem('worklane_settings_v1') || '',
  ]).size;
  const storageKB = (storageBytes / 1024).toFixed(1);

  // 1. Handle Profile Avatar File Upload & Open Cropper
  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file size must be less than 5MB', 'warning');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setCropperImageSrc(result);
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropperApply = (croppedDataUrl: string) => {
    setCustomAvatarUrl(croppedDataUrl);
    setCropperOpen(false);
    showToast('Photo cropped & adjusted! Click "Save Profile Changes" to apply.', 'info');
  };

  // 2. Handle Save Profile Changes
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!displayName.trim()) {
      showToast('Name cannot be empty', 'warning');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await updateUserProfile({
        name: displayName.trim(),
        avatarUrl: customAvatarUrl || undefined,
        borderStyle: borderStyle || 'none',
      });

      if (res.success) {
        showToast('Profile photo and name updated successfully!', 'success');
      } else {
        showToast(res.error || 'Failed to update profile', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating profile', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleExportData = () => {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      boards: useWorkStore.getState().boards,
      notifications: useNotifStore.getState().notifications,
      emailSettings: useEmailStore.getState().settings,
      customLabels: useSettingsStore.getState().customLabels,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worklane-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Workspace backup exported successfully', 'success');
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.boards && Array.isArray(json.boards)) {
          showConfirm({
            title: 'Restore Workspace Backup?',
            message: `This will replace your current boards with ${json.boards.length} boards from the backup file. Proceed?`,
            confirmText: 'Restore Data',
            onConfirm: () => {
              useWorkStore.setState({ boards: json.boards });
              if (json.notifications) useNotifStore.setState({ notifications: json.notifications });
              if (json.emailSettings) useEmailStore.setState({ settings: json.emailSettings });
              if (json.customLabels) useSettingsStore.setState({ customLabels: json.customLabels });
              showToast('Backup restored successfully!', 'success');
              onClose();
            }
          });
        } else {
          showToast('Invalid backup file format', 'error');
        }
      } catch (err) {
        showToast('Failed to parse backup JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      showToast('Please enter an email address', 'error');
      return;
    }
    setIsSendingTestEmail(true);
    try {
      const res = await useEmailStore.getState().testEmailNotification(testEmail.trim());
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'warning');
      }
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const navTabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'profile', label: 'My Profile & Avatar', icon: <User size={15} /> },
    { key: 'appearance', label: 'Appearance & Theme', icon: <Sun size={15} /> },
    { key: 'notifications', label: 'In-App Alerts', icon: <Bell size={15} /> },
    { key: 'email', label: 'Email Updates', icon: <Mail size={15} /> },
    { key: 'labels', label: 'Custom Labels', icon: <Tag size={15} /> },
    { key: 'privacy', label: 'Privacy & Storage', icon: <Shield size={15} /> },
  ];

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal"
        style={{
          maxWidth: 740,
          width: 'min(740px, calc(100vw - 16px))',
          height: 560,
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          transformStyle: 'preserve-3d'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid hsl(var(--border) / 0.4)',
            backgroundColor: 'hsl(var(--card))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: 'hsl(var(--card))',
                boxShadow: 'var(--neu-shadow-raised-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--primary))'
              }}
            >
              <Sliders size={16} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))' }}>Preferences & Settings</div>
              <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Configure your profile avatar, workspace preferences, and security</div>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}>
            <X size={15} />
          </motion.button>
        </div>

        {/* 2-Column Body on Desktop / Top Tab Strip on Mobile */}
        <div className="settings-modal-grid">
          {/* Settings Tab List */}
          <div className="settings-modal-tabs">
            {navTabs.map(t => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '8px 12px',
                    borderRadius: 9,
                    border: 'none',
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    backgroundColor: active ? 'hsl(var(--card))' : 'transparent',
                    color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    boxShadow: active ? 'var(--neu-shadow-raised-sm)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ color: active ? 'hsl(var(--primary))' : 'inherit' }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Content Panel */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', backgroundColor: 'hsl(var(--card))' }}>
            
            {/* ══ 1. PROFILE & AVATAR TAB ══ */}
            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Profile Photo & Information</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Customize how your profile appears across boards, cards, and team comments.</p>
                </div>

                {/* Avatar Preview & Upload Area */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'hsl(var(--background))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                  }}
                >
                  {/* Avatar with Camera Hover Overlay */}
                  <div
                    onClick={() => avatarFileInputRef.current?.click()}
                    title="Click to upload custom picture"
                    style={{
                      position: 'relative',
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      boxShadow: 'var(--neu-shadow-raised)',
                      border: '2px solid hsl(var(--primary) / 0.4)',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {customAvatarUrl ? (
                      <img
                        src={customAvatarUrl}
                        alt={displayName || 'User'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: 'hsl(var(--primary))',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 22,
                          fontWeight: 800,
                        }}
                      >
                        {avatarInitials(displayName || user?.email || 'U')}
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                    >
                      <Camera size={18} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, marginTop: 2 }}>Change</span>
                    </div>
                  </div>

                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    style={{ display: 'none' }}
                    onChange={handleAvatarFileUpload}
                  />

                  {/* Upload & Reset Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '6px 14px', gap: 6 }}
                        onClick={() => avatarFileInputRef.current?.click()}
                      >
                        <Upload size={13} />
                        <span>Upload Image File</span>
                      </motion.button>

                      {customAvatarUrl && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '6px 12px', gap: 5 }}
                          onClick={() => {
                            setCropperImageSrc(customAvatarUrl);
                            setCropperOpen(true);
                          }}
                          title="Drag, zoom, or adjust photo framing"
                        >
                          <Crop size={13} />
                          <span>Adjust & Zoom</span>
                        </motion.button>
                      )}

                      {customAvatarUrl && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '6px 12px', gap: 5 }}
                          onClick={() => {
                            setCustomAvatarUrl('');
                            showToast('Avatar reset to default initials', 'info');
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Remove Photo</span>
                        </motion.button>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                      Supports PNG, JPG, GIF, or WebP (max 3MB). Replaces Google photo if signed in with Google.
                    </span>
                  </div>
                </div>

                {/* Preset Avatars Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                    <Sparkles size={14} color="hsl(var(--primary))" />
                    <span>Or choose a stylish 3D avatar:</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 2px' }}>
                    {PRESET_AVATARS.map((url, idx) => {
                      const isSelected = customAvatarUrl === url;
                      return (
                        <motion.div
                          key={idx}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setCustomAvatarUrl(url);
                            showToast('Selected avatar preset! Click Save to apply.', 'info');
                          }}
                          style={{
                            position: 'relative',
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            boxShadow: isSelected
                              ? '0 0 0 2.5px hsl(var(--primary)), var(--neu-shadow-raised-sm)'
                              : 'var(--neu-shadow-raised-sm)',
                            flexShrink: 0,
                          }}
                        >
                          <img src={url} alt={`Avatar ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          {isSelected && (
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                backgroundColor: 'hsl(var(--primary) / 0.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                              }}
                            >
                              <Check size={16} strokeWidth={3} />
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Avatar Border Customization */}
                <div style={{ paddingTop: 4, borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
                  <div style={{ marginBottom: 12 }}>
                    <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 3 }}>Profile Border Style</h4>
                    <p style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                      Choose a border to display around your avatar — useful for IT role identification or personal flair.
                    </p>
                  </div>
                  <ProfileBorderPicker
                    name={displayName || user?.name || 'User'}
                    avatarUrl={customAvatarUrl || undefined}
                    color="hsl(var(--primary))"
                    value={borderStyle}
                    onChange={setBorderStyle}
                  />
                </div>

                {/* Display Name & Email Fields */}
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4, borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Your full name"
                      className="text-input"
                      style={{ height: 38, fontSize: 13 }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                      Custom Image URL (Optional)
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="url"
                        value={customAvatarUrl}
                        onChange={e => setCustomAvatarUrl(e.target.value)}
                        placeholder="https://example.com/my-photo.jpg"
                        className="text-input"
                        style={{ height: 38, fontSize: 13, flex: 1 }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="submit"
                      disabled={isSavingProfile}
                      className="btn btn-primary"
                      style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700 }}
                    >
                      {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
                    </motion.button>
                  </div>
                </form>
              </div>
            )}

            {/* ══ 2. APPEARANCE TAB ══ */}
            {activeTab === 'appearance' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Theme & Color Mode</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Choose between bright neumorphic daylight mode or deep dark gunmetal theme.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <motion.div
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { if (isDark) toggleTheme(); }}
                    style={{
                      padding: 16,
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      border: !isDark ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                      backgroundColor: !isDark ? 'hsl(var(--card))' : 'hsl(var(--background))',
                      boxShadow: !isDark ? 'var(--neu-shadow-raised)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ height: 60, borderRadius: 8, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', padding: 8, display: 'flex', gap: 6 }}>
                      <div style={{ width: 28, height: '100%', backgroundColor: '#e2e8f0', borderRadius: 4 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ height: 10, width: '60%', backgroundColor: '#cbd5e1', borderRadius: 2 }} />
                        <div style={{ height: 24, backgroundColor: '#ffffff', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Sun size={15} color="#f59e0b" /> Light Theme
                      </span>
                      {!isDark && <Check size={16} color="hsl(var(--primary))" strokeWidth={3} />}
                    </div>
                  </motion.div>

                  <motion.div
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { if (!isDark) toggleTheme(); }}
                    style={{
                      padding: 16,
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      border: isDark ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                      backgroundColor: isDark ? 'hsl(var(--card))' : 'hsl(var(--background))',
                      boxShadow: isDark ? 'var(--neu-shadow-raised)' : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8
                    }}
                  >
                    <div style={{ height: 60, borderRadius: 8, backgroundColor: '#0f172a', border: '1px solid #1e293b', padding: 8, display: 'flex', gap: 6 }}>
                      <div style={{ width: 28, height: '100%', backgroundColor: '#1e293b', borderRadius: 4 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ height: 10, width: '60%', backgroundColor: '#334155', borderRadius: 2 }} />
                        <div style={{ height: 24, backgroundColor: '#1e293b', borderRadius: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Moon size={15} color="#6366f1" /> Dark Theme
                      </span>
                      {isDark && <Check size={16} color="hsl(var(--primary))" strokeWidth={3} />}
                    </div>
                  </motion.div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 4 }}>Card Label Display Style</h4>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 10 }}>Configure how priority and category tags look on board cards.</p>
                  
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['text', 'dot'] as const).map(mode => {
                      const active = labelMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setLabelMode(mode)}
                          style={{
                            flex: 1,
                            padding: '8px 10px',
                            borderRadius: 'var(--radius)',
                            border: active ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                            backgroundColor: active ? 'hsl(var(--card))' : 'hsl(var(--background))',
                            boxShadow: active ? 'var(--neu-shadow-raised-sm)' : 'none',
                            color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                            fontSize: 12,
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                          }}
                        >
                          {mode === 'text' ? 'Full Text Badge' : 'Minimal Dot Indicator'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ══ 3. NOTIFICATIONS TAB ══ */}
            {activeTab === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>In-App Alert Activity</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Manage logged real-time activity and due-date triggers.</p>
                </div>

                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'hsl(var(--background))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Stored Notifications</div>
                    <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Currently retaining {notifications.length} alerts in local memory</div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      clearNotifications();
                      showToast('All notifications cleared', 'info');
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    disabled={notifications.length === 0}
                  >
                    <Trash2 size={13} />
                    <span>Clear All</span>
                  </motion.button>
                </div>
              </div>
            )}

            {/* ══ 4. EMAIL UPDATES TAB ══ */}
            {activeTab === 'email' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Automated Email Notifications</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Automated emails for task assignments, deadlines, @mentions, and board movements.</p>
                </div>

                {/* Master Switch */}
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius)', backgroundColor: 'hsl(var(--background))', boxShadow: 'var(--neu-shadow-raised-sm)', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Enable Email Delivery</div>
                    <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>Dispatches email notifications when trigger events happen</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailSettings.enabled}
                    onChange={e => {
                      updateEmailSettings({ enabled: e.target.checked });
                      showToast(e.target.checked ? 'Email notifications enabled' : 'Email notifications paused', 'info');
                    }}
                    style={{ width: 16, height: 16, accentColor: 'hsl(var(--primary))' }}
                  />
                </label>

                {/* Event Preferences */}
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'hsl(var(--background))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Notification Triggers</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailSettings.notifyOnAssign}
                        onChange={e => updateEmailSettings({ notifyOnAssign: e.target.checked })}
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      Notify member on task assignment
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailSettings.notifyOnDue}
                        onChange={e => updateEmailSettings({ notifyOnDue: e.target.checked })}
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      Notify member on due dates & overdue alerts
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailSettings.notifyOnStatusChange}
                        onChange={e => updateEmailSettings({ notifyOnStatusChange: e.target.checked })}
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      Notify member on task status changes (completed / reopened)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'hsl(var(--foreground))', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailSettings.notifyOnMention ?? true}
                        onChange={e => updateEmailSettings({ notifyOnMention: e.target.checked })}
                        style={{ accentColor: 'hsl(var(--primary))' }}
                      />
                      Notify member on @mentions in comments
                    </label>
                  </div>
                </div>

                {/* Test Dispatch */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Send Instant Test Notification</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="email"
                      placeholder="recipient@company.com"
                      value={testEmail}
                      onChange={e => setTestEmail(e.target.value)}
                      className="text-input"
                      style={{ height: 36, fontSize: 12.5, flex: 1 }}
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="btn btn-primary"
                      onClick={handleSendTestEmail}
                      disabled={isSendingTestEmail}
                      style={{ fontSize: 12, padding: '0 14px', gap: 6 }}
                    >
                      {isSendingTestEmail ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      <span>Send Test</span>
                    </motion.button>
                  </div>
                </div>
              </div>
            )}

            {/* ══ 5. CUSTOM LABELS TAB ══ */}
            {activeTab === 'labels' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Workspace Category Labels</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Create customized classification tags available on all task cards.</p>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="New label name (e.g. Design, Mobile, Security)..."
                    value={newLabelName}
                    onChange={e => setNewLabelName(e.target.value)}
                    className="text-input"
                    style={{ height: 36, fontSize: 12.5, flex: 1 }}
                  />
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={e => setNewLabelColor(e.target.value)}
                    style={{ width: 36, height: 36, padding: 0, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                  />
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    className="btn btn-primary"
                    style={{ height: 36, fontSize: 12, padding: '0 12px' }}
                    onClick={() => {
                      if (newLabelName.trim()) {
                        addLabel(newLabelName.trim(), newLabelColor);
                        setNewLabelName('');
                        showToast('Custom label created', 'success');
                      }
                    }}
                  >
                    <Plus size={14} /> Add
                  </motion.button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                  {customLabels.map(l => (
                    <div
                      key={l.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 20,
                        backgroundColor: `${l.color}22`,
                        color: l.color,
                        fontSize: 12,
                        fontWeight: 600,
                        border: `1px solid ${l.color}55`
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: l.color }} />
                      <span>{l.name}</span>
                      <button
                        onClick={() => removeLabel(l.id)}
                        style={{ background: 'none', border: 'none', color: l.color, cursor: 'pointer', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══ 6. PRIVACY & STORAGE TAB ══ */}
            {activeTab === 'privacy' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: 2 }}>Storage, Backups & Account Security</h3>
                  <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Export local data snapshots or manage account deletion.</p>
                </div>

                {/* Storage Diagnostics */}
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'hsl(var(--background))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 10,
                    textAlign: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Boards</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{boards.length}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Task Cards</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{totalCards}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>Local Storage</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{storageKB} KB</div>
                  </div>
                </div>

                {/* Export & Restore */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: 12.5, padding: '8px 12px' }}
                    onClick={handleExportData}
                  >
                    <Download size={14} /> Export Backup (.json)
                  </motion.button>
                  <label style={{ flex: 1, margin: 0 }}>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', fontSize: 12.5, padding: '8px 12px' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload size={14} /> Restore Backup
                    </motion.button>
                    <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportData} />
                  </label>
                </div>

                {/* Danger Zone: Account Deletion */}
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'hsl(var(--destructive) / 0.06)',
                    border: '1px solid hsl(var(--destructive) / 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'hsl(var(--destructive))', fontWeight: 700, fontSize: 13 }}>
                    <AlertTriangle size={15} />
                    <span>Danger Zone: Deactivate & Delete Account</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'hsl(var(--muted-foreground))', lineHeight: 1.45 }}>
                    Permanently delete your profile and account from Supabase. All your workspace memberships, profile data, and notifications will be wiped from the database immediately.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => {
                      if (!user?.email) return;
                      showConfirm({
                        title: 'Delete Account & Profile Permanently?',
                        message: `Are you sure you want to delete your account (${user.email})? Your profile, notifications, and all board memberships will be erased from Supabase. This action cannot be undone.`,
                        confirmText: 'Delete Account Forever',
                        variant: 'danger',
                        icon: 'trash',
                        onConfirm: async () => {
                          const res = await deleteAccount();
                          if (res.success) {
                            showToast('Your account and profile have been permanently deleted.', 'info');
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
                      fontSize: 12,
                      padding: '6px 14px',
                    }}
                  >
                    Delete Account
                  </motion.button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Profile Photo Cropper & Drag/Zoom Modal */}
      <AvatarCropperModal
        isOpen={cropperOpen}
        imageSrc={cropperImageSrc}
        onClose={() => setCropperOpen(false)}
        onApply={handleCropperApply}
      />
    </div>
  );
}
