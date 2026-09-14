import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight,
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

export default function NeumorphicDatePicker({
  value,
  onChange,
  placeholder = 'Set due date & time...',
  align = 'right'
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse existing value or fallback to today
  const initialDate = useMemo(() => {
    if (!value) return new Date();
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(value ? initialDate : null);

  // Time state (12-hour format)
  const [hours, setHours] = useState(() => {
    const h = initialDate.getHours();
    const h12 = h % 12 || 12;
    return String(h12).padStart(2, '0');
  });
  const [minutes, setMinutes] = useState(() => {
    return String(initialDate.getMinutes()).padStart(2, '0');
  });
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(() => {
    return initialDate.getHours() >= 12 ? 'PM' : 'AM';
  });

  // Sync state when value changes from outside
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
        setSelectedDate(d);
        const h = d.getHours();
        setHours(String(h % 12 || 12).padStart(2, '0'));
        setMinutes(String(d.getMinutes()).padStart(2, '0'));
        setAmpm(h >= 12 ? 'PM' : 'AM');
      }
    } else {
      setSelectedDate(null);
    }
  }, [value]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const computeIso = (d: Date | null, hStr: string, mStr: string, period: 'AM' | 'PM') => {
    if (!d) return null;
    let h = parseInt(hStr, 10);
    if (isNaN(h) || h < 1 || h > 12) h = 12;
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    let m = parseInt(mStr, 10);
    if (isNaN(m) || m < 0 || m > 59) m = 0;
    const finalDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, 0, 0);
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

  const handleSelectDate = (dateObj: Date) => {
    setViewMonth(dateObj.getMonth());
    setViewYear(dateObj.getFullYear());
    setSelectedDate(dateObj);
    const iso = computeIso(dateObj, hours, minutes, ampm);
    if (iso) onChange(iso);
  };

  const handleQuickPreset = (preset: 'today' | 'tomorrow' | 'nextWeek' | 'endOfWeek') => {
    const now = new Date();
    let d = now;
    let h = '05';
    let m = '00';
    let p: 'AM' | 'PM' = 'PM';

    if (preset === 'today') {
      d = now;
    } else if (preset === 'tomorrow') {
      d = new Date();
      d.setDate(d.getDate() + 1);
    } else if (preset === 'endOfWeek') {
      d = new Date();
      const diff = 5 - d.getDay();
      d.setDate(d.getDate() + (diff >= 0 ? diff : diff + 7));
    } else if (preset === 'nextWeek') {
      d = new Date();
      d.setDate(d.getDate() + 7);
      h = '09';
      p = 'AM';
    }

    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(d);
    setHours(h);
    setMinutes(m);
    setAmpm(p);

    const iso = computeIso(d, h, m, p);
    if (iso) onChange(iso);
  };

  const handleApply = () => {
    const targetDate = selectedDate || new Date();
    setSelectedDate(targetDate);
    const iso = computeIso(targetDate, hours, minutes, ampm);
    if (iso) onChange(iso);
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

  // Display trigger string (clean date and time separation)
  const formatted = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;

    const datePart = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    });
    return { datePart, timePart };
  }, [value]);

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
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Interactive Trigger Button */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '6px 8px',
          minHeight: 44,
          borderRadius: 10,
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
        onClick={() => setIsOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              backgroundColor: formatted ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--secondary) / 0.8)',
              color: formatted ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: 'var(--neu-shadow-raised-sm)',
            }}
          >
            <CalendarIcon size={13} strokeWidth={2} />
          </div>

          {formatted ? (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', textAlign: 'left' }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 400,
                  color: 'hsl(var(--foreground))',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.25,
                  letterSpacing: '-0.01em',
                }}
              >
                {formatted.datePart}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 300,
                  color: 'hsl(var(--muted-foreground))',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  lineHeight: 1.2,
                  marginTop: 1,
                }}
              >
                <Clock size={9} style={{ opacity: 0.75, flexShrink: 0 }} />
                <span>{formatted.timePart}</span>
              </span>
            </div>
          ) : (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 300,
                color: 'hsl(var(--muted-foreground))',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
            title="Clear date & time"
          >
            <X size={12} strokeWidth={2.2} />
          </motion.span>
        ) : (
          <Clock size={12} style={{ opacity: 0.35, flexShrink: 0, marginLeft: 2 }} />
        )}
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
              ...(align === 'right' ? { right: 0 } : { left: 0 }),
              marginTop: 6,
              zIndex: 120,
              width: 300,
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

            {/* Time Selector */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 12,
                backgroundColor: 'hsl(var(--card))',
                boxShadow: 'var(--neu-shadow-input)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} color="hsl(var(--primary))" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>Time</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Hours */}
                <input
                  type="text"
                  maxLength={2}
                  value={hours}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    if (v === '' || (parseInt(v, 10) >= 1 && parseInt(v, 10) <= 12)) {
                      setHours(v);
                    }
                  }}
                  onBlur={() => {
                    const h = parseInt(hours, 10) || 12;
                    const hFormatted = String(h).padStart(2, '0');
                    setHours(hFormatted);
                    if (selectedDate) {
                      onChange(computeIso(selectedDate, hFormatted, minutes, ampm));
                    }
                  }}
                  style={{
                    width: 32,
                    textAlign: 'center',
                    padding: '2px 4px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    border: 'none',
                    outline: 'none',
                    color: 'hsl(var(--foreground))'
                  }}
                />

                <span style={{ fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>:</span>

                {/* Minutes */}
                <input
                  type="text"
                  maxLength={2}
                  value={minutes}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    if (v === '' || (parseInt(v, 10) >= 0 && parseInt(v, 10) <= 59)) {
                      setMinutes(v);
                    }
                  }}
                  onBlur={() => {
                    const m = parseInt(minutes, 10) || 0;
                    const mFormatted = String(m).padStart(2, '0');
                    setMinutes(mFormatted);
                    if (selectedDate) {
                      onChange(computeIso(selectedDate, hours, mFormatted, ampm));
                    }
                  }}
                  style={{
                    width: 32,
                    textAlign: 'center',
                    padding: '2px 4px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    backgroundColor: 'hsl(var(--card))',
                    boxShadow: 'var(--neu-shadow-raised-sm)',
                    border: 'none',
                    outline: 'none',
                    color: 'hsl(var(--foreground))'
                  }}
                />

                {/* AM / PM Toggle */}
                <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setAmpm('AM');
                      if (selectedDate) {
                        onChange(computeIso(selectedDate, hours, minutes, 'AM'));
                      }
                    }}
                    style={{
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: ampm === 'AM' ? 'hsl(var(--primary))' : 'hsl(var(--card))',
                      color: ampm === 'AM' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                      boxShadow: ampm === 'AM' ? 'var(--neu-shadow-raised-sm)' : 'none'
                    }}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAmpm('PM');
                      if (selectedDate) {
                        onChange(computeIso(selectedDate, hours, minutes, 'PM'));
                      }
                    }}
                    style={{
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: ampm === 'PM' ? 'hsl(var(--primary))' : 'hsl(var(--card))',
                      color: ampm === 'PM' ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                      boxShadow: ampm === 'PM' ? 'var(--neu-shadow-raised-sm)' : 'none'
                    }}
                  >
                    PM
                  </button>
                </div>
              </div>
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
                  onClick={() => setIsOpen(false)}
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
