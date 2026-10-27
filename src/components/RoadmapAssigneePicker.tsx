import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserPlus, Check, Search, Users, User, X, Shield, Plus } from 'lucide-react';
import type { Card as CardType, Member } from '../types';
import { avatarInitials, getMemberTeamCategory, getTeamBadgeInfo } from '../utils';
import AvatarBorder from './ui/AvatarBorder';

interface Props {
  card: CardType;
  members: Member[];
  onToggleAssignee: (memberId: string) => void;
  onManageMembers?: () => void;
  isObserver?: boolean;
}

export default function RoadmapAssigneePicker({
  card,
  members,
  onToggleAssignee,
  onManageMembers,
  isObserver,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<'all' | 'frontend' | 'backend' | 'work'>('all');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const assignedMemberIds = useMemo(() => new Set(card.assignees || []), [card.assignees]);

  const assignedMembers = useMemo(() => {
    return (card.assignees || [])
      .map(id => members.find(m => m.id === id || (m.email && m.email.toLowerCase().trim() === id.toLowerCase().trim())))
      .filter(Boolean) as Member[];
  }, [card.assignees, members]);

  // Team counts
  const feCount = useMemo(() => members.filter(m => getMemberTeamCategory(m.borderStyle) === 'frontend').length, [members]);
  const beCount = useMemo(() => members.filter(m => getMemberTeamCategory(m.borderStyle) === 'backend').length, [members]);
  const workCount = useMemo(() => members.filter(m => getMemberTeamCategory(m.borderStyle) === 'work').length, [members]);

  const filteredMembers = useMemo(() => {
    let list = members;
    if (teamFilter !== 'all') {
      list = list.filter(m => getMemberTeamCategory(m.borderStyle) === teamFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q))
      );
    }
    return list;
  }, [members, teamFilter, search]);

  const handleToggle = (e: React.MouseEvent, mId: string) => {
    e.stopPropagation();
    onToggleAssignee(mId);
  };

  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isObserver) return;
    setIsOpen(s => !s);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Trigger Area: Avatars + Add Button */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          cursor: isObserver ? 'default' : 'pointer',
        }}
        onClick={handleOpenClick}
      >
        {assignedMembers.length > 0 ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {assignedMembers.slice(0, 2).map(m => (
              <AvatarBorder key={m.id} borderStyle={m.borderStyle} size={18} title={`${m.name} (${m.role || 'Member'})`}>
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.name} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    backgroundColor: m.color || '#6366f1',
                    color: '#fff',
                    fontSize: 8,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {avatarInitials(m.name)}
                  </div>
                )}
              </AvatarBorder>
            ))}

            {assignedMembers.length > 2 && (
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: 'hsl(var(--muted))',
                  color: 'hsl(var(--muted-foreground))',
                  fontSize: 8,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={`${assignedMembers.length - 2} more assignees`}
              >
                +{assignedMembers.length - 2}
              </div>
            )}

            {!isObserver && (
              <button
                ref={triggerRef}
                type="button"
                className="roadmap-assignee-add-btn"
                title="Add / change users on this feature"
                style={{
                  width: 17,
                  height: 17,
                  borderRadius: '50%',
                  border: '1px dashed hsl(var(--border))',
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--muted-foreground))',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: 1,
                }}
                onClick={handleOpenClick}
              >
                <Plus size={10} />
              </button>
            )}
          </div>
        ) : (
          !isObserver && (
            <button
              ref={triggerRef}
              type="button"
              className="roadmap-assign-empty-btn"
              title="Add users to this feature"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                border: '1px dashed hsl(var(--border) / 0.8)',
                background: 'hsl(var(--card) / 0.7)',
                color: 'hsl(var(--muted-foreground))',
                cursor: 'pointer',
              }}
              onClick={handleOpenClick}
            >
              <UserPlus size={10} />
              <span>Assign</span>
            </button>
          )
        )}
      </div>

      {/* Popover Dropdown for Member Assignment */}
      {isOpen && (
        <div
          ref={popoverRef}
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            width: 250,
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 10,
            boxShadow: 'var(--neu-shadow-raised-lg)',
            zIndex: 100,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {/* Popover Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border) / 0.6)', paddingBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Users size={13} color="hsl(var(--primary))" />
              Assign to Feature
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'hsl(var(--muted-foreground))' }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Search box if more than 3 members */}
          {members.length > 3 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'hsl(var(--muted) / 0.4)',
              border: '1px solid hsl(var(--border) / 0.6)',
              borderRadius: 6,
              padding: '3px 8px',
            }}>
              <Search size={12} color="hsl(var(--muted-foreground))" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users..."
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: 11,
                  color: 'hsl(var(--foreground))',
                  width: '100%',
                }}
              />
            </div>
          )}

          {/* Team Filter Pills (if teams exist) */}
          {(feCount > 0 || beCount > 0 || workCount > 0) && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setTeamFilter('all')}
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: teamFilter === 'all' ? '1px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                  background: teamFilter === 'all' ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                  color: teamFilter === 'all' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                  cursor: 'pointer',
                }}
              >
                All ({members.length})
              </button>
              {feCount > 0 && (
                <button
                  type="button"
                  onClick={() => setTeamFilter('frontend')}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: teamFilter === 'frontend' ? '1px solid #0284c7' : '1px solid hsl(var(--border))',
                    background: teamFilter === 'frontend' ? 'rgba(14, 165, 233, 0.18)' : 'transparent',
                    color: teamFilter === 'frontend' ? '#0284c7' : 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                  }}
                >
                  Frontend ({feCount})
                </button>
              )}
              {beCount > 0 && (
                <button
                  type="button"
                  onClick={() => setTeamFilter('backend')}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: teamFilter === 'backend' ? '1px solid #ea580c' : '1px solid hsl(var(--border))',
                    background: teamFilter === 'backend' ? 'rgba(249, 115, 22, 0.18)' : 'transparent',
                    color: teamFilter === 'backend' ? '#ea580c' : 'hsl(var(--muted-foreground))',
                    cursor: 'pointer',
                  }}
                >
                  Backend ({beCount})
                </button>
              )}
            </div>
          )}

          {/* Members List */}
          <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {filteredMembers.length === 0 ? (
              <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', textAlign: 'center', padding: '10px 0' }}>
                No members found
              </div>
            ) : (
              filteredMembers.map(m => {
                const isAssigned = assignedMemberIds.has(m.id) || (m.email && assignedMemberIds.has(m.email.toLowerCase().trim()));
                const badgeInfo = getTeamBadgeInfo(m.borderStyle);

                return (
                  <div
                    key={m.id}
                    onClick={(e) => handleToggle(e, m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 6,
                      background: isAssigned ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                      border: isAssigned ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                      <AvatarBorder borderStyle={m.borderStyle} size={22}>
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt={m.name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: m.color || '#6366f1',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {avatarInitials(m.name)}
                          </div>
                        )}
                      </AvatarBorder>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: isAssigned ? 700 : 500, color: 'hsl(var(--foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.name}
                        </div>
                        {badgeInfo && (
                          <span style={{ fontSize: 9.5, color: badgeInfo.color, fontWeight: 600 }}>
                            {badgeInfo.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: isAssigned ? '1.5px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
                      background: isAssigned ? 'hsl(var(--primary))' : 'transparent',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isAssigned && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Link: Invite / Manage Team */}
          {onManageMembers && (
            <div style={{ borderTop: '1px solid hsl(var(--border) / 0.6)', paddingTop: 6 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onManageMembers();
                }}
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: 'hsl(var(--primary))',
                  fontSize: 11,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <UserPlus size={12} />
                <span>Manage / Invite Team Members</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

