import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  subLabel?: string;
  icon?: React.ReactNode;
  color?: string;
}

interface Props<T extends string = string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  prefix?: React.ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  placement?: 'top' | 'bottom' | 'auto';
  align?: 'left' | 'right';
}

export function NeumorphicSelect<T extends string = string>({
  value,
  options,
  onChange,
  placeholder = 'Select option...',
  prefix,
  size = 'md',
  disabled = false,
  style,
  className,
  placement = 'auto',
  align = 'left',
}: Props<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [computedPlacement, setComputedPlacement] = useState<'top' | 'bottom'>('bottom');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  // Close on click outside & calculate auto placement
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      if (placement === 'auto' && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // If less than 200px below, flip to open upwards
        setComputedPlacement(spaceBelow < 200 ? 'top' : 'bottom');
      } else {
        setComputedPlacement(placement === 'top' ? 'top' : 'bottom');
      }
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, placement]);

  const isSmall = size === 'sm';
  const isTop = computedPlacement === 'top';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: isSmall ? 'auto' : '100%',
        minWidth: isSmall ? 120 : 160,
        zIndex: isOpen ? 100 : 'auto',
        ...style,
      }}
      className={className}
    >
      {/* Trigger Button */}
      <motion.button
        type="button"
        whileTap={!disabled ? { scale: 0.98 } : undefined}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: isSmall ? '4px 10px' : '8px 12px',
          fontSize: isSmall ? 11.5 : 12.5,
          fontWeight: 600,
          borderRadius: isSmall ? 8 : 10,
          border: '1px solid hsl(var(--border) / 0.8)',
          backgroundColor: isOpen
            ? 'hsl(var(--secondary) / 0.8)'
            : 'hsl(var(--card))',
          color: selectedOption?.color || 'hsl(var(--foreground))',
          boxShadow: isOpen
            ? 'var(--neu-shadow-pressed)'
            : 'var(--neu-shadow-raised-sm)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          transition: 'all 0.18s ease',
          boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
          {prefix && (
            <span style={{ fontSize: isSmall ? 11 : 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
              {prefix}
            </span>
          )}
          {selectedOption?.icon && (
            <span style={{ display: 'flex', alignItems: 'center', color: selectedOption.color || 'hsl(var(--primary))', flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: selectedOption?.color || 'hsl(var(--foreground))' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}
        >
          <ChevronDown size={isSmall ? 12 : 14} />
        </motion.div>
      </motion.button>

      {/* Floating Neumorphic Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: isTop ? 6 : -6, scale: 0.96 }}
            animate={{ opacity: 1, y: isTop ? -4 : 4, scale: 1 }}
            exit={{ opacity: 0, y: isTop ? 6 : -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: isTop ? 'auto' : '100%',
              bottom: isTop ? '100%' : 'auto',
              left: align === 'right' ? 'auto' : 0,
              right: align === 'right' ? 0 : 'auto',
              zIndex: 9999,
              minWidth: isSmall ? 165 : '100%',
              backgroundColor: 'hsl(var(--card) / 0.98)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid hsl(var(--border) / 0.9)',
              borderRadius: 12,
              padding: 5,
              boxShadow: '0 16px 36px -4px rgba(0,0,0,0.25), 0 6px 16px -2px rgba(0,0,0,0.12), var(--neu-shadow-raised)',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              transformOrigin: isTop
                ? (align === 'right' ? 'bottom right' : 'bottom left')
                : (align === 'right' ? 'top right' : 'top left'),
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <motion.button
                  key={opt.value}
                  type="button"
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: isSmall ? '6px 8px' : '8px 10px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: isSelected
                      ? 'hsl(var(--primary) / 0.12)'
                      : 'transparent',
                    color: isSelected
                      ? 'hsl(var(--primary))'
                      : 'hsl(var(--foreground))',
                    cursor: 'pointer',
                    fontSize: isSmall ? 11.5 : 12.5,
                    fontWeight: isSelected ? 700 : 500,
                    textAlign: 'left',
                    boxShadow: isSelected ? 'var(--neu-shadow-pressed)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'hsl(var(--secondary) / 0.7)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {opt.icon && (
                      <span style={{ display: 'flex', alignItems: 'center', color: opt.color || (isSelected ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))') }}>
                        {opt.icon}
                      </span>
                    )}
                    <div>
                      <div>{opt.label}</div>
                      {opt.subLabel && (
                        <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', fontWeight: 400 }}>
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={13} strokeWidth={2.5} color="hsl(var(--primary))" style={{ flexShrink: 0, marginLeft: 8 }} />
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
