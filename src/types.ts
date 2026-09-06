// ── Domain Types ──────────────────────────────────────────────────────

export type MemberRole = 'owner' | 'admin' | 'member' | 'observer';

export interface Member {
  id: string;
  name: string;
  email: string;
  color: string;
  avatarUrl?: string;
  role?: MemberRole;
  borderStyle?: string; // e.g. 'frontend', 'backend', 'gold', 'none'
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  addedAt: string;
}

export interface Comment {
  id: string;
  author: string;
  authorInitials: string;
  avatarColor: string;
  text: string;
  createdAt: string;
  parentId?: string | null;
  replyToAuthor?: string | null;
  authorEmail?: string;
  authorId?: string;
  attachments?: Attachment[];
}

export interface Card {
  id: string;
  title: string;
  description: string;
  comments: Comment[];
  attachments: Attachment[];
  labels: string[];
  assignees: string[];
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  coverAttachmentId?: string | null;
  isInbox?: boolean;
  // due-date alert flags
  [key: string]: unknown;
}

export interface Column {
  id: string;
  name: string;
  cards: Card[];
}

export interface Board {
  id: string;
  name: string;
  color: string;
  createdBy?: string; // email of the user who created this board
  members: Member[];
  columns: Column[];
  inboxCards?: Card[];
}

export interface Notification {
  id: string;
  title: string;
  sub: string;
  icon: string;
  cardId: string | null;
  boardId: string | null;
  recipientEmail?: string | null;
  time: string;
}

export interface EmailNotificationLog {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  sentAt: string;
  status: 'sent' | 'failed';
  eventType: 'card_assigned' | 'status_changed' | 'due_reminder' | 'comment_added' | 'member_added' | 'mention';
}

export interface EmailSettings {
  enabled: boolean;
  notifyOnAssign: boolean;
  notifyOnDue: boolean;
  notifyOnStatusChange: boolean;
  notifyOnMention: boolean;
  senderEmail: string;
}

// ── Border Style Presets ───────────────────────────────────────────────

export interface BorderPreset {
  key: string;
  label: string;
  group: 'tech' | 'work' | 'none';
  badgeText?: string;
  /** CSS gradient/color string for the border ring */
  gradient: string;
  /** Optional: animated */
  animated?: boolean;
}

export interface CustomBorderDef {
  id: string;
  label: string;
  badgeText: string;
  color: string;
  gradient?: string;
  styleType: 'gradient' | 'solid' | 'glow' | 'dashed';
}

export const BORDER_PRESETS: BorderPreset[] = [
  // ── Engineering & Tech Roles ──────────────────────────────────────────
  { key: 'frontend',  label: 'Frontend Dev',      group: 'tech', badgeText: 'FE',     gradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4, #38bdf8)' },
  { key: 'backend',   label: 'Backend Dev',       group: 'tech', badgeText: 'BE',     gradient: 'linear-gradient(135deg, #f97316, #fb923c, #f59e0b)' },
  { key: 'fullstack', label: 'Full-Stack Dev',    group: 'tech', badgeText: 'FS',     gradient: 'linear-gradient(135deg, #6366f1, #0ea5e9, #10b981, #f59e0b)' },
  { key: 'devops',    label: 'DevOps / Cloud',    group: 'tech', badgeText: 'DevOps', gradient: 'linear-gradient(135deg, #10b981, #14b8a6, #34d399)' },
  { key: 'mobile',    label: 'Mobile Dev',        group: 'tech', badgeText: 'Mobile', gradient: 'linear-gradient(135deg, #f59e0b, #eab308, #fbbf24)' },
  { key: 'qa',        label: 'QA / Testing',      group: 'tech', badgeText: 'QA',     gradient: 'linear-gradient(135deg, #8b5cf6, #6366f1, #a78bfa)' },
  { key: 'data',      label: 'Data / AI / ML',    group: 'tech', badgeText: 'Data',   gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)' },
  { key: 'security',  label: 'SecOps / Security', group: 'tech', badgeText: 'SecOps', gradient: 'linear-gradient(135deg, #ef4444, #f87171, #dc2626)' },

  // ── Workplace & Product Roles ───────────────────────────────────────────
  { key: 'designer',  label: 'UI/UX Design',       group: 'work', badgeText: 'UI/UX',  gradient: 'linear-gradient(135deg, #ec4899, #f43f5e, #fb7185)' },
  { key: 'pm',        label: 'Product Manager',    group: 'work', badgeText: 'PM',     gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24, #d97706)' },
  { key: 'scrum',     label: 'Scrum Master',       group: 'work', badgeText: 'Scrum',  gradient: 'linear-gradient(135deg, #06b6d4, #22d3ee, #0891b2)' },
  { key: 'techlead',  label: 'Tech Lead',          group: 'work', badgeText: 'Lead',   gradient: 'linear-gradient(135deg, #eab308, #facc15, #ca8a04)' },
  { key: 'analyst',   label: 'Business Analyst',   group: 'work', badgeText: 'BA',     gradient: 'linear-gradient(135deg, #10b981, #34d399, #059669)' },
  { key: 'marketing', label: 'Growth / Marketing', group: 'work', badgeText: 'Growth', gradient: 'linear-gradient(135deg, #d946ef, #e879f9, #c026d3)' },
  { key: 'support',   label: 'IT / Operations',    group: 'work', badgeText: 'Ops',    gradient: 'linear-gradient(135deg, #64748b, #94a3b8, #475569)' },

  // ── Default ───────────────────────────────────────────────────────────
  { key: 'none',      label: 'No Role / Border',   group: 'none', gradient: 'none' },
];

// ── Constants ──────────────────────────────────────────────────────────

export const BOARD_COLORS = [
  { name: 'Indigo',  value: '#6366f1' },
  { name: 'Purple',  value: '#a855f7' },
  { name: 'Pink',    value: '#ec4899' },
  { name: 'Rose',    value: '#f43f5e' },
  { name: 'Orange',  value: '#f97316' },
  { name: 'Amber',   value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal',    value: '#14b8a6' },
  { name: 'Sky',     value: '#0ea5e9' },
  { name: 'Blue',    value: '#3b82f6' },
  { name: 'Slate',   value: '#64748b' },
  { name: 'Zinc',    value: '#71717a' },
] as const;

export const AVATAR_COLORS = [
  '#6366f1','#a855f7','#ec4899','#f43f5e',
  '#f97316','#10b981','#14b8a6','#0ea5e9','#3b82f6',
] as const;

export const LABELS = [
  { id: 'general',  name: 'General',  color: '#64748b' },
  { id: 'task',     name: 'Task',     color: '#3b82f6' },
  { id: 'planning', name: 'Planning', color: '#8b5cf6' },
  { id: 'research', name: 'Research', color: '#06b6d4' },
  { id: 'review',   name: 'Review',   color: '#f59e0b' },
  { id: 'urgent',   name: 'Urgent',   color: '#ef4444' },
  { id: 'done',     name: 'Done',     color: '#10b981' },
  { id: 'design',   name: 'Design',   color: '#ec4899' },
  { id: 'feature',  name: 'Feature',  color: '#6366f1' },
  { id: 'bug',      name: 'Bug',      color: '#dc2626' },
  { id: 'backend',  name: 'Backend',  color: '#f97316' },
  { id: 'frontend', name: 'Frontend', color: '#0ea5e9' },
] as const;
