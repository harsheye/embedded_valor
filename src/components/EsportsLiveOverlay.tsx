import React, { useState, useEffect } from 'react';
import { 
  Trophy, Radio, ChevronRight, ChevronLeft, Zap, RefreshCw, ExternalLink
} from 'lucide-react';

export interface EsportsMatch {
  id: string;
  game: 'valorant' | 'cs2' | 'lol';
  eventName: string;
  tournamentRating?: number; // 4 or 5 star tier
  status: 'ongoing' | 'upcoming' | 'completed';
  startsInMinutes?: number; // For upcoming matches (<= 10 mins)
  bestOf: string;
  teamA: {
    name: string;
    tag: string;
    score: number;
    color?: string;
  };
  teamB: {
    name: string;
    tag: string;
    score: number;
    color?: string;
  };
  currentMapName?: string;
  currentMapRoundScore?: {
    teamA: number;
    teamB: number;
  };
  vlrUrl?: string;
}

export const EsportsLiveOverlay: React.FC = () => {
  // Collapsed by default as requested
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [matches, setMatches] = useState<EsportsMatch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedGameFilter, setSelectedGameFilter] = useState<'all' | 'valorant' | 'cs2' | 'lol'>('all');

  const fetchLiveScoresSilently = async () => {
    try {
      const res = await fetch('http://127.0.0.1:50001/api/vlr/live');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Map real live matches from API
          const realMatches: EsportsMatch[] = data.map((d: any) => ({
            id: d.id || String(Math.random()),
            game: d.game || 'valorant',
            eventName: d.eventName || 'VCT League',
            status: d.status || 'ongoing',
            startsInMinutes: d.startsInMinutes,
            bestOf: d.bestOf || 'BO3',
            teamA: {
              name: d.teamA?.name || 'Team A',
              tag: d.teamA?.tag || 'T1',
              score: d.teamA?.score ?? 0,
              color: d.teamA?.color || '#e50914'
            },
            teamB: {
              name: d.teamB?.name || 'Team B',
              tag: d.teamB?.tag || 'T2',
              score: d.teamB?.score ?? 0,
              color: d.teamB?.color || '#3b82f6'
            },
            currentMapName: d.currentMapName,
            currentMapRoundScore: d.currentMapRoundScore,
            vlrUrl: d.vlrUrl || 'https://vlr.gg'
          }));
          setMatches(realMatches);
        }
      }
    } catch (e) {
      // Keep state clean - no fake data
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveScoresSilently();
    // Silent auto-refresh every 30 seconds (no visible timer text)
    const interval = setInterval(fetchLiveScoresSilently, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter ONLY Live matches OR Matches starting in <= 10 mins. OMIT ALL OLD/COMPLETED MATCHES!
  const liveMatches = matches.filter((m) => {
    if (selectedGameFilter !== 'all' && m.game !== selectedGameFilter) return false;
    if (m.status === 'ongoing') return true;
    if (m.status === 'upcoming' && m.startsInMinutes !== undefined && m.startsInMinutes <= 10) return true;
    return false;
  });

  const getGameBadge = (game: 'valorant' | 'cs2' | 'lol') => {
    switch (game) {
      case 'valorant':
        return { label: 'VLR', color: '#e50914' };
      case 'cs2':
        return { label: 'HLTV 5★', color: '#f59e0b' };
      case 'lol':
        return { label: 'LoL', color: '#3b82f6' };
    }
  };

  return (
    <div 
      className="esports-live-overlay-container"
      style={{
        position: 'fixed',
        right: '1.25rem',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {/* Collapsed View: Rounded Pill Badge Button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          title="Expand Live Scores Overlay"
          style={{
            background: 'rgba(12, 12, 18, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <Radio size={16} color="#e50914" className="pulsing" />
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>
            LIVE {liveMatches.length > 0 ? `(${liveMatches.length})` : ''}
          </span>
          <ChevronLeft size={16} color="rgba(255,255,255,0.7)" />
        </button>
      )}

      {/* Expanded View: High Aesthetic Glass Overlay Panel */}
      {isExpanded && (
        <div 
          className="glass-panel"
          style={{
            width: '320px',
            maxHeight: '82vh',
            background: 'rgba(10, 10, 15, 0.94)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '20px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            overflowY: 'auto',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          {/* Top Header Bar with Collapse Button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: 'rgba(229, 9, 20, 0.15)', padding: '6px', borderRadius: '8px', color: '#e50914', display: 'flex', alignItems: 'center' }}>
                <Trophy size={18} />
              </div>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fff' }}>Live Esports Scores</span>
              {liveMatches.length > 0 && (
                <span style={{ background: '#e50914', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '2px 7px', borderRadius: '10px' }}>
                  {liveMatches.length}
                </span>
              )}
            </div>

            {/* Collapse Close Chevron */}
            <button
              onClick={() => setIsExpanded(false)}
              title="Collapse Overlay"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Game Category Filters */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'all', label: 'All Live' },
              { id: 'valorant', label: 'VLR' },
              { id: 'cs2', label: 'CS2 5★' },
              { id: 'lol', label: 'LoL' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedGameFilter(f.id as any)}
                style={{
                  background: selectedGameFilter === f.id ? 'rgba(229, 9, 20, 0.25)' : 'rgba(255,255,255,0.04)',
                  border: selectedGameFilter === f.id ? '1px solid #e50914' : '1px solid rgba(255,255,255,0.08)',
                  color: selectedGameFilter === f.id ? '#fff' : 'rgba(255,255,255,0.6)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Matches List or Real Empty State */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
              Loading live matches...
            </div>
          ) : liveMatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Radio size={24} color="rgba(255,255,255,0.2)" />
              <span>No live matches right now</span>
              <button 
                onClick={fetchLiveScoresSilently}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}
              >
                <RefreshCw size={12} />
                <span>Check Live Feed</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {liveMatches.map((m) => {
                const gameBadge = getGameBadge(m.game);
                return (
                  <div
                    key={m.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '14px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem'
                    }}
                  >
                    {/* Event Tag Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px' }}>
                        {m.eventName}
                      </span>
                      <span style={{ background: `${gameBadge.color}22`, border: `1px solid ${gameBadge.color}66`, color: gameBadge.color, padding: '2px 7px', borderRadius: '6px', fontWeight: 800, fontSize: '0.64rem' }}>
                        {gameBadge.label}
                      </span>
                    </div>

                    {/* Series Score Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                        {m.teamA.name} <span style={{ color: '#e50914', margin: '0 4px' }}>{m.teamA.score}</span>
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: 700 }}>VS</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>
                        <span style={{ color: '#e50914', margin: '0 4px' }}>{m.teamB.score}</span> {m.teamB.name}
                      </span>
                    </div>

                    {/* Map Name & Live Round Score */}
                    {m.status === 'ongoing' && m.currentMapName && m.currentMapRoundScore && (
                      <div style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: '#3b82f6', fontWeight: 700 }}>{m.currentMapName}</span>
                        <span style={{ color: '#fff', fontWeight: 800 }}>
                          Live Round: <strong style={{ color: '#2ecc71' }}>{m.currentMapRoundScore.teamA}</strong> - <strong style={{ color: '#e74c3c' }}>{m.currentMapRoundScore.teamB}</strong>
                        </span>
                      </div>
                    )}

                    {/* Upcoming Match in <= 10m Tag */}
                    {m.status === 'upcoming' && m.startsInMinutes !== undefined && (
                      <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '8px', padding: '5px 10px', textAlign: 'center', fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                        Starts in {m.startsInMinutes} mins
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
};
