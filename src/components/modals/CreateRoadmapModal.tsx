import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, Upload, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWorkStore } from '../../store/useWorkStore';
import { useToastStore } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BOARD_COLORS } from '../../types';

interface Props {
  onClose: (createdRoadmapId?: string) => void;
  initialName?: string;
}

type PhaseItem = { name: string; type: 'phase' | 'subtask' };

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
  const [phases, setPhases]               = useState<PhaseItem[]>([]);
  const [newPhaseInput, setNewPhaseInput] = useState('');
  const [newPhaseType, setNewPhaseType]   = useState<'phase' | 'subtask'>('phase');
  const [isSubmitting, setIsSubmitting]   = useState(false);

  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing]       = useState(false);
  const [importedFile, setImportedFile] = useState<string | null>(null);
  const [preview, setPreview]           = useState<PhaseItem[] | null>(null);

  const handleAddPhase = () => {
    if (!newPhaseInput.trim()) return;
    setPhases(prev => [...prev, { name: newPhaseInput.trim(), type: newPhaseType }]);
    setNewPhaseInput('');
  };

  const handleRemovePhase = (i: number) =>
    setPhases(prev => prev.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newRoadmap = await createRoadmap(
        name.trim(), selectedColor, user?.email, user?.name,
        description.trim(), phases,
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
    showToast(`Imported ${preview.length} item${preview.length !== 1 ? 's' : ''}`, 'success');
    setPreview(null);
  };

  const handleCancelImport = () => { setPreview(null); setImportedFile(null); };

  const updatePreviewType = (i: number, t: 'phase' | 'subtask') =>
    setPreview(prev => prev ? prev.map((p, idx) => idx === i ? { ...p, type: t } : p) : prev);

  const removePreviewItem = (i: number) =>
    setPreview(prev => {
      if (!prev) return prev;
      const next = prev.filter((_, idx) => idx !== i);
      return next.length === 0 ? null : next;
    });

  const badge = (type: 'phase' | 'subtask'): React.CSSProperties => ({
    fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 4,
    textTransform: 'uppercase', letterSpacing: '0.04em',
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
        style={{ maxWidth: 520, transformStyle: 'preserve-3d' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
              <h2 className="modal-title" style={{ margin: 0, fontSize: 16 }}>Create Project Roadmap</h2>
              <span className="sidebar-beta-tag">BETA</span>
            </div>
            <p style={{ margin: 0, fontSize: 11.5, color: 'hsl(var(--muted-foreground))' }}>
              Track project phases, scheduled deadlines, and actual progress
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={() => onClose()}>
            <X size={15} />
          </motion.button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Name */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Project / Application Name</label>
            <input type="text" className="text-input"
              placeholder="e.g. Inky, Mobile App v2, Brand Redesign"
              maxLength={60} value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Project Goal / Summary (Optional)</label>
            <input type="text" className="text-input"
              placeholder="e.g. Development of our new customer facing application"
              maxLength={120} value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {/* Phases */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="field-label" style={{ margin: 0 }}>
                Phases &amp; Subtasks ({phases.length})
              </label>
              <span style={{ fontSize: 10.5, color: 'hsl(var(--muted-foreground))' }}>
                You can add or modify more anytime
              </span>
            </div>

            {phases.length > 0 && (
              <div style={{
                maxHeight: 130, overflowY: 'auto', borderRadius: 8,
                border: '1px solid hsl(var(--border) / 0.7)',
                background: 'hsl(var(--card))', padding: 6,
                display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6,
              }}>
                {phases.map((phase, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '4px 8px', borderRadius: 6,
                    background: 'hsl(var(--secondary) / 0.6)', fontSize: 12,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--muted-foreground))', width: 14 }}>
                        {idx + 1}.
                      </span>
                      <span style={badge(phase.type)}>{phase.type}</span>
                      <span style={{ fontWeight: 500 }}>{phase.name}</span>
                    </span>
                    <button type="button" className="icon-btn"
                      style={{ width: 18, height: 18, padding: 0 }}
                      onClick={() => handleRemovePhase(idx)} title="Remove">
                      <Trash2 size={11} color="hsl(var(--destructive))" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Manual add row */}
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.7)', flexShrink: 0 }}>
                {(['phase', 'subtask'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setNewPhaseType(t)} style={{
                    height: 28, padding: '0 9px', fontSize: 10.5, fontWeight: 600,
                    border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                    background: newPhaseType === t ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.5)',
                    color: newPhaseType === t ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                    transition: 'all 0.15s ease',
                  }}>{t}</button>
                ))}
              </div>
              <input type="text" className="text-input"
                style={{ fontSize: 11.5, padding: '4px 8px', height: 28 }}
                placeholder={`Add a ${newPhaseType} (e.g. ${newPhaseType === 'phase' ? 'Design System' : 'Write unit tests'})...`}
                value={newPhaseInput}
                onChange={e => setNewPhaseInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhase(); } }}
              />
              <button type="button" className="btn btn-secondary"
                style={{ height: 28, padding: '0 10px', fontSize: 11.5 }}
                onClick={handleAddPhase}>
                <Plus size={12} /> Add
              </button>
            </div>

            {/* Import button */}
            <div style={{ marginTop: 6 }}>
              <input ref={fileInputRef} type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button type="button" className="btn btn-secondary"
                style={{
                  width: '100%', height: 30, fontSize: 11.5, gap: 6,
                  justifyContent: 'center',
                  border: '1.5px dashed hsl(var(--border))',
                  background: 'transparent',
                }}
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
              >
                {isParsing
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Parsing file…</>
                  : <><Upload size={12} /> Import phases from document (PDF, DOCX, TXT)</>
                }
              </button>
            </div>

            {/* Preview panel */}
            <AnimatePresence>
              {preview && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden', marginTop: 8 }}
                >
                  <div style={{
                    borderRadius: 10,
                    border: '1.5px solid hsl(var(--primary) / 0.35)',
                    background: 'hsl(var(--primary) / 0.04)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderBottom: '1px solid hsl(var(--border) / 0.5)',
                      background: 'hsl(var(--primary) / 0.07)',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'hsl(var(--primary))' }}>
                        <FileText size={12} />
                        {importedFile} — {preview.length} item{preview.length !== 1 ? 's' : ''} detected
                      </span>
                      <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                        Adjust types, then confirm
                      </span>
                    </div>

                    <div style={{ maxHeight: 150, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {preview.map((item, idx) => (
                        <div key={idx} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '3px 6px', borderRadius: 6,
                          background: 'hsl(var(--secondary) / 0.5)', fontSize: 11.5,
                        }}>
                          <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', width: 16, flexShrink: 0 }}>{idx + 1}.</span>
                          <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid hsl(var(--border) / 0.6)', flexShrink: 0 }}>
                            {(['phase', 'subtask'] as const).map(t => (
                              <button key={t} type="button" onClick={() => updatePreviewType(idx, t)} style={{
                                padding: '1px 6px', fontSize: 9, fontWeight: 600, border: 'none', cursor: 'pointer',
                                background: item.type === t ? 'hsl(var(--primary))' : 'transparent',
                                color: item.type === t ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                              }}>{t}</button>
                            ))}
                          </div>
                          <span style={{ flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </span>
                          <button type="button" className="icon-btn"
                            style={{ width: 16, height: 16, padding: 0, flexShrink: 0 }}
                            onClick={() => removePreviewItem(idx)}>
                            <Trash2 size={10} color="hsl(var(--destructive))" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 6, padding: '6px 8px', borderTop: '1px solid hsl(var(--border) / 0.5)' }}>
                      <button type="button" className="btn btn-primary"
                        style={{ flex: 1, fontSize: 11.5, height: 28, gap: 5 }}
                        onClick={handleConfirmImport}>
                        <CheckCircle2 size={12} />
                        Add {preview.length} item{preview.length !== 1 ? 's' : ''} to list
                      </button>
                      <button type="button" className="btn btn-secondary"
                        style={{ fontSize: 11.5, height: 28 }}
                        onClick={handleCancelImport}>
                        Discard
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Color Theme */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Color Theme</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {BOARD_COLORS.map(c => (
                <motion.button key={c.value} type="button" whileTap={{ scale: 0.9 }}
                  style={{
                    width: 24, height: 24, borderRadius: '50%', backgroundColor: c.value,
                    boxShadow: selectedColor === c.value ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                    border: selectedColor === c.value ? '2px solid hsl(var(--foreground))' : 'none',
                    cursor: 'pointer', outline: 'none',
                  }}
                  title={c.name} onClick={() => setSelectedColor(c.value)}
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
            }}
          >
            {isSubmitting && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            Create Roadmap
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
