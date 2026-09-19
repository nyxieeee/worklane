import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkStore } from '../../store/useWorkStore';
import { useToastStore } from '../../store/useToastStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BOARD_COLORS } from '../../types';

interface Props {
  onClose: (createdBoardId?: string) => void;
}

export default function CreateBoardModal({ onClose }: Props) {
  const createBoard = useWorkStore(s => s.createBoard);
  const showToast = useToastStore(s => s.showToast);
  const user = useAuthStore(s => s.user);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(BOARD_COLORS[0].value);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newBoard = await createBoard(name.trim(), selectedColor, user?.email, user?.name);
      showToast(`Board "${name.trim()}" created`, 'success');
      setName('');
      setSelectedColor(BOARD_COLORS[0].value);
      onClose(newBoard.id);
    } catch (err) {
      console.error('[CreateBoardModal] error creating board:', err);
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
        className="modal small-modal"
        style={{ transformStyle: 'preserve-3d' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 className="modal-title">Create Board</h2>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={() => onClose()}><X size={15} /></motion.button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="field-label">Board Name</label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. Engineering Sprint"
              maxLength={50}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="field-label">Accent Color</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {BOARD_COLORS.map(c => (
                <motion.button
                  key={c.value}
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    backgroundColor: c.value,
                    boxShadow: selectedColor === c.value ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-raised-sm)',
                    border: selectedColor === c.value ? '2px solid hsl(var(--foreground))' : 'none',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  title={c.name}
                  onClick={() => setSelectedColor(c.value)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={() => onClose()}>Cancel</motion.button>
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
            <Check size={14} /> {isSubmitting ? 'Creating...' : 'Create Board'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
