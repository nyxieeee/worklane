import React, { useState } from 'react';
import { X, Milestone, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkStore } from '../../store/useWorkStore';
import { useToastStore } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BOARD_COLORS } from '../../types';

interface Props {
  onClose: (createdRoadmapId?: string) => void;
  initialName?: string;
}

const TEMPLATES = [
  {
    id: 'software',
    name: 'App Development',
    description: 'Planning, UI, Frontend, Backend & Launch',
    phases: ['Planning', 'Making the UI', 'Making the frontend', 'Making the backend', 'QA & Launch'],
  },
  {
    id: 'product',
    name: 'Product Launch',
    description: 'Research, Design, Staging, Marketing, Release',
    phases: ['Market Research', 'Design & Prototyping', 'Beta Staging', 'Marketing Campaign', 'Public Launch'],
  },
  {
    id: 'blank',
    name: 'Blank Custom',
    description: 'Start with your own custom phases',
    phases: ['Phase 1: Kickoff'],
  },
];

export default function CreateRoadmapModal({ onClose, initialName = '' }: Props) {
  const createRoadmap = useWorkStore(s => s.createRoadmap);
  const showToast = useToastStore(s => s.showToast);
  const user = useAuthStore(s => s.user);

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('#6366f1');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('software');
  const [phases, setPhases] = useState<string[]>(TEMPLATES[0].phases);
  const [newPhaseInput, setNewPhaseInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplate(tplId);
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (tpl) {
      setPhases([...tpl.phases]);
    }
  };

  const handleAddPhase = () => {
    if (!newPhaseInput.trim()) return;
    setPhases(prev => [...prev, newPhaseInput.trim()]);
    setNewPhaseInput('');
  };

  const handleRemovePhase = (index: number) => {
    setPhases(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const finalPhases = phases.length > 0 ? phases : ['Phase 1: Kickoff'];
      const newRoadmap = await createRoadmap(
        name.trim(),
        selectedColor,
        user?.email,
        user?.name,
        description.trim(),
        finalPhases
      );
      showToast(`Project Roadmap "${name.trim()}" created`, 'success');
      onClose(newRoadmap.id);
    } catch (err) {
      console.error('[CreateRoadmapModal] error creating roadmap:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={() => onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal"
        style={{ maxWidth: 520, transformStyle: 'preserve-3d' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
            }}>
              <Milestone size={16} />
            </div>
            <div>
              <h2 className="modal-title" style={{ margin: 0, fontSize: 16 }}>Create Project Roadmap</h2>
              <p style={{ margin: 0, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
                Track project phases, scheduled deadlines, and actual progress
              </p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={() => onClose()}>
            <X size={15} />
          </motion.button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Project / Roadmap Name */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Project / Application Name</label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. Inky, Mobile App v2, Brand Redesign"
              maxLength={60}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Project Goal / Summary (Optional)</label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. Development of our new customer facing application"
              maxLength={120}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Template Selection */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Starter Template</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TEMPLATES.map(tpl => {
                const isSelected = selectedTemplate === tpl.id;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleSelectTemplate(tpl.id)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: isSelected ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.7)',
                      background: isSelected ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--secondary) / 0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>
                      {tpl.name}
                    </span>
                    <span style={{ fontSize: 9.5, color: 'hsl(var(--muted-foreground))', lineHeight: 1.25 }}>
                      {tpl.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phases list */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="field-label" style={{ margin: 0 }}>
                Phases &amp; Subtasks ({phases.length})
              </label>
              <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                You can add or modify more anytime
              </span>
            </div>

            <div style={{
              maxHeight: 140,
              overflowY: 'auto',
              borderRadius: 8,
              border: '1px solid hsl(var(--border) / 0.7)',
              background: 'hsl(var(--card))',
              padding: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              {phases.map((phase, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'hsl(var(--secondary) / 0.6)',
                    fontSize: 12,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--muted-foreground))', width: 14 }}>
                      {idx + 1}.
                    </span>
                    <span style={{ fontWeight: 500 }}>{phase}</span>
                  </span>
                  {phases.length > 1 && (
                    <button
                      type="button"
                      className="icon-btn"
                      style={{ width: 18, height: 18, padding: 0 }}
                      onClick={() => handleRemovePhase(idx)}
                      title="Remove phase"
                    >
                      <Trash2 size={11} color="hsl(var(--destructive))" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Quick add phase input */}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <input
                type="text"
                className="text-input"
                style={{ fontSize: 11.5, padding: '4px 8px', height: 28 }}
                placeholder="Add another phase (e.g. Design System)..."
                value={newPhaseInput}
                onChange={e => setNewPhaseInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPhase();
                  }
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}
                onClick={handleAddPhase}
              >
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {/* Accent Color */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Color Theme</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BOARD_COLORS.map(c => (
                <motion.button
                  key={c.value}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: c.value,
                    boxShadow: selectedColor === c.value ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                    border: selectedColor === c.value ? '2px solid hsl(var(--foreground))' : 'none',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                  title={c.name}
                  onClick={() => setSelectedColor(c.value)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: 8 }}>
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={() => onClose()}>
            Cancel
          </motion.button>
          <motion.button
            whileTap={(name.trim() && !isSubmitting) ? { scale: 0.95 } : undefined}
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || isSubmitting}
            style={{
              opacity: (name.trim() && !isSubmitting) ? 1 : 0.5,
              cursor: (name.trim() && !isSubmitting) ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Milestone size={14} />
            Create Roadmap
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
