/**
 * AvatarBorder – wraps any avatar (img or initials div) with a styled border ring.
 *
 * Gradient borders on circular elements can't be done with CSS `border` alone,
 * so we use the background + padding technique:
 *   - outer div: borderRadius 50%, background = gradient, padding = 2-3px
 *   - inner div/img: borderRadius 50%, 100% size
 *
 * This component handles all borderStyle keys defined in BORDER_PRESETS.
 */
import React, { useRef } from 'react';
import { BORDER_PRESETS } from '../../types';
import { parseCustomBorderStyle } from '../../utils';

interface AvatarBorderProps {
  borderStyle?: string;
  size: number;
  children: React.ReactNode;
  /** Extra className on the outer wrapper */
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export default function AvatarBorder({
  borderStyle,
  size,
  children,
  className,
  style,
  title,
}: AvatarBorderProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  const key = borderStyle || 'none';
  const custom = parseCustomBorderStyle(key);
  const preset = BORDER_PRESETS.find(p => p.key === key);
  const gap = 2; // px between gradient border and avatar content

  // ── Custom border rendering ─────────────────────────────────────────────
  if (custom) {
    const color = custom.color || 'hsl(var(--primary))';
    if (custom.styleType === 'solid') {
      return (
        <div
          ref={wrapRef}
          className={className}
          title={title}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `2.5px solid ${color}`,
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...style,
          }}
        >
          {children}
        </div>
      );
    }
    if (custom.styleType === 'dashed') {
      return (
        <div
          ref={wrapRef}
          className={className}
          title={title}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `2px dashed ${color}`,
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...style,
          }}
        >
          {children}
        </div>
      );
    }
    if (custom.styleType === 'glow') {
      return (
        <div
          ref={wrapRef}
          className={className}
          title={title}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            boxShadow: `0 0 0 2px ${color}35, 0 0 12px 3px ${color}65`,
            overflow: 'hidden',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...style,
          }}
        >
          {children}
        </div>
      );
    }

    // Default custom gradient
    const totalSize = size + gap * 2;
    const gradient = custom.gradient || `linear-gradient(135deg, ${color}, #8b5cf6)`;
    return (
      <div
        ref={wrapRef}
        className={`avatar-border-wrap${className ? ` ${className}` : ''}`}
        title={title}
        data-border={key}
        style={{
          width: totalSize,
          height: totalSize,
          borderRadius: '50%',
          background: gradient,
          padding: gap,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // ── No border ──────────────────────────────────────────────────────────
  if (!preset || key === 'none') {
    return (
      <div
        ref={wrapRef}
        className={className}
        title={title}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '1.5px solid hsl(var(--border))',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  // ── Dashed border ──────────────────────────────────────────────────────
  if (key === 'dashed') {
    return (
      <div
        ref={wrapRef}
        className={className}
        title={title}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '2px dashed hsl(var(--primary))',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  // ── Glow border ────────────────────────────────────────────────────────
  if (key === 'glow') {
    return (
      <div
        ref={wrapRef}
        className={className}
        title={title}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '2px solid hsl(var(--primary))',
          boxShadow: '0 0 0 2px hsl(var(--primary) / 0.22), 0 0 12px 3px hsl(var(--primary) / 0.45)',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  // ── Solid border ───────────────────────────────────────────────────────
  if (key === 'solid') {
    return (
      <div
        ref={wrapRef}
        className={className}
        title={title}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '2.5px solid hsl(var(--primary))',
          overflow: 'hidden',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  // ── Gradient border (gradient background + padding technique) ──────────
  const totalSize = size + gap * 2;
  const isAnimated = preset.animated;

  return (
    <div
      ref={wrapRef}
      className={`avatar-border-wrap${isAnimated ? ' avatar-border-animated' : ''}${className ? ` ${className}` : ''}`}
      title={title}
      data-border={key}
      style={{
        width: totalSize,
        height: totalSize,
        borderRadius: '50%',
        background: preset.gradient,
        padding: gap,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {/* Inner clip — hides the gradient background except as the border ring */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
