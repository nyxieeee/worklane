import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AlignLeft, Paperclip, MessageSquare, Calendar, Tag, Users,
  Trash2, CheckSquare, Square, Download, X, Send, Plus, Check,
  Eye, Image as ImageIcon, Maximize2, AtSign, Reply, Sparkles,
  FileSpreadsheet, FileText, FileCode, FileArchive, File, Lock,
  Edit3, Crown, Shield, Save, Loader2, Globe, Server, Cpu, Briefcase,
  Link2, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';
import { useConfirmStore } from '../store/useConfirmStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { LABELS, type Attachment, type Comment, type Member } from '../types';
import { avatarInitials, formatBytes, formatTime, uid, truncateFileName, sortMembersWithOwnerFirst, getMemberTeamCategory, getTeamBadgeInfo } from '../utils';
import { supabaseService } from '../services/supabaseService';
import NeumorphicDatePicker from './ui/NeumorphicDatePicker';
import AvatarBorder from './ui/AvatarBorder';

interface Props {
  cardId: string | null;
  boardId: string | null;
  onClose: () => void;
}

function getFileTypeInfo(fileName: string, type: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return { tag: 'XLSX', color: '#10b981', bg: '#10b9811c', icon: FileSpreadsheet };
  }
  if (['pdf'].includes(ext)) {
    return { tag: 'PDF', color: '#ef4444', bg: '#ef44441c', icon: FileText };
  }
  if (['doc', 'docx', 'txt', 'rtf', 'md'].includes(ext)) {
    return { tag: 'DOC', color: '#3b82f6', bg: '#3b82f61c', icon: FileText };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { tag: 'ZIP', color: '#f59e0b', bg: '#f59e0b1c', icon: FileArchive };
  }
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'html', 'css', 'sql'].includes(ext)) {
    return { tag: ext.toUpperCase(), color: '#06b6d4', bg: '#06b6d41c', icon: FileCode };
  }
  if (type.startsWith('image/')) {
    return { tag: 'IMG', color: '#ec4899', bg: '#ec48991c', icon: ImageIcon };
  }
  return { tag: ext.toUpperCase() || 'FILE', color: '#6366f1', bg: '#6366f11c', icon: File };
}

export default function CardModal({ cardId, boardId, onClose }: Props) {
  const boards = useWorkStore(s => s.boards);
  const updateCard = useWorkStore(s => s.updateCard);
  const deleteCard = useWorkStore(s => s.deleteCard);
  const toggleCardComplete = useWorkStore(s => s.toggleCardComplete);
  const toggleCardLabel = useWorkStore(s => s.toggleCardLabel);
  const toggleCardAssignee = useWorkStore(s => s.toggleCardAssignee);
  const addAttachment = useWorkStore(s => s.addAttachment);
  const removeAttachment = useWorkStore(s => s.removeAttachment);
  const addComment = useWorkStore(s => s.addComment);
  const deleteComment = useWorkStore(s => s.deleteComment);
  const showToast = useToastStore(s => s.showToast);
  const showConfirm = useConfirmStore(s => s.showConfirm);
  const customLabels = useSettingsStore(s => s.customLabels);
  const addCustomLabel = useSettingsStore(s => s.addLabel);
  const currentUser = useAuthStore(s => s.user);

  const [commentText, setCommentText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor] = useState('#3b82f6');
  const [showNewLabel, setShowNewLabel] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  // Proof & Screenshot attachments for comments & replies
  const [commentAttachments, setCommentAttachments] = useState<Attachment[]>([]);
  const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
  const [isProcessingProof, setIsProcessingProof] = useState(false);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const replyFileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkModal, setShowLinkModal] = useState<'comment' | 'reply' | null>(null);
  const [linkUrlInput, setLinkUrlInput] = useState('');
  const [linkTextInput, setLinkTextInput] = useState('');

  // Mention State
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionTarget, setMentionTarget] = useState<'comment' | 'reply' | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentionIdx, setSelectedMentionIdx] = useState(0);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const mentionBlurTimeoutRef = useRef<number | undefined>(undefined);

  const result = useMemo(() => {
    if (!cardId) return null;
    let targetBoard = boardId ? boards.find(b => b.id === boardId) : null;
    if (!targetBoard) {
      targetBoard = boards.find(b =>
        b.columns?.some(c => c.cards?.some(card => card.id === cardId)) ||
        (b.inboxCards || []).some(card => card.id === cardId)
      ) || null;
    }
    if (!targetBoard) return null;

    for (const column of targetBoard.columns || []) {
      const card = column.cards?.find(c => c.id === cardId);
      if (card) {
        return { card, column, board: targetBoard, isInbox: false };
      }
    }

    const inboxCard = (targetBoard.inboxCards || []).find(c => c.id === cardId);
    if (inboxCard) {
      return { card: inboxCard, column: null, board: targetBoard, isInbox: true };
    }

    return null;
  }, [boards, cardId, boardId]);

  if (!cardId || !result) return null;

  const { card, column, board, isInbox } = result;
  const members = useMemo(
    () => sortMembersWithOwnerFirst(board.members || [], board.createdBy),
    [board.members, board.createdBy]
  );
  const allLabels = [...LABELS, ...customLabels];

  const currentEmail = currentUser?.email?.toLowerCase().trim();
  const currentUserName = currentUser?.name?.toLowerCase().trim();
  const currentMemberObj = members.find(m => m.email && currentEmail && m.email.toLowerCase().trim() === currentEmail);
  const isOwner = !!(
    (board.createdBy && currentEmail && board.createdBy.toLowerCase().trim() === currentEmail) ||
    members.some(m => m.email && currentEmail && m.email.toLowerCase().trim() === currentEmail && m.role === 'owner') ||
    (!board.createdBy && currentMemberObj?.role !== 'member' && currentMemberObj?.role !== 'observer')
  );
  const isAdmin = currentMemberObj?.role === 'admin';

  // Only the board owner or admins can assign team members. Regular members and observers cannot assign.
  const canAssign = isOwner || isAdmin;

  // Check if current user is author of a comment/reply
  const isCommentAuthor = (c: Comment) => {
    if (c.authorId && currentUser?.id && c.authorId === currentUser.id) return true;
    if (c.authorEmail && currentEmail && c.authorEmail.toLowerCase().trim() === currentEmail) return true;
    const authorLower = (c.author || '').toLowerCase().trim();
    if (!authorLower) return false;
    if (currentUserName && authorLower === currentUserName) return true;
    if (currentEmail && authorLower === currentEmail) return true;
    if (currentMemberObj?.name && authorLower === currentMemberObj.name.toLowerCase().trim()) return true;
    if (authorLower === 'me') return true;
    return false;
  };

  // Owner, admin, or the comment author can delete comments
  const canDeleteComment = (c: Comment) => {
    return isOwner || isAdmin || isCommentAuthor(c);
  };

  const handleDeleteComment = (comment: Comment, isReply = false) => {
    showConfirm({
      title: isReply ? 'Delete Reply' : 'Delete Comment',
      message: isReply
        ? 'Are you sure you want to delete this reply?'
        : 'Are you sure you want to delete this comment? All replies under it will also be deleted.',
      confirmText: 'Delete',
      variant: 'danger',
      icon: 'trash',
      onConfirm: () => {
        deleteComment(cardId, comment.id);
        if (replyingTo?.id === comment.id) {
          setReplyingTo(null);
          setReplyText('');
          setShowMentionMenu(false);
        }
        showToast(isReply ? 'Reply deleted' : 'Comment deleted', 'info');
      },
    });
  };

  // ── Local title & description state with unsaved change tracking ──
  const [localTitle, setLocalTitle] = useState(card.title);
  const [localDescription, setLocalDescription] = useState(card.description || '');
  const [isSaving, setIsSaving] = useState(false);

  // Assignee team filter state
  const [assigneeTeamFilter, setAssigneeTeamFilter] = useState<'all' | 'frontend' | 'backend' | 'work'>('all');

  const feAssignees = useMemo(() => members.filter((m: Member) => getMemberTeamCategory(m.borderStyle) === 'frontend'), [members]);
  const beAssignees = useMemo(() => members.filter((m: Member) => getMemberTeamCategory(m.borderStyle) === 'backend'), [members]);
  const workAssignees = useMemo(() => members.filter((m: Member) => getMemberTeamCategory(m.borderStyle) === 'work'), [members]);

  const filteredAssigneeMembers = useMemo(() => {
    if (assigneeTeamFilter === 'frontend') return feAssignees;
    if (assigneeTeamFilter === 'backend') return beAssignees;
    if (assigneeTeamFilter === 'work') return workAssignees;
    return members;
  }, [assigneeTeamFilter, feAssignees, beAssignees, workAssignees, members]);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [shakeSave, setShakeSave] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setLocalTitle(card.title);
    setLocalDescription(card.description || '');
  }, [card.title, card.description]);

  const isDirty = useMemo(() => {
    const titleChanged = localTitle.trim() !== card.title;
    const descChanged = localDescription !== (card.description || '');
    return titleChanged || descChanged;
  }, [localTitle, localDescription, card.title, card.description]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalDescription(e.target.value);
  };

  const handleSaveCard = async () => {
    const trimmedTitle = localTitle.trim();
    if (!trimmedTitle) {
      showToast('Card title cannot be empty', 'error');
      return;
    }

    setIsSaving(true);
    try {
      updateCard(cardId, {
        title: trimmedTitle,
        description: localDescription,
      });

      // Retrieve the fresh, complete board state from the store to avoid stale closure overrides
      const freshBoard = useWorkStore.getState().boards.find(b => b.id === board.id);
      if (freshBoard) {
        await supabaseService.syncBoard(freshBoard);
      }

      setIsSaving(false);
      setIsSavedSuccess(true);
      showToast('Card changes saved to cloud!', 'success');
      setTimeout(() => setIsSavedSuccess(false), 2000);
    } catch (err) {
      console.warn('Error saving card:', err);
      setIsSaving(false);
      showToast('Failed to save card to cloud', 'error');
    }
  };

  const handleSafeClose = () => {
    if (isDirty) {
      setShakeSave(true);
      setTimeout(() => setShakeSave(false), 700);
      showToast('Please save your card changes before closing!', 'warning');
      return;
    }
    onClose();
  };

  // Prevent Escape key from closing when dirty
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !previewAttachment && !showMentionMenu) {
        if (isDirty) {
          e.preventDefault();
          e.stopPropagation();
          setShakeSave(true);
          setTimeout(() => setShakeSave(false), 700);
          showToast('Please save your card changes before closing!', 'warning');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDirty, previewAttachment, showMentionMenu, onClose]);

  const handleDeleteCard = () => {
    showConfirm({
      title: `Delete "${card.title}"?`,
      message: `Are you sure you want to permanently delete this task and all its attachments and comments? This action cannot be undone.`,
      confirmText: 'Delete Task',
      variant: 'danger',
      icon: 'trash',
      onConfirm: async () => {
        setIsDeleting(true);
        setTimeout(() => {
          deleteCard(cardId);
          showToast('Task deleted', 'info');
          onClose();
        }, 260);
      }
    });
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = [...(e.target.files ?? [])];
    if (!rawFiles.length) return;

    let addedCount = 0;
    rawFiles.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        showToast(`"${file.name}" exceeds the maximum allowed size of 5 MB`, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = ev => {
        addAttachment(cardId, {
          id: uid(),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl: (ev.target?.result as string) ?? '',
          addedAt: new Date().toISOString(),
        });
      };
      reader.readAsDataURL(file);
      addedCount++;
    });

    if (addedCount > 0) {
      showToast(`Added ${addedCount} guide / attachment(s)`, 'success');
    }
    e.target.value = '';
  };

  const MAX_PROOF_SIZE = 10 * 1024 * 1024; // 10 MB raw file max before compression

  const compressImageIfNeeded = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
          resolve(dataUrl);
          return;
        }
        const img = new Image();
        img.onerror = () => resolve(dataUrl);
        img.onload = () => {
          const MAX_DIM = 1280;
          let { width, height } = img;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressed);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const processProofFiles = async (files: File[], target: 'comment' | 'reply') => {
    if (!files || files.length === 0) return;
    setIsProcessingProof(true);
    try {
      const newAttachments: Attachment[] = [];
      for (const file of files) {
        if (file.size > MAX_PROOF_SIZE) {
          showToast(`"${file.name}" exceeds 10 MB limit`, 'error');
          continue;
        }
        try {
          const compressedDataUrl = await compressImageIfNeeded(file);
          newAttachments.push({
            id: uid(),
            name: file.name || `proof_${Date.now()}.${file.type.split('/')[1] || 'png'}`,
            size: Math.round((compressedDataUrl.length * 3) / 4),
            type: file.type || 'image/png',
            dataUrl: compressedDataUrl,
            addedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to process file:', err);
        }
      }
      if (newAttachments.length > 0) {
        if (target === 'comment') {
          setCommentAttachments(prev => [...prev, ...newAttachments]);
        } else {
          setReplyAttachments(prev => [...prev, ...newAttachments]);
        }
        showToast(`Attached ${newAttachments.length} file/proof(s)`, 'success');
      }
    } finally {
      setIsProcessingProof(false);
    }
  };

  const handlePasteProof = async (e: React.ClipboardEvent<HTMLInputElement>, target: 'comment' | 'reply') => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      await processProofFiles(imageFiles, target);
    }
  };

  const handlePostComment = () => {
    const text = commentText.trim();
    if (!text && commentAttachments.length === 0) return;
    addComment(
      cardId,
      text || (commentAttachments.length > 0 ? '(Proof / attachment attached)' : ''),
      null,
      null,
      commentAttachments.length > 0 ? commentAttachments : undefined
    );
    setCommentText('');
    setCommentAttachments([]);
    setShowMentionMenu(false);
    showToast('Comment posted', 'success');
  };

  const handlePostReply = (parentId: string, replyToAuthor: string) => {
    const text = replyText.trim();
    if (!text && replyAttachments.length === 0) return;
    addComment(
      cardId,
      text || (replyAttachments.length > 0 ? '(Proof / attachment attached)' : ''),
      parentId,
      replyToAuthor,
      replyAttachments.length > 0 ? replyAttachments : undefined
    );
    setReplyText('');
    setReplyAttachments([]);
    setReplyingTo(null);
    showToast('Reply posted', 'success');
  };

  const filteredMentionMembers = useMemo(() => {
    if (!members.length) return [];
    if (!mentionQuery) return members;
    const q = mentionQuery.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q))
    );
  }, [members, mentionQuery]);

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      if (!query.includes('\n') && query.length <= 20) {
        setMentionQuery(query);
        setMentionTarget('comment');
        setShowMentionMenu(true);
        setSelectedMentionIdx(0);
        return;
      }
    }
    if (mentionTarget === 'comment') {
      setShowMentionMenu(false);
    }
  };

  const handleReplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReplyText(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const query = textBeforeCursor.slice(lastAtIdx + 1);
      if (!query.includes('\n') && query.length <= 20) {
        setMentionQuery(query);
        setMentionTarget('reply');
        setShowMentionMenu(true);
        setSelectedMentionIdx(0);
        return;
      }
    }
    if (mentionTarget === 'reply') {
      setShowMentionMenu(false);
    }
  };

  const handleSelectMention = (member: { name: string; email?: string }) => {
    if (mentionBlurTimeoutRef.current) {
      clearTimeout(mentionBlurTimeoutRef.current);
    }

    if (mentionTarget === 'reply') {
      const val = replyText;
      const cursorPos = replyInputRef.current?.selectionStart || val.length;
      const textBeforeCursor = val.slice(0, cursorPos);
      const lastAtIdx = textBeforeCursor.lastIndexOf('@');

      const textAfterCursor = val.slice(cursorPos);
      const newTextBefore = lastAtIdx !== -1 ? textBeforeCursor.slice(0, lastAtIdx) : textBeforeCursor;
      const newReply = `${newTextBefore}@${member.name} ${textAfterCursor}`;
      setReplyText(newReply);
      setShowMentionMenu(false);
      setMentionQuery('');

      setTimeout(() => {
        if (replyInputRef.current) {
          replyInputRef.current.focus();
          const nextPos = (newTextBefore + `@${member.name} `).length;
          replyInputRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 10);
    } else {
      const val = commentText;
      const cursorPos = commentInputRef.current?.selectionStart || val.length;
      const textBeforeCursor = val.slice(0, cursorPos);
      const lastAtIdx = textBeforeCursor.lastIndexOf('@');

      const textAfterCursor = val.slice(cursorPos);
      const newTextBefore = lastAtIdx !== -1 ? textBeforeCursor.slice(0, lastAtIdx) : textBeforeCursor;
      const newComment = `${newTextBefore}@${member.name} ${textAfterCursor}`;
      setCommentText(newComment);
      setShowMentionMenu(false);
      setMentionQuery('');

      setTimeout(() => {
        if (commentInputRef.current) {
          commentInputRef.current.focus();
          const nextPos = (newTextBefore + `@${member.name} `).length;
          commentInputRef.current.setSelectionRange(nextPos, nextPos);
        }
      }, 10);
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionMenu && mentionTarget === 'comment' && filteredMentionMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx(i => (i + 1) % filteredMentionMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx(i => (i - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = filteredMentionMembers[selectedMentionIdx] || filteredMentionMembers[0];
        if (chosen) handleSelectMention(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      handlePostComment();
    }
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, parentId: string, replyToAuthor: string) => {
    if (showMentionMenu && mentionTarget === 'reply' && filteredMentionMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIdx(i => (i + 1) % filteredMentionMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIdx(i => (i - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen = filteredMentionMembers[selectedMentionIdx] || filteredMentionMembers[0];
        if (chosen) handleSelectMention(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePostReply(parentId, replyToAuthor);
    } else if (e.key === 'Escape') {
      setReplyingTo(null);
      setReplyText('');
      setShowMentionMenu(false);
    }
  };

  const triggerMentionInComment = () => {
    if (mentionBlurTimeoutRef.current) {
      clearTimeout(mentionBlurTimeoutRef.current);
    }
    setCommentText(prev => {
      const needsSpace = prev.length > 0 && !prev.endsWith(' ');
      return prev + (needsSpace ? ' @' : '@');
    });
    setMentionTarget('comment');
    setShowMentionMenu(true);
    setMentionQuery('');
    setSelectedMentionIdx(0);
    commentInputRef.current?.focus();
  };

  const triggerMentionInReply = () => {
    if (mentionBlurTimeoutRef.current) {
      clearTimeout(mentionBlurTimeoutRef.current);
    }
    setReplyText(prev => {
      const needsSpace = prev.length > 0 && !prev.endsWith(' ');
      return prev + (needsSpace ? ' @' : '@');
    });
    setMentionTarget('reply');
    setShowMentionMenu(true);
    setMentionQuery('');
    setSelectedMentionIdx(0);
    replyInputRef.current?.focus();
  };

  const renderMentionDropdown = () => (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      transition={{ duration: 0.12 }}
      onMouseDown={e => {
        e.preventDefault();
        if (mentionBlurTimeoutRef.current) {
          clearTimeout(mentionBlurTimeoutRef.current);
        }
      }}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 8,
        width: 280,
        maxHeight: 200,
        overflowY: 'auto',
        backgroundColor: 'hsl(var(--popover))',
        borderRadius: 12,
        boxShadow: 'var(--neu-shadow-floating)',
        border: '1px solid hsl(var(--border) / 0.6)',
        padding: 6,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <div style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', letterSpacing: '0.04em' }}>
        Mention a member
      </div>
      {filteredMentionMembers.map((m, idx) => {
        const isSelected = idx === selectedMentionIdx;
        return (
          <button
            key={m.id}
            type="button"
            className={`sidebar-nav-item ${isSelected ? 'active' : ''}`}
            style={{
              padding: '6px 8px',
              fontSize: 12,
              borderRadius: 8,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              textAlign: 'left',
              backgroundColor: isSelected ? 'hsl(var(--primary) / 0.12)' : 'transparent',
              color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseDown={e => {
              e.preventDefault();
              if (mentionBlurTimeoutRef.current) {
                clearTimeout(mentionBlurTimeoutRef.current);
              }
              handleSelectMention(m);
            }}
          >
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt={m.name} style={{ width: 22, height: 22, borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: m.color || '#6366f1', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {avatarInitials(m.name)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name}
              </span>
              {m.email && (
                <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.email}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </motion.div>
  );

  const renderCommentText = (text: string) => {
    if (!text) return null;

    // Sort member names by length descending to match full multi-word names first (e.g. "John Enrico Santiago")
    const memberNames = members
      .map(m => m.name?.trim())
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => b.length - a.length);

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Tokenizer regex matching:
    // 1. Markdown link: \[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)
    // 2. Raw URL: (https?:\/\/[^\s<]+|www\.[^\s<]+)
    // 3. Mention: @MemberName or @word
    const mentionSub = memberNames.length > 0
      ? `@(?:${memberNames.map(escapeRegex).join('|')}|[^\\s@]+)`
      : `@[^\\s@]+`;

    const masterRegex = new RegExp(
      `(\\[[^\\]]+\\]\\(?:https?:\\/\\/[^\\s)]+|www\\.[^\\s)]+\\)|https?:\\/\\/[^\\s<]+|www\\.[^\\s<]+|${mentionSub})`,
      'gi'
    );

    const parts = text.split(masterRegex);

    return parts.map((part, idx) => {
      if (!part) return null;

      // 1. Check markdown link: [label](url)
      const mdMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)$/i);
      if (mdMatch) {
        const label = mdMatch[1];
        let href = mdMatch[2];
        if (href.startsWith('www.')) href = 'https://' + href;
        return (
          <a
            key={idx}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'hsl(var(--primary))',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              wordBreak: 'break-all',
            }}
            onClick={e => e.stopPropagation()}
            title={href}
          >
            {label}
            <ExternalLink size={10} style={{ opacity: 0.7, flexShrink: 0 }} />
          </a>
        );
      }

      // 2. Check plain URL: https://... or www....
      const isPlainUrl = /^(https?:\/\/[^\s<]+|www\.[^\s<]+)$/i.test(part);
      if (isPlainUrl) {
        const cleanUrl = part.replace(/[.,;!?)\]]+$/, '');
        const trailing = part.slice(cleanUrl.length);
        let href = cleanUrl;
        if (href.startsWith('www.')) href = 'https://' + href;
        return (
          <React.Fragment key={idx}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'hsl(var(--primary))',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                wordBreak: 'break-all',
              }}
              onClick={e => e.stopPropagation()}
              title={href}
            >
              {cleanUrl}
              <ExternalLink size={10} style={{ opacity: 0.7, flexShrink: 0 }} />
            </a>
            {trailing}
          </React.Fragment>
        );
      }

      // 3. Check Mention
      if (part.startsWith('@')) {
        const potentialName = part.slice(1).trim().toLowerCase();
        const matched = members.find(m => {
          const mName = m.name?.toLowerCase().trim();
          const mEmail = m.email?.toLowerCase().trim();
          return mName === potentialName || mEmail === potentialName || (mName && potentialName.startsWith(mName));
        });

        if (matched) {
          return (
            <span
              key={idx}
              style={{
                color: 'hsl(var(--primary))',
                backgroundColor: 'hsl(var(--primary) / 0.14)',
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                margin: '0 2px'
              }}
              title={matched.email || matched.name}
            >
              <AtSign size={10} />
              {matched.name}
            </span>
          );
        }
      }

      return <span key={idx}>{part}</span>;
    });
  };

  const isImageAttachment = (att: { type?: string; dataUrl?: string; name?: string }) => {
    return (
      att.type?.startsWith('image/') ||
      att.dataUrl?.startsWith('data:image/') ||
      /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(att.name || '')
    );
  };

  const coverAttachment = card.attachments?.find(a =>
    card.coverAttachmentId ? a.id === card.coverAttachmentId : isImageAttachment(a)
  );

  return (
    <>
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={handleSafeClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -60 }}
        animate={
          isDeleting
            ? { opacity: 0, scale: 0.72, filter: 'blur(10px)', rotateX: 20, y: 30 }
            : { opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }
        }
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -60 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="modal large-modal"
        style={{ transformStyle: 'preserve-3d', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cover Image Banner (Trello style) */}
        {coverAttachment && (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 180,
              backgroundColor: 'hsl(var(--secondary))',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
            <img
              src={coverAttachment.dataUrl}
              alt={coverAttachment.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                cursor: 'pointer'
              }}
              onClick={() => setPreviewAttachment(coverAttachment)}
              title="Click to view full image"
            />
            {/* Top Close Button over cover */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              className="icon-btn"
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                color: '#fff',
                backdropFilter: 'blur(6px)',
                border: 'none',
                width: 28,
                height: 28
              }}
              onClick={handleSafeClose}
            >
              <X size={15} />
            </motion.button>

            {/* Bottom Actions over cover */}
            <div
              style={{
                position: 'absolute',
                bottom: 10,
                right: 12,
                display: 'flex',
                gap: 6
              }}
            >
              <motion.button
                whileTap={{ scale: 0.94 }}
                className="btn btn-secondary"
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  color: '#fff',
                  backdropFilter: 'blur(6px)',
                  border: 'none'
                }}
                onClick={() => setPreviewAttachment(coverAttachment)}
              >
                <Eye size={13} /> Preview
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                className="btn btn-secondary"
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  backgroundColor: 'rgba(0, 0, 0, 0.65)',
                  color: '#fff',
                  backdropFilter: 'blur(6px)',
                  border: 'none'
                }}
                onClick={() => updateCard(cardId, { coverAttachmentId: card.coverAttachmentId === coverAttachment.id ? null : coverAttachment.id })}
              >
                <ImageIcon size={13} /> {card.coverAttachmentId === coverAttachment.id ? 'Remove Cover' : 'Cover'}
              </motion.button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              in column: {column?.name || 'Inbox'}
            </span>
          </div>
          {!coverAttachment && (
            <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={handleSafeClose}>
              <X size={15} />
            </motion.button>
          )}
        </div>

        {/* Modal Body: 2 Columns */}
        <div className="modal-body card-modal-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 310px', gap: 28, padding: '20px 28px 28px 28px', overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
          {/* Main Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0, width: '100%', overflow: 'hidden' }}>
            {/* Title Field */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px 0' }}>
                <Edit3 size={13} /> Card Title
              </label>
              <textarea
                className="textarea-input"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  resize: 'none',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'hsl(var(--card))',
                  boxShadow: 'var(--neu-shadow-input)',
                  border: '1px solid hsl(var(--border) / 0.6)',
                  color: 'hsl(var(--foreground))',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                  lineHeight: 1.4,
                  minHeight: 44,
                }}
                value={localTitle}
                rows={1}
                onChange={e => setLocalTitle(e.target.value)}
                placeholder="Enter card title..."
              />
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlignLeft size={13} /> Description
              </label>
              <textarea
                className="textarea-input"
                rows={4}
                value={localDescription}
                onChange={handleDescriptionChange}
                placeholder="Add a detailed description..."
              />
            </div>

            {/* Task Guides & Attachments (Prominently Highlighted) */}
            <div
              className="form-group"
              style={{
                background: (card.attachments?.length > 0) ? 'hsl(var(--primary) / 0.04)' : 'transparent',
                border: (card.attachments?.length > 0) ? '1.5px solid hsl(var(--primary) / 0.35)' : '1px solid hsl(var(--border) / 0.6)',
                borderRadius: 14,
                padding: '14px 16px',
                boxShadow: (card.attachments?.length > 0) ? '0 4px 16px -4px hsl(var(--primary) / 0.12)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (card.attachments?.length > 0) ? 12 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="field-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, color: 'hsl(var(--foreground))', fontWeight: 700 }}>
                    <Paperclip size={14} color="hsl(var(--primary))" /> Task Guides & Attachments ({card.attachments?.length || 0})
                  </label>
                  {card.attachments?.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'hsl(var(--primary) / 0.15)',
                        color: 'hsl(var(--primary))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Sparkles size={10} /> Essential Guide
                    </span>
                  )}
                </div>

                <label
                  className="btn btn-primary"
                  style={{ fontSize: 11.5, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Plus size={13} /> Add Guide / File
                  <input type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
                </label>
              </div>

              {card.attachments?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {card.attachments.map(att => {
                    const isImg = isImageAttachment(att);
                    const isCover = card.coverAttachmentId === att.id || (!card.coverAttachmentId && isImg && coverAttachment?.id === att.id);
                    const fileInfo = getFileTypeInfo(att.name, att.type);
                    const FileIcon = fileInfo.icon;

                    return (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 10,
                          boxShadow: 'var(--neu-shadow-raised-sm)',
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          transition: 'border-color 0.15s ease',
                          flexWrap: 'wrap',
                          minWidth: 0,
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        {/* Thumbnail or File Type Badge */}
                        {isImg ? (
                          <div
                            style={{
                              width: 80,
                              height: 56,
                              borderRadius: 8,
                              overflow: 'hidden',
                              backgroundColor: 'hsl(var(--secondary))',
                              cursor: 'pointer',
                              flexShrink: 0,
                              boxShadow: 'var(--neu-shadow-raised-sm)',
                              border: '1px solid hsl(var(--border) / 0.8)',
                            }}
                            onClick={() => setPreviewAttachment(att)}
                            title="Click to preview full image"
                          >
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 8,
                              backgroundColor: fileInfo.bg,
                              color: fileInfo.color,
                              border: `1px solid ${fileInfo.color}33`,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              gap: 2,
                            }}
                          >
                            <FileIcon size={18} />
                            <span style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase' }}>
                              {fileInfo.tag}
                            </span>
                          </div>
                        )}

                        {/* File Details */}
                        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              cursor: isImg ? 'pointer' : 'default',
                              color: 'hsl(var(--foreground))'
                            }}
                            title={att.name}
                            onClick={() => isImg && setPreviewAttachment(att)}
                          >
                            {truncateFileName(att.name, 36)}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                            <span style={{ fontWeight: 600 }}>{formatBytes(att.size)}</span>
                            <span>•</span>
                            <span>{new Date(att.addedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            {isCover && (
                              <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                                Cover
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action buttons with prominent Download */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
                          {isImg && (
                            <>
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                className="icon-btn"
                                style={{ width: 30, height: 30 }}
                                onClick={() => setPreviewAttachment(att)}
                                title="Preview Image"
                              >
                                <Eye size={14} />
                              </motion.button>
                              <motion.button
                                whileTap={{ scale: 0.92 }}
                                className="icon-btn"
                                style={{ width: 30, height: 30, color: isCover ? 'hsl(var(--primary))' : undefined }}
                                onClick={() => updateCard(cardId, { coverAttachmentId: isCover ? null : att.id })}
                                title={isCover ? 'Remove Cover' : 'Make Cover'}
                              >
                                <ImageIcon size={14} />
                              </motion.button>
                            </>
                          )}
                          <a
                            href={att.dataUrl}
                            download={att.name}
                            className="btn btn-secondary"
                            style={{
                              padding: '5px 10px',
                              fontSize: 11.5,
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              color: 'hsl(var(--primary))',
                              borderColor: 'hsl(var(--primary) / 0.3)',
                              textDecoration: 'none',
                            }}
                            title="Download Guide"
                          >
                            <Download size={13} />
                            <span>Download</span>
                          </a>
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            className="icon-btn"
                            style={{ width: 30, height: 30, color: 'hsl(var(--destructive))' }}
                            onClick={() => removeAttachment(cardId, att.id)}
                            title="Delete Attachment"
                          >
                            <Trash2 size={13} />
                          </motion.button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Comments & Activity (Threaded Discussions) */}
            <div className="form-group" style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={13} /> Activity & Discussion ({card.comments?.length || 0})
                </label>
                {members.length > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '2px 8px', color: 'hsl(var(--primary))', display: 'flex', alignItems: 'center', gap: 4 }}
                    onMouseDown={e => {
                      e.preventDefault();
                    }}
                    onClick={triggerMentionInComment}
                  >
                    <AtSign size={12} /> Mention
                  </motion.button>
                )}
              </div>

              {/* Mention Autocomplete Dropdown for Main Comment */}
              <AnimatePresence>
                {showMentionMenu && mentionTarget === 'comment' && filteredMentionMembers.length > 0 && (
                  renderMentionDropdown()
                )}
              </AnimatePresence>

              {/* Main Comment Input Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Staged Comment Proofs / Attachments Tray */}
                {commentAttachments.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      padding: '6px 8px',
                      borderRadius: 8,
                      backgroundColor: 'hsl(var(--secondary) / 0.6)',
                      border: '1px solid hsl(var(--border) / 0.6)',
                    }}
                  >
                    {commentAttachments.map((att, idx) => {
                      const isImg = isImageAttachment(att);
                      return (
                        <div
                          key={att.id || idx}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 6,
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            fontSize: 11,
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                          }}
                        >
                          {isImg ? (
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4 }}
                            />
                          ) : (
                            <Paperclip size={12} style={{ color: 'hsl(var(--primary))' }} />
                          )}
                          <span
                            style={{
                              maxWidth: 130,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: 500,
                            }}
                          >
                            {att.name}
                          </span>
                          <span style={{ fontSize: 9.5, color: 'hsl(var(--muted-foreground))' }}>
                            {formatBytes(att.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCommentAttachments(prev => prev.filter((_, i) => i !== idx))}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'hsl(var(--muted-foreground))',
                              display: 'flex',
                              alignItems: 'center',
                              padding: 1,
                            }}
                            title="Remove attachment"
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {/* Hidden File Input for Comment Proofs */}
                  <input
                    ref={commentFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        processProofFiles(files, 'comment');
                      }
                      e.target.value = '';
                    }}
                  />

                  <input
                    ref={commentInputRef}
                    type="text"
                    className="text-input"
                    placeholder="Write a comment, paste screenshot, or type @ to mention..."
                    value={commentText}
                    onChange={handleCommentChange}
                    onKeyDown={handleCommentKeyDown}
                    onPaste={e => handlePasteProof(e, 'comment')}
                    onFocus={() => {
                      setMentionTarget('comment');
                      if (mentionBlurTimeoutRef.current) {
                        clearTimeout(mentionBlurTimeoutRef.current);
                      }
                    }}
                    onBlur={() => {
                      mentionBlurTimeoutRef.current = window.setTimeout(() => {
                        if (mentionTarget === 'comment') {
                          setShowMentionMenu(false);
                        }
                      }, 250);
                    }}
                    style={{ flex: 1 }}
                  />

                  {/* Attach Screenshot / Proof Button */}
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => commentFileInputRef.current?.click()}
                    disabled={isProcessingProof}
                    title="Attach screenshot or proof file"
                    style={{
                      padding: '0 10px',
                      height: 38,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: isProcessingProof ? 'wait' : 'pointer',
                    }}
                  >
                    {isProcessingProof ? <Loader2 size={13} className="animate-spin" /> : <Paperclip size={13} />}
                  </motion.button>

                  {/* Insert Link Button */}
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setLinkUrlInput('');
                      setLinkTextInput('');
                      setShowLinkModal('comment');
                    }}
                    title="Insert link or URL"
                    style={{
                      padding: '0 10px',
                      height: 38,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Link2 size={13} />
                  </motion.button>

                  {/* Post Comment Button */}
                  <motion.button
                    whileTap={(commentText.trim() || commentAttachments.length > 0) ? { scale: 0.92 } : undefined}
                    className="btn btn-primary"
                    onClick={handlePostComment}
                    title="Post Comment"
                    disabled={!commentText.trim() && commentAttachments.length === 0}
                    style={{
                      padding: '0 14px',
                      height: 38,
                      flexShrink: 0,
                      opacity: (commentText.trim() || commentAttachments.length > 0) ? 1 : 0.5,
                      cursor: (commentText.trim() || commentAttachments.length > 0) ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <Send size={13} />
                  </motion.button>
                </div>
              </div>

              {/* Threaded Comments List */}
              {card.comments?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                  {(() => {
                    const allComments = card.comments || [];
                    const rootComments = allComments.filter(c => !c.parentId);

                    return rootComments.map(c => {
                      const childReplies = allComments.filter(r => r.parentId === c.id);

                      return (
                        <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {/* Root Comment Card */}
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: 'var(--radius)',
                              backgroundColor: 'hsl(var(--card))',
                              boxShadow: 'var(--neu-shadow-raised-sm)',
                              border: '1px solid hsl(var(--border) / 0.6)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div
                                  style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    backgroundColor: c.avatarColor || '#6366f1',
                                    color: '#fff',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  {c.authorInitials || avatarInitials(c.author)}
                                </div>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                                  {c.author}
                                </span>
                                {(() => {
                                  const cMem = members.find(m => m.name.toLowerCase().trim() === c.author.toLowerCase().trim() || (m.email && m.email.toLowerCase().trim() === c.author.toLowerCase().trim()));
                                  const isOwn = !!(cMem?.email && board.createdBy && cMem.email.toLowerCase().trim() === board.createdBy.toLowerCase().trim());
                                  if (isOwn) {
                                    return (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                        <Crown size={9} /> Owner
                                      </span>
                                    );
                                  }
                                  if (cMem?.role === 'admin') {
                                    return (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                        <Shield size={9} /> Admin
                                      </span>
                                    );
                                  }
                                  if (cMem?.role === 'observer') {
                                    return (
                                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                        <Eye size={9} /> Observer
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                                {formatTime(c.createdAt)}
                              </span>
                            </div>

                            <p style={{ fontSize: 12.5, color: 'hsl(var(--foreground))', lineHeight: 1.4, margin: '4px 0 6px 0' }}>
                              {renderCommentText(c.text)}
                            </p>

                            {/* Attached Proofs / Screenshots on Root Comment */}
                            {c.attachments && c.attachments.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 8 }}>
                                {c.attachments.map(att => {
                                  const isImg = isImageAttachment(att);
                                  if (isImg) {
                                    return (
                                      <div
                                        key={att.id}
                                        onClick={() => setPreviewAttachment(att)}
                                        style={{
                                          borderRadius: 8,
                                          overflow: 'hidden',
                                          cursor: 'pointer',
                                          border: '1px solid hsl(var(--border) / 0.8)',
                                          boxShadow: 'var(--neu-shadow-raised-sm)',
                                          maxWidth: 240,
                                          backgroundColor: 'hsl(var(--card))',
                                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                        }}
                                        title={`Click to preview full screenshot: ${att.name}`}
                                        onMouseEnter={e => {
                                          e.currentTarget.style.transform = 'translateY(-2px)';
                                          e.currentTarget.style.boxShadow = 'var(--neu-shadow-raised)';
                                        }}
                                        onMouseLeave={e => {
                                          e.currentTarget.style.transform = 'translateY(0)';
                                          e.currentTarget.style.boxShadow = 'var(--neu-shadow-raised-sm)';
                                        }}
                                      >
                                        <img
                                          src={att.dataUrl}
                                          alt={att.name}
                                          style={{
                                            width: '100%',
                                            maxHeight: 120,
                                            objectFit: 'cover',
                                            display: 'block',
                                          }}
                                        />
                                        <div
                                          style={{
                                            padding: '3px 8px',
                                            fontSize: 10,
                                            color: 'hsl(var(--muted-foreground))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 4,
                                            backgroundColor: 'hsl(var(--secondary) / 0.7)',
                                          }}
                                        >
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                                            {att.name}
                                          </span>
                                          <span>{formatBytes(att.size)}</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  const info = getFileTypeInfo(att.name, att.type);
                                  const FileIcon = info.icon;
                                  return (
                                    <a
                                      key={att.id}
                                      href={att.dataUrl}
                                      download={att.name}
                                      onClick={e => e.stopPropagation()}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '5px 10px',
                                        borderRadius: 8,
                                        backgroundColor: 'hsl(var(--secondary))',
                                        border: '1px solid hsl(var(--border) / 0.8)',
                                        color: 'hsl(var(--foreground))',
                                        textDecoration: 'none',
                                        fontSize: 11,
                                        fontWeight: 500,
                                        boxShadow: 'var(--neu-shadow-raised-sm)',
                                        transition: 'all 0.15s ease',
                                      }}
                                      title={`Download proof: ${att.name}`}
                                    >
                                      <FileIcon size={13} style={{ color: info.color }} />
                                      <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {att.name}
                                      </span>
                                      <span style={{ fontSize: 9.5, color: 'hsl(var(--muted-foreground))' }}>
                                        ({formatBytes(att.size)})
                                      </span>
                                      <Download size={11} style={{ color: 'hsl(var(--muted-foreground))' }} />
                                    </a>
                                  );
                                })}
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                              {canDeleteComment(c) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(c, false)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'hsl(var(--muted-foreground))',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    transition: 'color 0.15s ease',
                                  }}
                                  title="Delete comment"
                                  onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                  onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}
                                >
                                  <Trash2 size={11} /> Delete
                                </button>
                              )}

                              <motion.button
                                whileTap={{ scale: 0.94 }}
                                onClick={() => {
                                  setReplyingTo({ id: c.id, author: c.author } as Comment);
                                  setReplyText('');
                                  setShowMentionMenu(false);
                                }}
                                style={{
                                  background: 'hsl(var(--secondary))',
                                  border: '1px solid hsl(var(--border) / 0.8)',
                                  color: 'hsl(var(--primary))',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '3px 9px',
                                  borderRadius: 6,
                                  boxShadow: 'var(--neu-shadow-raised-sm)',
                                }}
                                title={`Reply to @${c.author}`}
                              >
                                <Reply size={12} /> Reply
                              </motion.button>
                            </div>
                          </div>

                          {/* Nested Replies */}
                          {childReplies.length > 0 && (
                            <div
                              style={{
                                marginLeft: 20,
                                paddingLeft: 12,
                                borderLeft: '2px solid hsl(var(--primary) / 0.35)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                              }}
                            >
                              {childReplies.map(reply => (
                                <div
                                  key={reply.id}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: 'var(--radius)',
                                    backgroundColor: 'hsl(var(--card) / 0.8)',
                                    boxShadow: 'var(--neu-shadow-raised-sm)',
                                    border: '1px solid hsl(var(--border) / 0.5)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div
                                        style={{
                                          width: 18,
                                          height: 18,
                                          borderRadius: '50%',
                                          backgroundColor: reply.avatarColor || '#6366f1',
                                          color: '#fff',
                                          fontSize: 8,
                                          fontWeight: 700,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        {reply.authorInitials || avatarInitials(reply.author)}
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
                                        {reply.author}
                                      </span>
                                      {(() => {
                                        const rMem = members.find(m => m.name.toLowerCase().trim() === reply.author.toLowerCase().trim() || (m.email && m.email.toLowerCase().trim() === reply.author.toLowerCase().trim()));
                                        const isROwn = !!(rMem?.email && board.createdBy && rMem.email.toLowerCase().trim() === board.createdBy.toLowerCase().trim());
                                        if (isROwn) {
                                          return (
                                            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 4px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                              <Crown size={8} /> Owner
                                            </span>
                                          );
                                        }
                                        if (rMem?.role === 'admin') {
                                          return (
                                            <span style={{ fontSize: 8.5, fontWeight: 700, padding: '1px 4px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                              <Shield size={8} /> Admin
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                      {reply.replyToAuthor && (
                                        <span style={{ fontSize: 10.5, color: 'hsl(var(--primary))' }}>
                                          → @{reply.replyToAuthor}
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                                      {formatTime(reply.createdAt)}
                                    </span>
                                  </div>
                                  <p style={{ fontSize: 12, color: 'hsl(var(--foreground))', lineHeight: 1.35, margin: '2px 0 4px 0' }}>
                                    {renderCommentText(reply.text)}
                                  </p>

                                  {/* Attached Proofs / Screenshots on Child Reply */}
                                  {reply.attachments && reply.attachments.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 6 }}>
                                      {reply.attachments.map(att => {
                                        const isImg = isImageAttachment(att);
                                        if (isImg) {
                                          return (
                                            <div
                                              key={att.id}
                                              onClick={() => setPreviewAttachment(att)}
                                              style={{
                                                borderRadius: 6,
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                border: '1px solid hsl(var(--border) / 0.8)',
                                                boxShadow: 'var(--neu-shadow-raised-sm)',
                                                maxWidth: 200,
                                                backgroundColor: 'hsl(var(--card))',
                                                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                              }}
                                              title={`Click to preview full screenshot: ${att.name}`}
                                              onMouseEnter={e => {
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                e.currentTarget.style.boxShadow = 'var(--neu-shadow-raised)';
                                              }}
                                              onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = 'var(--neu-shadow-raised-sm)';
                                              }}
                                            >
                                              <img
                                                src={att.dataUrl}
                                                alt={att.name}
                                                style={{
                                                  width: '100%',
                                                  maxHeight: 100,
                                                  objectFit: 'cover',
                                                  display: 'block',
                                                }}
                                              />
                                              <div
                                                style={{
                                                  padding: '2px 6px',
                                                  fontSize: 9.5,
                                                  color: 'hsl(var(--muted-foreground))',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-between',
                                                  gap: 4,
                                                  backgroundColor: 'hsl(var(--secondary) / 0.7)',
                                                }}
                                              >
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                                                  {att.name}
                                                </span>
                                                <span>{formatBytes(att.size)}</span>
                                              </div>
                                            </div>
                                          );
                                        }
                                        const info = getFileTypeInfo(att.name, att.type);
                                        const FileIcon = info.icon;
                                        return (
                                          <a
                                            key={att.id}
                                            href={att.dataUrl}
                                            download={att.name}
                                            onClick={e => e.stopPropagation()}
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 5,
                                              padding: '4px 8px',
                                              borderRadius: 6,
                                              backgroundColor: 'hsl(var(--secondary))',
                                              border: '1px solid hsl(var(--border) / 0.8)',
                                              color: 'hsl(var(--foreground))',
                                              textDecoration: 'none',
                                              fontSize: 10.5,
                                              fontWeight: 500,
                                              boxShadow: 'var(--neu-shadow-raised-sm)',
                                              transition: 'all 0.15s ease',
                                            }}
                                            title={`Download proof: ${att.name}`}
                                          >
                                            <FileIcon size={12} style={{ color: info.color }} />
                                            <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {att.name}
                                            </span>
                                            <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>
                                              ({formatBytes(att.size)})
                                            </span>
                                            <Download size={10} style={{ color: 'hsl(var(--muted-foreground))' }} />
                                          </a>
                                        );
                                      })}
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                    {canDeleteComment(reply) && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(reply, true)}
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: 'hsl(var(--muted-foreground))',
                                          fontSize: 10.5,
                                          fontWeight: 500,
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3,
                                          padding: '1px 5px',
                                          borderRadius: 4,
                                          transition: 'color 0.15s ease',
                                        }}
                                        title="Delete reply"
                                        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                        onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}
                                      >
                                        <Trash2 size={10} /> Delete
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingTo({ id: c.id, author: reply.author } as Comment);
                                        setReplyText('');
                                        setShowMentionMenu(false);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'hsl(var(--primary))',
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                        padding: '1px 4px',
                                        borderRadius: 4,
                                      }}
                                      title={`Reply to @${reply.author}`}
                                    >
                                      <Reply size={10} /> Reply
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Inline Reply Composer directly at the bottom of this comment thread */}
                          {replyingTo?.id === c.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              style={{
                                marginLeft: 20,
                                padding: '8px 12px',
                                borderRadius: 'var(--radius)',
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--primary) / 0.5)',
                                boxShadow: 'var(--neu-shadow-raised-sm)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                position: 'relative',
                              }}
                            >
                              {/* Mention Autocomplete Dropdown for Reply */}
                              <AnimatePresence>
                                {showMentionMenu && mentionTarget === 'reply' && filteredMentionMembers.length > 0 && (
                                  renderMentionDropdown()
                                )}
                              </AnimatePresence>

                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'hsl(var(--primary))' }}>
                                  <Reply size={11} />
                                  <span>Replying to <strong>@{replyingTo.author}</strong></span>
                                  {members.length > 0 && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost"
                                      style={{ fontSize: 10, padding: '1px 6px', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 3, height: 20 }}
                                      onMouseDown={e => e.preventDefault()}
                                      onClick={triggerMentionInReply}
                                      title="Mention someone in reply"
                                    >
                                      <AtSign size={10} /> Mention
                                    </button>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingTo(null);
                                    setReplyText('');
                                    setShowMentionMenu(false);
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 2 }}
                                  title="Cancel reply"
                                >
                                  <X size={12} />
                                </button>
                              </div>

                              {/* Staged Reply Attachments Preview Tray */}
                              {replyAttachments.length > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: 5,
                                    padding: '4px 6px',
                                    borderRadius: 6,
                                    backgroundColor: 'hsl(var(--secondary) / 0.6)',
                                    border: '1px solid hsl(var(--border) / 0.6)',
                                  }}
                                >
                                  {replyAttachments.map((att, idx) => {
                                    const isImg = isImageAttachment(att);
                                    return (
                                      <div
                                        key={att.id || idx}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 5,
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          backgroundColor: 'hsl(var(--card))',
                                          border: '1px solid hsl(var(--border))',
                                          fontSize: 10.5,
                                          boxShadow: 'var(--neu-shadow-raised-sm)',
                                        }}
                                      >
                                        {isImg ? (
                                          <img src={att.dataUrl} alt={att.name} style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: 3 }} />
                                        ) : (
                                          <Paperclip size={11} style={{ color: 'hsl(var(--primary))' }} />
                                        )}
                                        <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {att.name}
                                        </span>
                                        <span style={{ fontSize: 9, color: 'hsl(var(--muted-foreground))' }}>
                                          {formatBytes(att.size)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setReplyAttachments(prev => prev.filter((_, i) => i !== idx))}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', padding: 1 }}
                                          title="Remove attachment"
                                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                                          onMouseLeave={e => (e.currentTarget.style.color = 'hsl(var(--muted-foreground))')}
                                        >
                                          <X size={11} />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {/* Hidden File Input for Reply Proofs */}
                                <input
                                  ref={replyFileInputRef}
                                  type="file"
                                  multiple
                                  accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                                  style={{ display: 'none' }}
                                  onChange={e => {
                                    const files = Array.from(e.target.files || []);
                                    if (files.length > 0) {
                                      processProofFiles(files, 'reply');
                                    }
                                    e.target.value = '';
                                  }}
                                />

                                <input
                                  ref={replyInputRef}
                                  autoFocus
                                  type="text"
                                  className="text-input"
                                  placeholder={`Reply to @${replyingTo.author}, paste screenshot, or type @...`}
                                  value={replyText}
                                  onChange={handleReplyChange}
                                  onKeyDown={e => handleReplyKeyDown(e, c.id, replyingTo.author)}
                                  onPaste={e => handlePasteProof(e, 'reply')}
                                  onFocus={() => {
                                    setMentionTarget('reply');
                                    if (mentionBlurTimeoutRef.current) {
                                      clearTimeout(mentionBlurTimeoutRef.current);
                                    }
                                  }}
                                  onBlur={() => {
                                    mentionBlurTimeoutRef.current = window.setTimeout(() => {
                                      if (mentionTarget === 'reply') {
                                        setShowMentionMenu(false);
                                      }
                                    }, 250);
                                  }}
                                  style={{ fontSize: 12, padding: '6px 10px', flex: 1 }}
                                />

                                {/* Attach Screenshot / Proof Button for Reply */}
                                <motion.button
                                  whileTap={{ scale: 0.94 }}
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => replyFileInputRef.current?.click()}
                                  disabled={isProcessingProof}
                                  title="Attach proof file or screenshot"
                                  style={{ padding: '0 8px', height: 32, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                >
                                  {isProcessingProof ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
                                </motion.button>

                                {/* Insert Link Button for Reply */}
                                <motion.button
                                  whileTap={{ scale: 0.94 }}
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    setLinkUrlInput('');
                                    setLinkTextInput('');
                                    setShowLinkModal('reply');
                                  }}
                                  title="Insert link or URL"
                                  style={{ padding: '0 8px', height: 32, flexShrink: 0, display: 'flex', alignItems: 'center' }}
                                >
                                  <Link2 size={11} />
                                </motion.button>

                                <motion.button
                                  whileTap={(replyText.trim() || replyAttachments.length > 0) ? { scale: 0.94 } : undefined}
                                  className="btn btn-primary"
                                  onClick={() => handlePostReply(c.id, replyingTo.author)}
                                  disabled={!replyText.trim() && replyAttachments.length === 0}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    height: 32,
                                    flexShrink: 0,
                                    opacity: (replyText.trim() || replyAttachments.length > 0) ? 1 : 0.5,
                                    cursor: (replyText.trim() || replyAttachments.length > 0) ? 'pointer' : 'not-allowed',
                                  }}
                                >
                                  <Send size={12} />
                                </motion.button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Controls */}
          <div className="card-modal-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingLeft: 18, borderLeft: '1px solid hsl(var(--border) / 0.4)', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
            {/* Status Button */}
            <div className="form-group">
              <label className="field-label">Status</label>
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                className={`btn ${card.completed ? 'btn-primary' : 'btn-secondary'}`}
                style={{ width: '100%', justifyContent: 'flex-start', cursor: 'pointer' }}
                onClick={() => toggleCardComplete(cardId)}
              >
                {card.completed ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>{card.completed ? 'Completed' : 'Mark as Done'}</span>
              </motion.button>
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Calendar size={12} /> Due Date & Time
              </label>
              <NeumorphicDatePicker
                value={card.dueDate}
                onChange={newDue => {
                  updateCard(cardId, { dueDate: newDue });
                }}
              />
            </div>

            {/* Labels */}
            <div className="form-group">
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={12} /> Labels
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {allLabels.map(l => {
                  const isSelected = (card.labels || []).includes(l.id);
                  return (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      whileHover={{ scale: 1.04 }}
                      key={l.id}
                      type="button"
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        padding: '4px 9px',
                        borderRadius: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        boxShadow: isSelected
                          ? 'var(--neu-shadow-pressed)'
                          : 'var(--neu-shadow-raised-sm)',
                        backgroundColor: isSelected ? l.color : 'hsl(var(--card))',
                        color: isSelected ? '#ffffff' : 'hsl(var(--foreground))',
                        cursor: 'pointer',
                        border: `1px solid ${isSelected ? l.color : 'hsl(var(--border) / 0.5)'}`,
                        boxSizing: 'border-box'
                      }}
                      onClick={() => toggleCardLabel(cardId, l.id)}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {isSelected ? (
                          <Check size={11} strokeWidth={3} />
                        ) : (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: l.color,
                              flexShrink: 0
                            }}
                          />
                        )}
                      </span>
                      <span>{l.name}</span>
                    </motion.button>
                  );
                })}
              </div>

              {showNewLabel ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="New label name"
                    value={newLabelName}
                    onChange={e => setNewLabelName(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <motion.button
                      whileTap={newLabelName.trim() ? { scale: 0.95 } : undefined}
                      className="btn btn-primary"
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        opacity: newLabelName.trim() ? 1 : 0.5,
                        cursor: newLabelName.trim() ? 'pointer' : 'not-allowed',
                      }}
                      disabled={!newLabelName.trim()}
                      onClick={() => {
                        if (!newLabelName.trim()) return;
                        addCustomLabel(newLabelName.trim(), newLabelColor);
                        setNewLabelName('');
                        setShowNewLabel(false);
                      }}
                    >
                      Save
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => setShowNewLabel(false)}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, justifyContent: 'flex-start', padding: '2px 4px' }}
                  onClick={() => setShowNewLabel(true)}
                >
                  <Plus size={12} /> New Label
                </motion.button>
              )}
            </div>

            {/* Assignees (Owner & Admin Control) */}
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  <Users size={12} /> Assignees
                </label>
                {!canAssign && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                    Owner & Admin only
                  </span>
                )}
              </div>

              {members.length === 0 ? (
                <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>No members yet</span>
              ) : canAssign ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {/* Team filter buttons for quick frontend / backend assignment */}
                  {(feAssignees.length > 0 || beAssignees.length > 0) && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                      <motion.button
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                        type="button"
                        style={{
                          padding: '4px 9px',
                          fontSize: 10.5,
                          fontWeight: 600,
                          borderRadius: 7,
                          cursor: 'pointer',
                          border: assigneeTeamFilter === 'all' ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.6)',
                          backgroundColor: assigneeTeamFilter === 'all' ? 'hsl(var(--primary) / 0.14)' : 'hsl(var(--card))',
                          color: assigneeTeamFilter === 'all' ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                          boxShadow: assigneeTeamFilter === 'all' ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                          display: 'flex', alignItems: 'center', gap: 4,
                          transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease'
                        }}
                        onClick={() => setAssigneeTeamFilter('all')}
                      >
                        <Users size={11} />
                        <span>All ({members.length})</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                        type="button"
                        style={{
                          padding: '4px 9px',
                          fontSize: 10.5,
                          fontWeight: 600,
                          borderRadius: 7,
                          cursor: 'pointer',
                          border: assigneeTeamFilter === 'frontend' ? '1.5px solid #0284c7' : '1px solid rgba(14, 165, 233, 0.35)',
                          backgroundColor: assigneeTeamFilter === 'frontend' ? 'rgba(14, 165, 233, 0.18)' : 'hsl(var(--card))',
                          color: '#0284c7',
                          boxShadow: assigneeTeamFilter === 'frontend' ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                          display: 'flex', alignItems: 'center', gap: 4,
                          transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease'
                        }}
                        onClick={() => setAssigneeTeamFilter('frontend')}
                      >
                        <Globe size={11} />
                        <span>Frontend ({feAssignees.length})</span>
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.94 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                        type="button"
                        style={{
                          padding: '4px 9px',
                          fontSize: 10.5,
                          fontWeight: 600,
                          borderRadius: 7,
                          cursor: 'pointer',
                          border: assigneeTeamFilter === 'backend' ? '1.5px solid #ea580c' : '1px solid rgba(249, 115, 22, 0.35)',
                          backgroundColor: assigneeTeamFilter === 'backend' ? 'rgba(249, 115, 22, 0.18)' : 'hsl(var(--card))',
                          color: '#ea580c',
                          boxShadow: assigneeTeamFilter === 'backend' ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                          display: 'flex', alignItems: 'center', gap: 4,
                          transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease'
                        }}
                        onClick={() => setAssigneeTeamFilter('backend')}
                      >
                        <Server size={11} />
                        <span>Backend ({beAssignees.length})</span>
                      </motion.button>

                      {workAssignees.length > 0 && (
                        <motion.button
                          whileHover={{ scale: 1.04, y: -1 }}
                          whileTap={{ scale: 0.94 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                          type="button"
                          style={{
                            padding: '4px 9px',
                            fontSize: 10.5,
                            fontWeight: 600,
                            borderRadius: 7,
                            cursor: 'pointer',
                            border: assigneeTeamFilter === 'work' ? '1.5px solid #8b5cf6' : '1px solid rgba(139, 92, 246, 0.35)',
                            backgroundColor: assigneeTeamFilter === 'work' ? 'rgba(139, 92, 246, 0.18)' : 'hsl(var(--card))',
                            color: '#8b5cf6',
                            boxShadow: assigneeTeamFilter === 'work' ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                            display: 'flex', alignItems: 'center', gap: 4,
                            transition: 'border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease'
                          }}
                          onClick={() => setAssigneeTeamFilter('work')}
                        >
                          <Briefcase size={11} />
                          <span>Work Roles ({workAssignees.length})</span>
                        </motion.button>
                      )}
                    </div>
                  )}

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={assigneeTeamFilter}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    >
                      {filteredAssigneeMembers.length === 0 ? (
                        <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', padding: '8px 4px' }}>
                          No {assigneeTeamFilter} team members found.
                        </div>
                      ) : (
                        (() => {
                          const assignedList: Member[] = [];
                          const unassignedList: Member[] = [];

                          filteredAssigneeMembers.forEach(m => {
                            const isAssigned = card.assignees?.some(a =>
                              a === m.id || (m.email && a.toLowerCase().trim() === m.email.toLowerCase().trim())
                            );
                            if (isAssigned) {
                              assignedList.push(m);
                            } else {
                              unassignedList.push(m);
                            }
                          });

                          const renderAssigneeRow = (m: Member, isAssigned: boolean) => {
                            const isCurrent = currentUser?.email && m.email?.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
                            const displayName = (isCurrent && currentUser?.name) ? currentUser.name : m.name;
                            const isMemberOwner = !!(board.createdBy && m.email && board.createdBy.toLowerCase().trim() === m.email.toLowerCase().trim());
                            const badge = getTeamBadgeInfo(m.borderStyle);

                            return (
                              <motion.button
                                key={m.id}
                                whileTap={{ scale: 0.98 }}
                                whileHover={{ scale: 1.01 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                type="button"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  width: '100%',
                                  padding: '6px 9px',
                                  borderRadius: 9,
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  boxSizing: 'border-box',
                                  border: isAssigned
                                    ? '1.5px solid #f59e0b'
                                    : '1px solid hsl(var(--border) / 0.55)',
                                  backgroundColor: isAssigned
                                    ? 'rgba(245, 158, 11, 0.12)'
                                    : 'hsl(var(--card))',
                                  boxShadow: isAssigned
                                    ? '0 2px 8px rgba(245, 158, 11, 0.22), var(--neu-shadow-raised-sm)'
                                    : 'var(--neu-shadow-raised-sm)',
                                  color: isAssigned
                                    ? 'hsl(var(--foreground))'
                                    : 'hsl(var(--muted-foreground))',
                                  fontWeight: isAssigned ? 600 : 500,
                                  transition: 'all 0.15s ease'
                                }}
                                onClick={() => toggleCardAssignee(cardId, m.id)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                  <AvatarBorder borderStyle={m.borderStyle} size={22}>
                                    {m.avatarUrl ? (
                                      <img src={m.avatarUrl} alt={displayName} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {avatarInitials(displayName)}
                                      </div>
                                    )}
                                  </AvatarBorder>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                    <span style={{
                                      textAlign: 'left',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      color: isAssigned ? 'hsl(var(--foreground))' : undefined,
                                      fontWeight: isAssigned ? 600 : 500,
                                      fontSize: 12,
                                      lineHeight: 1.2
                                    }}>
                                      {displayName}
                                    </span>

                                    {(badge || isMemberOwner || m.role === 'admin' || m.role === 'observer') && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 3.5, flexWrap: 'wrap', minWidth: 0 }}>
                                        {badge && (
                                          <span style={{
                                            fontSize: 8.5, fontWeight: 700, padding: '0.5px 4.5px', borderRadius: 4,
                                            background: badge.bg, color: badge.color,
                                            display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                                            whiteSpace: 'nowrap'
                                          }}>
                                            <span>{badge.label}</span>
                                          </span>
                                        )}

                                        {isMemberOwner ? (
                                          <span style={{ fontSize: 8.5, fontWeight: 700, padding: '0.5px 4.5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                            <Crown size={9} /> Owner
                                          </span>
                                        ) : m.role === 'admin' ? (
                                          <span style={{ fontSize: 8.5, fontWeight: 700, padding: '0.5px 4.5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                            <Shield size={9} /> Admin
                                          </span>
                                        ) : m.role === 'observer' ? (
                                          <span style={{ fontSize: 8.5, fontWeight: 700, padding: '0.5px 4.5px', borderRadius: 4, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 2.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                            <Eye size={9} /> Observer
                                          </span>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Prominent Visual Indicator */}
                                {isAssigned ? (
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3.5,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '2.5px 7px',
                                    borderRadius: 6,
                                    backgroundColor: '#f59e0b',
                                    color: '#ffffff',
                                    boxShadow: '0 1px 4px rgba(245, 158, 11, 0.4)',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <Check size={11} strokeWidth={3} />
                                    <span>Assigned</span>
                                  </div>
                                ) : (
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: '2.5px 6px',
                                    borderRadius: 6,
                                    border: '1px dashed hsl(var(--muted-foreground) / 0.35)',
                                    color: 'hsl(var(--muted-foreground))',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <Plus size={10} strokeWidth={2.5} />
                                    <span>Assign</span>
                                  </div>
                                )}
                              </motion.button>
                            );
                          };

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {/* Group 1: Assigned (Always on top) */}
                              {assignedList.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: '#d97706',
                                    padding: '2px 4px'
                                  }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <CheckSquare size={11} /> Assigned ({assignedList.length})
                                    </span>
                                    <span style={{ fontSize: 9.5, opacity: 0.75, textTransform: 'none', fontWeight: 500 }}>
                                      Click to unassign
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {assignedList.map(m => renderAssigneeRow(m, true))}
                                  </div>
                                </div>
                              )}

                              {/* Group 2: Available / Not Assigned */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: 10,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em',
                                  color: 'hsl(var(--muted-foreground))',
                                  padding: '2px 4px',
                                  marginTop: assignedList.length > 0 ? 4 : 0
                                }}>
                                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Users size={11} /> Not Assigned ({unassignedList.length})
                                  </span>
                                  <span style={{ fontSize: 9.5, opacity: 0.75, textTransform: 'none', fontWeight: 500 }}>
                                    Click to assign
                                  </span>
                                </div>

                                {unassignedList.length === 0 ? (
                                  <div style={{
                                    fontSize: 11,
                                    color: 'hsl(var(--muted-foreground))',
                                    fontStyle: 'italic',
                                    padding: '7px 10px',
                                    backgroundColor: 'hsl(var(--muted) / 0.25)',
                                    borderRadius: 8,
                                    border: '1px dashed hsl(var(--border) / 0.5)',
                                    textAlign: 'center'
                                  }}>
                                    All members in this category are assigned.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {unassignedList.map(m => renderAssigneeRow(m, false))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              ) : (
                // Read-only assignee display for non-admins
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {card.assignees?.length > 0 ? (
                    card.assignees.map(mId => {
                      const m = members.find(mem => mem.id === mId);
                      if (!m) return null;
                      const isMemOwner = !!(board.createdBy && m.email && board.createdBy.toLowerCase().trim() === m.email.toLowerCase().trim());
                      const badge = getTeamBadgeInfo(m.borderStyle);

                      return (
                        <div
                          key={m.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderRadius: 8,
                            background: 'hsl(var(--card))',
                            boxShadow: 'var(--neu-shadow-raised-sm)',
                            border: '1px solid hsl(var(--border) / 0.5)',
                            boxSizing: 'border-box',
                            width: '100%',
                            minWidth: 0,
                          }}
                        >
                          <AvatarBorder borderStyle={m.borderStyle} size={22}>
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: m.color, color: '#fff', fontSize: 9.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {avatarInitials(m.name)}
                              </div>
                            )}
                          </AvatarBorder>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            <span style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: 'hsl(var(--foreground))',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              lineHeight: 1.2
                            }}>
                              {m.name}
                            </span>

                            {(badge || isMemOwner || m.role === 'admin' || m.role === 'observer') && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3.5, flexWrap: 'wrap', minWidth: 0 }}>
                                {badge && (
                                  <span style={{
                                    fontSize: 8.5, fontWeight: 700, padding: '0.5px 4.5px', borderRadius: 4,
                                    background: badge.bg, color: badge.color,
                                    display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    <span>{badge.label}</span>
                                  </span>
                                )}

                                {isMemOwner ? (
                                  <span style={{ fontSize: 8.5, fontWeight: 700, padding: '0.5px 4.5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    <Crown size={9} /> Owner
                                  </span>
                                ) : m.role === 'admin' ? (
                                  <span style={{ fontSize: 8.5, fontWeight: 700, padding: '0.5px 4.5px', borderRadius: 4, backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', display: 'inline-flex', alignItems: 'center', gap: 2.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    <Shield size={9} /> Admin
                                  </span>
                                ) : m.role === 'observer' ? (
                                  <span style={{ fontSize: 8.5, fontWeight: 700, padding: '0.5px 4.5px', borderRadius: 4, backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: 2.5, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                    <Eye size={9} /> Observer
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>Unassigned</span>
                  )}
                  <div style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} /> Only the board owner or admins can assign team members.
                  </div>
                </div>
              )}
            </div>

            {/* Save Card & Delete Card Action Area */}
            <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <motion.button
                whileTap={{ scale: 0.96 }}
                animate={{
                  x: shakeSave ? [-8, 8, -6, 6, -3, 3, 0] : 0,
                  boxShadow: isDirty
                    ? '0 0 16px hsla(var(--primary), 0.45), var(--neu-shadow-raised-sm)'
                    : 'var(--neu-shadow-raised-sm)'
                }}
                transition={{ duration: shakeSave ? 0.6 : 0.2 }}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '10px 14px',
                  borderRadius: 11,
                  backgroundColor: isSavedSuccess ? '#10b981' : isDirty ? 'hsl(var(--primary))' : 'hsl(var(--card))',
                  color: isSavedSuccess ? '#fff' : isDirty ? '#fff' : 'hsl(var(--foreground))',
                  border: isDirty ? 'none' : '1px solid hsl(var(--border))',
                  cursor: isSaving ? 'wait' : 'pointer',
                  transition: 'background-color 0.2s, color 0.2s, border 0.2s'
                }}
                disabled={isSaving}
                onClick={handleSaveCard}
                title={isDirty ? 'Save unsaved card changes' : 'Card is already saved'}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Saving to Cloud...
                  </>
                ) : isSavedSuccess ? (
                  <>
                    <Check size={15} /> Saved to Cloud!
                  </>
                ) : (
                  <>
                    <Save size={15} /> {isDirty ? 'Save Card (Unsaved)' : 'Save Card'}
                  </>
                )}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                className="btn btn-secondary"
                style={{ width: '100%', color: 'hsl(var(--destructive))', borderRadius: 11 }}
                onClick={handleDeleteCard}
              >
                <Trash2 size={13} /> Delete Card
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>

    {/* Fullscreen Lightbox Image Preview */}
    <AnimatePresence>
      {previewAttachment && (
        <div
          className="modal-overlay"
          style={{ zIndex: 200, backgroundColor: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(10px)', padding: 24 }}
          onClick={() => setPreviewAttachment(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.16 }}
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#fff', padding: '0 4px' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 450 }}>
                {previewAttachment.name} ({formatBytes(previewAttachment.size)})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href={previewAttachment.dataUrl}
                  download={previewAttachment.name}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '5px 12px', backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none' }}
                >
                  <Download size={13} /> Download
                </a>
                <button
                  className="icon-btn"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: 'none', width: 30, height: 30 }}
                  onClick={() => setPreviewAttachment(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <img
              src={previewAttachment.dataUrl}
              alt={previewAttachment.name}
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 12,
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)'
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Link Insertion Modal Dialog */}
    <AnimatePresence>
      {showLinkModal && (
        <div
          className="modal-overlay"
          style={{ zIndex: 210, backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(5px)', padding: 20 }}
          onClick={() => setShowLinkModal(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="modal-content"
            style={{
              width: '100%',
              maxWidth: 560,
              padding: '24px 28px',
              borderRadius: 18,
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border) / 0.8)',
              boxShadow: 'var(--neu-shadow-floating)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: 'hsl(var(--primary) / 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'hsl(var(--primary))',
                    flexShrink: 0,
                  }}
                >
                  <Link2 size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                    Insert Link in {showLinkModal === 'comment' ? 'Comment' : 'Reply'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', marginTop: 1 }}>
                    Attach a web link or resource with custom display text
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                style={{ width: 32, height: 32 }}
                onClick={() => setShowLinkModal(null)}
              >
                <X size={15} />
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                let url = linkUrlInput.trim();
                if (!url) return;
                if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
                  url = 'https://' + url;
                }
                const label = linkTextInput.trim();
                const formatted = label ? `[${label}](${url})` : url;

                if (showLinkModal === 'comment') {
                  setCommentText(prev => {
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                    return prev + (needsSpace ? ' ' : '') + formatted + ' ';
                  });
                  setTimeout(() => commentInputRef.current?.focus(), 60);
                } else if (showLinkModal === 'reply') {
                  setReplyText(prev => {
                    const needsSpace = prev.length > 0 && !prev.endsWith(' ');
                    return prev + (needsSpace ? ' ' : '') + formatted + ' ';
                  });
                  setTimeout(() => replyInputRef.current?.focus(), 60);
                }
                setShowLinkModal(null);
                setLinkUrlInput('');
                setLinkTextInput('');
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div className="form-group">
                <label className="field-label" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  Destination URL <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  className="text-input"
                  placeholder="https://example.com or link..."
                  value={linkUrlInput}
                  onChange={e => setLinkUrlInput(e.target.value)}
                  style={{ height: 42, fontSize: 13.5, padding: '8px 14px', borderRadius: 8 }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="field-label" style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                  Display Text <span style={{ fontSize: 11, fontWeight: 400, color: 'hsl(var(--muted-foreground))' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Sprint Specs, Figma, PR #12"
                  value={linkTextInput}
                  onChange={e => setLinkTextInput(e.target.value)}
                  style={{ height: 42, fontSize: 13.5, padding: '8px 14px', borderRadius: 8 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowLinkModal(null)}
                  style={{ fontSize: 13, padding: '8px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!linkUrlInput.trim()}
                  style={{ fontSize: 13, padding: '8px 20px' }}
                >
                  Insert Link
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  );
}
