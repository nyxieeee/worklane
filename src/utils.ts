import React, { useState, useEffect } from 'react';
import type { CustomBorderDef } from './types';

export const uid = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function avatarInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function formatTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return d.toLocaleDateString();
}

export function formatDueDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getDueStatus(iso: string | null): 'overdue' | 'due-soon' | 'ok' | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) return 'overdue';
  if (diff < 86400000) return 'due-soon';
  return 'ok';
}

export function truncateFileName(name: string, maxLength: number = 28): string {
  if (!name || name.length <= maxLength) return name;
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1 || lastDot < name.length - 8) {
    return name.slice(0, maxLength - 3) + '...';
  }
  const ext = name.slice(lastDot);
  const base = name.slice(0, lastDot);
  const availableBase = maxLength - ext.length - 3;
  if (availableBase <= 4) return name.slice(0, maxLength - 3) + '...';
  const frontChars = Math.ceil(availableBase * 0.6);
  const backChars = Math.floor(availableBase * 0.4);
  return `${base.slice(0, frontChars)}...${base.slice(-backChars)}${ext}`;
}

export function fileIcon(name: string): string {
  const ext = (name || '').split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
    ppt: '📊', pptx: '📊', txt: '📃', zip: '🗜️', rar: '🗜️',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️', webp: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mp3: '🎵', wav: '🎵',
    js: '💻', ts: '💻', py: '💻', html: '💻', css: '💻', json: '📋',
  };
  return map[ext] || '📁';
}

export function isImageFile(name: string): boolean {
  const ext = (name || '').split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext);
}

/**
 * Deterministically sorts board members with the Board Owner fixed at the top,
 * followed by alphabetical order of members' display names.
 */
export function sortMembersWithOwnerFirst<T extends { email?: string; role?: string; name?: string }>(
  members: T[],
  createdByEmail?: string
): T[] {
  if (!members || members.length === 0) return [];
  const cleanCreatedBy = createdByEmail ? createdByEmail.toLowerCase().trim() : '';

  return [...members].sort((a, b) => {
    const aEmail = (a.email || '').toLowerCase().trim();
    const bEmail = (b.email || '').toLowerCase().trim();

    const aIsOwner = (cleanCreatedBy && aEmail === cleanCreatedBy) || a.role === 'owner';
    const bIsOwner = (cleanCreatedBy && bEmail === cleanCreatedBy) || b.role === 'owner';

    if (aIsOwner && !bIsOwner) return -1;
    if (!aIsOwner && bIsOwner) return 1;

    const aName = a.name || aEmail;
    const bName = b.name || bEmail;
    return aName.localeCompare(bName);
  });
}

/**
 * Returns inline CSS style properties that render a coloured avatar border ring
 * based on the given borderStyle key (e.g. 'frontend', 'gold', 'rainbow', 'none').
 *
 * The caller should spread these styles onto the avatar element.
 */
export function getAvatarBorderStyle(borderStyle: string | undefined): React.CSSProperties {
  if (!borderStyle || borderStyle === 'none') {
    return { border: '1.5px solid hsl(var(--border))' };
  }

  // Dashed style
  if (borderStyle === 'dashed') {
    return {
      border: '2px dashed hsl(var(--primary))',
      padding: 1,
    };
  }

  // Glow style — primary colour with neon shadow
  if (borderStyle === 'glow') {
    return {
      border: '2px solid hsl(var(--primary))',
      boxShadow: '0 0 0 2px hsl(var(--primary) / 0.25), 0 0 10px 2px hsl(var(--primary) / 0.4)',
    };
  }

  // Solid classic
  if (borderStyle === 'solid') {
    return { border: '2.5px solid hsl(var(--primary))' };
  }

  // Gradient-based styles — implemented via outline trick using background-clip
  // We use a CSS-in-JS compatible technique: padding + background on parent wrapper.
  // Since we can't use ::before in inline styles, we render a 2px gradient border
  // by setting the element's outline to transparent and using boxShadow isn't ideal,
  // so we rely on a 2px gradient border using the background + padding approach.
  // For img/div avatars we apply via border + a data-border attribute consumed by CSS.
  // Simplest cross-element approach: use a coloured box-shadow ring + thin transparent border.
  const gradientMap: Record<string, string> = {
    frontend:  'linear-gradient(135deg, #0ea5e9, #06b6d4, #38bdf8)',
    backend:   'linear-gradient(135deg, #f97316, #fb923c, #f59e0b)',
    devops:    'linear-gradient(135deg, #10b981, #14b8a6, #34d399)',
    designer:  'linear-gradient(135deg, #ec4899, #f43f5e, #fb7185)',
    qa:        'linear-gradient(135deg, #8b5cf6, #6366f1, #a78bfa)',
    fullstack: 'linear-gradient(135deg, #6366f1, #0ea5e9, #10b981, #f59e0b)',
    mobile:    'linear-gradient(135deg, #f59e0b, #eab308, #fbbf24)',
    data:      'linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)',
    gold:      'linear-gradient(135deg, #f59e0b, #fbbf24, #d97706)',
    silver:    'linear-gradient(135deg, #94a3b8, #cbd5e1, #64748b)',
    rose:      'linear-gradient(135deg, #f43f5e, #fb7185, #fda4af)',
    ocean:     'linear-gradient(135deg, #0ea5e9, #38bdf8, #0284c7)',
    forest:    'linear-gradient(135deg, #16a34a, #22c55e, #15803d)',
    sunset:    'linear-gradient(135deg, #f97316, #ef4444, #ec4899)',
    rainbow:   'linear-gradient(135deg, #f43f5e, #f97316, #f59e0b, #10b981, #0ea5e9, #8b5cf6)',
  };

  const gradient = gradientMap[borderStyle];
  if (!gradient) return { border: '1.5px solid hsl(var(--border))' };

  // We achieve a gradient border by wrapping the element in a gradient-background div
  // with a small padding. Since we can't do that in a single element's inline style,
  // we return a special marker so the AvatarBorder wrapper component applies the trick.
  // For now, return the `data-border` style flag — the AvatarBorder wrapper handles the rest.
  return {
    // These are used as fallback / consumed by AvatarBorder wrapper
    outline: '2.5px solid transparent',
    outlineOffset: '1px',
    // Custom property read by the global CSS animation or wrapper
    ['--avatar-border-gradient' as string]: gradient,
    boxShadow: 'none',
  };
}

const CUSTOM_BORDERS_KEY = 'worklane_custom_borders';

export function getCustomBorders(): CustomBorderDef[] {
  try {
    const raw = localStorage.getItem(CUSTOM_BORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomBorder(border: CustomBorderDef): void {
  try {
    const list = getCustomBorders();
    const idx = list.findIndex(b => b.id === border.id);
    if (idx >= 0) {
      list[idx] = border;
    } else {
      list.unshift(border);
    }
    localStorage.setItem(CUSTOM_BORDERS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save custom border:', e);
  }
}

export function deleteCustomBorder(id: string): void {
  try {
    const list = getCustomBorders().filter(b => b.id !== id);
    localStorage.setItem(CUSTOM_BORDERS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to delete custom border:', e);
  }
}

export function encodeCustomBorderStyle(border: CustomBorderDef): string {
  return `custom:${border.id}|${border.label}|${border.badgeText}|${border.color}|${border.styleType}`;
}

export function parseCustomBorderStyle(val?: string): CustomBorderDef | null {
  if (!val) return null;
  if (val.startsWith('custom:')) {
    const payload = val.slice(7);
    const parts = payload.split('|');
    if (parts.length >= 4) {
      const id = parts[0] || 'custom';
      const label = parts[1] || 'Custom Role';
      const badgeText = parts[2] || 'ROLE';
      const color = parts[3] || '#6366f1';
      const styleType = (parts.length >= 6 ? parts[5] : parts[4]) || 'gradient';
      return {
        id,
        label,
        badgeText,
        color,
        styleType: (styleType as any) || 'gradient',
        gradient: `linear-gradient(135deg, ${color || '#6366f1'}, #8b5cf6)`
      };
    }
  }
  // Lookup by ID in saved custom borders
  const found = getCustomBorders().find(b => b.id === val);
  return found || null;
}

export type TeamCategory = 'frontend' | 'backend' | 'work' | 'none';

export function getMemberTeamCategory(borderStyle?: string): TeamCategory {
  if (!borderStyle || borderStyle === 'none') return 'none';
  if (borderStyle === 'frontend') return 'frontend';
  if (borderStyle === 'backend') return 'backend';
  // All other presets and custom borders are work-related
  return 'work';
}

export function getTeamBadgeInfo(borderStyle?: string): { label: string; color: string; bg: string } | null {
  if (!borderStyle || borderStyle === 'none') return null;

  // Custom border & badge lookup
  const custom = parseCustomBorderStyle(borderStyle);
  if (custom) {
    return {
      label: `${custom.label} (${custom.badgeText})`,
      color: custom.color,
      bg: `${custom.color}1e`
    };
  }

  switch (borderStyle) {
    case 'frontend':
      return { label: 'Frontend (FE)', color: '#0284c7', bg: 'rgba(14, 165, 233, 0.12)' };
    case 'backend':
      return { label: 'Backend (BE)', color: '#ea580c', bg: 'rgba(249, 115, 22, 0.12)' };
    case 'fullstack':
      return { label: 'Full-Stack (FS)', color: '#4f46e5', bg: 'rgba(99, 102, 241, 0.12)' };
    case 'devops':
      return { label: 'DevOps / Cloud', color: '#059669', bg: 'rgba(16, 185, 129, 0.12)' };
    case 'mobile':
      return { label: 'Mobile Dev', color: '#d97706', bg: 'rgba(245, 158, 11, 0.12)' };
    case 'qa':
      return { label: 'QA / Testing', color: '#7c3aed', bg: 'rgba(139, 92, 246, 0.12)' };
    case 'data':
      return { label: 'Data / AI / ML', color: '#9333ea', bg: 'rgba(147, 51, 234, 0.12)' };
    case 'security':
      return { label: 'SecOps / Security', color: '#dc2626', bg: 'rgba(239, 68, 68, 0.12)' };
    case 'designer':
      return { label: 'UI/UX Design', color: '#db2777', bg: 'rgba(236, 72, 153, 0.12)' };
    case 'pm':
      return { label: 'Product Manager (PM)', color: '#d97706', bg: 'rgba(245, 158, 11, 0.12)' };
    case 'scrum':
      return { label: 'Scrum Master (SM)', color: '#0891b2', bg: 'rgba(6, 182, 212, 0.12)' };
    case 'techlead':
      return { label: 'Tech Lead (TL)', color: '#ca8a04', bg: 'rgba(234, 179, 8, 0.12)' };
    case 'analyst':
      return { label: 'Business Analyst (BA)', color: '#059669', bg: 'rgba(16, 185, 129, 0.12)' };
    case 'marketing':
      return { label: 'Growth / Marketing', color: '#c026d3', bg: 'rgba(217, 70, 239, 0.12)' };
    case 'support':
      return { label: 'IT / Operations', color: '#475569', bg: 'rgba(100, 116, 139, 0.12)' };
    default:
      return null;
  }
}

export function useIsMobile(breakpoint = 860): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    update(mql);
    if (mql.addEventListener) {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    } else {
      mql.addListener(update);
      return () => mql.removeListener(update);
    }
  }, [breakpoint]);

  return isMobile;
}

export function getColDotColor(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('done') || n.includes('complete'))             return '#10b981';
  if (n.includes('urgent') || n.includes('critical'))           return '#ef4444';
  if (n.includes('progress') || n.includes('active') || n.includes('doing')) return '#3b82f6';
  if (n.includes('review') || n.includes('qa') || n.includes('testing'))     return '#f59e0b';
  if (n.includes('todo') || n.includes('to do') || n.includes('backlog'))    return '#8b5cf6';
  return '#64748b';
}



