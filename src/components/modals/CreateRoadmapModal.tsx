import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X, Plus, Trash2, Upload, FileText, Loader2, CheckCircle2,
  Calendar, Clock, Layers, Sparkles, DollarSign, Image as ImageIcon,
  Building, Check, ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useWorkStore } from '../../store/useWorkStore';
import { useToastStore } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BOARD_COLORS } from '../../types';
import NeumorphicDatePicker from '../ui/NeumorphicDatePicker';
import {
  extractTableFromFile,
  parseCommercialQuotation,
  parseBuildingTakeoff,
  apportionQuotationValues,
  type ExtractedBuildingItem,
  type CommercialLotItem
} from '../../imports/quotationParser';

interface Props {
  onClose: (createdRoadmapId?: string) => void;
  initialName?: string;
}

type PhaseItem = {
  name: string;
  type: 'phase' | 'subtask';
  days?: number;
  cost?: number;
  quantity?: number;
  unit?: string;
};

export default function CreateRoadmapModal({ onClose, initialName = '' }: Props) {
  const createRoadmap = useWorkStore(s => s.createRoadmap);
  const showToast     = useToastStore(s => s.showToast);
  const user          = useAuthStore(s => s.user);

  // Tab mode: 'quotation' (simple & automated) vs 'manual' (custom list)
  const [creationMode, setCreationMode]   = useState<'quotation' | 'manual'>('quotation');

  const [name, setName]                   = useState(initialName);
  const [description, setDescription]     = useState('');
  const [selectedColor, setSelectedColor] = useState<string>('#6366f1');
  const [currency, setCurrency]           = useState('₱');

  // Overall Roadmap Date Bounds
  const [overallStartDate, setOverallStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [overallEndDate, setOverallEndDate]     = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return d.toISOString().split('T')[0];
  });

  // Quotation Upload State
  const quotationFileRef = useRef<HTMLInputElement>(null);
  const breakdownFileRef = useRef<HTMLInputElement>(null);

  const [isReadingQuotation, setIsReadingQuotation] = useState(false);
  const [isReadingBreakdown, setIsReadingBreakdown] = useState(false);
  const reader = useRef<AbortController | null>(null);
  useEffect(() => () => reader.current?.abort(), []);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const isReading = isReadingQuotation || isReadingBreakdown;
  const [readingStatus, setReadingStatus]           = useState('');

  const [quotationFileName, setQuotationFileName]   = useState<string | null>(null);
  const [breakdownFileName, setBreakdownFileName]   = useState<string | null>(null);

  // Financial values
  const [contractTotal, setContractTotal]           = useState<number>(0);
  const [commercialLots, setCommercialLots]         = useState<CommercialLotItem[]>([]);
  const [buildingTakeoff, setBuildingTakeoff]       = useState<ExtractedBuildingItem[]>([]);

  // Generated phases list for the roadmap
  const [phases, setPhases]                         = useState<PhaseItem[]>([]);
  const [phaseDaysMap, setPhaseDaysMap]             = useState<Record<string, number>>({});
  const [subtaskDaysMap, setSubtaskDaysMap]         = useState<Record<string, number>>({});

  // Manual phase adding
  const [newPhaseInput, setNewPhaseInput]           = useState('');
  const [newPhaseType, setNewPhaseType]             = useState<'phase' | 'subtask'>('phase');
  const [newPhaseDays, setNewPhaseDays]             = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting]             = useState(false);

  // Calculate total roadmap duration in days
  const totalRoadmapDays = useMemo(() => {
    if (!overallStartDate || !overallEndDate) return 0;
    const s = new Date(overallStartDate);
    const e = new Date(overallEndDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [overallStartDate, overallEndDate]);

  // Handle uploading the Commercial Quotation (PDF, Excel, or Text)
  const handleUploadQuotation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (isReading) return;
    const controller = new AbortController();
    reader.current = controller;
    setUploadErrors([]);
    setIsReadingQuotation(true);
    setReadingStatus(`Reading ${file.name}...`);
    setQuotationFileName(file.name);

    try {
      const { rows, rawText } = await extractTableFromFile(file, setReadingStatus, controller.signal);
      if (controller.signal.aborted) return;
      const result = parseCommercialQuotation(rows, rawText);
      if (result.totalContractPrice <= 0) throw new Error('No contract total or priced lot items found. Check the document or enter the contract price manually.');

      if (result.currency) setCurrency(result.currency);
      if (result.totalContractPrice > 0) {
        setContractTotal(result.totalContractPrice);
      }
      setCommercialLots(result.commercialItems);

      // Auto-name project if empty
      if (!name) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setName(cleanName);
      }

      // If we already have breakdown items, re-apportion
      if (buildingTakeoff.length > 0) {
        syncGeneratedPhases(result.commercialItems, buildingTakeoff, result.totalContractPrice);
      }

      showToast(`Loaded quotation: ${result.currency} ${result.totalContractPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'success');
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setUploadErrors([`${file.name}: ${err.message || 'Failed to read quotation'}`]);
        setQuotationFileName(null);
      }
    } finally {
      setIsReadingQuotation(false);
      setReadingStatus('');
    }
  };

  // Handle uploading the Building/Scope Breakdown (PNG picture, Excel, or PDF)
  const handleUploadBreakdown = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || isReading) return;
    const controller = new AbortController();
    reader.current = controller;
    setIsReadingBreakdown(true);
    setUploadErrors([]);
    const items: ExtractedBuildingItem[] = [];
    const failures: string[] = [];
    const loaded: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        if (controller.signal.aborted) return;
        const progress = (message: string) => setReadingStatus(`${index + 1}/${files.length} · ${file.name}: ${message}`);
        try {
          progress('Reading quantities and buildings…');
          const { rows, rawText } = await extractTableFromFile(file, progress, controller.signal);
          if (controller.signal.aborted) return;
          const parsed = parseBuildingTakeoff(rows, rawText);
          if (!parsed.length) throw new Error('No quantities found. Use a clear table with descriptions, quantities and units.');
          items.push(...parsed.map(item => ({ ...item, id: `${index}_${item.id}` })));
          loaded.push(file.name);
        } catch (err) {
          if (controller.signal.aborted) return;
          failures.push(`${file.name}: ${err instanceof Error ? err.message : 'Could not read this file'}`);
        }
      }
      setUploadErrors(failures);
      if (items.length) {
        setBuildingTakeoff(items);
        setBreakdownFileName(loaded.join(', '));
        syncGeneratedPhases(commercialLots, items, contractTotal);
        showToast(`Loaded ${loaded.length} files with ${items.length} deliverables`, 'success');
      }
    } finally {
      setIsReadingBreakdown(false);
      setReadingStatus('');
    }
  };

  // Sync apportioned values into phases list
  const syncGeneratedPhases = (
    lots: CommercialLotItem[],
    takeoff: ExtractedBuildingItem[],
    manualTotal: number
  ) => {
    const { itemsWithValues, phaseBudgets } = apportionQuotationValues(lots, takeoff, manualTotal);

    // Group into Phase structure
    const grouped = new Map<string, ExtractedBuildingItem[]>();
    itemsWithValues.forEach(it => {
      const bName = it.buildingOrPhase || 'Scope of Work';
      const list = grouped.get(bName) || [];
      list.push(it);
      grouped.set(bName, list);
    });

    const newPhases: PhaseItem[] = [];
    const newPhaseDays: Record<string, number> = {};
    const newSubtaskDays: Record<string, number> = {};

    grouped.forEach((subItems, buildingName) => {
      newPhases.push({
        name: buildingName,
        type: 'phase',
        days: 14,
        cost: phaseBudgets[buildingName] || 0,
      });
      newPhaseDays[buildingName] = 14;

      subItems.forEach((sub, sIdx) => {
        newPhases.push({
          name: `${sub.scopeDescription} (${sub.quantity} ${sub.unit})`,
          type: 'subtask',
          days: 4,
          cost: sub.totalCost,
          quantity: sub.quantity,
          unit: sub.unit,
        });
        const subtaskKey = `${sub.scopeDescription} (${sub.quantity} ${sub.unit})`;
        newSubtaskDays[subtaskKey] = 4;
        newSubtaskDays[`${subtaskKey}_${newPhases.length - 1}`] = 4;
      });
    });

    setPhases(newPhases);
    setPhaseDaysMap(newPhaseDays);
    setSubtaskDaysMap(newSubtaskDays);
  };

  // Update total contract price manually
  const handleUpdateContractTotal = (val: number) => {
    const valid = Math.max(0, val);
    setContractTotal(valid);
    if (buildingTakeoff.length > 0) {
      syncGeneratedPhases(commercialLots, buildingTakeoff, valid);
    }
  };

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
    if (!name.trim() || isSubmitting || isReading) return;
    if (!totalRoadmapDays) { showToast('Choose a completion date on or after the start date.', 'error'); return; }

    if (phases.length === 0) {
      showToast('Please add or upload at least one phase before creating the roadmap.', 'error');
      return;
    }

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
        subtaskDaysMap,
        contractTotal > 0 ? contractTotal : undefined,
        currency
      );
      showToast(`Project Roadmap "${name.trim()}" created successfully!`, 'success');
      onClose(newRoadmap.id);
    } catch (err: any) {
      console.error('[CreateRoadmapModal] error:', err);
      showToast(err.message || 'Failed to create roadmap', 'error');
      setIsSubmitting(false);
    }
  };

  const badge = (type: 'phase' | 'subtask') => ({
    fontSize: 9,
    fontWeight: 700 as const,
    padding: '1px 5px',
    borderRadius: 3,
    background: type === 'phase' ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted-foreground) / 0.15)',
    color: type === 'phase' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    flexShrink: 0,
  });

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={() => onClose()}>
      <motion.div
        className="modal create-roadmap-modal" role="dialog" aria-modal="true" aria-label="Create Project Roadmap"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        style={{
          width: '92vw',
          maxWidth: 780,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border))' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Create Project Roadmap</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                AUTO-EVM
              </span>
            </h2>
            <p style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', margin: '3px 0 0' }}>
              Upload quotation &amp; takeoff files or set up phases manually to generate your Gantt and S-Curve.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={() => onClose()}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Mode Switcher */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 4, background: 'hsl(var(--secondary) / 0.4)', borderRadius: 8 }}>
            <button
              type="button"
              className={`btn ${creationMode === 'quotation' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, height: 32, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              onClick={() => setCreationMode('quotation')}
            >
              <Sparkles size={13} />
              <span>Smart Quotation &amp; Takeoff Import (Recommended)</span>
            </button>
            <button
              type="button"
              className={`btn ${creationMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ height: 32, fontSize: 12, padding: '0 16px' }}
              onClick={() => setCreationMode('manual')}
            >
              Manual List
            </button>
          </div>

          {/* Basic Info: Project Title */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Project Name *</label>
            <input
              type="text"
              className="text-input"
              style={{ fontSize: 13, fontWeight: 600 }}
              placeholder="e.g. Installation of FDAS Roughing-Ins - Mutien Building"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Overall Timeline Dates */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10, alignItems: 'end',
            padding: '12px 14px', borderRadius: 8, background: 'hsl(var(--secondary) / 0.25)',
            border: '1px solid hsl(var(--border) / 0.5)'
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} color="hsl(var(--primary))" />
                <span>Project Target Start</span>
              </label>
              <NeumorphicDatePicker
                value={overallStartDate || null}
                onChange={val => setOverallStartDate(val ? val.split('T')[0] : '')}
                align="left"
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={11} color="hsl(var(--primary))" />
                <span>Project Target Completion</span>
              </label>
              <NeumorphicDatePicker
                value={overallEndDate || null}
                onChange={val => setOverallEndDate(val ? val.split('T')[0] : '')}
                align="right"
              />
            </div>

            <div style={{ paddingBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--primary))', whiteSpace: 'nowrap' }}>
                {totalRoadmapDays} Calendar Days
              </span>
            </div>
          </div>

          {/* ── AUTOMATED SMART QUOTATION MODE ── */}
          {creationMode === 'quotation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              
              {/* Two Dropzones */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 12 }}>
                
                {/* 1. Commercial Quotation (PDF, Excel, Docx) */}
                <div
                  style={{
                    border: '2px dashed hsl(var(--primary) / 0.4)',
                    borderRadius: 10,
                    padding: '16px 14px',
                    textAlign: 'center',
                    background: 'hsl(var(--secondary) / 0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                  onClick={() => { if (!isReading) quotationFileRef.current?.click(); }}
                >
                  <input
                    ref={quotationFileRef}
                    type="file"
                    disabled={isReading} accept=".pdf,.xlsx,.docx,.csv,.txt"
                    style={{ display: 'none' }}
                    onChange={handleUploadQuotation}
                  />
                  {isReadingQuotation ? (
                    <Loader2 size={24} className="spin" color="hsl(var(--primary))" />
                  ) : (
                    <FileText size={24} color="hsl(var(--primary))" style={{ opacity: 0.8 }} />
                  )}
                  <div style={{ fontSize: 11.5, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {quotationFileName ? quotationFileName : '1. Upload Commercial Quotation'}
                  </div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                    PDF, Excel, or Word (Reads 1 Lot Labor, Devices &amp; Contract Price)
                  </div>
                </div>

                {/* 2. Building / Scope Takeoff (PNG Screenshot or Excel) */}
                <div
                  style={{
                    border: '2px dashed rgba(59,130,246,0.5)',
                    borderRadius: 10,
                    padding: '16px 14px',
                    textAlign: 'center',
                    background: 'rgba(59,130,246,0.04)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                  onClick={() => { if (!isReading) breakdownFileRef.current?.click(); }}
                >
                  <input
                    ref={breakdownFileRef}
                    type="file"
                    multiple disabled={isReading} accept=".png,.jpg,.jpeg,.webp,.bmp,.pdf,.xlsx,.csv"
                    style={{ display: 'none' }}
                    onChange={handleUploadBreakdown}
                  />
                  {isReadingBreakdown ? (
                    <Loader2 size={24} className="spin" color="#3b82f6" />
                  ) : (
                    <ImageIcon size={24} color="#3b82f6" style={{ opacity: 0.8 }} />
                  )}
                  <div style={{ fontSize: 11.5, fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {breakdownFileName ? breakdownFileName : '2. Upload Building Pictures / Takeoff Files'}
                  </div>
                  <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                    Select multiple pictures or files in one batch
                  </div>
                </div>

              </div>

              {readingStatus && (
                <div style={{ fontSize: 11, color: 'hsl(var(--primary))', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Loader2 size={12} className="spin" />
                  <span>{readingStatus}</span>
                </div>
              )}

              {uploadErrors.length > 0 && <div role="alert" style={{ color: 'hsl(var(--destructive))', fontSize: 12 }}>
                {uploadErrors.map((message, index) => <p key={index}>{message}</p>)}
              </div>}
              {/* Total Contract Price row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarSign size={16} color="#10b981" />
                  <div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'hsl(var(--foreground))' }}>
                      Total Contract Price (BAC)
                    </span>
                    <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))', display: 'block' }}>
                      Automatically distributed across building scopes
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>{currency}</span>
                  <input
                    type="number"
                    min={0}
                    value={contractTotal || ''}
                    onChange={e => handleUpdateContractTotal(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 1500000"
                    style={{
                      width: 130,
                      height: 28,
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: 'right',
                      padding: '2px 8px',
                      borderRadius: 6,
                      border: '1px solid rgba(16,185,129,0.4)',
                      background: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                </div>
              </div>

            </div>
          )}

          {/* ── GENERATED OR CONFIGURED PHASES & DELIVERABLES ── */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="field-label" style={{ margin: 0 }}>
                Project Phases &amp; Deliverables Breakdown ({phases.filter(p => p.type === 'phase').length} Phases, {phases.filter(p => p.type === 'subtask').length} Deliverables)
              </label>
              {phases.length > 0 && contractTotal > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981' }}>
                  Total Allocated: {currency} {phases.filter(p => p.type === 'phase').reduce((sum, p) => sum + (p.cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {phases.length === 0 ? (
              <div style={{
                padding: '20px', textAlign: 'center', borderRadius: 8,
                background: 'hsl(var(--secondary) / 0.2)', border: '1px dashed hsl(var(--border))',
                fontSize: 11.5, color: 'hsl(var(--muted-foreground))'
              }}>
                Select your quotation or breakdown pictures above to automatically generate buildings, deliverables, and monetary values.
              </div>
            ) : (
              <div style={{
                maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
                padding: 6, borderRadius: 8, background: 'hsl(var(--secondary) / 0.15)', border: '1px solid hsl(var(--border) / 0.6)'
              }}>
                {phases.map((phase, idx) => {
                  const isPhase = phase.type === 'phase';
                  const allottedDays = isPhase
                    ? (phaseDaysMap[phase.name] ?? phase.days ?? 7)
                    : (subtaskDaysMap[`${phase.name}_${idx}`] ?? subtaskDaysMap[phase.name] ?? phase.days ?? 3);

                  return (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', borderRadius: 6,
                      background: isPhase ? 'hsl(var(--secondary) / 0.75)' : 'hsl(var(--card))',
                      fontSize: 11.5,
                      border: isPhase ? '1px solid hsl(var(--border) / 0.6)' : '1px solid hsl(var(--border) / 0.25)',
                      paddingLeft: isPhase ? 8 : 22,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 8 }}>
                        {!isPhase && <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 10 }}>└─</span>}
                        <span style={badge(phase.type)}>{phase.type}</span>
                        <span style={{ fontWeight: isPhase ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {phase.name}
                        </span>
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {/* Cost Tag */}
                        {phase.cost !== undefined && phase.cost > 0 && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981' }}>
                            {currency} {phase.cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        )}

                        {/* Days Input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} title={`Allotted duration for this ${phase.type}`}>
                          <Clock size={10} color="hsl(var(--muted-foreground))" />
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={allottedDays}
                            onChange={e => {
                              const val = parseInt(e.target.value, 10) || 1;
                              if (isPhase) handleUpdatePhaseDays(phase.name, val);
                              else handleUpdateSubtaskDays(idx, phase.name, val);
                            }}
                            style={{
                              width: 36,
                              height: 20,
                              fontSize: 10.5,
                              fontWeight: 700,
                              textAlign: 'center',
                              padding: '1px 2px',
                              borderRadius: 4,
                              border: '1px solid hsl(var(--border))',
                              background: 'hsl(var(--card))',
                              color: 'hsl(var(--foreground))',
                            }}
                          />
                          <span style={{ fontSize: 9.5, color: 'hsl(var(--muted-foreground))' }}>d</span>
                        </div>

                        <button
                          type="button"
                          className="icon-btn"
                          style={{ width: 18, height: 18, padding: 0 }}
                          onClick={() => handleRemovePhase(idx)}
                          title="Remove"
                        >
                          <Trash2 size={11} color="hsl(var(--destructive))" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Manual add row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 8 }}>
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

              <input
                type="text"
                className="text-input"
                style={{ fontSize: 11.5, padding: '4px 8px', height: 28, flex: 1 }}
                placeholder={`Add custom ${newPhaseType} (e.g. ${newPhaseType === 'phase' ? 'Testing & Commissioning' : 'Pull Cat6 cabling'})...`}
                value={newPhaseInput}
                onChange={e => setNewPhaseInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhase(); } }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={newPhaseDays}
                  onChange={e => setNewPhaseDays(parseInt(e.target.value, 10) || 1)}
                  placeholder="Days"
                  style={{
                    width: 44,
                    height: 28,
                    fontSize: 11,
                    textAlign: 'center',
                    padding: '2px 4px',
                    borderRadius: 6,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <span style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>d</span>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: 28, padding: '0 10px', fontSize: 11, flexShrink: 0 }}
                onClick={handleAddPhase}
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Color Picker */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="field-label">Theme Color</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {BOARD_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  style={{
                    width: 22, height: 22, borderRadius: '50%',
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

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={() => onClose()} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || phases.length === 0 || isSubmitting || isReading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="spin" />
                <span>Generating Roadmap &amp; S-Curve...</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Generate Roadmap &amp; S-Curve ({phases.filter(p => p.type === 'phase').length} Buildings)</span>
              </>
            )}
          </button>
        </div>

      </motion.div>
    </div>, document.body
  );
}
