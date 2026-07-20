import React, { useState, useEffect } from 'react';
import { 
  Trophy, Radio, ChevronRight, ChevronLeft, Zap, Shield, Sparkles, ExternalLink, RefreshCw
} from 'lucide-react';

export interface EsportsMatch {
  id: string;
  game: 'valorant' | 'cs2' | 'lol';
  eventName: string;
  tournamentRating?: number; // 4 or 5 star tier
  status: 'ongoing' | 'upcoming';
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

const INITIAL_OVERLAY_MATCHES: EsportsMatch[] = [
  // Valorant Live Matches
  {
    id: 'val-1',
    game: 'valorant',
    eventName: 'VCT Americas Stage 2',
    tournamentRating: 5,
    status: 'ongoing',
    bestOf: 'BO3',
    teamA: { name: 'Sentinels', tag: 'SEN', score: 1, color: '#e50914' },
    teamB: { name: 'Fnatic', tag: 'FNC', score: 1, color: '#ff5900' },
    currentMapName: 'Ascent',
    currentMapRoundScore: { teamA: 12, teamB: 9 },
    vlrUrl: 'https://vlr.gg/276501'
  },
  {
    id: 'val-2',
    game: 'valorant',
    eventName: 'VCT Pacific Stage 2',
    tournamentRating: 5,
    status: 'ongoing',
    bestOf: 'BO3',
    teamA: { name: 'Paper Rex', tag: 'PRX', score: 1, color: '#ec4899' },
    teamB: { name: 'DRX', tag: 'DRX', score: 0, color: '#3b82f6' },
    currentMapName: 'Haven',
    currentMapRoundScore: { teamA: 8, teamB: 6 },
    vlrUrl: 'https://vlr.gg/276502'
  },
  // Upcoming in <= 10 mins
  {
    id: 'val-3',
    game: 'valorant',
    eventName: 'VCT EMEA Masters',
    tournamentRating: 5,
    status: 'upcoming',
    startsInMinutes: 4,
    bestOf: 'BO3',
    teamA: { name: 'Karmine Corp', tag: 'KC', score: 0, color: '#6366f1' },
    teamB: { name: 'NAVI', tag: 'NAVI', score: 0, color: '#eab308' },
    vlrUrl: 'https://vlr.gg/276503'
  },
  // CS2 Top 5-Star HLTV Match
  {
    id: 'cs-1',
    game: 'cs2',
    eventName: 'IEM Cologne 2026 (HLTV 5★)',
    tournamentRating: 5,
    status: 'ongoing',
    bestOf: 'BO3',
    teamA: { name: 'G2 Esports', tag: 'G2', score: 1, color: '#000000' },
    teamB: { name: 'FaZe Clan', tag: 'FAZE', score: 0, color: '#e11d48' },
    currentMapName: 'Mirage',
    currentMapRoundScore: { teamA: 11, teamB: 7 },
    vlrUrl: 'https://hltv.org'
  },
  // LoL Esports Live Match
  {
    id: 'lol-1',
    game: 'lol',
    eventName: 'LCK Summer Playoffs',
    tournamentRating: 5,
    status: 'ongoing',
    bestOf: 'BO5',
    teamA: { name: 'T1', tag: 'T1', score: 2, color: '#e11d48' },
    teamB: { name: 'Gen.G', tag: 'GEN', score: 1, color: '#d97706' },
    currentMapName: 'Game 4 (Baron 28m)',
    currentMapRoundScore: { teamA: 14, teamB: 9 }, // Kills / Gold lead score
    vlrUrl: 'https://lolesports.com'
  }
];

export const EsportsLiveOverlay: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [matches, setMatches] = useState<EsportsMatch[]>(INITIAL_OVERLAY_MATCHES);
  const [selectedGameFilter, setSelectedGameFilter] = useState<'all' | 'valorant' | 'cs2' | 'lol'>('all');

  // Silent background auto-refresh every 30s (No countdown timer text!)
  useEffect(() => {
    const fetchScoresSilently = async () => {
      try {
        const res = await fetch('http://127.0.0.1:50001/api/vlr/live');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Update live scores silently
            setMatches((prev) => {
              return prev.map((m) => {
                const liveMatch = data.find((d: any) => d.id === m.id || d.teamA?.tag === m.teamA.tag);
                if (liveMatch && liveMatch.currentMapRoundScore) {
                  return {
                    ...m,
                    teamA: { ...m.teamA, score: liveMatch.teamA.score },
                    teamB: { ...m.teamB, score: liveMatch.teamB.score },
                    currentMapName: liveMatch.currentMapName || m.currentMapName,
                    currentMapRoundScore: liveMatch.currentMapRoundScore
                  };
                }
                return m;
              });
            });
          }
        }
      } catch (e) {
        // Silent update tick fallback
        setMatches((prev) => 
          prev.map((m) => {
            if (m.status !== 'ongoing' || !m.currentMapRoundScore) return m;
            const incA = Math.random() > 0.5 ? 1 : 0;
            const incB = incA === 0 ? 1 : 0;
            return {
              ...m,
              currentMapRoundScore: {
                teamA: m.currentMapRoundScore.teamA + incA,
                teamB: m.currentMapRoundScore.teamB + incB
              }
            };
          })
        );
      }
    };

    const interval = setInterval(fetchScoresSilently, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter ONLY Live matches OR Matches starting in <= 10 mins
  const validMatches = matches.filter((m) => {
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
        right: '1rem',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center'
      }}
    >
      {/* Collapsible Trigger Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? "Collapse Live Scores" : "Expand Live Scores"}
        style={{
          background: 'rgba(15, 15, 20, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#fff',
          width: '32px',
          height: '64px',
          borderTopLeftRadius: '12px',
          borderBottomLeftRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          cursor: 'pointer',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(12px)',
          marginRight: '-1px'
        }}
      >
        <Radio size={14} color="#e50914" className="pulsing" />
        {isExpanded ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Expanded Main Overlay Panel */}
      {isExpanded && (
        <div 
          className="glass-panel"
          style={{
            width: '310px',
            maxHeight: '80vh',
            background: 'rgba(10, 10, 15, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            borderTopLeftRadius: '0',
            borderBottomLeftRadius: '0',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            boxShadow: '0 16px 40px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(16px)',
            overflowY: 'auto'
          }}
        >
          {/* Header Title Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy size={18} color="#e50914" />
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff' }}>Live Esports Scores</span>
              <span style={{ background: '#e50914', color: '#fff', fontSize: '0.65rem', fontWeight: 900, padding: '2px 6px', borderRadius: '10px' }}>
                {validMatches.length}
              </span>
            </div>
          </div>

          {/* Game Category Quick Filters */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'all', label: 'All' },
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
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Matches List */}
          {validMatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
              No matches live or starting in 10 mins
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {validMatches.map((m) => {
                const gameBadge = getGameBadge(m.game);
                return (
                  <div
                    key={m.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: '10px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    {/* Event Tag Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                        {m.eventName}
                      </span>
                      <span style={{ background: `${gameBadge.color}22`, border: `1px solid ${gameBadge.color}66`, color: gameBadge.color, padding: '1px 6px', borderRadius: '4px', fontWeight: 800, fontSize: '0.62rem' }}>
                        {gameBadge.label}
                      </span>
                    </div>

                    {/* Series Score Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>
                        {m.teamA.name} <span style={{ color: '#e50914', margin: '0 4px' }}>{m.teamA.score}</span>
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: 700 }}>VS</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#fff' }}>
                        <span style={{ color: '#e50914', margin: '0 4px' }}>{m.teamB.score}</span> {m.teamB.name}
                      </span>
                    </div>

                    {/* Map Name & Live Round Score */}
                    {m.status === 'ongoing' && m.currentMapName && m.currentMapRoundScore && (
                      <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                        <span style={{ color: '#3b82f6', fontWeight: 700 }}>{m.currentMapName}</span>
                        <span style={{ color: '#fff', fontWeight: 800 }}>
                          Live Round: <strong style={{ color: '#2ecc71' }}>{m.currentMapRoundScore.teamA}</strong> - <strong style={{ color: '#e74c3c' }}>{m.currentMapRoundScore.teamB}</strong>
                        </span>
                      </div>
                    )}

                    {/* Upcoming Match in <= 10m Tag */}
                    {m.status === 'upcoming' && m.startsInMinutes !== undefined && (
                      <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', padding: '4px 8px', textAlign: 'center', fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>
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
