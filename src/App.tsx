import { useState, useEffect } from 'react';
import { RemoteVideoPlayer } from './components/RemoteVideoPlayer';
import type { VideoItem } from './types/media';

export const BACKEND_ORIGIN = 'http://127.0.0.1:50001';

const defaultSettings = {
  subSettings: {
    fontSize: 'medium' as const,
    color: 'white' as const,
    backdrop: 'shadow' as const,
    fontFamily: 'sans-serif' as const,
    fontStyle: 'normal' as const,
    customTextColor: '',
    customBgColor: '',
    customSize: 100
  },
  hideUIOverlays: false,
  hideVideoName: false,
  toastDuration: 4.0,
  disableAnimations: false,
  pauseOnFocusChange: false,
  showPlayButton: true,
  showTimeDisplay: true,
  showPlayBar: true,
  showVolumeControl: true,
  showFullscreen: true,
  historySaveInterval: 5,
  saveVolume: true,
  ratingThreshold: 3,
  getOverlayDataFromTmdb: true,
  overlayPosition: 'bottom-left' as const,
  overlayShowBackground: true,
  overlayShowRating: true,
  overlayShowOverview: true,
  openSubtitlesApiKey: '',
  allowUiSkipping: true,
  blockSeekingCompletely: false,
  autoSkipIntroOutro: true,
  autoSkipSexScenes: true,
  lockModeActive: false,
  settingsOrder: [
    'hideUIOverlays', 'hideVideoName', 'showPlayButton', 'showTimeDisplay', 'showPlayBar', 'showVolumeControl',
    'showFullscreen', 'disableAnimations', 'pauseOnFocusChange', 'allowUiSkipping', 'blockSeekingCompletely', 'autoSkipIntroOutro', 'lockModeActive'
  ],
  uiHideTimeout: 1.5,
  customLoaderUrl: '',
  customLoaderType: 'default' as const,
  spinnerPreset: 'fire-circle'
};

function App() {
  const [video, setVideo] = useState<VideoItem | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    const fileParam = params.get('file');
    const assetId = params.get('assetId');

    if (assetId) {
      // Immich asset — proxy through Valor backend (internal Docker network)
      const proxyUrl = `${BACKEND_ORIGIN}/immich-proxy?assetId=${encodeURIComponent(assetId)}`;
      setVideo({
        id: assetId,
        title: params.get('title') || 'Immich Video',
        type: 'remote',
        url: proxyUrl,
        addedAt: new Date().toISOString(),
        progress: 0,
        duration: 0,
        audioTracks: [],
        subtitleTracks: []
      });
    } else if (fileParam) {
      const localStreamUrl = `${BACKEND_ORIGIN}/local-video-stream?path=${encodeURIComponent(fileParam)}`;
      setVideo({
        id: '1',
        title: fileParam.split(/[\\/]/).pop() || fileParam,
        type: 'local',
        localFilePath: fileParam,
        url: localStreamUrl,
        addedAt: new Date().toISOString(),
        progress: 0,
        duration: 0,
        audioTracks: [],
        subtitleTracks: []
      });
    } else if (urlParam) {
      setVideo({
        id: '2',
        title: urlParam.split(/[\\/]/).pop() || urlParam,
        type: 'remote',
        url: urlParam,
        addedAt: new Date().toISOString(),
        progress: 0,
        duration: 0,
        audioTracks: [],
        subtitleTracks: []
      });
    }
  }, []);

  if (!video) {
    return <div style={{ color: 'white', padding: 20 }}>No video provided. Use ?url= or ?file=</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black', overflow: 'hidden' }}>
      <RemoteVideoPlayer
        video={video}
        onBack={() => {}}
        onUpdateVideo={(updater) => {
          setVideo(prev => typeof updater === 'function' ? updater(prev!) : (updater as any));
        }}
        subSettings={defaultSettings.subSettings}
        onUpdateSubSettings={() => {}}
        onUpdateSettings={() => {}}
        {...defaultSettings}
      />
    </div>
  );
}

export default App;
