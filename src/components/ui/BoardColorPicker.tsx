import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Pipette } from 'lucide-react';
import { BOARD_COLORS } from '../../types';

interface Props {
  currentColor: string;
  onSelectColor: (color: string) => void;
  onClose: () => void;
  align?: 'left' | 'right';
  style?: React.CSSProperties;
}

export default function BoardColorPicker({
  currentColor,
  onSelectColor,
  onClose,
  align = 'right',
  style,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 6 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        [align]: 0,
        zIndex: 100,
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 12,
        padding: '10px 12px',
        boxShadow: 'var(--neu-shadow-floating)',
        width: 190,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Board Color
        </span>
        <label
          title="Pick custom color"
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 10.5,
            color: 'hsl(var(--primary))',
            fontWeight: 600,
          }}
        >
          <Pipette size={11} />
          <span>Custom</span>
          <input
            type="color"
            value={currentColor.startsWith('#') ? currentColor : '#6366f1'}
            onChange={e => onSelectColor(e.target.value)}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
        {BOARD_COLORS.map(c => {
          const isSelected = currentColor.toLowerCase() === c.value.toLowerCase();
          return (
            <motion.button
              key={c.value}
              type="button"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              title={c.name}
              onClick={(e) => {
                e.stopPropagation();
                onSelectColor(c.value);
                onClose();
              }}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                backgroundColor: c.value,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: isSelected ? '2px solid hsl(var(--foreground))' : '1px solid rgba(0,0,0,0.1)',
                boxShadow: isSelected ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                cursor: 'pointer',
                outline: 'none',
                padding: 0,
              }}
            >
              {isSelected && <Check size={11} color="#fff" strokeWidth={3} />}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
