import type { DragEvent } from 'react';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import type { Board } from '../types';
import { useWorkStore } from '../store/useWorkStore';
import { useAuthStore } from '../store/useAuthStore';

const dragType = 'application/x-worklane-task-order';
function isObserver(board: Board) {
  const email = useAuthStore.getState().user?.email?.toLowerCase().trim();
  return board.createdBy?.toLowerCase().trim() !== email
    && board.members?.some(member => member.email?.toLowerCase().trim() === email && member.role === 'observer');
}
export function taskOrderDropHandlers(board: Board, columnId: string, cardId: string, disabled = false) {
  return {
    onDragOver: (event: DragEvent) => {
      if (disabled || isObserver(board) || !event.dataTransfer.types.includes(dragType)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    onDrop: (event: DragEvent) => {
      if (disabled || isObserver(board) || !event.dataTransfer.types.includes(dragType)) return;
      event.preventDefault(); event.stopPropagation();
      try {
        const source = JSON.parse(event.dataTransfer.getData(dragType));
        if (source.boardId === board.id && source.columnId === columnId) {
          useWorkStore.getState().reorderCard(board.id, columnId, source.cardId, cardId);
        }
      } catch { /* Ignore unrelated or malformed drag data. */ }
    },
  };
}

export default function TaskOrderControls({ board, columnId, cardId, disabled = false }: {
  board: Board; columnId: string; cardId: string; disabled?: boolean;
}) {
  const reorder = useWorkStore(state => state.reorderCard);
  const user = useAuthStore(state => state.user);
  const email = user?.email?.toLowerCase().trim();
  const observer = board.createdBy?.toLowerCase().trim() !== email
    && board.members?.some(member => member.email?.toLowerCase().trim() === email && member.role === 'observer');
  const cards = board.columns.find(column => column.id === columnId)?.cards || [];
  const index = cards.findIndex(card => card.id === cardId);
  if (disabled || observer || index < 0) return null;
  return <span className="task-order-controls" onClick={event => event.stopPropagation()}>
    <button type="button" className="task-order-button" draggable={cards.length > 1}
      aria-label="Drag to reorder task" title="Drag onto another task to place it above (within this building)"
      onDragStart={event => {
        event.stopPropagation(); event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(dragType, JSON.stringify({ boardId: board.id, columnId, cardId }));
      }}><GripVertical size={12} /></button>
    <span className="task-order-arrows">
      <button type="button" className="task-order-button" aria-label="Move task up" title="Move task up" disabled={index === 0}
        onClick={() => reorder(board.id, columnId, cardId, cards[index - 1].id)}><ArrowUp size={10} /></button>
      <button type="button" className="task-order-button" aria-label="Move task down" title="Move task down" disabled={index === cards.length - 1}
        onClick={() => reorder(board.id, columnId, cardId, cards[index + 2]?.id ?? null)}><ArrowDown size={10} /></button>
    </span>
  </span>;
}
