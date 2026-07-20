import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, RotateCw, X, 
  Maximize, Minimize, Volume2, Volume1, VolumeX, Lock,
  Sliders, SkipForward, Ban, Eye, Settings, Bookmark as BookmarkIcon, List, Server, Cpu
} from 'lucide-react';
import type { VideoItem, Bookmark } from '../types/media';
import { BookmarkPanel } from './BookmarkPanel';
import { BookmarkModal } from './BookmarkModal';
import { logger } from '../utils/logger';

interface OnlineVideoPlayerProps {
  video: VideoItem;
  userId?: string;
  onBack: () => void;
  onUpdateVideo: (updatedVideoOrUpdater: VideoItem | ((prev: VideoItem) => VideoItem), isExiting?: boolean, targetVideoId?: string, forceSave?: boolean) => void;
  hideUIOverlays?: boolean;
  toastDuration?: number;
  disableAnimations?: boolean;
  showPlayButton?: boolean;
  showTimeDisplay?: boolean;
  showPlayBar?: boolean;
  showVolumeControl?: boolean;
  showFullscreen?: boolean;
  historySaveInterval?: number;
  saveVolume?: boolean;
  openSubtitlesApiKey?: string;
  allowUiSkipping?: boolean;
  blockSeekingCompletely?: boolean;
  autoSkipIntroOutro?: boolean;
  autoSkipSexScenes?: boolean;
  lockModeActive?: boolean;
  uiHideTimeout?: number;
  tmdbApiKey?: string;
}

const DEFAULT_TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlMzQwMGRhZWZjODJjNTJlZDEyYzk1MWU1ZWFmYmVhYyIsIm5iZiI6MTc4MzU0MTI2OS44NzUsInN1YiI6IjZhNGVhZTE1MzFhOWUyYmNhZjBmY2RlMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.GT6_b6NSJwjYCXlbaCi_djq09ug0rKDxY9iouqVrYWY";

export const OnlineVideoPlayer: React.FC<OnlineVideoPlayerProps> = ({
  video,
  userId,
  onBack,
  onUpdateVideo,
  hideUIOverlays = false,
  toastDuration = 3000,
  disableAnimations = false,
  showPlayButton = true,
  showTimeDisplay = true,
  showPlayBar = true,
  showVolumeControl = true,
  showFullscreen = true,
  historySaveInterval = 10,
  saveVolume = true,
  allowUiSkipping = true,
  blockSeekingCompletely = false,
  autoSkipIntroOutro = true,
  autoSkipSexScenes = true,
  lockModeActive = false,
  uiHideTimeout = 3000,
  tmdbApiKey
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(video.currentTime || 0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('valor_player_volume');
    return saved ? Number(saved) : 1.0;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Streaming servers & details
  const [server, setServer] = useState<'videasy' | 'vidking'>('videasy');
  const [currentSeason, setCurrentSeason] = useState(video.season || 1);
  const [currentEpisode, setCurrentEpisode] = useState(video.episode || 1);
  const [tvMetadata, setTvMetadata] = useState<{ seasonsCount: number; episodesPerSeason: { [seasonNum: number]: number } } | null>(null);
  const [animeEpisodesCount, setAnimeEpisodesCount] = useState<number | null>(null);

  // Overlays / Popups
  const [showControls, setShowControls] = useState(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showBookmarksPopover, setShowBookmarksPopover] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | undefined>(undefined);
  const [markingStartTime, setMarkingStartTime] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(lockModeActive);
  
  // Native control mode (pointer events auto)
  const [interactWithNative, setInteractWithNative] = useState(false);

  // Bookmarks local state
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Toast / Alerts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const bookmarksTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTimeRef = useRef(video.currentTime || 0);
  const lastSkipTimeRef = useRef<number>(0);

  const isAnime = video.type === 'online_anime';

  // Trigger Toast Notification
  const addToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, toastDuration);
  }, [toastDuration]);

  // postMessage Command Dispatcher
  const sendIframeCommand = useCallback((action: 'play' | 'pause' | 'seek', value?: number) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    
    // Multiple API schemas for Videasy & Vidking
    const payloads = [
      { type: action, value },
      { method: action, value },
      { command: action, value },
      { type: 'PLAYER_COMMAND', command: action, value },
      { event: 'command', func: action, value },
      { event: 'command', func: `${action}Video`, value },
      { event: action, value },
      { action, value },
      { type: 'media', action, value }
    ];
    
    payloads.forEach(p => {
      try { iframe.contentWindow.postMessage(JSON.stringify(p), '*'); } catch (e) {}
      try { iframe.contentWindow.postMessage(p, '*'); } catch (e) {}
    });
  }, []);

  // Fetch Bookmarks from GraphQL API
  const fetchBookmarks = useCallback(async () => {
    try {
      const activeUserId = userId || 'local';
      const queryStr = `
        query GetBookmarks($userId: String!, $videoId: String!) {
          bookmarks(userId: $userId, videoId: $videoId) {
            id
            time
            endTime
            label
            isIntro
            isOutro
            skipEnabled
            title
            description
            category
            thumbnail
            favorite
            createdBy
          }
        }
      `;
      const response = await fetch('http://127.0.0.1:50001/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryStr,
          variables: { userId: activeUserId, videoId: video.id }
        })
      });
      const result = await response.json();
      if (result.data && result.data.bookmarks) {
        setBookmarks(result.data.bookmarks);
      }
    } catch (err) {
      console.warn('Failed to load bookmarks:', err);
    }
  }, [video.id, userId]);

  // Sync Bookmarks to Server
  const saveBookmarksToServer = useCallback(async (updatedBookmarks: Bookmark[]) => {
    try {
      const activeUserId = userId || 'local';
      const mutation = `
        mutation SaveBookmarks($userId: String!, $videoId: String!, $bookmarks: [BookmarkInput!]!) {
          saveBookmarks(userId: $userId, videoId: $videoId, bookmarks: $bookmarks) {
            success
            count
          }
        }
      `;
      
      const serialized = updatedBookmarks.map(bm => ({
        id: bm.id,
        time: bm.time,
        endTime: bm.endTime !== undefined ? bm.endTime : null,
        label: bm.label || '',
        isIntro: bm.isIntro || false,
        isOutro: bm.isOutro || false,
        skipEnabled: bm.skipEnabled || false,
        title: bm.title || '',
        description: bm.description || '',
        category: bm.category || 'Custom',
        thumbnail: bm.thumbnail || '',
        favorite: bm.favorite || false,
        createdBy: bm.createdBy || 'manual'
      }));

      await fetch('http://127.0.0.1:50001/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mutation,
          variables: { userId: activeUserId, videoId: video.id, bookmarks: serialized }
        })
      });
    } catch (err) {
      console.warn('Failed to sync bookmarks:', err);
    }
  }, [video.id, userId]);

  // Load TV metadata (TMDB)
  useEffect(() => {
    if (video.type !== 'online_tv' || !video.tmdbId) return;

    const fetchTvData = async () => {
      try {
        const isBearer = tmdbApiKey ? tmdbApiKey.length > 50 : true;
        const token = tmdbApiKey || DEFAULT_TMDB_TOKEN;
        let url = `https://api.themoviedb.org/3/tv/${video.tmdbId}?language=en-US`;
        let headers: HeadersInit = { 'accept': 'application/json' };
        
        if (isBearer) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          url += `&api_key=${token}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to fetch TV details');
        const data = await res.json();
        
        const episodesMap: { [key: number]: number } = {};
        (data.seasons || []).forEach((s: any) => {
          if (s.season_number > 0) {
            episodesMap[s.season_number] = s.episode_count;
          }
        });

        setTvMetadata({
          seasonsCount: data.number_of_seasons || Object.keys(episodesMap).length,
          episodesPerSeason: episodesMap
        });
      } catch (err) {
        console.error('Error fetching TV details:', err);
      }
    };

    fetchTvData();
  }, [video.tmdbId, video.type, tmdbApiKey]);

  // Fetch Anime details (AniList)
  useEffect(() => {
    if (video.type !== 'online_anime' || !video.anilistId) return;

    const fetchAnimeData = async () => {
      try {
        const graphqlQuery = `
          query ($id: Int) {
            Media (id: $id, type: ANIME) {
              episodes
            }
          }
        `;
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            query: graphqlQuery,
            variables: { id: video.anilistId }
          })
        });

        if (!res.ok) throw new Error('Failed to fetch Anime details');
        const body = await res.json();
        setAnimeEpisodesCount(body.data?.Media?.episodes || 12);
      } catch (err) {
        console.error('Error fetching Anime details:', err);
        setAnimeEpisodesCount(12);
      }
    };

    fetchAnimeData();
  }, [video.anilistId, video.type]);

  // Load initial bookmarks
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // Auto-hide controls handler
  const handleMouseMove = () => {
    if (isLocked) return;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    
    if (isPlaying && !interactWithNative) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, uiHideTimeout);
    }
  };

  // Keyboard Hotkeys listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked || showAddDialog || showSettingsPanel) return;

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekDelta(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekDelta(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (interactWithNative) {
            setInteractWithNative(false);
            addToast("Returned to Premium controls");
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, isPlaying, volume, isMuted, showAddDialog, showSettingsPanel, interactWithNative, sendIframeCommand]);

  // Listen to postMessage player events from iframe
  useEffect(() => {
    const handlePlayerMessage = (e: MessageEvent) => {
      try {
        let parsed = e.data;
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }

        if (parsed && parsed.type === 'PLAYER_EVENT') {
          const { event: playerEvent, currentTime: pTime, duration: pDur } = parsed.data;

          if (typeof pTime === 'number') {
            setCurrentTime(pTime);
            
            // Check for Auto-Skip bookmarks (Intro & Outro / Sex & Nudity)
            checkAutoSkip(pTime);

            // Periodic Save Progress to Server / storage
            if (Math.abs(pTime - lastSaveTimeRef.current) >= historySaveInterval) {
              lastSaveTimeRef.current = pTime;
              const updated: VideoItem = {
                ...video,
                currentTime: pTime,
                duration: formatTime(pDur || duration),
                season: video.type === 'online_tv' ? currentSeason : undefined,
                episode: video.type !== 'online_movie' ? currentEpisode : undefined
              };
              onUpdateVideo(updated);
            }
          }

          if (typeof pDur === 'number' && pDur > 0) {
            setDuration(pDur);
          }

          if (playerEvent === 'play') {
            setIsPlaying(true);
          } else if (playerEvent === 'pause') {
            setIsPlaying(false);
          } else if (playerEvent === 'ended') {
            setIsPlaying(false);
            handleVideoEnded();
          }
        }
      } catch (err) {}
    };

    window.addEventListener('message', handlePlayerMessage);
    return () => window.removeEventListener('message', handlePlayerMessage);
  }, [video, duration, currentSeason, currentEpisode, historySaveInterval, onUpdateVideo]);

  // Construct URL for streaming server iframe
  const getEmbedUrl = () => {
    const id = video.type === 'online_anime' ? video.anilistId : video.tmdbId;
    const startProgress = video.currentTime && Math.floor(video.currentTime) > 10 ? `?progress=${Math.floor(video.currentTime)}` : '';
    
    if (server === 'videasy') {
      const colorParam = startProgress ? '&color=8B5CF6' : '?color=8B5CF6';
      if (video.type === 'online_movie') {
        return `https://player.videasy.net/movie/${id}${startProgress}${colorParam}`;
      } else if (video.type === 'online_tv') {
        return `https://player.videasy.net/tv/${id}/${currentSeason}/${currentEpisode}${startProgress}${colorParam}&nextEpisode=true&episodeSelector=true`;
      } else {
        return `https://player.videasy.net/anime/${id}/${currentEpisode}${startProgress}${colorParam}`;
      }
    } else {
      const colorParam = startProgress ? '&color=e50914' : '?color=e50914';
      if (video.type === 'online_movie') {
        return `https://www.vidking.net/embed/movie/${id}${startProgress}${colorParam}&autoPlay=true`;
      } else {
        return `https://www.vidking.net/embed/tv/${id}/${currentSeason}/${currentEpisode}${startProgress}${colorParam}&nextEpisode=true&episodeSelector=true`;
      }
    }
  };

  // Skip auto-marked scenes
  const checkAutoSkip = (time: number) => {
    // Prevent double trigger within 3 seconds
    if (Date.now() - lastSkipTimeRef.current < 3000) return;

    const matched = bookmarks.find(bm => {
      if (!bm.endTime || bm.endTime <= bm.time) return false;
      const inside = time >= bm.time && time < bm.endTime;
      if (!inside) return false;

      // Filter by user preference toggles
      const isIntroOutro = bm.isIntro || bm.isOutro || bm.category === 'Intro' || bm.category === 'Outro';
      const isSexScene = bm.category === 'Sex' || bm.category === 'Nudity';

      if (isIntroOutro && autoSkipIntroOutro) return true;
      if (isSexScene && autoSkipSexScenes) return true;
      if (bm.skipEnabled && !isIntroOutro && !isSexScene) return true;

      return false;
    });

    if (matched && matched.endTime) {
      lastSkipTimeRef.current = Date.now();
      addToast(`Auto-Skipping Scene: ${matched.title || matched.category}`);
      sendIframeCommand('seek', matched.endTime);
      setCurrentTime(matched.endTime);
    }
  };

  // Playback control functions
  const togglePlay = () => {
    if (isLocked) return;
    if (isPlaying) {
      sendIframeCommand('pause');
      setIsPlaying(false);
    } else {
      sendIframeCommand('play');
      setIsPlaying(true);
    }
  };

  const seekDelta = (secs: number) => {
    if (isLocked || blockSeekingCompletely) return;
    const target = Math.max(0, Math.min(duration, currentTime + secs));
    sendIframeCommand('seek', target);
    setCurrentTime(target);
    addToast(secs > 0 ? `+${secs}s` : `${secs}s`);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked || blockSeekingCompletely) return;
    const target = Number(e.target.value);
    sendIframeCommand('seek', target);
    setCurrentTime(target);
  };

  const adjustVolume = (delta: number) => {
    if (isLocked) return;
    const val = Math.max(0, Math.min(1.0, volume + delta));
    setVolume(val);
    localStorage.setItem('valor_player_volume', String(val));
    setIsMuted(val === 0);
    
    // Note: Cross-origin iframe limitations might prevent volume modification 
    // inside the iframe directly, but we show visual status inside our custom control
    addToast(`Volume: ${Math.round(val * 100)}%`);
  };

  const toggleMute = () => {
    if (isLocked) return;
    setIsMuted(prev => {
      const next = !prev;
      addToast(next ? "Muted" : `Volume: ${Math.round(volume * 100)}%`);
      return next;
    });
  };

  const toggleFullscreen = () => {
    if (isLocked) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  // Autoplay next episode logic
  const handleVideoEnded = () => {
    const totalEps = video.type === 'online_tv' 
      ? (tvMetadata?.episodesPerSeason[currentSeason] || 10) 
      : (animeEpisodesCount || 12);
      
    if (currentEpisode < totalEps) {
      addToast(`Autoplay: Starting Episode ${currentEpisode + 1}...`);
      setTimeout(() => {
        setCurrentEpisode(currentEpisode + 1);
        setCurrentTime(0);
        setIsPlaying(true);
      }, 3000);
    } else if (video.type === 'online_tv' && tvMetadata && currentSeason < tvMetadata.seasonsCount) {
      addToast(`Autoplay: Starting Season ${currentSeason + 1} Episode 1...`);
      setTimeout(() => {
        setCurrentSeason(currentSeason + 1);
        setCurrentEpisode(1);
        setCurrentTime(0);
        setIsPlaying(true);
      }, 3000);
    } else {
      addToast("Series finished!");
    }
  };

  // Helper formatting clock
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Add / Edit Bookmarks handlers
  const handleSaveBookmark = (bmData: Partial<Bookmark>) => {
    let nextBookmarks = [...bookmarks];
    if (bmData.id) {
      // Edit mode
      nextBookmarks = nextBookmarks.map(b => b.id === bmData.id ? { ...b, ...bmData } as Bookmark : b);
      addToast("Bookmark Updated");
    } else {
      // Create mode
      const newBm: Bookmark = {
        id: `bm-${Date.now()}`,
        time: bmData.time ?? currentTime,
        endTime: bmData.endTime,
        label: bmData.label || bmData.title || 'Scene Mark',
        isIntro: bmData.category === 'Intro',
        isOutro: bmData.category === 'Outro',
        skipEnabled: bmData.skipEnabled || false,
        title: bmData.title || '',
        description: bmData.description || '',
        category: bmData.category || 'Custom',
        thumbnail: bmData.thumbnail || '',
        favorite: bmData.favorite || false,
        createdBy: 'manual'
      };
      nextBookmarks.push(newBm);
      addToast("Bookmark Saved");
    }
    setBookmarks(nextBookmarks);
    saveBookmarksToServer(nextBookmarks);
    setMarkingStartTime(null);
  };

  const handleDeleteBookmark = (bmId: string) => {
    const next = bookmarks.filter(b => b.id !== bmId);
    setBookmarks(next);
    saveBookmarksToServer(next);
    addToast("Bookmark Deleted");
  };

  const handleToggleLock = () => {
    setIsLocked(prev => {
      const next = !prev;
      addToast(next ? "Controls Locked" : "Controls Unlocked");
      return next;
    });
  };

  const handleNativeConfigMode = () => {
    setInteractWithNative(true);
    addToast("Direct streaming interaction enabled. Press ESC to return.");
  };

  return (
    <div 
      ref={playerContainerRef}
      className={`local-player-container ${isLocked ? 'is-locked' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !interactWithNative && isPlaying && setShowControls(false)}
      style={{ background: 'black', fontFamily: 'Outfit, sans-serif' }}
    >
      {/* Floating control panel: exit & server selection */}
      <div 
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 2200,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '6px 12px',
          borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          pointerEvents: 'auto'
        }}
      >
        {/* Source Selector Dropdown */}
        <div className="season-selector-dropdown-wrapper" style={{ position: 'relative' }}>
          <select 
            value={server} 
            onChange={(e) => setServer(e.target.value as 'videasy' | 'vidking')}
            className="season-details-dropdown"
            style={{
              padding: '0.2rem 1.8rem 0.2rem 0.6rem',
              fontSize: '0.8rem',
              borderRadius: '6px',
              height: '28px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="videasy">Source 1</option>
            <option value="vidking">Source 2</option>
          </select>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)' }} />

        {/* Exit Button */}
        <button 
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.8)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            padding: '4px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#e50914'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
          title="Exit Player"
        >
          <X size={18} />
        </button>
      </div>

      <style>{`
        .local-player-container {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          background: #000;
          z-index: 2000;
          overflow: hidden;
          user-select: none;
        }
        .online-iframe-wrapper {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 5;
          pointer-events: auto !important;
        }
        .online-native-hud {
          position: absolute;
          top: 75px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(229, 9, 20, 0.95);
          border: 1px solid #ff4a4a;
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.5);
          animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .online-native-hud button {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          padding: 3px 10px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 700;
          font-size: 11px;
          transition: background 0.2s;
        }
        .online-native-hud button:hover {
          background: rgba(255,255,255,0.35);
        }
        .control-btn-native {
          background: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #a78bfa !important;
        }
        .control-btn-native:hover {
          background: rgba(167, 139, 250, 0.15) !important;
          border-color: #c084fc !important;
          color: #c084fc !important;
        }

        /* Custom UI Overlays Styling */
        .player-ui-overlay-layer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 10;
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, transparent 20%, transparent 80%, rgba(0, 0, 0, 0.7) 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          opacity: 0;
          pointer-events: none !important;
          transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .player-ui-overlay-layer.visible {
          opacity: 1;
          pointer-events: none !important;
        }

        .top-bar-overlay {
          height: 80px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          width: 100%;
          box-sizing: border-box;
          pointer-events: auto;
        }
        .back-btn {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          transition: transform 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 50%;
        }
        .back-btn:hover {
          background: rgba(255,255,255,0.1);
          transform: scale(1.08);
        }
        .player-title-info h2 {
          margin: 0;
          font-size: 1.25rem;
          color: white;
          font-weight: 700;
        }
        .player-title-info span {
          font-size: 0.85rem;
          color: #a78bfa;
          font-weight: 600;
          margin-top: 4px;
          display: block;
        }
        .source-indicator-badge {
          background: rgba(139, 92, 246, 0.2);
          border: 1px solid #8b5cf6;
          color: #c084fc;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
        }

        .center-hud-clicker {
          flex-grow: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .lock-hud-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          color: #ff0914;
          background: rgba(0,0,0,0.7);
          padding: 20px 40px;
          border-radius: 16px;
          border: 1px solid rgba(255,9,20,0.3);
          backdrop-filter: blur(10px);
        }
        .lock-hud-indicator span {
          font-weight: 700;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pause-synopsis-overlay {
          position: absolute;
          left: 2rem;
          bottom: 120px;
          max-width: 450px;
          z-index: 12;
          pointer-events: none;
        }
        .synopsis-box {
          background: rgba(10, 10, 15, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 1.5rem;
          border-radius: 16px;
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          pointer-events: auto;
        }
        .synopsis-tag {
          background: #ff0914;
          color: white;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.5px;
        }
        .synopsis-box h3 {
          margin: 10px 0 6px 0;
          color: white;
          font-size: 1.35rem;
        }
        .synopsis-box p {
          margin: 0;
          color: rgba(255, 255, 255, 0.55);
          font-size: 0.85rem;
          line-height: 1.5;
        }

        .bottom-bar-overlay {
          background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%);
          padding: 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          width: 100%;
          box-sizing: border-box;
          pointer-events: auto;
        }
        .scrub-container-premium {
          position: relative;
          width: 100%;
          height: 16px;
          display: flex;
          align-items: center;
          cursor: pointer;
        }
        .scrub-bar-premium {
          position: absolute;
          width: 100%;
          height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
          z-index: 10;
          cursor: pointer;
        }
        .scrub-bar-premium::-webkit-slider-runnable-track {
          background: transparent;
        }
        .scrub-bar-premium::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
          transform: scale(0);
          opacity: 0;
          transition: transform 0.15s, opacity 0.15s;
        }
        .scrub-container-premium:hover .scrub-bar-premium::-webkit-slider-thumb,
        .scrub-bar-premium:active::-webkit-slider-thumb {
          transform: scale(1.3);
          opacity: 1;
        }
        .scrub-track-progress {
          position: absolute;
          height: 4px;
          background: #8b5cf6;
          border-radius: 2px 0 0 2px;
          z-index: 8;
          pointer-events: none;
        }
        .timeline-bookmark-range {
          position: absolute;
          height: 4px;
          background: rgba(229, 9, 20, 0.6);
          z-index: 9;
          pointer-events: none;
        }
        .timeline-bookmark-dot {
          position: absolute;
          width: 6px;
          height: 6px;
          background: #fbbf24;
          border-radius: 50%;
          transform: translate(-3px, -1px);
          z-index: 9;
          pointer-events: none;
        }
        .timeline-bookmark-range.nudity, .timeline-bookmark-dot.nudity { background: #ec4899; }
        .timeline-bookmark-range.sex, .timeline-bookmark-dot.sex { background: #a855f7; }
        .timeline-bookmark-range.gore, .timeline-bookmark-dot.gore { background: #ef4444; }
        .timeline-bookmark-range.intro, .timeline-bookmark-dot.intro { background: #3b82f6; }
        .timeline-bookmark-range.outro, .timeline-bookmark-dot.outro { background: #10b981; }

        .bottom-control-buttons-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .bottom-controls-left-group, .bottom-controls-right-group {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .control-btn {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border-radius: 50%;
          transition: background 0.2s, transform 0.15s;
        }
        .control-btn:hover {
          background: rgba(255,255,255,0.1);
          transform: scale(1.08);
        }
        .control-btn.active {
          color: #8b5cf6;
        }
        .volume-slider-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .volume-slider-bar {
          width: 80px;
          height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
          cursor: pointer;
        }
        .volume-slider-bar::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
        }
        .time-display-odometer {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(255,255,255,0.7);
          font-size: 0.85rem;
          font-family: monospace;
        }
        .time-display-odometer .divider {
          color: rgba(255,255,255,0.3);
        }

        .popover-wrapper {
          position: relative;
        }
        .player-toast-notification {
          position: absolute;
          bottom: 120px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(139, 92, 246, 0.95);
          border: 1px solid #a78bfa;
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          z-index: 1000;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }

        /* Quick Settings Panel */
        .player-quick-settings-panel {
          position: absolute;
          bottom: 120px;
          right: 2rem;
          width: 320px;
          background: rgba(10, 10, 15, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 1.25rem;
          color: white;
          z-index: 1000;
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
        }
        .player-quick-settings-panel .settings-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .player-quick-settings-panel .settings-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
        }
        .player-quick-settings-panel .settings-header button {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
        }
        .player-quick-settings-panel .settings-options-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .player-quick-settings-panel .pref-toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }
      `}</style>

      {/* Direct Interactive Streaming HUD */}
      {interactWithNative && (
        <div className="online-native-hud">
          <Cpu size={14} className="animate-pulse" />
          <span>Interacting with native streaming controls. controls overlays temporarily hidden.</span>
          <button onClick={() => setInteractWithNative(false)}>ESC to Return</button>
        </div>
      )}

      {/* Main Stream Iframe */}
      <div className={`online-iframe-wrapper ${interactWithNative ? 'native-active' : ''}`}>
        <iframe
          ref={iframeRef}
          key={getEmbedUrl()}
          src={getEmbedUrl()}
          style={{ width: '100%', height: '100%', border: 'none' }}
          allowFullScreen
          allow="autoplay; encrypted-media"
          {...{ credentialless: "true" }}
        />
      </div>

      {/* Custom CONTROL OVERLAY OVER THE IFRAME */}
      {!interactWithNative && (
        <div 
          className={`player-ui-overlay-layer ${showControls ? 'visible' : ''}`}
          style={{ zIndex: 10 }}
        >
          {/* Top Bar controls */}
          <div className="top-bar-overlay">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button className="back-btn" onClick={onBack} title="Go Back">
                <X size={22} />
              </button>
              <div className="player-title-info">
                <h2>{video.title}</h2>
                {video.type !== 'online_movie' && (
                  <span>
                    {video.type === 'online_tv' ? `Season ${currentSeason} • Episode ${currentEpisode}` : `Episode ${currentEpisode}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center Playback click-trigger & status popup */}
          <div className="center-hud-clicker" onClick={togglePlay}>
            {isLocked && (
              <div className="lock-hud-indicator animate-fade-in">
                <Lock size={32} />
                <span>Controls Locked</span>
              </div>
            )}
          </div>

          {/* Pause overlay details screen */}
          {!isPlaying && !isLocked && !showBookmarksPopover && !showSettingsPanel && (
            <div className="pause-synopsis-overlay animate-fade-in">
              <div className="synopsis-box">
                <span className="synopsis-tag">PAUSED</span>
                <h3>{video.title}</h3>
                <p>Streaming online via direct CDN node selector. Change audio track, subtitles, or server via the Stream Config native selector if required.</p>
              </div>
            </div>
          )}

          {/* Toast notifications */}
          {toastMessage && (
            <div className="player-toast-notification">
              {toastMessage}
            </div>
          )}

          {/* Bottom Controls Overlay */}
          <div className="bottom-bar-overlay">
            {/* Passive Timeline Progress Tracker */}
            {showPlayBar && (
              <div className="scrub-container-premium" style={{ cursor: 'default' }}>
                {/* Visual Track Background */}
                <div 
                  className="scrub-track-bg" 
                  style={{ 
                    position: 'absolute', 
                    width: '100%', 
                    height: '4px', 
                    background: 'rgba(255,255,255,0.2)', 
                    borderRadius: '2px',
                    zIndex: 7
                  }} 
                />
                
                {/* Visual Progress Bar Overlay */}
                <div 
                  className="scrub-track-progress" 
                  style={{ 
                    width: `${(currentTime / (duration || 1)) * 100}%`,
                    height: '4px',
                    background: '#8b5cf6',
                    borderRadius: '2px',
                    position: 'absolute',
                    zIndex: 8
                  }} 
                />

                {/* Render bookmarks on timeline */}
                {bookmarks.map((bm) => {
                  const pct = (bm.time / (duration || 1)) * 100;
                  const isRange = bm.endTime !== undefined && bm.endTime > bm.time;
                  
                  if (isRange && bm.endTime) {
                    const endPct = (bm.endTime / (duration || 1)) * 100;
                    const width = endPct - pct;
                    return (
                      <div 
                        key={bm.id}
                        className={`timeline-bookmark-range ${bm.category?.toLowerCase() || ''}`}
                        style={{ left: `${pct}%`, width: `${width}%` }}
                        title={`${bm.category}: ${bm.title || bm.label}`}
                      />
                    );
                  }
                  return (
                    <div 
                      key={bm.id}
                      className={`timeline-bookmark-dot ${bm.category?.toLowerCase() || ''}`}
                      style={{ left: `${pct}%` }}
                      title={`${bm.category}: ${bm.title || bm.label}`}
                    />
                  );
                })}
              </div>
            )}

            {/* Controls Button Row */}
            <div className="bottom-control-buttons-row">
              <div className="bottom-controls-left-group">
                {showVolumeControl && (
                  <div className="volume-slider-wrapper">
                    <button className="control-btn" onClick={toggleMute}>
                      {isMuted ? <VolumeX size={18} /> : (volume > 0.5 ? <Volume2 size={18} /> : <Volume1 size={18} />)}
                    </button>
                    <input 
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setVolume(val);
                        setIsMuted(val === 0);
                      }}
                      className="volume-slider-bar"
                    />
                  </div>
                )}

                {showTimeDisplay && (
                  <div className="time-display-odometer">
                    <span>{formatTime(currentTime)}</span>
                    <span className="divider">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                )}
              </div>

              <div className="bottom-controls-right-group">
                {/* Native Config button (pointers auto) */}
                <button 
                  className="control-btn control-btn-native"
                  onClick={handleNativeConfigMode}
                  title="Direct Interactive configuration (Subs/Audio/Servers)"
                >
                  <Cpu size={18} />
                  <span style={{ fontSize: '11px', fontWeight: 700, marginLeft: '4px' }}>Stream Config</span>
                </button>

                {/* Lock Controls button */}
                <button className="control-btn" onClick={handleToggleLock} title="Lock Screen Controls">
                  <Lock size={18} />
                </button>

                {/* Timeline bookmark range marking trigger */}
                {markingStartTime === null ? (
                  <button 
                    className="control-btn"
                    onClick={() => {
                      setMarkingStartTime(Math.round(currentTime));
                      addToast("Mark Start Set. Seek to end and click again to save.");
                    }}
                    title="Mark Skip Section"
                  >
                    <BookmarkIcon size={18} />
                  </button>
                ) : (
                  <button 
                    className="control-btn marking-active"
                    onClick={() => {
                      setEditingBookmark(undefined);
                      setShowAddDialog(true);
                    }}
                    title="Complete Skip Section Mark"
                    style={{ background: '#ff7a00', color: 'white', borderRadius: '4px' }}
                  >
                    <BookmarkIcon size={18} fill="white" />
                  </button>
                )}

                {/* Bookmarks popover list */}
                <div className="popover-wrapper">
                  <button 
                    className={`control-btn ${showBookmarksPopover ? 'active' : ''}`}
                    onClick={() => setShowBookmarksPopover(prev => !prev)}
                    title="Bookmarks catalog list"
                  >
                    <List size={18} />
                  </button>

                  {showBookmarksPopover && (
                    <BookmarkPanel 
                      bookmarks={bookmarks}
                      onJump={(time) => {
                        sendIframeCommand('seek', time);
                        setCurrentTime(time);
                        setShowBookmarksPopover(false);
                      }}
                      onEdit={(bm) => {
                        setEditingBookmark(bm);
                        setShowAddDialog(true);
                        setShowBookmarksPopover(false);
                      }}
                      onDelete={handleDeleteBookmark}
                      onAdd={() => {
                        setEditingBookmark(undefined);
                        setShowAddDialog(true);
                        setShowBookmarksPopover(false);
                      }}
                      onClose={() => setShowBookmarksPopover(false)}
                    />
                  )}
                </div>

                {/* Server change configuration */}
                {!isAnime && (
                  <div className="server-overlay-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
                    <select
                      value={server}
                      onChange={(e) => {
                        setServer(e.target.value as any);
                        setCurrentTime(0);
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '6px',
                        color: 'white',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    >
                      <option value="videasy" style={{ background: '#121212' }}>VIDEASY CDN</option>
                      <option value="vidking" style={{ background: '#121212' }}>VIDKING CDN</option>
                    </select>
                  </div>
                )}

                {/* Settings panel trigger */}
                <button 
                  className={`control-btn ${showSettingsPanel ? 'active' : ''}`} 
                  onClick={() => setShowSettingsPanel(prev => !prev)} 
                  title="Player Settings"
                >
                  <Settings size={18} />
                </button>

                {showFullscreen && (
                  <button className="control-btn" onClick={toggleFullscreen}>
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Settings Panel popup */}
          {showSettingsPanel && (
            <div className="player-quick-settings-panel animate-scale-up" onClick={(e) => e.stopPropagation()}>
              <div className="settings-header">
                <h3>Player Preferences</h3>
                <button onClick={() => setShowSettingsPanel(false)}><X size={16} /></button>
              </div>
              <div className="settings-options-list">
                <div className="pref-toggle-row">
                  <span>Auto-Skip Intro & Outro</span>
                  <input 
                    type="checkbox" 
                    checked={autoSkipIntroOutro} 
                    onChange={() => onUpdateVideo(prev => ({ ...prev }), false, undefined, true)} // force save triggers preference update
                  />
                </div>
                <div className="pref-toggle-row">
                  <span>Auto-Skip Explicit Scenes</span>
                  <input 
                    type="checkbox" 
                    checked={autoSkipSexScenes} 
                    onChange={() => onUpdateVideo(prev => ({ ...prev }), false, undefined, true)}
                  />
                </div>
                <div className="pref-toggle-row">
                  <span>Block Timed Seeking</span>
                  <input 
                    type="checkbox" 
                    checked={blockSeekingCompletely} 
                    readOnly
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bookmark Modal */}
      {showAddDialog && (
        <BookmarkModal 
          initialTime={markingStartTime !== null ? markingStartTime : Math.round(currentTime)}
          initialEndTime={markingStartTime !== null ? Math.round(currentTime) : undefined}
          initialBookmark={editingBookmark}
          videoElement={null}
          videoTitle={video.title}
          onSave={handleSaveBookmark}
          onClose={() => {
            setShowAddDialog(false);
            setMarkingStartTime(null);
          }}
        />
      )}
    </div>
  );
};
