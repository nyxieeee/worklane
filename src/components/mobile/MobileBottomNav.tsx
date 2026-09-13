import React from 'react';
import { LayoutDashboard, KanbanSquare, List, Calendar, Inbox } from 'lucide-react';

interface MobileBottomNavProps {
  page: 'dashboard' | 'board';
  viewMode: 'board' | 'list' | 'calendar';
  showInbox: boolean;
  onGoHome: () => void;
  onSelectBoardView: (view: 'board' | 'list' | 'calendar') => void;
  onToggleInbox: () => void;
}

export default function MobileBottomNav({
  page,
  viewMode,
  showInbox,
  onGoHome,
  onSelectBoardView,
  onToggleInbox,
}: MobileBottomNavProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Quick Mobile Navigation">
      <button
        type="button"
        className={`mobile-nav-tab ${page === 'dashboard' ? 'active' : ''}`}
        onClick={onGoHome}
        title="Dashboard"
      >
        <LayoutDashboard size={17} />
        <span>Home</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-tab ${page === 'board' && viewMode === 'board' ? 'active' : ''}`}
        onClick={() => onSelectBoardView('board')}
        title="Board View"
      >
        <KanbanSquare size={17} />
        <span>Board</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-tab ${page === 'board' && viewMode === 'list' ? 'active' : ''}`}
        onClick={() => onSelectBoardView('list')}
        title="List View"
      >
        <List size={17} />
        <span>List</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-tab ${page === 'board' && viewMode === 'calendar' ? 'active' : ''}`}
        onClick={() => onSelectBoardView('calendar')}
        title="Calendar View"
      >
        <Calendar size={17} />
        <span>Calendar</span>
      </button>

      <button
        type="button"
        className={`mobile-nav-tab ${showInbox ? 'active' : ''}`}
        onClick={onToggleInbox}
        title="Inbox"
      >
        <Inbox size={17} />
        <span>Inbox</span>
      </button>
    </nav>
  );
}
