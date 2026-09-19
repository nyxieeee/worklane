import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useWorkStore } from '../../store/useWorkStore';

interface Props {
  onClose: () => void;
  mode?: 'column' | 'row';
}

export default function AddColumnModal({ onClose, mode = 'column' }: Props) {
  const addColumn = useWorkStore(s => s.addColumn);
  const [name, setName] = useState('');

  const isRow = mode === 'row';
  const labelText = isRow ? 'Row' : 'Column';

  const handleAdd = () => {
    if (!name.trim()) return;
    addColumn(name.trim());
    setName('');
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ perspective: 1200 }} onClick={onClose}>
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
          <h2 className="modal-title">Add {labelText}</h2>
          <motion.button whileTap={{ scale: 0.92 }} className="icon-btn" onClick={onClose}><X size={15} /></motion.button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="field-label">{labelText} Name</label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. In Review"
              maxLength={40}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <motion.button whileTap={{ scale: 0.95 }} className="btn btn-secondary" onClick={onClose}>Cancel</motion.button>
          <motion.button
            whileTap={name.trim() ? { scale: 0.95 } : undefined}
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={!name.trim()}
            style={{
              opacity: name.trim() ? 1 : 0.5,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            <Check size={14} /> Add {labelText}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
