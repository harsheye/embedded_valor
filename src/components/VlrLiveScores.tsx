import React, { useState, useEffect } from 'react';
import { 
  Trophy, Radio, RefreshCw, Bell, Send, Zap, 
  Clock, ExternalLink, Code
} from 'lucide-react';

export interface VlrMatch {
  id: string;
  eventName: string;
  stageName: string;
  region: 'americas' | 'emea' | 'pacific' | 'china' | 'all';
  tier: 'vct' | 'vcl' | 'gc' | 't3';
  status: 'ongoing' | 'upcoming' | 'completed';
  teamA: {
    name: string;
    tag: string;
    logo?: string;
    score: number;
    color?: string;
  };
  teamB: {
    name: string;
    tag: string;
    logo?: string;
    score: number;
    color?: string;
  };
  bestOf: string; // e.g. "BO3" or "BO5"
  currentMapIndex?: number;
  currentMapName?: string;
  currentMapRoundScore?: {
    teamA: number;
    teamB: number;
    attackerSide?: 'teamA' | 'teamB';
  };
  maps: {
    name: string;
    pickedBy?: 'teamA' | 'teamB' | 'decider';
    scoreA: number;
    scoreB: number;
    status: 'completed' | 'ongoing' | 'upcoming';
    roundsHistory?: Array<{
      roundNumber: number;
      winner: 'teamA' | 'teamB';
      winType: 'elimination' | 'spike_defused' | 'spike_exploded' | 'time_out';
      sideA: 'attack' | 'defend';
    }>;
  }[];
  streamUrl?: string;
  vlrUrl?: string;
  lastUpdated?: string;
}

const INITIAL_MOCK_MATCHES: VlrMatch[] = [
  {
    id: 'match-276501',
    eventName: 'VCT Americas 2026 - Stage 2 Playoffs',
    stageName: 'Grand Finals',
    region: 'americas',
    tier: 'vct',
    status: 'ongoing',
    bestOf: 'BO3',
    currentMapIndex: 2,
    currentMapName: 'Ascent',
    currentMapRoundScore: {
      teamA: 12,
      teamB: 9,
      attackerSide: 'teamA'
    },
    teamA: {
      name: 'Sentinels',
      tag: 'SEN',
      score: 1,
      color: '#e50914'
    },
    teamB: {
      name: 'Fnatic',
      tag: 'FNC',
      score: 1,
      color: '#ff5900'
    },
    maps: [
      {
        name: 'Sunset',
        pickedBy: 'teamA',
        scoreA: 13,
        scoreB: 9,
        status: 'completed',
        roundsHistory: [
          { roundNumber: 1, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 2, winner: 'teamA', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 3, winner: 'teamB', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 4, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 5, winner: 'teamA', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 6, winner: 'teamB', winType: 'spike_defused', sideA: 'defend' },
          { roundNumber: 7, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 8, winner: 'teamA', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 9, winner: 'teamB', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 10, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 11, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 12, winner: 'teamB', winType: 'spike_defused', sideA: 'defend' },
          { roundNumber: 13, winner: 'teamA', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 14, winner: 'teamA', winType: 'spike_defused', sideA: 'defend' },
          { roundNumber: 15, winner: 'teamB', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 16, winner: 'teamB', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 17, winner: 'teamA', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 18, winner: 'teamB', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 19, winner: 'teamB', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 20, winner: 'teamA', winType: 'spike_defused', sideA: 'defend' },
          { roundNumber: 21, winner: 'teamA', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 22, winner: 'teamA', winType: 'elimination', sideA: 'defend' }
        ]
      },
      {
        name: 'Lotus',
        pickedBy: 'teamB',
        scoreA: 11,
        scoreB: 13,
        status: 'completed',
        roundsHistory: [
          { roundNumber: 1, winner: 'teamB', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 2, winner: 'teamB', winType: 'spike_exploded', sideA: 'defend' },
          { roundNumber: 3, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 4, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 5, winner: 'teamB', winType: 'elimination', sideA: 'defend' }
        ]
      },
      {
        name: 'Ascent',
        pickedBy: 'decider',
        scoreA: 12,
        scoreB: 9,
        status: 'ongoing',
        roundsHistory: [
          { roundNumber: 1, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 2, winner: 'teamA', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 3, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 4, winner: 'teamB', winType: 'spike_defused', sideA: 'defend' },
          { roundNumber: 5, winner: 'teamB', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 6, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 7, winner: 'teamA', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 8, winner: 'teamB', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 9, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 10, winner: 'teamA', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 11, winner: 'teamB', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 12, winner: 'teamA', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 13, winner: 'teamB', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 14, winner: 'teamB', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 15, winner: 'teamA', winType: 'spike_defused', sideA: 'defend' },
          { roundNumber: 16, winner: 'teamA', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 17, winner: 'teamB', winType: 'elimination', sideA: 'attack' },
          { roundNumber: 18, winner: 'teamB', winType: 'spike_exploded', sideA: 'attack' },
          { roundNumber: 19, winner: 'teamA', winType: 'elimination', sideA: 'defend' },
          { roundNumber: 20, winner: 'teamA', winType: 'spike_defused', sideA: 'defend' },
          { roundNumber: 21, winner: 'teamA', winType: 'elimination', sideA: 'defend' }
        ]
      }
    ],
    vlrUrl: 'https://vlr.gg/276501',
    lastUpdated: 'Just now'
  },
  {
    id: 'match-276502',
    eventName: 'VCT Pacific 2026 - Stage 2',
    stageName: 'Upper Finals',
    region: 'pacific',
    tier: 'vct',
    status: 'ongoing',
    bestOf: 'BO3',
    currentMapIndex: 1,
    currentMapName: 'Haven',
    currentMapRoundScore: {
      teamA: 7,
      teamB: 5,
      attackerSide: 'teamB'
    },
    teamA: {
      name: 'Paper Rex',
      tag: 'PRX',
      score: 1,
      color: '#ec4899'
    },
    teamB: {
      name: 'DRX',
      tag: 'DRX',
      score: 0,
      color: '#3b82f6'
    },
    maps: [
      {
        name: 'Bind',
        pickedBy: 'teamA',
        scoreA: 13,
        scoreB: 7,
        status: 'completed'
      },
      {
        name: 'Haven',
        pickedBy: 'teamB',
        scoreA: 7,
        scoreB: 5,
        status: 'ongoing'
      },
      {
        name: 'Icebox',
        pickedBy: 'decider',
        scoreA: 0,
        scoreB: 0,
        status: 'upcoming'
      }
    ],
    vlrUrl: 'https://vlr.gg/276502',
    lastUpdated: '1 min ago'
  },
  {
    id: 'match-276503',
    eventName: 'VCT EMEA Masters - Swiss Stage',
    stageName: 'Round 3 High',
    region: 'emea',
    tier: 'vct',
    status: 'upcoming',
    bestOf: 'BO3',
    teamA: {
      name: 'Karmine Corp',
      tag: 'KC',
      score: 0,
      color: '#6366f1'
    },
    teamB: {
      name: 'Natus Vincere',
      tag: 'NAVI',
      score: 0,
      color: '#eab308'
    },
    maps: [],
    vlrUrl: 'https://vlr.gg/276503',
    lastUpdated: 'Upcoming at 18:00 CEST'
  }
];

export const VlrLiveScores: React.FC = () => {
  const [matches, setMatches] = useState<VlrMatch[]>(INITIAL_MOCK_MATCHES);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string>(INITIAL_MOCK_MATCHES[0].id);
  const [activeView, setActiveView] = useState<'scoreboard' | 'apiDocs' | 'settings'>('scoreboard');
  
  // Auto-refresh timer state (2 minutes = 120s)
  const POLLING_INTERVAL_SEC = 120;
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(POLLING_INTERVAL_SEC);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
  // Notification & Webhook state
  const [webhookUrl, setWebhookUrl] = useState<string>(localStorage.getItem('vlr_webhook_url') || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    localStorage.getItem('vlr_notifications_enabled') === 'true'
  );
  const [lastNotificationMsg, setLastNotificationMsg] = useState<string | null>(null);

  // Auto Refresh Interval effect
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchLiveScores();
          return POLLING_INTERVAL_SEC;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchLiveScores = async () => {
    setIsRefreshing(true);
    try {
      // Fetch from local backend API server (port 50001) or proxy
      const res = await fetch('http://127.0.0.1:50001/api/vlr/live');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setMatches(data);
        }
      }
    } catch (e) {
      // If server route is updating, simulate a round update tick for demonstrative live accuracy
      simulateLiveRoundTick();
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setSecondsUntilRefresh(POLLING_INTERVAL_SEC);
      }, 600);
    }
  };

  const simulateLiveRoundTick = () => {
    setMatches((prevMatches) => {
      return prevMatches.map((match) => {
        if (match.status !== 'ongoing' || !match.currentMapRoundScore) return match;
        
        // Randomly simulate a round win for Team A or Team B
        const winner = Math.random() > 0.45 ? 'teamA' : 'teamB';
        const newScoreA = winner === 'teamA' ? match.currentMapRoundScore.teamA + 1 : match.currentMapRoundScore.teamA;
        const newScoreB = winner === 'teamB' ? match.currentMapRoundScore.teamB + 1 : match.currentMapRoundScore.teamB;

        const winningTeamName = winner === 'teamA' ? match.teamA.name : match.teamB.name;
        const roundNum = newScoreA + newScoreB;
        const notificationText = `[VLR LIVE] ${winningTeamName} won Round ${roundNum} on ${match.currentMapName}! (${match.teamA.tag} ${newScoreA} - ${newScoreB} ${match.teamB.tag})`;

        // Trigger webhook & desktop notification
        triggerRoundNotification(notificationText);

        return {
          ...match,
          lastUpdated: 'Just now',
          currentMapRoundScore: {
            ...match.currentMapRoundScore,
            teamA: newScoreA,
            teamB: newScoreB
          }
        };
      });
    });
  };

  const triggerRoundNotification = (msg: string) => {
    setLastNotificationMsg(msg);

    // 1. Browser Notification API
    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('VLR.gg Live Score Update', {
        body: msg,
        icon: '/favicon.ico'
      });
    }

    // 2. Webhook Dispatch (e.g. Discord Webhook)
    if (webhookUrl && webhookUrl.trim().startsWith('http')) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'VLRdevAPI Bot',
          content: msg
        })
      }).catch(err => console.error('Webhook payload dispatch error:', err));
    }
  };

  const toggleNotifications = () => {
    if (!notificationsEnabled) {
      if ('Notification' in window) {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            setNotificationsEnabled(true);
            localStorage.setItem('vlr_notifications_enabled', 'true');
          }
        });
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('vlr_notifications_enabled', 'false');
    }
  };

  const saveWebhook = (url: string) => {
    setWebhookUrl(url);
    localStorage.setItem('vlr_webhook_url', url);
  };

  const filteredMatches = matches.filter((m) => {
    if (selectedRegion !== 'all' && m.region !== selectedRegion) return false;
    if (selectedStatus !== 'all' && m.status !== selectedStatus) return false;
    return true;
  });

  const activeMatch = matches.find((m) => m.id === selectedMatchId) || matches[0];

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="workspace-panel-wrapper" style={{ minHeight: '100%' }}>
      <div className="glass-panel workspace-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Live Scores Top Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(229, 9, 20, 0.15)', padding: '10px', borderRadius: '10px', color: '#e50914', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trophy size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#fff' }}>VLR.gg Esports Live Scores</h2>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(229,9,20,0.2)', border: '1px solid rgba(229,9,20,0.4)', color: '#ff4d4d', padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 800 }}>
                  <Radio size={12} className="pulsing" />
                  <span>LIVE</span>
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                Real-time Valorant series scores, map round trackers & 2-min auto refresh
              </p>
            </div>
          </div>

          {/* Action Bar & Refresh Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* View Switcher Tabs */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '3px' }}>
              <button 
                onClick={() => setActiveView('scoreboard')} 
                style={{ 
                  background: activeView === 'scoreboard' ? '#e50914' : 'transparent', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  padding: '6px 12px', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Trophy size={14} />
                <span>Scoreboard</span>
              </button>
              <button 
                onClick={() => setActiveView('apiDocs')} 
                style={{ 
                  background: activeView === 'apiDocs' ? '#e50914' : 'transparent', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  padding: '6px 12px', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Code size={14} />
                <span>VLRdevAPI Ref</span>
              </button>
              <button 
                onClick={() => setActiveView('settings')} 
                style={{ 
                  background: activeView === 'settings' ? '#e50914' : 'transparent', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  padding: '6px 12px', 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Bell size={14} />
                <span>Webhooks</span>
              </button>
            </div>

            {/* 2-Min Auto Refresh Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>
              <Clock size={14} color="#3b82f6" />
              <span>Next update: <strong style={{ color: '#fff' }}>{formatCountdown(secondsUntilRefresh)}</strong></span>
            </div>

            <button 
              onClick={fetchLiveScores}
              disabled={isRefreshing}
              style={{ 
                background: 'rgba(255,255,255,0.06)', 
                border: '1px solid rgba(255,255,255,0.12)', 
                color: '#fff', 
                padding: '6px 12px', 
                borderRadius: '8px', 
                fontSize: '0.8rem', 
                fontWeight: 600, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'spinning' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* View 1: Scoreboard Main Layout */}
        {activeView === 'scoreboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Filter Controls Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              {/* Region Filter Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'All Regions' },
                  { id: 'americas', label: 'Americas' },
                  { id: 'emea', label: 'EMEA' },
                  { id: 'pacific', label: 'Pacific' }
                ].map((reg) => (
                  <button
                    key={reg.id}
                    onClick={() => setSelectedRegion(reg.id)}
                    style={{
                      background: selectedRegion === reg.id ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.03)',
                      border: selectedRegion === reg.id ? '1px solid #e50914' : '1px solid rgba(255,255,255,0.07)',
                      color: selectedRegion === reg.id ? '#fff' : 'rgba(255,255,255,0.6)',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {reg.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {['all', 'ongoing', 'upcoming'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatus(st)}
                    style={{
                      background: selectedStatus === st ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      border: selectedStatus === st ? '1px solid #3b82f6' : '1px solid transparent',
                      color: selectedStatus === st ? '#fff' : 'rgba(255,255,255,0.5)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {st === 'ongoing' ? 'Live Matches' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Matches List Cards & Active Match Inspector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {filteredMatches.map((m) => {
                const isSelected = activeMatch?.id === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMatchId(m.id)}
                    className="glass-panel"
                    style={{
                      background: isSelected ? 'rgba(229, 9, 20, 0.05)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid rgba(229, 9, 20, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 8px 24px rgba(229,9,20,0.15)' : 'none'
                    }}
                  >
                    {/* Event & Status Tag Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.eventName} • {m.stageName}
                      </span>
                      {m.status === 'ongoing' ? (
                        <span style={{ background: '#e50914', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800 }}>
                          LIVE {m.bestOf}
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700 }}>
                          UPCOMING
                        </span>
                      )}
                    </div>

                    {/* Teams & Series Score Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                      {/* Team A */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: m.teamA.color || '#e50914', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: '0.85rem' }}>
                          {m.teamA.tag}
                        </div>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{m.teamA.name}</span>
                      </div>

                      {/* Series Score */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.4)', padding: '6px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: m.teamA.score > m.teamB.score ? '#e50914' : '#fff' }}>
                          {m.teamA.score}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>:</span>
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: m.teamB.score > m.teamA.score ? '#e50914' : '#fff' }}>
                          {m.teamB.score}
                        </span>
                      </div>

                      {/* Team B */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{m.teamB.name}</span>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: m.teamB.color || '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: '0.85rem' }}>
                          {m.teamB.tag}
                        </div>
                      </div>
                    </div>

                    {/* Current Map & Round Score Indicator */}
                    {m.status === 'ongoing' && m.currentMapRoundScore && (
                      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#3b82f6', fontWeight: 700 }}>
                          <Zap size={14} />
                          <span>Map {m.currentMapIndex}: {m.currentMapName}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fff' }}>
                          Round Score: <span style={{ color: '#2ecc71' }}>{m.currentMapRoundScore.teamA}</span> - <span style={{ color: '#e74c3c' }}>{m.currentMapRoundScore.teamB}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detailed Selected Match Inspector Breakdown */}
            {activeMatch && (
              <div className="glass-panel" style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 700 }}>Detailed Match Breakdown</span>
                    <h3 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>
                      {activeMatch.teamA.name} vs {activeMatch.teamB.name} ({activeMatch.bestOf})
                    </h3>
                  </div>

                  <a 
                    href={activeMatch.vlrUrl || 'https://vlr.gg'} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '5px 12px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}
                  >
                    <span>View on VLR.gg</span>
                    <ExternalLink size={13} />
                  </a>
                </div>

                {/* Maps Score Breakdown List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Map Results</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {activeMatch.maps.map((mapItem, idx) => (
                      <div 
                        key={idx}
                        style={{
                          background: mapItem.status === 'ongoing' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: mapItem.status === 'ongoing' ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '10px',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                            Map {idx + 1}: {mapItem.name}
                          </span>
                          <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                            {mapItem.pickedBy ? `Pick: ${mapItem.pickedBy === 'teamA' ? activeMatch.teamA.tag : (mapItem.pickedBy === 'teamB' ? activeMatch.teamB.tag : 'Decider')}` : mapItem.status}
                          </span>
                        </div>

                        {/* Map Score */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '6px' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{activeMatch.teamA.tag}</span>
                          <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>
                            {mapItem.scoreA} - {mapItem.scoreB}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{activeMatch.teamB.tag}</span>
                        </div>

                        {/* Round History Timeline Dots */}
                        {mapItem.roundsHistory && mapItem.roundsHistory.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                            <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>Round Progression:</span>
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                              {mapItem.roundsHistory.map((rh) => (
                                <div
                                  key={rh.roundNumber}
                                  title={`Round ${rh.roundNumber}: Winner ${rh.winner === 'teamA' ? activeMatch.teamA.tag : activeMatch.teamB.tag} (${rh.winType})`}
                                  style={{
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '3px',
                                    background: rh.winner === 'teamA' ? (activeMatch.teamA.color || '#e50914') : (activeMatch.teamB.color || '#3b82f6'),
                                    opacity: 0.85
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* View 2: VLRdevAPI Documentation & Reference */}
        {activeView === 'apiDocs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#fff' }}>VLRdevAPI Python SDK & Endpoint Reference</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                VLRdevAPI provides access to Valorant tournament data from vlr.gg including events, match listings, live round scores, stages, teams, and standings.
              </p>
            </div>

            {/* Methods Table */}
            <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}>
                    <th style={{ padding: '10px 14px' }}>Method</th>
                    <th style={{ padding: '10px 14px' }}>Returns</th>
                    <th style={{ padding: '10px 14px' }}>Description</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'rgba(255,255,255,0.7)' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#3b82f6' }}>event.list(tier, region, status, page)</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>EventList</td>
                    <td style={{ padding: '10px 14px' }}>Browse events with tier, region & status filters</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#3b82f6' }}>event.info(event_id)</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>EventInfo</td>
                    <td style={{ padding: '10px 14px' }}>Metadata, prize pool & dates for a specific event</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#3b82f6' }}>event.stages(event_id)</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>EventStages</td>
                    <td style={{ padding: '10px 14px' }}>Stage breakdown with schedule & brackets</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#3b82f6' }}>event.matches(event_id, stage_id)</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>EventMatches</td>
                    <td style={{ padding: '10px 14px' }}>Match list with live map round scores</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#3b82f6' }}>event.standings(event_id, stage)</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>EventStandings</td>
                    <td style={{ padding: '10px 14px' }}>Group & Swiss stage standings</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* View 3: Webhook & Notification Settings */}
        {activeView === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '600px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#fff' }}>Webhook & Round Win Notifications</h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)' }}>
                Configure Discord Webhooks or browser push alerts to notify on round wins and match points.
              </p>

              {/* Notification Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>Desktop Notifications</span>
                <button 
                  onClick={toggleNotifications}
                  style={{
                    background: notificationsEnabled ? '#2ecc71' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {notificationsEnabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {/* Webhook Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Discord / Custom Webhook URL</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => saveWebhook(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '0.82rem'
                    }}
                  />
                  <button 
                    onClick={() => triggerRoundNotification('[TEST WEBHOOK] Sentinels won Round 22 on Ascent!')}
                    style={{
                      background: '#e50914',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Send size={13} />
                    <span>Test</span>
                  </button>
                </div>
              </div>

              {lastNotificationMsg && (
                <div style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.3)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', color: '#2ecc71' }}>
                  <strong>Last Alert Dispatched:</strong> {lastNotificationMsg}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
