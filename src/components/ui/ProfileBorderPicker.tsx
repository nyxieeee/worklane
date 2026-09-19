/**
 * ProfileBorderPicker
 * Professional live avatar preview + work-related border style swatches
 * and clean custom border & badge creator (no emojis).
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Check, Code2, Plus, Sparkles, Trash2, X, Briefcase
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BORDER_PRESETS, type BorderPreset, type CustomBorderDef } from '../../types';
import {
  avatarInitials, getCustomBorders, saveCustomBorder, deleteCustomBorder,
  encodeCustomBorderStyle, parseCustomBorderStyle, getTeamBadgeInfo
} from '../../utils';
import AvatarBorder from './AvatarBorder';

interface ProfileBorderPickerProps {
  /** The member's (or current user's) name */
  name: string;
  /** The member's avatar URL, if any */
  avatarUrl?: string;
  /** The member's initials fallback colour */
  color?: string;
  /** Currently selected border style key or encoded custom border */
  value: string;
  /** Called when a new border preset or custom border is selected */
  onChange: (key: string) => void;
}

const PRESET_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f97316',
  '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#64748b'
];

function SwatchPreview({ preset, size = 26 }: { preset: BorderPreset; size?: number }) {
  if (preset.key === 'none') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: '1.5px solid hsl(var(--border))',
        backgroundColor: 'hsl(var(--muted))',
      }} />
    );
  }

  const gap = 2;
  return (
    <div style={{
      width: size + gap * 2, height: size + gap * 2, borderRadius: '50%',
      background: preset.gradient,
      padding: gap, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        backgroundColor: 'hsl(var(--muted))',
      }} />
    </div>
  );
}

export default function ProfileBorderPicker({
  name, avatarUrl, color, value, onChange,
}: ProfileBorderPickerProps) {
  const techPresets = useMemo(() => BORDER_PRESETS.filter(p => p.group === 'tech'), []);
  const workPresets = useMemo(() => BORDER_PRESETS.filter(p => p.group === 'work'), []);
  const nonePreset  = useMemo(() => BORDER_PRESETS.find(p => p.key === 'none')!, []);

  // Custom borders management
  const [customBorders, setCustomBorders] = useState<CustomBorderDef[]>(() => getCustomBorders());
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);

  // New custom border form state
  const [customLabel, setCustomLabel] = useState('');
  const [customBadge, setCustomBadge] = useState('');
  const [customColor, setCustomColor] = useState('#6366f1');
  const [customStyleType, setCustomStyleType] = useState<'gradient' | 'glow' | 'solid' | 'dashed'>('gradient');

  // Optimistic selection state with rubberband bounce rejection
  const [selectedStyle, setSelectedStyle] = useState<string>(value || 'none');
  const lastClickTimeRef = useRef<number>(0);

  useEffect(() => {
    // Only accept incoming value changes if user hasn't clicked in the last 2.5s (prevents cloud sync rubberbanding)
    if (Date.now() - lastClickTimeRef.current > 2500) {
      setSelectedStyle(value || 'none');
    }
  }, [value]);

  const handleSelect = (key: string) => {
    lastClickTimeRef.current = Date.now();
    setSelectedStyle(key);
    onChange(key);
  };

  // Live preview border style:
  // If user is actively creating/editing in the Custom Roles & Badges panel,
  // dynamically build the custom border from their current form inputs (color, style, labels)!
  const livePreviewStyle = useMemo(() => {
    if (isCreatingCustom) {
      const trimmedLabel = customLabel.trim() || 'Custom Role';
      const trimmedBadge = customBadge.trim() || (customLabel.trim() || 'ROLE').slice(0, 4).toUpperCase();
      const previewDef: CustomBorderDef = {
        id: 'temp_preview',
        label: trimmedLabel,
        badgeText: trimmedBadge,
        color: customColor,
        gradient: `linear-gradient(135deg, ${customColor}, #a855f7)`,
        styleType: customStyleType,
      };
      return encodeCustomBorderStyle(previewDef);
    }
    return selectedStyle;
  }, [isCreatingCustom, customLabel, customBadge, customColor, customStyleType, selectedStyle]);

  const liveBadgeInfo = useMemo(() => {
    return getTeamBadgeInfo(livePreviewStyle);
  }, [livePreviewStyle]);

  const parsedCustom = parseCustomBorderStyle(selectedStyle);

  const avatarContent = avatarUrl ? (
    <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
  ) : (
    <div style={{
      width: '100%', height: '100%', borderRadius: '50%',
      backgroundColor: color || 'hsl(var(--primary))',
      color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 800,
    }}>
      {avatarInitials(name || 'U')}
    </div>
  );

  const handleCreateCustom = () => {
    const trimmedLabel = customLabel.trim() || 'Custom Role';
    const trimmedBadge = customBadge.trim() || trimmedLabel.slice(0, 4).toUpperCase();
    const id = `cb_${Date.now()}`;
    const newBorder: CustomBorderDef = {
      id,
      label: trimmedLabel,
      badgeText: trimmedBadge,
      color: customColor,
      gradient: `linear-gradient(135deg, ${customColor}, #a855f7)`,
      styleType: customStyleType,
    };

    saveCustomBorder(newBorder);
    setCustomBorders(getCustomBorders());
    const encoded = encodeCustomBorderStyle(newBorder);
    handleSelect(encoded);
    setIsCreatingCustom(false);
    setCustomLabel('');
    setCustomBadge('');
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteCustomBorder(id);
    const updated = getCustomBorders();
    setCustomBorders(updated);
    if (selectedStyle.includes(id)) {
      handleSelect('none');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Live Preview */}
      <div style={{
        padding: '14px 18px',
        borderRadius: 14,
        backgroundColor: 'hsl(var(--background))',
        boxShadow: 'var(--neu-shadow-raised-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <AvatarBorder borderStyle={livePreviewStyle} size={64}>
          {avatarContent}
        </AvatarBorder>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--foreground))' }}>{name || 'Member'}</div>
            {isCreatingCustom && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: customColor,
                backgroundColor: `${customColor}18`,
                padding: '1.5px 8px',
                borderRadius: 9999,
                border: `1px solid ${customColor}40`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: customColor }} />
                Live Preview
              </span>
            )}
          </div>
          
          {liveBadgeInfo ? (
            <div style={{
              marginTop: 6,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2.5px 10px',
              borderRadius: 9999,
              background: liveBadgeInfo.bg,
              color: liveBadgeInfo.color,
              border: `1px solid ${liveBadgeInfo.color}40`,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.02em',
              boxShadow: 'var(--neu-shadow-raised-sm)'
            }}>
              <span>{liveBadgeInfo.label}</span>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', marginTop: 3 }}>
              No Role / Default Border
            </div>
          )}
        </div>
      </div>

      {/* ── Custom Border & Badge Creator ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            fontSize: 11.5, fontWeight: 700,
            color: 'hsl(var(--muted-foreground))',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <Sparkles size={12} style={{ color: '#a855f7' }} />
            Custom Roles & Badges
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.94 }}
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsCreatingCustom(v => !v)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: 'hsl(var(--primary))'
            }}
          >
            {isCreatingCustom ? <X size={12} /> : <Plus size={12} />}
            <span>{isCreatingCustom ? 'Close' : 'Create Custom Border & Badge'}</span>
          </motion.button>
        </div>

        {/* Creator Form */}
        <AnimatePresence>
          {isCreatingCustom && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{
                borderRadius: 12,
                padding: '14px 16px',
                backgroundColor: 'hsl(var(--card))',
                border: '1.5px solid hsl(var(--primary) / 0.35)',
                boxShadow: 'var(--neu-shadow-raised-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AvatarBorder borderStyle={livePreviewStyle} size={38}>
                    {avatarContent}
                  </AvatarBorder>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', display: 'block' }}>
                      Design Custom Role, Border & Badge
                    </span>
                    <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                      Changes preview live on avatar above
                    </span>
                  </div>
                </div>
                {/* Mini Preview */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '2.5px 9px', borderRadius: 9999,
                  background: `${customColor}22`, color: customColor,
                  border: `1px solid ${customColor}50`,
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.02em',
                  flexShrink: 0
                }}>
                  <span>{customLabel.trim() || 'Role'} ({customBadge.trim() || 'TAG'})</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 4 }}>
                    Role Name
                  </label>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                    placeholder="e.g. AI Engineer, Growth Lead"
                    className="text-input"
                    style={{ width: '100%', fontSize: 12, padding: '6px 10px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 4 }}>
                    Badge Tag (Max 6 Chars)
                  </label>
                  <input
                    type="text"
                    value={customBadge}
                    maxLength={6}
                    onChange={e => setCustomBadge(e.target.value.toUpperCase())}
                    placeholder="e.g. AI, LEAD, CS"
                    className="text-input"
                    style={{ width: '100%', fontSize: 12, padding: '6px 10px', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 4 }}>
                  Theme Color
                </label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCustomColor(c)}
                      style={{
                        width: 22, height: 22, borderRadius: '50%',
                        backgroundColor: c,
                        border: customColor === c ? '2.5px solid hsl(var(--foreground))' : '1px solid rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        boxShadow: customColor === c ? '0 0 0 2px hsl(var(--primary))' : 'none'
                      }}
                    />
                  ))}
                  <input
                    type="color"
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                    title="Custom color"
                  />
                </div>
              </div>

              {/* Border Style Type */}
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 4 }}>
                  Border Style
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {(['gradient', 'glow', 'solid', 'dashed'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCustomStyleType(st)}
                      style={{
                        padding: '6px 8px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                        border: customStyleType === st ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                        background: customStyleType === st ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--card))',
                        color: customStyleType === st ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                        cursor: 'pointer'
                      }}
                    >
                      {st === 'gradient' ? 'Gradient' : st === 'glow' ? 'Neon Glow' : st === 'solid' ? 'Solid' : 'Dashed'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsCreatingCustom(false)}
                  style={{ fontSize: 11.5, padding: '5px 12px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreateCustom}
                  style={{ fontSize: 11.5, padding: '5px 14px' }}
                >
                  Save & Apply Role
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom borders swatches list */}
        {customBorders.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {customBorders.map(cb => {
              const encoded = encodeCustomBorderStyle(cb);
              const isSelected = selectedStyle === encoded || (parsedCustom && parsedCustom.id === cb.id);
              return (
                <motion.div
                  key={cb.id}
                  whileTap={{ scale: 0.93 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={() => handleSelect(encoded)}
                  title={`${cb.label} (${cb.badgeText})`}
                  style={{
                    border: isSelected ? `1.5px solid ${cb.color}` : '1px solid hsl(var(--border) / 0.6)',
                    borderRadius: 10,
                    padding: '8px 6px',
                    backgroundColor: isSelected ? `${cb.color}18` : 'hsl(var(--card))',
                    boxShadow: isSelected ? 'var(--neu-shadow-raised-sm)' : 'var(--neu-shadow-input)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    position: 'relative',
                  }}
                >
                  {/* Delete custom preset button */}
                  <button
                    type="button"
                    onClick={(e) => handleDeleteCustom(cb.id, e)}
                    style={{
                      position: 'absolute', top: 3, left: 3,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'hsl(var(--muted-foreground))', padding: 2,
                      opacity: 0.5
                    }}
                    title="Delete custom preset"
                  >
                    <Trash2 size={10} />
                  </button>

                  {isSelected && (
                    <div style={{
                      position: 'absolute', top: 3, right: 3,
                      width: 14, height: 14, borderRadius: '50%',
                      backgroundColor: cb.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Check size={9} color="#fff" strokeWidth={3} />
                    </div>
                  )}

                  {/* Swatch circle */}
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: cb.styleType === 'gradient' ? (cb.gradient || `linear-gradient(135deg, ${cb.color}, #a855f7)`) : cb.color,
                    boxShadow: cb.styleType === 'glow' ? `0 0 8px 2px ${cb.color}70` : 'none',
                    border: cb.styleType === 'dashed' ? `2px dashed ${cb.color}` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: '0.02em'
                  }}>
                    {cb.badgeText ? cb.badgeText.slice(0, 2) : ''}
                  </div>

                  <span style={{
                    fontSize: 9.5, fontWeight: 700, lineHeight: 1.2, textAlign: 'center',
                    color: isSelected ? cb.color : 'hsl(var(--foreground))',
                  }}>
                    {cb.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Engineering & Tech Roles ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 700,
          color: 'hsl(var(--muted-foreground))',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Code2 size={12} style={{ color: 'hsl(var(--primary))' }} />
          Engineering & Tech Roles
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {techPresets.map(preset => {
            const isSelected = selectedStyle === preset.key;
            return (
              <motion.button
                key={preset.key}
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.04 }}
                type="button"
                onClick={() => handleSelect(preset.key)}
                title={preset.label}
                style={{
                  border: isSelected ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.6)',
                  borderRadius: 10,
                  padding: '8px 6px',
                  backgroundColor: isSelected ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--card))',
                  boxShadow: isSelected ? 'var(--neu-shadow-raised-sm)' : 'var(--neu-shadow-input)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.12s ease',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 3, right: 3,
                    width: 14, height: 14, borderRadius: '50%',
                    backgroundColor: 'hsl(var(--primary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={9} color="#fff" strokeWidth={3} />
                  </div>
                )}
                <SwatchPreview preset={preset} size={22} />
                <span style={{
                  fontSize: 9.5, fontWeight: 600, lineHeight: 1.2, textAlign: 'center',
                  color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                }}>
                  {preset.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Workplace & Product Roles ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontSize: 11.5, fontWeight: 700,
          color: 'hsl(var(--muted-foreground))',
          textTransform: 'uppercase', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <Briefcase size={12} style={{ color: '#f59e0b' }} />
          Product & Operations Roles
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {workPresets.map(preset => {
            const isSelected = selectedStyle === preset.key;
            return (
              <motion.button
                key={preset.key}
                whileTap={{ scale: 0.93 }}
                whileHover={{ scale: 1.04 }}
                type="button"
                onClick={() => handleSelect(preset.key)}
                title={preset.label}
                style={{
                  border: isSelected ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.6)',
                  borderRadius: 10,
                  padding: '8px 6px',
                  backgroundColor: isSelected ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--card))',
                  boxShadow: isSelected ? 'var(--neu-shadow-raised-sm)' : 'var(--neu-shadow-input)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.12s ease',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 3, right: 3,
                    width: 14, height: 14, borderRadius: '50%',
                    backgroundColor: 'hsl(var(--primary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={9} color="#fff" strokeWidth={3} />
                  </div>
                )}
                <SwatchPreview preset={preset} size={22} />
                <span style={{
                  fontSize: 9.5, fontWeight: 600, lineHeight: 1.2, textAlign: 'center',
                  color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
                }}>
                  {preset.label}
                </span>
              </motion.button>
            );
          })}

          {/* No border button */}
          <motion.button
            key={nonePreset.key}
            whileTap={{ scale: 0.93 }}
            whileHover={{ scale: 1.04 }}
            type="button"
            onClick={() => handleSelect(nonePreset.key)}
            title={nonePreset.label}
            style={{
              border: selectedStyle === 'none' || !selectedStyle ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.6)',
              borderRadius: 10,
              padding: '8px 6px',
              backgroundColor: selectedStyle === 'none' || !selectedStyle ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--card))',
              boxShadow: selectedStyle === 'none' || !selectedStyle ? 'var(--neu-shadow-raised-sm)' : 'var(--neu-shadow-input)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.12s ease',
              position: 'relative',
            }}
          >
            {(selectedStyle === 'none' || !selectedStyle) && (
              <div style={{
                position: 'absolute', top: 3, right: 3,
                width: 14, height: 14, borderRadius: '50%',
                backgroundColor: 'hsl(var(--primary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={9} color="#fff" strokeWidth={3} />
              </div>
            )}
            <SwatchPreview preset={nonePreset} size={22} />
            <span style={{
              fontSize: 9.5, fontWeight: 600, lineHeight: 1.2, textAlign: 'center',
              color: selectedStyle === 'none' || !selectedStyle ? 'hsl(var(--primary))' : 'hsl(var(--foreground))',
            }}>
              {nonePreset.label}
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
