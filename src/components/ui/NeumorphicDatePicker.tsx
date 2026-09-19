import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight,
  X, Check, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  value?: string | null; // ISO date string or datetime string
  onChange: (val: string | null) => void;
  placeholder?: string;
  align?: 'left' | 'right';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function parseDateValue(val?: string | null): Date | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0, 0);
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export default function NeumorphicDatePicker({
  value,
  onChange,
  placeholder = 'Set date...',
  align = 'right'
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse existing value or fallback to today
  const initialDate = useMemo(() => {
    return parseDateValue(value) || new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(value ? parseDateValue(value) : null);

  // Sync state when value changes from outside
  useEffect(() => {
    if (value) {
      const d = parseDateValue(value);
      if (d) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
        setSelectedDate(d);
      }
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // Dynamic alignment check to prevent popover cutoff on container edges
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(align);

  useEffect(() => {
    setEffectiveAlign(align);
  }, [align]);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const updateAlign = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const popoverWidth = 290;

      // Check boundary against clipping containers or window
      const clipParent = containerRef.current.closest('.modal-body') ||
                         containerRef.current.closest('.card-modal-grid') ||
                         containerRef.current.closest('.modal-content');
      const maxRight = clipParent ? clipParent.getBoundingClientRect().right : window.innerWidth;
      const minLeft = clipParent ? clipParent.getBoundingClientRect().left : 0;

      if (align === 'left' && rect.left + popoverWidth > maxRight - 8) {
        setEffectiveAlign('right');
      } else if (align === 'right' && rect.right - popoverWidth < minLeft + 8) {
        setEffectiveAlign('left');
      } else {
        setEffectiveAlign(align);
      }
    };

    updateAlign();
    window.addEventListener('resize', updateAlign);
    return () => window.removeEventListener('resize', updateAlign);
  }, [isOpen, align]);

  // Click outside to close (revert temporary selection if unapplied)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        if (value) {
          const d = parseDateValue(value);
          if (d) {
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
            setSelectedDate(d);
          }
        } else {
          setSelectedDate(null);
        }
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, value]);

  const computeIso = (d: Date | null) => {
    if (!d) return null;
    const finalDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
    return isNaN(finalDate.getTime()) ? null : finalDate.toISOString();
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  // Clicking a date selects and applies it immediately
  const handleSelectDate = (dateObj: Date) => {
    const target = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 12, 0, 0, 0);
    setViewMonth(target.getMonth());
    setViewYear(target.getFullYear());
    setSelectedDate(target);
    const iso = computeIso(target);
    if (iso) onChange(iso);
    setIsOpen(false);
  };

  const handleQuickPreset = (preset: 'today' | 'tomorrow' | 'nextWeek' | 'endOfWeek') => {
    const now = new Date();
    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

    if (preset === 'today') {
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    } else if (preset === 'tomorrow') {
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0, 0);
    } else if (preset === 'endOfWeek') {
      const diff = 5 - now.getDay();
      const daysToAdd = diff >= 0 ? diff : diff + 7;
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToAdd, 12, 0, 0, 0);
    } else if (preset === 'nextWeek') {
      d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 12, 0, 0, 0);
    }

    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(d);
    const iso = computeIso(d);
    if (iso) onChange(iso);
    setIsOpen(false);
  };

  const handleApply = () => {
    const targetDate = selectedDate || new Date();
    setSelectedDate(targetDate);
    const iso = computeIso(targetDate);
    if (iso) onChange(iso);
    setIsOpen(false);
  };

  const handleCancel = () => {
    if (value) {
      const d = parseDateValue(value);
      if (d) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
        setSelectedDate(d);
      }
    } else {
      setSelectedDate(null);
    }
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedDate(null);
    onChange(null);
    setIsOpen(false);
  };

  // Generate days in month grid
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days: Array<{ day: number; isCurrentMonth: boolean; dateObj: Date }> = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(viewYear, viewMonth - 1, d);
      days.push({ day: d, isCurrentMonth: false, dateObj: prevDate });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const currDate = new Date(viewYear, viewMonth, i);
      days.push({ day: i, isCurrentMonth: true, dateObj: currDate });
    }

    // Next month filler days to complete 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(viewYear, viewMonth + 1, i);
      days.push({ day: i, isCurrentMonth: false, dateObj: nextDate });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Display trigger string (clean date only, without time)
  const formatted = useMemo(() => {
    const d = parseDateValue(value);
    if (!d) return null;

    const datePart = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    return { datePart };
  }, [value]);

  const handleToggleOpen = () => {
    if (!isOpen) {
      const current = parseDateValue(value);
      if (current) {
        setSelectedDate(current);
        setViewYear(current.getFullYear());
        setViewMonth(current.getMonth());
      } else {
        setSelectedDate(null);
        const now = new Date();
        setViewYear(now.getFullYear());
        setViewMonth(now.getMonth());
      }
    }
    setIsOpen(o => !o);
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (d: Date) => {
    if (!selectedDate) return false;
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
      {/* Interactive Trigger Button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '5px 8px',
          minHeight: 34,
          borderRadius: 8,
          border: '1px solid hsl(var(--border) / 0.8)',
          backgroundColor: isOpen
            ? 'hsl(var(--secondary) / 0.7)'
            : 'hsl(var(--card))',
          boxShadow: isOpen
            ? 'var(--neu-shadow-pressed)'
            : 'var(--neu-shadow-raised-sm)',
          outline: 'none',
          transition: 'all 0.18s ease',
          boxSizing: 'border-box',
        }}
        onClick={handleToggleOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              backgroundColor: formatted ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--secondary) / 0.8)',
              color: formatted ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}
          >
            <CalendarIcon size={12} strokeWidth={2} />
          </div>

          {formatted ? (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                textAlign: 'left',
              }}
            >
              {formatted.datePart}
            </span>
          ) : (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 300,
                color: 'hsl(var(--muted-foreground))',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                flex: 1,
                textAlign: 'left',
              }}
            >
              {placeholder}
            </span>
          )}
        </div>

        {value ? (
          <motion.span
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleClear}
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: 3,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Clear date"
          >
            <X size={12} strokeWidth={2.2} />
          </motion.span>
        ) : null}
      </motion.button>

      {/* Neumorphic Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '100%',
              ...(effectiveAlign === 'right' ? { right: 0 } : { left: 0 }),
              marginTop: 6,
              zIndex: 120,
              width: 290,
              maxWidth: 'calc(100vw - 24px)',
              boxSizing: 'border-box',
              backgroundColor: 'hsl(var(--popover))',
              borderRadius: 16,
              boxShadow: 'var(--neu-shadow-floating)',
              border: '1px solid hsl(var(--border) / 0.6)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Quick Presets */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="dashboard-filter-pill"
                style={{ backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', fontSize: 11 }}
                onClick={() => handleQuickPreset('today')}
              >
                Today
              </button>
              <button
                type="button"
                className="dashboard-filter-pill"
                style={{ backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', fontSize: 11 }}
                onClick={() => handleQuickPreset('tomorrow')}
              >
                Tomorrow
              </button>
              <button
                type="button"
                className="dashboard-filter-pill"
                style={{ backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', fontSize: 11 }}
                onClick={() => handleQuickPreset('endOfWeek')}
              >
                End of Week
              </button>
              <button
                type="button"
                className="dashboard-filter-pill"
                style={{ backgroundColor: 'hsl(var(--card))', boxShadow: 'var(--neu-shadow-raised-sm)', fontSize: 11 }}
                onClick={() => handleQuickPreset('nextWeek')}
              >
                Next Week
              </button>
            </div>

            {/* Month & Year Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                className="icon-btn"
                style={{ width: 28, height: 28 }}
                onClick={handlePrevMonth}
              >
                <ChevronLeft size={15} />
              </motion.button>

              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>

              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                className="icon-btn"
                style={{ width: 28, height: 28 }}
                onClick={handleNextMonth}
              >
                <ChevronRight size={15} />
              </motion.button>
            </div>

            {/* Days of Week Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: 4 }}>
              {DAYS_OF_WEEK.map(d => (
                <span key={d} style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                  {d}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {calendarDays.map((item, idx) => {
                const selected = isSelected(item.dateObj);
                const currentDay = isToday(item.dateObj);

                return (
                  <motion.button
                    type="button"
                    key={idx}
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: 1.08 }}
                    onClick={() => handleSelectDate(item.dateObj)}
                    onDoubleClick={() => {
                      handleSelectDate(item.dateObj);
                      const iso = computeIso(item.dateObj);
                      if (iso) onChange(iso);
                      setIsOpen(false);
                    }}
                    style={{
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: selected || currentDay ? 700 : 500,
                      cursor: 'pointer',
                      border: currentDay && !selected ? '1.5px solid hsl(var(--primary))' : 'none',
                      backgroundColor: selected
                        ? 'hsl(var(--primary))'
                        : item.isCurrentMonth
                        ? 'hsl(var(--card))'
                        : 'transparent',
                      color: selected
                        ? 'hsl(var(--primary-foreground))'
                        : item.isCurrentMonth
                        ? 'hsl(var(--foreground))'
                        : 'hsl(var(--muted-foreground) / 0.4)',
                      boxShadow: selected
                        ? 'var(--neu-shadow-raised-sm)'
                        : item.isCurrentMonth
                        ? 'var(--neu-shadow-raised-sm)'
                        : 'none',
                      transition: 'background-color 0.12s ease'
                    }}
                  >
                    {item.day}
                  </motion.button>
                );
              })}
            </div>

            {/* Popover Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                className="btn btn-ghost"
                style={{ fontSize: 11.5, padding: '4px 8px', color: 'hsl(var(--destructive))' }}
                onClick={() => handleClear()}
              >
                Clear
              </motion.button>

              <div style={{ display: 'flex', gap: 6 }}>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  className="btn btn-secondary"
                  style={{ fontSize: 11.5, padding: '4px 10px' }}
                  onClick={handleCancel}
                >
                  Cancel
                </motion.button>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  className="btn btn-primary"
                  style={{ fontSize: 11.5, padding: '4px 12px' }}
                  onClick={handleApply}
                >
                  <Check size={12} /> Apply
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
