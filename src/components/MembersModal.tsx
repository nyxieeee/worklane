import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, UserPlus, Camera, Trash2, LogOut, Shield, User, Eye,
  Crown, Info, Lock, Search, Link2, Copy, Check, Sparkles,
  UserCheck, Loader2, Mail, Palette, Globe, Server, Cpu, Users, Plus, Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useNotifStore } from '../store/useNotifStore';
import { useAuthStore } from '../store/useAuthStore';
import { useEmailStore } from '../store/useEmailStore';
import { avatarInitials, sortMembersWithOwnerFirst, uid, getMemberTeamCategory, getTeamBadgeInfo } from '../utils';
import { NeumorphicSelect, SelectOption } from './ui/NeumorphicSelect';
import AvatarBorder from './ui/AvatarBorder';
import ProfileBorderPicker from './ui/ProfileBorderPicker';
import { Member, MemberRole, BORDER_PRESETS } from '../types';
import { supabaseService } from '../services/supabaseService';
import AvatarCropperModal from './modals/AvatarCropperModal';

interface Props {
  onClose: () => void;
}

type AssignableRole = 'admin' | 'member' | 'observer';

interface RegisteredUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

const OWNER_ROLE_OPTIONS: SelectOption<AssignableRole>[] = [
  { value: 'admin', label: 'Admin', subLabel: 'Full board management', icon: <Shield size={13} />, color: 'hsl(var(--primary))' },
  { value: 'member', label: 'Member', subLabel: 'Active team member', icon: <User size={13} />, color: 'hsl(var(--foreground))' },
  { value: 'observer', label: 'Observer', subLabel: 'View-only access', icon: <Eye size={13} />, color: '#f59e0b' },
];

const ADMIN_ROLE_OPTIONS: SelectOption<AssignableRole>[] = [
  { value: 'member', label: 'Member', subLabel: 'Active team member', icon: <User size={13} />, color: 'hsl(var(--foreground))' },
  { value: 'observer', label: 'Observer', subLabel: 'View-only access', icon: <Eye size={13} />, color: '#f59e0b' },
];

export default function MembersModal({ onClose }: Props) {
  const board = useWorkStore(s => s.boards.find(b => b.id === s.activeBoardId));
  const addMember = useWorkStore(s => s.addMember);
  const updateMember = useWorkStore(s => s.updateMember);
  const removeMember = useWorkStore(s => s.removeMember);
  const leaveBoard = useWorkStore(s => s.leaveBoard);
  const showToast = useToastStore(s => s.showToast);
  const showConfirm = useConfirmStore(s => s.showConfirm);
  const currentUser = useAuthStore(s => s.user);
  const updateUserProfile = useAuthStore(s => s.updateUserProfile);

  // Search & Registered users state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RegisteredUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastSearchedQuery, setLastSearchedQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [role, setRole] = useState<AssignableRole>('member');
  const [isAdding, setIsAdding] = useState(false);

  // Invite link state
  const [inviteRole, setInviteRole] = useState<AssignableRole>('member');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [showInviteTab, setShowInviteTab] = useState(false);

  // Border style override state (owner can set any member's border)
  const [borderPickerMemberId, setBorderPickerMemberId] = useState<string | null>(null);
  const [pendingBorderStyle, setPendingBorderStyle] = useState<string>('none');
  const [pendingMemberStyles, setPendingMemberStyles] = useState<Record<string, string>>({});

  // Team Filtering
  const [teamFilter, setTeamFilter] = useState<'all' | 'frontend' | 'backend' | 'work'>('all');
  const [addTeamRole, setAddTeamRole] = useState<'none' | 'frontend' | 'backend'>('none');

  const searchTimeoutRef = useRef<number | undefined>(undefined);

  const updateMemberRole = useWorkStore(s => s.updateMemberRole);

  const members = useMemo(
    () => sortMembersWithOwnerFirst(board?.members || [], board?.createdBy),
    [board?.members, board?.createdBy]
  );

  const frontendMembers = useMemo(() => members.filter(m => getMemberTeamCategory(m.borderStyle) === 'frontend'), [members]);
  const backendMembers = useMemo(() => members.filter(m => getMemberTeamCategory(m.borderStyle) === 'backend'), [members]);
  const workMembers = useMemo(() => members.filter(m => getMemberTeamCategory(m.borderStyle) === 'work'), [members]);

  if (!board) return null;
  const currentEmail = currentUser?.email?.toLowerCase().trim();
  const isOwner = !!(board.createdBy && currentEmail && board.createdBy.toLowerCase().trim() === currentEmail);
  const currentMemberObj = members.find(m => m.email && currentEmail && m.email.toLowerCase().trim() === currentEmail);
  const isAdmin = !isOwner && currentMemberObj?.role === 'admin';
  const canManage = isOwner || isAdmin || !board.createdBy;

  // Search Supabase registered users with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      setLastSearchedQuery('');
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const results = await supabaseService.searchRegisteredProfiles(trimmed);
        setSearchResults(results);
        setLastSearchedQuery(trimmed);
      } catch (err) {
        console.warn('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState('');
  const [croppingMemberId, setCroppingMemberId] = useState<string | null>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>, memberId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Avatar image must be under 5 MB', 'error');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = (ev.target?.result as string) ?? '';
      if (dataUrl && memberId) {
        setCropperImageSrc(dataUrl);
        setCroppingMemberId(memberId);
        setCropperOpen(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropperApply = async (croppedDataUrl: string) => {
    if (croppingMemberId) {
      updateMember(croppingMemberId, { avatarUrl: croppedDataUrl });

      const member = members.find(m => m.id === croppingMemberId);
      const isCurrent = (member && currentEmail && member.email && member.email.toLowerCase().trim() === currentEmail.toLowerCase().trim()) || (currentUser?.id === croppingMemberId);
      if (isCurrent) {
        try {
          await updateUserProfile({ avatarUrl: croppedDataUrl });
        } catch (err) {
          console.warn('Failed to update user profile avatar:', err);
        }
      }

      showToast('Profile photo updated', 'success');
    }
    setCropperOpen(false);
    setCroppingMemberId(null);
  };

  const handleAddSelected = async () => {
    if (!canManage || !selectedUser || isAdding) return;
    const cleanEmail = selectedUser.email.toLowerCase().trim();
    
    // Check if already in board
    if (members.some(m => m.email && m.email.toLowerCase().trim() === cleanEmail)) {
      showToast('User is already a member of this board', 'error');
      return;
    }

    setIsAdding(true);
    try {
      const result = await addMember(selectedUser.name, cleanEmail, selectedUser.avatarUrl, role, selectedUser.id, addTeamRole);
      if (result !== null) {
        const adderName = currentUser?.name || currentUser?.email || 'A board manager';
        
        // In-app notification
        useNotifStore.getState().addNotification(
          `Invited to board: ${board.name}`,
          `${adderName} added you as ${role === 'observer' ? 'an Observer' : role === 'admin' ? 'an Admin' : 'a Member'} on "${board.name}".`,
          'users',
          null,
          board.id,
          cleanEmail
        );

        // Dispatched email log
        useEmailStore.getState().sendEmailNotification({
          recipient: { id: result || uid(), name: selectedUser.name, email: cleanEmail, color: '#6366f1' },
          subject: `You've been added to board "${board.name}" on Worklane`,
          body: `Hi ${selectedUser.name},\n\n${adderName} added you as ${role === 'observer' ? 'an Observer (study mode)' : role === 'admin' ? 'an Admin' : 'a Member'} to collaborate on board "${board.name}".\n\nWorklane Team`,
          eventType: 'member_added',
          metadata: {
            boardName: board.name,
            boardId: board.id,
            actorName: adderName,
          },
        });

        showToast(`Added ${selectedUser.name} (${role === 'observer' ? 'Observer' : role === 'admin' ? 'Admin' : 'Member'}) to "${board.name}"`, 'success');
        setSelectedUser(null);
        setSearchQuery('');
        setSearchResults([]);
        setRole('member');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to add member to board', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleCopyInviteLink = (assignedRole: AssignableRole = inviteRole) => {
    const inviteUrl = `${window.location.origin}/?joinBoard=${board.id}&role=${assignedRole}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2200);
    showToast(`Invite link copied! Users who sign in with this link join as ${assignedRole === 'admin' ? 'Admin' : assignedRole === 'observer' ? 'Observer' : 'Member'}.`, 'success');
  };

  const handleLeaveBoard = () => {
    if (!currentEmail) return;
    showConfirm({
      title: `Leave "${board.name}"?`,
      message: `Are you sure you want to leave this board? You will lose access unless re-invited.`,
      confirmText: 'Leave Board',
      variant: 'danger',
      icon: 'logout',
      onConfirm: () => {
        leaveBoard(board.id, currentEmail);
        showToast(`You left board "${board.name}"`, 'info');
        onClose();
      }
    });
  };

  const inviteUrl = `${window.location.origin}/?joinBoard=${board.id}&role=${inviteRole}`;

  const renderMemberItem = (member: Member) => {
    const isCurrent = !!(member.email && currentEmail && member.email.toLowerCase().trim() === currentEmail);
    const isMemberOwner = !!(board.createdBy && member.email && board.createdBy.toLowerCase().trim() === member.email.toLowerCase().trim());
    const memberRole: MemberRole = isMemberOwner ? 'owner' : (member.role || 'member');
    const badge = getTeamBadgeInfo(member.borderStyle);

    return (
      <React.Fragment key={member.id}>
        <motion.div
          layout
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 12px',
            borderRadius: 12,
            backgroundColor: 'hsl(var(--card))',
            boxShadow: 'var(--neu-shadow-raised-sm)',
            gap: 10
          }}
        >
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <AvatarBorder borderStyle={member.borderStyle} size={34}>
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.name}
                  style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    backgroundColor: member.color || 'hsl(var(--primary))',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  {avatarInitials(member.name)}
                </div>
              )}
            </AvatarBorder>
            {isCurrent && (
              <label
                title="Change photo"
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: 'hsl(var(--primary))',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <Camera size={8} />
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleAvatarUpload(e, member.id)} />
              </label>
            )}
          </div>

          {/* Name & Email */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.name}
              </span>
              {isCurrent && (
                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                  You
                </span>
              )}
              {badge ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isOwner || isCurrent) {
                      setBorderPickerMemberId(borderPickerMemberId === member.id ? null : member.id);
                      setPendingBorderStyle(member.borderStyle || 'none');
                    }
                  }}
                  style={{
                    fontSize: 9.5, fontWeight: 700, padding: '1.5px 7px', borderRadius: 9999,
                    background: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.color}40`,
                    display: 'inline-flex', alignItems: 'center', gap: 3.5,
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    cursor: (isOwner || isCurrent) ? 'pointer' : 'default'
                  }}
                  title={(isOwner || isCurrent) ? 'Click to change team role' : undefined}
                >
                  <span>{badge.label}</span>
                  {(isOwner || isCurrent) && <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>}
                </button>
              ) : member.borderStyle && member.borderStyle !== 'none' ? (() => {
                const bp = BORDER_PRESETS.find(p => p.key === member.borderStyle);
                return bp ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (isOwner || isCurrent) {
                        setBorderPickerMemberId(borderPickerMemberId === member.id ? null : member.id);
                        setPendingBorderStyle(member.borderStyle || 'none');
                      }
                    }}
                    style={{
                      fontSize: 9.5, fontWeight: 700, padding: '1.5px 6px', borderRadius: 9999,
                      background: 'hsl(var(--muted))',
                      color: 'hsl(var(--muted-foreground))',
                      border: '1px solid hsl(var(--border))',
                      cursor: (isOwner || isCurrent) ? 'pointer' : 'default',
                      display: 'inline-flex', alignItems: 'center', gap: 3
                    }}
                  >
                    <span>{bp.label}</span>
                    {(isOwner || isCurrent) && <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>}
                  </button>
                ) : null;
              })() : null}
            </div>
            {member.email && (
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.email}
              </div>
            )}
          </div>

          {/* Role Badge / Role Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {isMemberOwner ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  borderRadius: 9999,
                  backgroundColor: 'hsl(var(--primary) / 0.12)',
                  color: 'hsl(var(--primary))',
                  fontSize: 11.5,
                  fontWeight: 700,
                  boxShadow: 'var(--neu-shadow-raised-sm)',
                }}
              >
                <Crown size={12} />
                <span>Owner</span>
              </div>
            ) : canManage ? (
              <NeumorphicSelect
                value={memberRole as AssignableRole}
                options={isOwner ? OWNER_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS}
                onChange={(newRole) => {
                  updateMemberRole(board.id, member.id, newRole);
                  showToast(`Updated ${member.name}'s role to ${newRole}`, 'success');
                }}
                size="sm"
              />
            ) : (
              <div
                style={{
                  padding: '3px 8px',
                  borderRadius: 9999,
                  backgroundColor: 'hsl(var(--card))',
                  boxShadow: 'var(--neu-shadow-input)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: memberRole === 'admin' ? 'hsl(var(--primary))' : memberRole === 'observer' ? '#f59e0b' : 'hsl(var(--foreground))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {memberRole === 'admin' ? <Shield size={11} /> : memberRole === 'observer' ? <Eye size={11} /> : <User size={11} />}
                <span style={{ textTransform: 'capitalize' }}>{memberRole}</span>
              </div>
            )}

            {/* Border Style / Palette button — owner can assign, member can see their own */}
            {(isOwner || isCurrent) && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (borderPickerMemberId === member.id) {
                    setBorderPickerMemberId(null);
                  } else {
                    setBorderPickerMemberId(member.id);
                    setPendingBorderStyle(member.borderStyle || 'none');
                  }
                }}
                style={{
                  background: borderPickerMemberId === member.id ? 'hsl(var(--primary) / 0.12)' : 'none',
                  border: borderPickerMemberId === member.id ? '1px solid hsl(var(--primary) / 0.4)' : 'none',
                  cursor: 'pointer',
                  color: borderPickerMemberId === member.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.12s',
                }}
                title={isOwner && !isCurrent ? `More roles & borders for ${member.name}` : 'Change your team role & border'}
              >
                <Palette size={13} />
              </motion.button>
            )}

            {/* Delete Member Button */}
            {canManage && !isMemberOwner && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  showConfirm({
                    title: `Remove ${member.name}?`,
                    message: `Are you sure you want to remove ${member.name} from this board?`,
                    confirmText: 'Remove Member',
                    variant: 'danger',
                    icon: 'trash',
                    onConfirm: () => {
                      removeMember(member.id);
                      showToast(`Removed ${member.name}`, 'info');
                    }
                  });
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'hsl(var(--destructive))',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Remove from board"
              >
                <Trash2 size={14} />
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Inline Border Picker Panel (expandable with INSTANT AUTO-SAVE) */}
        <AnimatePresence>
          {borderPickerMemberId === member.id && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                padding: '14px',
                borderRadius: 12,
                backgroundColor: 'hsl(var(--background))',
                boxShadow: 'var(--neu-shadow-input)',
                border: '1px solid hsl(var(--primary) / 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Palette size={13} color="hsl(var(--primary))" />
                      <span>{isOwner && !isCurrent ? `Set Team / Border Role for ${member.name}` : 'Your Team / Border Style'}</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                      Click any style below to instantly save and apply.
                    </span>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 11, padding: '4px 12px' }}
                    onClick={() => setBorderPickerMemberId(null)}
                  >
                    Done
                  </motion.button>
                </div>

                <ProfileBorderPicker
                  name={member.name}
                  avatarUrl={member.avatarUrl}
                  color={member.color}
                  value={pendingMemberStyles[member.id] !== undefined ? pendingMemberStyles[member.id] : (member.borderStyle || 'none')}
                  onChange={(newStyle) => {
                    setPendingBorderStyle(newStyle);
                    setPendingMemberStyles(prev => ({ ...prev, [member.id]: newStyle }));
                    updateMember(member.id, { borderStyle: newStyle });
                    const preset = BORDER_PRESETS.find(p => p.key === newStyle);
                    const label = preset?.label || newStyle;
                    showToast(
                      newStyle === 'none'
                        ? `Removed profile border for ${member.name}`
                        : `Applied "${label}" to ${member.name}`,
                      'success'
                    );
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </React.Fragment>
    );
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal small-modal"
        style={{ transformStyle: 'preserve-3d', maxWidth: 540 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="modal-title">Board Team & Roles</h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'hsl(var(--muted-foreground))',
                backgroundColor: 'hsl(var(--card))',
                boxShadow: 'var(--neu-shadow-input)',
                padding: '2px 8px',
                borderRadius: 9999
              }}
            >
              {members.length}
            </span>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', overflowX: 'visible', maxHeight: '72vh', paddingBottom: 16 }}>
          
          {/* Team Filter / Navigation Pills */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                  type="button"
                  style={{
                    padding: '5px 11px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: teamFilter === 'all' ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.6)',
                    backgroundColor: teamFilter === 'all' ? 'hsl(var(--primary) / 0.14)' : 'hsl(var(--card))',
                    color: teamFilter === 'all' ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                    boxShadow: teamFilter === 'all' ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onClick={() => setTeamFilter('all')}
                >
                  <Users size={12} />
                  <span>All ({members.length})</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                  type="button"
                  style={{
                    padding: '5px 11px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: teamFilter === 'frontend' ? '1.5px solid #0284c7' : '1px solid rgba(14, 165, 233, 0.35)',
                    backgroundColor: teamFilter === 'frontend' ? 'rgba(14, 165, 233, 0.18)' : 'hsl(var(--card))',
                    color: '#0284c7',
                    boxShadow: teamFilter === 'frontend' ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onClick={() => setTeamFilter('frontend')}
                >
                  <Globe size={12} />
                  <span>Frontend ({frontendMembers.length})</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                  type="button"
                  style={{
                    padding: '5px 11px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: teamFilter === 'backend' ? '1.5px solid #ea580c' : '1px solid rgba(249, 115, 22, 0.35)',
                    backgroundColor: teamFilter === 'backend' ? 'rgba(249, 115, 22, 0.18)' : 'hsl(var(--card))',
                    color: '#ea580c',
                    boxShadow: teamFilter === 'backend' ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onClick={() => setTeamFilter('backend')}
                >
                  <Server size={12} />
                  <span>Backend ({backendMembers.length})</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                  type="button"
                  style={{
                    padding: '5px 11px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: teamFilter === 'work' ? '1.5px solid #8b5cf6' : '1px solid rgba(139, 92, 246, 0.35)',
                    backgroundColor: teamFilter === 'work' ? 'rgba(139, 92, 246, 0.18)' : 'hsl(var(--card))',
                    color: '#8b5cf6',
                    boxShadow: teamFilter === 'work' ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                    display: 'flex', alignItems: 'center', gap: 5,
                    transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onClick={() => setTeamFilter('work')}
                >
                  <Briefcase size={12} />
                  <span>Work Related ({workMembers.length})</span>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Current Members List */}
          <AnimatePresence mode="wait">
            <motion.div
              key={teamFilter}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {members.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))', fontSize: 13 }}>
                  No members found
                </div>
              ) : teamFilter === 'frontend' ? (
                frontendMembers.length === 0 ? (
                  <div style={{
                    padding: '24px 16px', textAlign: 'center', borderRadius: 12,
                    backgroundColor: 'rgba(14, 165, 233, 0.05)', border: '1px dashed rgba(14, 165, 233, 0.3)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                  }}>
                    <Globe size={24} style={{ color: '#0284c7' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>No Frontend Members Yet</div>
                    <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', maxWidth: 360 }}>
                      Switch to "All", then click the palette icon on any member to set their profile border to <strong>Frontend Dev</strong>.
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.03 }}
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 11.5, padding: '5px 14px', marginTop: 4 }}
                      onClick={() => setTeamFilter('all')}
                    >
                      View All Members ({members.length})
                    </motion.button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {frontendMembers.map(renderMemberItem)}
                  </div>
                )
              ) : teamFilter === 'backend' ? (
                backendMembers.length === 0 ? (
                  <div style={{
                    padding: '24px 16px', textAlign: 'center', borderRadius: 12,
                    backgroundColor: 'rgba(249, 115, 22, 0.05)', border: '1px dashed rgba(249, 115, 22, 0.3)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                  }}>
                    <Server size={24} style={{ color: '#ea580c' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>No Backend Members Yet</div>
                    <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', maxWidth: 360 }}>
                      Switch to "All", then click the palette icon on any member to set their profile border to <strong>Backend Dev</strong>.
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.03 }}
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 11.5, padding: '5px 14px', marginTop: 4 }}
                      onClick={() => setTeamFilter('all')}
                    >
                      View All Members ({members.length})
                    </motion.button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {backendMembers.map(renderMemberItem)}
                  </div>
                )
              ) : teamFilter === 'work' ? (
                workMembers.length === 0 ? (
                  <div style={{
                    padding: '24px 16px', textAlign: 'center', borderRadius: 12,
                    backgroundColor: 'rgba(139, 92, 246, 0.05)', border: '1px dashed rgba(139, 92, 246, 0.3)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
                  }}>
                    <Briefcase size={24} style={{ color: '#8b5cf6' }} />
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--foreground))' }}>No Work-Related or Custom Roles Yet</div>
                    <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', maxWidth: 360 }}>
                      Click the palette icon on any member to assign an Engineering, Product, or Custom role & badge.
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.03 }}
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: 11.5, padding: '5px 14px', marginTop: 4 }}
                      onClick={() => setTeamFilter('all')}
                    >
                      View All Members ({members.length})
                    </motion.button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {workMembers.map(renderMemberItem)}
                  </div>
                )
              ) : (
                /* All Members List */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'visible' }}>
                  {members.map(renderMemberItem)}
                </div>
              )}
            </motion.div>
          </AnimatePresence>



          {/* Add Member Form (Owner & Admin Only) */}
          {canManage ? (
            <div style={{ marginTop: 6, paddingTop: 14, borderTop: '1px solid hsl(var(--border) / 0.6)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="field-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserCheck size={14} style={{ color: 'hsl(var(--primary))' }} />
                  <span>Add Registered Member</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowInviteTab(v => !v)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'hsl(var(--primary))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Link2 size={13} />
                  <span>{showInviteTab ? 'Hide Invite Link' : 'Invite via Link'}</span>
                </button>
              </div>

              {/* Verified User Search Input */}
              {!selectedUser && (
                <div style={{ position: 'relative' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        left: 12,
                        color: 'hsl(var(--muted-foreground))',
                        pointerEvents: 'none'
                      }}
                    />
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Search registered user by name or email..."
                      value={searchQuery}
                      onChange={e => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        if (!val.trim()) {
                          setSearchResults([]);
                          setIsSearching(false);
                          setLastSearchedQuery('');
                        } else {
                          setIsSearching(true);
                        }
                      }}
                      style={{ paddingLeft: 34, paddingRight: isSearching ? 34 : searchQuery ? 30 : 12 }}
                    />
                    {isSearching ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                        style={{
                          position: 'absolute',
                          right: 12,
                          color: 'hsl(var(--primary))',
                        }}
                      />
                    ) : searchQuery ? (
                      <button
                        type="button"
                        onClick={() => { setSearchQuery(''); setSearchResults([]); setIsSearching(false); setLastSearchedQuery(''); }}
                        style={{
                          position: 'absolute',
                          right: 10,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'hsl(var(--muted-foreground))',
                          padding: 2,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>

                  {/* Search Results Dropdown - Floating overlay that doesn't shift the modal */}
                  {searchQuery.trim().length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        left: 0,
                        right: 0,
                        zIndex: 60,
                        backgroundColor: 'hsl(var(--card))',
                        borderRadius: 12,
                        boxShadow: '0 12px 32px -4px rgba(0,0,0,0.35), var(--neu-shadow-raised)',
                        border: '1px solid hsl(var(--border) / 0.85)',
                        backdropFilter: 'blur(16px)',
                        maxHeight: 220,
                        overflowY: 'auto',
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {isSearching || lastSearchedQuery !== searchQuery.trim() ? (
                        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8, color: 'hsl(var(--muted-foreground))', fontSize: 12 }}>
                          <Loader2 size={13} className="animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                          <span>Searching registered users...</span>
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div style={{ padding: '10px 12px', fontSize: 12, color: 'hsl(var(--muted-foreground))', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--foreground))', fontWeight: 600 }}>
                            <Info size={13} color="hsl(var(--primary))" />
                            <span>No registered user found for "{searchQuery}"</span>
                          </div>
                          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4 }}>
                            Only users registered on Worklane appear here. You can generate an invite link below so they can sign in and automatically join.
                          </p>
                          <motion.button
                            whileTap={{ scale: 0.96 }}
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleCopyInviteLink(role)}
                            style={{ alignSelf: 'flex-start', fontSize: 11.5, padding: '5px 12px', gap: 6, marginTop: 4 }}
                          >
                            <Copy size={12} />
                            <span>Copy Invite Link (as {role})</span>
                          </motion.button>
                        </div>
                      ) : (
                        searchResults.map(user => {
                          const isAlreadyMember = members.some(
                            m => m.email && m.email.toLowerCase().trim() === user.email.toLowerCase().trim()
                          );

                          return (
                            <div
                              key={user.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 10px',
                                borderRadius: 8,
                                backgroundColor: isAlreadyMember ? 'hsl(var(--muted) / 0.25)' : 'hsl(var(--card))',
                                boxShadow: isAlreadyMember ? 'none' : 'var(--neu-shadow-raised-sm)',
                                opacity: isAlreadyMember ? 0.6 : 1,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                {user.avatarUrl ? (
                                  <img
                                    src={user.avatarUrl}
                                    alt={user.name}
                                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: '50%',
                                      backgroundColor: 'hsl(var(--primary))',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    {avatarInitials(user.name)}
                                  </div>
                                )}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user.name}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {user.email}
                                  </div>
                                </div>
                              </div>

                              {isAlreadyMember ? (
                                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'hsl(var(--muted-foreground))', padding: '2px 7px', borderRadius: 6, backgroundColor: 'hsl(var(--muted) / 0.4)' }}>
                                  In Team
                                </span>
                              ) : (
                                <motion.button
                                  whileTap={{ scale: 0.94 }}
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setSearchQuery('');
                                    setSearchResults([]);
                                  }}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'hsl(var(--primary))' }}
                                >
                                  Select
                                </motion.button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Selected User Confirmation Card */}
              {selectedUser && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    border: '1.5px solid hsl(var(--primary) / 0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      {selectedUser.avatarUrl ? (
                        <img
                          src={selectedUser.avatarUrl}
                          alt={selectedUser.name}
                          style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            backgroundColor: 'hsl(var(--primary))',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 700
                          }}
                        >
                          {avatarInitials(selectedUser.name)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span>{selectedUser.name}</span>
                          <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 4, backgroundColor: 'hsl(142 76% 36% / 0.15)', color: 'hsl(142 76% 36%)', fontWeight: 700 }}>
                            Registered Account
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                          {selectedUser.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'hsl(var(--muted-foreground))',
                        padding: 4,
                      }}
                      title="Choose another user"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 10, alignItems: 'center' }}>
                      <div>
                        <label className="field-label" style={{ fontSize: 11, marginBottom: 4 }}>Board Permission</label>
                        <NeumorphicSelect
                          value={role}
                          options={isOwner ? OWNER_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS}
                          onChange={setRole}
                          size="md"
                        />
                      </div>
                      <div style={{ alignSelf: 'flex-end' }}>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          className="btn btn-primary"
                          onClick={handleAddSelected}
                          disabled={isAdding}
                          style={{ width: '100%', height: 38, justifyContent: 'center', opacity: isAdding ? 0.75 : 1 }}
                        >
                          {isAdding ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Adding...
                            </>
                          ) : (
                            <>
                              <UserPlus size={14} /> Add to Team
                            </>
                          )}
                        </motion.button>
                      </div>
                    </div>

                    <div>
                      <label className="field-label" style={{ fontSize: 11, marginBottom: 4 }}>Team Role / Specialization</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          style={{
                            flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                            border: addTeamRole === 'none' ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.6)',
                            backgroundColor: addTeamRole === 'none' ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--card))',
                            color: addTeamRole === 'none' ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => setAddTeamRole('none')}
                        >
                          General
                        </button>
                        <button
                          type="button"
                          style={{
                            flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                            border: addTeamRole === 'frontend' ? '1.5px solid #0284c7' : '1px solid rgba(14, 165, 233, 0.35)',
                            backgroundColor: addTeamRole === 'frontend' ? 'rgba(14, 165, 233, 0.15)' : 'hsl(var(--card))',
                            color: '#0284c7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => setAddTeamRole('frontend')}
                        >
                          <Globe size={12} /> Frontend Dev
                        </button>
                        <button
                          type="button"
                          style={{
                            flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                            border: addTeamRole === 'backend' ? '1.5px solid #ea580c' : '1px solid rgba(249, 115, 22, 0.35)',
                            backgroundColor: addTeamRole === 'backend' ? 'rgba(249, 115, 22, 0.15)' : 'hsl(var(--card))',
                            color: '#ea580c',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            transition: 'all 0.15s ease'
                          }}
                          onClick={() => setAddTeamRole('backend')}
                        >
                          <Server size={12} /> Backend Dev
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Shareable Invite Link Card (Collapsible or toggleable) */}
              <AnimatePresence>
                {showInviteTab && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    style={{
                      overflow: 'visible',
                      position: 'relative',
                      padding: '12px 14px',
                      borderRadius: 12,
                      backgroundColor: 'hsl(var(--muted) / 0.3)',
                      border: '1px dashed hsl(var(--primary) / 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                      <Sparkles size={14} color="hsl(var(--primary))" />
                      <span>Invite to Worklane & Join Board</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: 'hsl(var(--muted-foreground))', lineHeight: 1.45 }}>
                      Anyone with this link who registers or signs in with Google will automatically join this board.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8, alignItems: 'center', marginTop: 2, position: 'relative' }}>
                      <NeumorphicSelect
                        value={inviteRole}
                        options={isOwner ? OWNER_ROLE_OPTIONS : ADMIN_ROLE_OPTIONS}
                        onChange={setInviteRole}
                        size="sm"
                        placement="top"
                      />
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handleCopyInviteLink(inviteRole)}
                        style={{ fontSize: 11.5, height: 34, justifyContent: 'center', gap: 6 }}
                      >
                        {copiedInvite ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedInvite ? 'Copied Link!' : 'Copy Invite Link'}</span>
                      </motion.button>
                    </div>

                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        backgroundColor: 'hsl(var(--card))',
                        boxShadow: 'var(--neu-shadow-input)',
                        fontSize: 10.5,
                        color: 'hsl(var(--muted-foreground))',
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {inviteUrl}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Role Permissions Guide */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: 'hsl(var(--muted) / 0.35)',
                  border: '1px solid hsl(var(--border) / 0.5)',
                  fontSize: 11.5,
                  color: 'hsl(var(--muted-foreground))',
                  lineHeight: 1.45,
                }}
              >
                <div style={{ fontWeight: 700, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Info size={13} style={{ color: 'hsl(var(--primary))' }} />
                  <span>Role Permissions:</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <li>
                    <strong style={{ color: 'hsl(var(--foreground))' }}>Admin:</strong> Assign tasks, manage members, and configure boards.
                  </li>
                  <li>
                    <strong style={{ color: 'hsl(var(--foreground))' }}>Member:</strong> Complete assigned cards, edit details, and post comments.
                  </li>
                  <li>
                    <strong style={{ color: 'hsl(var(--foreground))' }}>Observer:</strong> Read-only view mode — view board progress, check task details, and post comments.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'hsl(var(--card))',
                boxShadow: 'var(--neu-shadow-input)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11.5,
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              <Lock size={13} style={{ color: 'hsl(var(--primary))', flexShrink: 0 }} />
              <span>Only the board owner and admins can invite or add new team members.</span>
            </div>
          )}

          {/* Leave Board Option for enrolled non-owner members only */}
          {!isOwner && !!currentMemberObj && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--neu-shadow-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'hsl(var(--foreground))' }}>Leave this board</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>You will lose access to this board until re-invited.</div>
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                className="btn btn-secondary"
                style={{ color: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive) / 0.3)', gap: 6, fontSize: 11.5, flexShrink: 0 }}
                onClick={handleLeaveBoard}
              >
                <LogOut size={13} />
                Leave Board
              </motion.button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={onClose}>Close</motion.button>
        </div>
      </motion.div>

      {/* Avatar Cropper Modal for member avatar uploads */}
      <AvatarCropperModal
        isOpen={cropperOpen}
        imageSrc={cropperImageSrc}
        onClose={() => {
          setCropperOpen(false);
          setCroppingMemberId(null);
        }}
        onApply={handleCropperApply}
      />
    </div>
  );
}
