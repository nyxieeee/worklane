import React, { useState, useRef, useMemo } from 'react';
import { X, Plus, Trash2, Upload, FileText, Loader2, CheckCircle2, Calendar, Clock, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../../store/useWorkStore';
import { useToastStore } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BOARD_COLORS } from '../../types';
import NeumorphicDatePicker from '../ui/NeumorphicDatePicker';

interface Props {
  onClose: (createdRoadmapId?: string) => void;
  initialName?: string;
}

type PhaseItem = { name: string; type: 'phase' | 'subtask'; days?: number };

// ── parsing helpers ────────────────────────────────────────────────────────

function guessType(rawLine: string): 'phase' | 'subtask' {
  if (/^#{1,3}\s/.test(rawLine) || /^\*\*/.test(rawLine)) return 'phase';
  if (/^(\s{2,}|\t|[-*•]\s)/.test(rawLine)) return 'subtask';
  return 'phase';
}

function extractLines(raw: string): PhaseItem[] {
  return raw
    .split(/\r?\n/)
    .filter(l => l.trim().length > 2)
    .map(line => ({
      name: line
        .replace(/^#{1,6}\s+/, '')
        .replace(/\*\*/g, '')
        .replace(/^[-*•]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .trim(),
      type: guessType(line),
      days: guessType(line) === 'phase' ? 7 : 3,
    }))
    .filter(p => p.name.length > 0);
}

async function parseFile(file: File): Promise<PhaseItem[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (['txt', 'md', 'csv'].includes(ext)) {
    return extractLines(await file.text());
  }
  if (['doc', 'docx'].includes(ext)) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return extractLines(result.value);
  }
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
    }
    return extractLines(text);
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

// ── component ──────────────────────────────────────────────────────────────

export default function CreateRoadmapModal({ onClose, initialName = '' }: Props) {
  const createRoadmap = useWorkStore(s => s.createRoadmap);
  const showToast     = useToastStore(s => s.showToast);
  const user          = useAuthStore(s => s.user);

  const [name, setName]                   = useState(initialName);
  const [description, setDescription]     = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('#6366f1');

  // Overall Roadmap Date Bounds
  const [overallStartDate, setOverallStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [overallEndDate, setOverallEndDate]     = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  const [phases, setPhases]                   = useState<PhaseItem[]>([]);
  const [phaseDaysMap, setPhaseDaysMap]       = useState<Record<string, number>>({});
  const [subtaskDaysMap, setSubtaskDaysMap]   = useState<Record<string, number>>({});
  const [newPhaseInput, setNewPhaseInput]     = useState('');
  const [newPhaseType, setNewPhaseType]       = useState<'phase' | 'subtask'>('phase');
  const [newPhaseDays, setNewPhaseDays]       = useState<number>(7);
  const [isSubmitting, setIsSubmitting]       = useState(false);

  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing]       = useState(false);
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const [preview, setPreview]           = useState<PhaseItem[] | null>(null);

  // Calculate total roadmap duration in days
  const totalRoadmapDays = useMemo(() => {
    if (!overallStartDate || !overallEndDate) return 0;
    const s = new Date(overallStartDate);
    const e = new Date(overallEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [overallStartDate, overallEndDate]);

  const handleAddPhase = () => {
    if (!newPhaseInput.trim()) return;
    const cleanName = newPhaseInput.trim();
    const days = Math.max(1, newPhaseDays || (newPhaseType === 'phase' ? 7 : 3));
    const newIdx = phases.length;

    setPhases(prev => [...prev, { name: cleanName, type: newPhaseType, days }]);

    if (newPhaseType === 'phase') {
      setPhaseDaysMap(prev => ({
        ...prev,
        [cleanName]: days,
      }));
    } else {
      setSubtaskDaysMap(prev => ({
        ...prev,
        [`${cleanName}_${newIdx}`]: days,
        [cleanName]: days,
      }));
    }
    setNewPhaseInput('');
  };

  const handleRemovePhase = (i: number) => {
    const target = phases[i];
    setPhases(prev => prev.filter((_, idx) => idx !== i));
    if (target) {
      if (target.type === 'phase') {
        const otherSame = phases.some((p, idx) => idx !== i && p.type === 'phase' && p.name === target.name);
        if (!otherSame) {
          setPhaseDaysMap(prev => {
            const next = { ...prev };
            delete next[target.name];
            return next;
          });
        }
      } else {
        setSubtaskDaysMap(prev => {
          const next = { ...prev };
          delete next[`${target.name}_${i}`];
          return next;
        });
      }
    }
  };

  const handleUpdatePhaseDays = (phaseName: string, days: number) => {
    setPhaseDaysMap(prev => ({
      ...prev,
      [phaseName]: Math.max(1, days || 1),
    }));
  };

  const handleUpdateSubtaskDays = (idx: number, subtaskName: string, days: number) => {
    const d = Math.max(1, days || 1);
    setSubtaskDaysMap(prev => ({
      ...prev,
      [`${subtaskName}_${idx}`]: d,
      [subtaskName]: d,
    }));
    setPhases(prev => prev.map((p, i) => i === idx ? { ...p, days: d } : p));
  };

  const handleCreate = async () => {
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newRoadmap = await createRoadmap(
        name.trim(),
        selectedColor,
        user?.email,
        user?.name,
        description.trim(),
        phases,
        overallStartDate || null,
        overallEndDate || null,
        phaseDaysMap,
        subtaskDaysMap
      );
      showToast(`Project Roadmap "${name.trim()}" created`, 'success');
      onClose(newRoadmap.id);
    } catch (err) {
      console.error('[CreateRoadmapModal] error:', err);
      setIsSubmitting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsParsing(true);
    setImportedFile(file.name);
    try {
      const items = await parseFile(file);
      if (items.length === 0) {
        showToast('No recognisable lines found in the file.', 'error');
        setImportedFile(null);
      } else {
        setPreview(items);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to parse file', 'error');
      setImportedFile(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!preview) return;
    setPhases(prev => [...prev, ...preview]);
    const newPhaseDaysObj: Record<string, number> = {};
    const newSubtaskDaysObj: Record<string, number> = {};

    preview.forEach((p, idx) => {
      if (p.type === 'phase') {
        newPhaseDaysObj[p.name] = p.days || 7;
      } else {
        newSubtaskDaysObj[`${p.name}_${idx}`] = p.days || 3;
        newSubtaskDaysObj[p.name] = p.days || 3;
      }
    });

    setPhaseDaysMap(prev => ({ ...prev, ...newPhaseDaysObj }));
    setSubtaskDaysMap(prev => ({ ...prev, ...newSubtaskDaysObj }));
    showToast(`Imported ${preview.length} item${preview.length !== 1 ? 's' : ''}`, 'success');
    setPreview(null);
  };

  const handleCancelImport = () => { setPreview(null); setImportedFile(null); };

  const updatePreviewType = (i: number, t: 'phase' | 'subtask') =>
    setPreview(prev => prev ? prev.map((p, idx) => idx === i ? { ...p, type: t, days: t === 'phase' ? 7 : 3 } : p) : prev);

  const badge = (type: 'phase' | 'subtask') => ({
    fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
    background: type === 'phase' ? 'hsl(var(--primary) / 0.15)' : 'hsl(262 80% 60% / 0.15)',
    color: type === 'phase' ? 'hsl(var(--primary))' : 'hsl(262 80% 60%)',
  });

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={() => onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, translateZ: 0 }}
        exit={{ opacity: 0, scale: 0.94, rotateX: 12, translateZ: -50 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="modal"
        style={{ maxWidth: 540, transformStyle: 'preserve-3d', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
              <h2 className="modal-title" style={{ margin: 0, fontSize: 16 }}>Create Project Roadmap</h2>
              <span className="sidebar-beta-tag">BETA</span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
              Set project schedule, allocate days per phase and sub-item, and track deliverables
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={() => onClose()}>
            <X size={15} />
          </motion.button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {/* Name */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Project / Application Name</label>
            <input type="text" className="text-input"
              placeholder="e.g. GTMI Floor Plan Layout, Brand Redesign, Mobile App v2"
              maxLength={60} value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
          </div>

          {/* Overall Roadmap Timeline Dates */}
          <div className="form-group" style={{
            marginBottom: 0,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid hsl(var(--border) / 0.8)',
            backgroundColor: 'hsl(var(--secondary) / 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="field-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={13} color="hsl(var(--primary))" />
                Overall Roadmap Timeline &amp; Duration
              </label>
              {totalRoadmapDays > 0 && (
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: 9999,
                  backgroundColor: 'hsl(var(--primary) / 0.15)',
                  color: 'hsl(var(--primary))',
                }}>
                  {totalRoadmapDays} days overall
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 3 }}>
                  Overall Start Date
                </span>
                <NeumorphicDatePicker
                  value={overallStartDate}
                  onChange={val => setOverallStartDate(val ? val.split('T')[0] : '')}
                  placeholder="e.g. Jul 26, 2026"
                  align="left"
                />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--muted-foreground))', display: 'block', marginBottom: 3 }}>
                  Overall End Date
                </span>
                <NeumorphicDatePicker
                  value={overallEndDate}
                  onChange={val => setOverallEndDate(val ? val.split('T')[0] : '')}
                  placeholder="e.g. Oct 16, 2026"
                  align="right"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Project Goal / Summary (Optional)</label>
            <input type="text" className="text-input"
              placeholder="e.g. Development and deployment of CCTV, Nurse Call, FDAS and Paging"
              maxLength={120} value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Phases & Allotted Days */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="field-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Layers size={13} color="hsl(var(--primary))" />
                Phases &amp; Sub-items Days Allotted ({phases.length})
              </label>
              <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                Pick days per phase or sub-item
              </span>
            </div>

            {phases.length > 0 && (
              <div style={{
                maxHeight: 160, overflowY: 'auto', borderRadius: 8,
                border: '1px solid hsl(var(--border) / 0.7)',
                background: 'hsl(var(--card))', padding: 6,
                display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6,
              }}>
                {phases.map((phase, idx) => {
                  const isPhase = phase.type === 'phase';
                  const allottedDays = isPhase
                    ? (phaseDaysMap[phase.name] ?? phase.days ?? 7)
                    : (subtaskDaysMap[`${phase.name}_${idx}`] ?? phase.days ?? 3);

                  return (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', borderRadius: 6,
                      background: isPhase ? 'hsl(var(--secondary) / 0.75)' : 'hsl(var(--secondary) / 0.35)',
                      fontSize: 12,
                      border: isPhase ? '1px solid hsl(var(--border) / 0.6)' : 'none',
                      paddingLeft: isPhase ? 8 : 20,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
                        {!isPhase && <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>└─</span>}
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--muted-foreground))', width: 14, flexShrink: 0 }}>
                          {idx + 1}.
                        </span>
                        <span style={badge(phase.type)}>{phase.type}</span>
                        <span style={{ fontWeight: isPhase ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {phase.name}
                        </span>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {/* Days Input per item (both phases and subtasks!) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title={`Allotted duration for this ${phase.type}`}>
                          <Clock size={11} color="hsl(var(--muted-foreground))" />
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={allottedDays}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10) || 1;
                              if (isPhase) {
                                handleUpdatePhaseDays(phase.name, val);
                              } else {
                                handleUpdateSubtaskDays(idx, phase.name, val);
                              }
                            }}
                            style={{
                              width: 44,
                              height: 22,
                              fontSize: 11,
                              fontWeight: 700,
                              textAlign: 'center',
                              padding: '1px 3px',
                              borderRadius: 4,
                              border: '1px solid hsl(var(--border))',
                              background: 'hsl(var(--card))',
                              color: 'hsl(var(--foreground))',
                            }}
                          />
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                            {allottedDays === 1 ? 'day' : 'days'}
                          </span>
                        </div>

                        <button type="button" className="icon-btn"
                          style={{ width: 18, height: 18, padding: 0 }}
                          onClick={() => handleRemovePhase(idx)} title="Remove">
                          <Trash2 size={11} color="hsl(var(--destructive))" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual add row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.7)', flexShrink: 0 }}>
                {(['phase', 'subtask'] as const).map(t => (
                  <button key={t} type="button" onClick={() => {
                    setNewPhaseType(t);
                    setNewPhaseDays(t === 'phase' ? 7 : 3);
                  }} style={{
                    height: 28, padding: '0 9px', fontSize: 10.5, fontWeight: 600,
                    border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                    background: newPhaseType === t ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                    color: newPhaseType === t ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    transition: 'all 0.15s ease',
                  }}>{t}</button>
                ))}
              </div>

              <input type="text" className="text-input"
                style={{ fontSize: 11.5, padding: '4px 8px', height: 28, flex: 1 }}
                placeholder={`Add a ${newPhaseType} (e.g. ${newPhaseType === 'phase' ? 'Rough-in Conduit & Boxes' : 'Pull Cat6 cabling'})...`}
                value={newPhaseInput}
                onChange={e => setNewPhaseInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhase(); } }}
              />

              {/* Day selection right when adding! */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }} title="Days allotted for this item">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={newPhaseDays}
                  onChange={e => setNewPhaseDays(parseInt(e.target.value, 10) || 1)}
                  style={{
                    width: 44,
                    height: 28,
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: 'center',
                    padding: '1px 3px',
                    borderRadius: 6,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>days</span>
              </div>

              <motion.button whileTap={{ scale: 0.95 }} type="button"
                className="btn btn-secondary"
                style={{ height: 28, padding: '0 10px', fontSize: 11, flexShrink: 0 }}
                onClick={handleAddPhase}>
                <Plus size={12} />
                Add
              </motion.button>
            </div>
          </div>

          {/* File Upload / Import */}
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            border: '1px dashed hsl(var(--border))',
            background: 'hsl(var(--secondary) / 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={16} color="hsl(var(--primary))" />
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 600, display: 'block' }}>
                  {importedFile ? `Loaded: ${importedFile}` : 'Import from File'}
                </span>
                <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                  .txt, .md, .csv, .docx, or .pdf breakdown
                </span>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.doc,.docx,.pdf"
              style={{ display: 'none' }} onChange={handleFileChange} />

            <button type="button" className="btn btn-secondary"
              style={{ height: 26, fontSize: 11, padding: '0 9px' }}
              onClick={() => fileInputRef.current?.click()} disabled={isParsing}>
              {isParsing ? <Loader2 size={11} className="spin" /> : <Upload size={11} />}
              <span>{isParsing ? 'Reading...' : 'Browse'}</span>
            </button>
          </div>

          {/* Color Picker */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Roadmap Theme Color</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BOARD_COLORS.map(c => (
                <button key={c.value} type="button"
                  onClick={() => setSelectedColor(c.value)}
                  style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: c.value, border: 'none', cursor: 'pointer',
                    boxShadow: selectedColor === c.value ? '0 0 0 2px hsl(var(--background)), 0 0 0 4px ' + c.value : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {selectedColor === c.value && <CheckCircle2 size={12} color="#fff" />}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={() => onClose()} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCreate} disabled={!name.trim() || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Roadmap'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
