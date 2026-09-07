import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Pipette, X } from 'lucide-react';
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
  const isColorInputActive = useRef(false);
  const [hexInput, setHexInput] = useState(() =>
    currentColor.startsWith('#') ? currentColor.slice(1) : currentColor
  );

  // Sync hex text when external currentColor changes
  useEffect(() => {
    if (currentColor.startsWith('#')) {
      setHexInput(currentColor.slice(1));
    }
  }, [currentColor]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // If the native color picker dialog was just active, do not close
      if (isColorInputActive.current) return;
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

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/[^0-9a-fA-F]/g, '');
    setHexInput(clean);
    if (clean.length === 6 || clean.length === 3) {
      onSelectColor('#' + clean);
    }
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 6 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
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
        width: 204,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        ...style,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Board Color
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          className="icon-btn"
          style={{ width: 20, height: 20, padding: 0 }}
          title="Close color drawer"
        >
          <X size={12} />
        </button>
      </div>

      {/* Preset Swatches */}
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
                // Keep open so user can preview and compare colors
              }}
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
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

      {/* Custom Color Input Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingTop: 8,
          borderTop: '1px solid hsl(var(--border) / 0.5)',
        }}
      >
        {/* Color picker circle with pipette icon */}
        <div
          title="Pick custom color"
          style={{
            position: 'relative',
            width: 24,
            height: 24,
            borderRadius: '50%',
            backgroundColor: currentColor.startsWith('#') ? currentColor : '#6366f1',
            boxShadow: 'var(--neu-shadow-raised-sm)',
            border: '1.5px solid hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            cursor: 'pointer',
          }}
        >
          <Pipette size={11} color="#fff" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))', pointerEvents: 'none' }} />
          <input
            type="color"
            value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#6366f1'}
            onFocus={() => { isColorInputActive.current = true; }}
            onBlur={() => { setTimeout(() => { isColorInputActive.current = false; }, 300); }}
            onChange={e => {
              onSelectColor(e.target.value);
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              width: '100%',
              height: '100%',
              cursor: 'pointer',
            }}
          />
        </div>

        {/* Hex input */}
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 7, fontSize: 11, color: 'hsl(var(--muted-foreground))', fontWeight: 600, pointerEvents: 'none' }}>#</span>
          <input
            type="text"
            maxLength={6}
            placeholder="6366f1"
            value={hexInput}
            onChange={handleHexChange}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            className="text-input"
            style={{
              height: 25,
              fontSize: 11.5,
              paddingLeft: 17,
              paddingRight: 6,
              fontFamily: 'monospace',
              borderRadius: 6,
              width: '100%',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
