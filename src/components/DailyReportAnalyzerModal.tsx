import React, { useState, useRef, useMemo } from 'react';
import {
  X, Upload, FileText, Check, AlertTriangle, ArrowRight,
  Sparkles, RefreshCw, Layers, CheckCircle2, Sliders, ShieldAlert,
  ClipboardPaste, FileUp, Loader2, Calendar, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Board } from '../types';
import type { TaskWithScheduleForSCurve } from './RoadmapSCurve';
import { useWorkStore } from '../store/useWorkStore';
import { useToastStore } from '../store/useToastStore';

interface Props {
  board: Board;
  tasks: TaskWithScheduleForSCurve[];
  currency?: string;
  onClose: () => void;
  onApplied?: () => void;
}

export interface TaskAccomplishmentMatch {
  taskId: string;
  cardId: string;
  title: string;
  columnName: string;
  currentProgress: number;
  suggestedProgress: number;
  evaluatedProgress: number;
  confidence: 'high' | 'medium' | 'low';
  snippet: string;
  matchedReason: string;
  taskCost: number;
  selected: boolean;
}

export interface ReportAnalysisResult {
  reportDate: string;
  datesFound: string[];
  rawText: string;
  matches: TaskAccomplishmentMatch[];
  detectedDelays: string[];
  toolboxTopics: string[];
}

// Extract raw text from uploaded .txt, .docx, or .pdf file
async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (['txt', 'md', 'csv', 'log'].includes(ext)) {
    return await file.text();
  }

  if (['doc', 'docx'].includes(ext)) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value || '';
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
      text += content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ') + '\n';
    }
    return text;
  }

  throw new Error(`Unsupported file type: .${ext}. Please upload a .txt, .docx, or .pdf document.`);
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'during', 'including', 'until',
  'against', 'among', 'throughout', 'despite', 'towards', 'upon', 'concerning', 'to',
  'in', 'for', 'on', 'by', 'about', 'like', 'through', 'over', 'before', 'between',
  'after', 'since', 'without', 'under', 'within', 'along', 'following', 'across',
  'behind', 'beyond', 'plus', 'except', 'but', 'up', 'out', 'around', 'down', 'off',
  'above', 'near', 'item', 'phase', 'task', 'deliverable', 'project', 'work', 'building'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// Extract floor number (e.g. "5th floor" -> 5)
function extractFloorNum(text: string): number | null {
  const match = text.match(/\b(\d+)(?:st|nd|rd|th)?\s+floor\b/i);
  return match ? parseInt(match[1], 10) : null;
}

// Analyze technician daily narrative text against roadmap tasks
function analyzeReportNarrative(
  text: string,
  tasks: TaskWithScheduleForSCurve[]
): ReportAnalysisResult {
  // Extract dates (e.g., 10/24/2026)
  const dateMatches = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g) || [];
  const uniqueDates = Array.from(new Set(dateMatches));

  // Extract lines and sentences
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const sentences: string[] = [];
  lines.forEach(l => {
    // Split bullet points or multiple statements
    const parts = l.split(/(?<=[.!?])\s+|[;•\-–—]\s*/).map(p => p.trim()).filter(p => p.length > 5);
    if (parts.length > 0) sentences.push(...parts);
    else if (l.length > 5) sentences.push(l);
  });

  const matches: TaskAccomplishmentMatch[] = [];
  const detectedDelays: string[] = [];
  const toolboxTopics: string[] = [];

  // 1. Scan for toolbox meeting & safety notes
  lines.forEach((l, idx) => {
    if (/TOOLBOX MEETING|SAFETY PRECAUTIONS/i.test(l)) {
      const nextLine = lines[idx + 1];
      if (nextLine && !nextLine.toUpperCase().includes('REPORT')) {
        toolboxTopics.push(nextLine.replace(/^[•\-\*]\s*/, ''));
      }
    }
  });

  // 2. Scan for work delays & stoppages
  const delayRegex = /\b(rain|weather|typhoon|storm|flood|power outage|blackout|brownout|no electricity|halted|suspended|stoppage|standby|denied access|locked|permit delayed|accident|incident|delay)\b/i;
  sentences.forEach(s => {
    if (delayRegex.test(s)) {
      if (!detectedDelays.includes(s)) detectedDelays.push(s);
    }
  });

  // 3. Match each task against narrative sentences
  tasks.forEach(t => {
    const taskTitle = t.card.title || '';
    const taskFullContext = `${taskTitle} ${t.columnName || ''}`;
    const taskTokens = tokenize(taskTitle);
    const taskFloor = extractFloorNum(taskFullContext);

    if (taskTokens.length === 0) return;

    let bestScore = 0;
    let bestSnippet = '';
    let matchedReason = '';
    let detectedPct: number | null = null;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Track total pieces mentioned for this scope (e.g. 18 pcs + 15 pcs = 33 pcs)
    let totalPiecesCount = 0;
    const pieceSnippets: string[] = [];

    sentences.forEach(s => {
      const lowerSentence = s.toLowerCase();
      const sentenceFloor = extractFloorNum(s);

      // If task specifically belongs to a floor (e.g. 5th floor)
      // and sentence is explicitly talking about a different floor (e.g. 3rd floor), skip mismatch!
      if (taskFloor !== null && sentenceFloor !== null && taskFloor !== sentenceFloor) {
        return;
      }

      let matchedTokenCount = 0;
      taskTokens.forEach(token => {
        if (lowerSentence.includes(token)) {
          matchedTokenCount++;
        }
      });

      // Floor boost
      if (taskFloor !== null && sentenceFloor === taskFloor) {
        matchedTokenCount += 2;
      }

      // Check for piece counts (e.g. "Installed 18 pieces of FDAS pipes")
      if (matchedTokenCount > 0) {
        const pieceMatch = s.match(/(\d+)\s*(?:pieces?|pcs?)\s+(?:of\s+)?([a-z0-9\s-]+)/i);
        if (pieceMatch) {
          const count = parseInt(pieceMatch[1], 10);
          totalPiecesCount += count;
          pieceSnippets.push(`${count} pcs on ${sentenceFloor ? `${sentenceFloor}th floor` : 'site'}`);
        }
      }

      if (matchedTokenCount > 0) {
        const score = matchedTokenCount / Math.max(1, taskTokens.length);
        if (score > bestScore) {
          bestScore = score;
          bestSnippet = s;

          // Case A: Negative / Not Started status (e.g. "No installed pipe for additional smoke detector")
          if (/\b(no installed|not installed|not started|none installed|zero installed|pending start)\b/i.test(s)) {
            detectedPct = 0;
            matchedReason = 'Not started (Report states zero installed yet)';
            confidence = 'high';
          }
          // Case B: Explicit Percentage in sentence (e.g. "50% finished")
          else if (s.match(/(\d{1,3})%/)) {
            const m = s.match(/(\d{1,3})%/);
            if (m) {
              detectedPct = Math.min(100, Math.max(0, parseInt(m[1], 10)));
              matchedReason = `Explicit progress ${detectedPct}% in report`;
              confidence = 'high';
            }
          }
          // Case C: Ratio (e.g. "8 of 10")
          else if (s.match(/(\d+)\s*(?:of|out of|\/)\s*(\d+)/i)) {
            const countMatch = s.match(/(\d+)\s*(?:of|out of|\/)\s*(\d+)/i);
            if (countMatch) {
              const num = parseInt(countMatch[1], 10);
              const den = parseInt(countMatch[2], 10);
              if (den > 0 && num <= den) {
                detectedPct = Math.round((num / den) * 100);
                matchedReason = `Installed ${num} of ${den} units (${detectedPct}%)`;
                confidence = 'high';
              }
            }
          }
          // Case D: Pending status (e.g. "Pipe installation is still pending")
          else if (/\b(still pending|pending installation|pending pipe|to be installed)\b/i.test(s)) {
            detectedPct = 40;
            matchedReason = 'Preparatory / boxes installed; pipe routing pending (40%)';
            confidence = 'medium';
          }
          // Case E: Preparatory drilling completed (e.g. "Completed the preparatory drilling work")
          else if (/\b(completed the preparatory drilling|finished drilling|holes prepared)\b/i.test(s)) {
            detectedPct = /drill|hole|passage/i.test(taskTitle) ? 100 : 35;
            matchedReason = 'Preparatory drilling & hole passages completed';
            confidence = 'high';
          }
          // Case F: Standard technical stage keywords
          else if (/\b(completed?|finished?|done|tested|passed|accepted|turned over|commissioned|certified)\b/i.test(s)) {
            detectedPct = 100;
            matchedReason = 'Completed & verified (Stage 4 - 100%)';
            confidence = 'high';
          } else if (/\b(terminated?|pulled|mounting|mounted|installed junction boxes|conduit clamps|pipe supports)\b/i.test(s)) {
            detectedPct = 75;
            matchedReason = 'Pipes, junction boxes & clamps installed (Stage 3 - 75%)';
            confidence = 'medium';
          } else if (/\b(rough-?in|ongoing|in-?progress|proceeded with|continued the installation|drilled holes|wall drilling)\b/i.test(s)) {
            detectedPct = 50;
            matchedReason = 'Rough-in underway / Drilling & routing in progress (50%)';
            confidence = 'medium';
          } else if (/\b(delivered?|staged?|unloaded|mobilized?|on-?site|prepared the necessary holes)\b/i.test(s)) {
            detectedPct = 20;
            matchedReason = 'Preparatory work & staging (Stage 1 - 20%)';
            confidence = 'low';
          }
        }
      }
    });

    // If pieces were aggregated across multiple days (e.g. 18 pcs + 15 pcs = 33 pcs)
    if (totalPiecesCount > 0) {
      if (detectedPct === null || detectedPct < 60) {
        detectedPct = Math.min(85, Math.max(50, 40 + totalPiecesCount));
      }
      matchedReason = `Installed total ${totalPiecesCount} pieces (${pieceSnippets.join(', ')})`;
      confidence = 'high';
    }

    // Match qualification threshold
    if (bestScore >= 0.25 || bestSnippet.length > 0) {
      const curProg = t.card.completed ? 100 : (t.card.progress || 0);
      const finalSuggested = detectedPct !== null ? detectedPct : (curProg > 0 ? Math.min(100, curProg + 25) : 50);
      if (!matchedReason) matchedReason = 'Scope activity identified in report';

      matches.push({
        taskId: t.card.id,
        cardId: t.card.id,
        title: taskTitle,
        columnName: t.columnName,
        currentProgress: curProg,
        suggestedProgress: finalSuggested,
        evaluatedProgress: finalSuggested,
        confidence,
        snippet: bestSnippet,
        matchedReason,
        taskCost: t.card.cost || 0,
        selected: finalSuggested > curProg || (finalSuggested === 0 && curProg === 0),
      });
    }
  });

  const formattedDate = uniqueDates.length > 1
    ? `${uniqueDates[0]} – ${uniqueDates[uniqueDates.length - 1]} (${uniqueDates.length} Daily Reports)`
    : (uniqueDates[0] || new Date().toISOString().split('T')[0]);

  return {
    reportDate: formattedDate,
    datesFound: uniqueDates,
    rawText: text,
    matches,
    detectedDelays,
    toolboxTopics,
  };
}

export default function DailyReportAnalyzerModal({
  board,
  tasks,
  currency = '₱',
  onClose,
  onApplied
}: Props) {
  const updateCard = useWorkStore(s => s.updateCard);
  const addComment = useWorkStore(s => s.addComment);
  const showToast = useToastStore(s => s.showToast);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeInputMode, setActiveInputMode] = useState<'upload' | 'paste'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ReportAnalysisResult | null>(null);
  const [appendAuditLog, setAppendAuditLog] = useState(true);

  // Editable matches list
  const [matches, setMatches] = useState<TaskAccomplishmentMatch[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setUploadedFileName(file.name);

    try {
      const rawText = await extractTextFromFile(file);
      if (!rawText.trim()) {
        showToast('The uploaded document appears to be empty', 'error');
        setIsParsing(false);
        return;
      }

      const res = analyzeReportNarrative(rawText, tasks);
      setAnalysisResult(res);
      setMatches(res.matches);

      if (res.matches.length === 0) {
        showToast('Document parsed, but no matching deliverables were detected. You can review the text below.', 'info');
      } else {
        showToast(`Analyzed report: ${res.matches.length} deliverable match${res.matches.length > 1 ? 'es' : ''} found!`, 'success');
      }
    } catch (err: any) {
      console.error('[DailyReportAnalyzer] parse error:', err);
      showToast(err.message || 'Failed to read document', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAnalyzePastedText = () => {
    if (!pastedText.trim()) {
      showToast('Please paste technician notes or report text first', 'info');
      return;
    }

    setIsParsing(true);
    try {
      const res = analyzeReportNarrative(pastedText, tasks);
      setAnalysisResult(res);
      setMatches(res.matches);

      if (res.matches.length === 0) {
        showToast('No matching deliverables detected. Check task keywords or titles.', 'info');
      } else {
        showToast(`Identified ${res.matches.length} deliverable activities!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Error parsing narrative text', 'error');
    } finally {
      setIsParsing(false);
    }
  };

  // Toggle selection
  const handleToggleSelect = (cardId: string) => {
    setMatches(prev => prev.map(m => m.cardId === cardId ? { ...m, selected: !m.selected } : m));
  };

  const handleSelectAll = (select: boolean) => {
    setMatches(prev => prev.map(m => ({ ...m, selected: select })));
  };

  // Update evaluated %
  const handleUpdateEvaluatedProgress = (cardId: string, pct: number) => {
    const validPct = Math.max(0, Math.min(100, pct));
    setMatches(prev => prev.map(m => m.cardId === cardId ? { ...m, evaluatedProgress: validPct, selected: true } : m));
  };

  // Apply to store
  const handleApplyAccomplishments = () => {
    const selectedMatches = matches.filter(m => m.selected);
    if (selectedMatches.length === 0) {
      showToast('No deliverables selected to update', 'info');
      return;
    }

    const todayIso = new Date().toISOString().split('T')[0];

    selectedMatches.forEach(m => {
      const isCompleted = m.evaluatedProgress >= 100;
      updateCard(m.cardId, {
        progress: m.evaluatedProgress,
        completed: isCompleted,
        completedAt: isCompleted ? new Date().toISOString() : null,
        actualEndDate: isCompleted ? todayIso : null,
        actualStartDate: m.evaluatedProgress > 0 ? (tasks.find(t => t.card.id === m.cardId)?.card.actualStartDate || todayIso) : null,
      });

      if (appendAuditLog && m.snippet) {
        addComment(
          m.cardId,
          `📋 [Daily Field Report Evaluation - ${m.evaluatedProgress}%]:\n"${m.snippet}"\n(Reason: ${m.matchedReason})`
        );
      }
    });

    showToast(`Successfully verified & applied ${selectedMatches.length} deliverable accomplishment${selectedMatches.length > 1 ? 's' : ''}!`, 'success');
    onApplied?.();
    onClose();
  };

  // Calculate total incremental earned value
  const totalIncrementalEV = useMemo(() => {
    return matches.filter(m => m.selected).reduce((sum, m) => {
      const prevEV = (m.taskCost * m.currentProgress) / 100;
      const newEV = (m.taskCost * m.evaluatedProgress) / 100;
      return sum + Math.max(0, newEV - prevEV);
    }, 0);
  }, [matches]);

  return (
    <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={onClose}>
      <motion.div
        className="modal-container"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        style={{
          width: '92vw',
          maxWidth: 920,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'hsl(var(--primary) / 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'hsl(var(--primary))'
              }}
            >
              <Sparkles size={19} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Daily Technician Report & Accomplishment Calculator</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                  AUTO-EVM
                </span>
              </h2>
              <p style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', margin: '2px 0 0' }}>
                Upload or paste site reports (e.g., FDAS rough-in, conduit pipes, boxes). Automatically calculates progress %, aggregates pieces, and computes Earned Value.
              </p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Input Method Switcher */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid hsl(var(--border) / 0.6)', paddingBottom: 10 }}>
            <button
              type="button"
              className={`btn ${activeInputMode === 'paste' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ height: 30, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setActiveInputMode('paste')}
            >
              <ClipboardPaste size={13} />
              <span>Paste Technician Daily Report</span>
            </button>
            <button
              type="button"
              className={`btn ${activeInputMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ height: 30, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setActiveInputMode('upload')}
            >
              <FileUp size={13} />
              <span>Upload Document (.docx, .pdf, .txt)</span>
            </button>
          </div>

          {/* Paste Mode Area */}
          {activeInputMode === 'paste' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                rows={7}
                className="text-input"
                placeholder="Paste technician's daily report here (e.g. Daily reports with DATE, 12:00 PM / 5:00 PM shift accomplishments, installed pieces of pipes, junction boxes, wall drilling, etc.)..."
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                style={{ fontSize: 11.5, resize: 'vertical', fontFamily: 'monospace' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ height: 32, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                  onClick={handleAnalyzePastedText}
                  disabled={isParsing || !pastedText.trim()}
                >
                  {isParsing ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                  <span>Analyze Report & Calculate Values</span>
                </button>
              </div>
            </div>
          )}

          {/* Upload Mode Area */}
          {activeInputMode === 'upload' && (
            <div
              style={{
                border: '2px dashed hsl(var(--primary) / 0.4)',
                borderRadius: 10,
                padding: '28px 20px',
                textAlign: 'center',
                background: 'hsl(var(--secondary) / 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx,.doc,.pdf,.md"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {isParsing ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={28} className="spin" color="hsl(var(--primary))" />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Analyzing technician report & extracting scope activities...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <Upload size={28} color="hsl(var(--primary))" style={{ opacity: 0.8 }} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Click to Browse or Drag & Drop Daily Report'}
                  </span>
                  <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                    Supports Technician Site Diary, Daily Progress Reports, or QA/QC Logs (.docx, .pdf, .txt)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Analysis Header Badge */}
          {analysisResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, background: 'hsl(var(--secondary) / 0.5)', fontSize: 11.5 }}>
              <Calendar size={13} color="hsl(var(--primary))" />
              <span><strong>Reporting Period:</strong> {analysisResult.reportDate}</span>
              {analysisResult.toolboxTopics.length > 0 && (
                <span style={{ marginLeft: 12, color: 'hsl(var(--muted-foreground))' }}>
                  • Safety briefing conducted
                </span>
              )}
            </div>
          )}

          {/* Delays Detected Alert */}
          {analysisResult && analysisResult.detectedDelays.length > 0 && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10
              }}
            >
              <ShieldAlert size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11.5 }}>
                <strong style={{ color: '#ef4444' }}>Site Delays & Obstacles Detected in Report:</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: 'hsl(var(--foreground))' }}>
                  {analysisResult.detectedDelays.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Matches Review Table */}
          {matches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                    Detected Deliverable Accomplishments ({matches.length})
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-secondary" style={{ height: 22, fontSize: 10.5, padding: '0 8px' }} onClick={() => handleSelectAll(true)}>
                      Select All
                    </button>
                    <button type="button" className="btn btn-secondary" style={{ height: 22, fontSize: 10.5, padding: '0 8px' }} onClick={() => handleSelectAll(false)}>
                      Deselect All
                    </button>
                  </div>
                </div>

                {totalIncrementalEV > 0 && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Estimated Incremental Earned Value:</span>
                    <span>+{currency} {totalIncrementalEV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              {/* Table */}
              <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'hsl(var(--secondary) / 0.5)', borderBottom: '1px solid hsl(var(--border))' }}>
                      <th style={{ width: 36, padding: '8px 10px', textAlign: 'center' }}>✓</th>
                      <th style={{ padding: '8px 10px' }}>Deliverable / Scope</th>
                      <th style={{ padding: '8px 10px' }}>Evidence Extracted from Technician Report</th>
                      <th style={{ width: 140, padding: '8px 10px', textAlign: 'center' }}>Current → New %</th>
                      <th style={{ width: 120, padding: '8px 10px', textAlign: 'right' }}>Earned Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map(m => {
                      const isSelected = m.selected;
                      const calculatedEV = (m.taskCost * m.evaluatedProgress) / 100;

                      return (
                        <tr
                          key={m.cardId}
                          style={{
                            borderBottom: '1px solid hsl(var(--border) / 0.3)',
                            background: isSelected ? 'hsl(var(--primary) / 0.04)' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(m.cardId)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>

                          {/* Deliverable Info */}
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}>{m.title}</div>
                            <div style={{ fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>Phase: {m.columnName}</div>
                            <span style={{ fontSize: 9.5, fontWeight: 700, color: m.confidence === 'high' ? '#10b981' : '#f59e0b' }}>
                              ● {m.matchedReason}
                            </span>
                          </td>

                          {/* Report Snippet */}
                          <td style={{ padding: '10px', maxWidth: 300 }}>
                            <div style={{
                              fontSize: 11,
                              fontStyle: 'italic',
                              background: 'hsl(var(--secondary) / 0.4)',
                              padding: '5px 8px',
                              borderRadius: 4,
                              borderLeft: '3px solid hsl(var(--primary))'
                            }}>
                              "{m.snippet}"
                            </div>
                          </td>

                          {/* Progress Adjustment */}
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ color: 'hsl(var(--muted-foreground))' }}>{m.currentProgress}%</span>
                                <ArrowRight size={11} />
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={m.evaluatedProgress}
                                  onChange={e => handleUpdateEvaluatedProgress(m.cardId, parseInt(e.target.value, 10) || 0)}
                                  style={{
                                    width: 44,
                                    height: 22,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    borderRadius: 4,
                                    border: '1px solid hsl(var(--primary))',
                                    background: 'hsl(var(--card))',
                                    color: 'hsl(var(--foreground))'
                                  }}
                                />
                                <span style={{ fontWeight: 700 }}>%</span>
                              </div>

                              {/* Quick stage override buttons */}
                              <div style={{ display: 'flex', gap: 2 }}>
                                {[15, 50, 75, 100].map(stage => (
                                  <button
                                    key={stage}
                                    type="button"
                                    onClick={() => handleUpdateEvaluatedProgress(m.cardId, stage)}
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 600,
                                      padding: '1px 4px',
                                      borderRadius: 3,
                                      border: '1px solid hsl(var(--border))',
                                      background: m.evaluatedProgress === stage ? 'hsl(var(--primary))' : 'hsl(var(--secondary) / 0.6)',
                                      color: m.evaluatedProgress === stage ? '#fff' : 'hsl(var(--muted-foreground))',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {stage}%
                                  </button>
                                ))}
                              </div>
                            </div>
                          </td>

                          {/* Earned Value */}
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, color: '#10b981' }}>
                              {currency} {calculatedEV.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: 9.5, color: 'hsl(var(--muted-foreground))' }}>
                              Contract: {currency} {m.taskCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Trail Option */}
          {matches.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={appendAuditLog}
                onChange={e => setAppendAuditLog(e.target.checked)}
              />
              <span>Append extracted report snippet as an official site log on each task (recommended for client billing proof)</span>
            </label>
          )}

        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid hsl(var(--border))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={matches.filter(m => m.selected).length === 0}
            onClick={handleApplyAccomplishments}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Check size={14} />
            <span>Apply Verified Values to SITREP & S-Curve ({matches.filter(m => m.selected).length} Items)</span>
          </button>
        </div>

      </motion.div>
    </div>
  );
}
