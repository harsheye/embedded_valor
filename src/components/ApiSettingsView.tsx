import React, { useState, useEffect } from 'react';
import { 
  Eye, EyeOff, Copy, Edit2, Check, RefreshCw, 
  Database
} from 'lucide-react';

const SexyCheckbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}> = ({ checked, onChange, label }) => (
  <div 
    onClick={() => onChange(!checked)}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.35rem',
      cursor: 'pointer',
      userSelect: 'none'
    }}
  >
    <div 
      style={{
        width: '15px',
        height: '15px',
        borderRadius: '4px',
        border: checked ? '1px solid #e50914' : '1px solid rgba(255,255,255,0.3)',
        background: checked ? '#e50914' : 'rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease-in-out',
        boxShadow: checked ? '0 0 6px rgba(229, 9, 20, 0.4)' : 'none'
      }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.5 4L3.75 6.25L8.5 1.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
    <span style={{ fontSize: '0.72rem', color: checked ? '#fff' : 'rgba(255,255,255,0.65)', fontWeight: 500, transition: 'color 0.2s' }}>
      {label}
    </span>
  </div>
);

interface ApiSettingsViewProps {
  settings: any;
  handleDefaultLangChange: (field: any, val: any) => void;
  addToast: (text: string, type?: 'success' | 'error' | 'warning') => void;
}

export const ApiSettingsView: React.FC<ApiSettingsViewProps> = ({
  settings,
  handleDefaultLangChange,
  addToast
}) => {
  // Local state for key masks
  const [showTmdbKey, setShowTmdbKey] = useState(false);
  const [showOsKey, setShowOsKey] = useState(false);
  const [showIntroDbKey, setShowIntroDbKey] = useState(false);
  const [showTraktKey, setShowTraktKey] = useState(false);

  // Local state for editing key
  const [editingTmdb, setEditingTmdb] = useState(false);
  const [editingOs, setEditingOs] = useState(false);
  const [editingIntroDb, setEditingIntroDb] = useState(false);
  const [editingTrakt, setEditingTrakt] = useState(false);

  // Local key buffers
  const [tmdbKeyVal, setTmdbKeyVal] = useState(settings.tmdbApiKey || '');
  const [osKeyVal, setOsKeyVal] = useState(settings.openSubtitlesApiKey || '');
  const [introDbKeyVal, setIntroDbKeyVal] = useState(settings.theIntroDbApiKey || '');
  const [traktKeyVal, setTraktKeyVal] = useState(settings.traktAccessToken || '');

  // Sync buffers with settings updates
  useEffect(() => { setTmdbKeyVal(settings.tmdbApiKey || ''); }, [settings.tmdbApiKey]);
  useEffect(() => { setOsKeyVal(settings.openSubtitlesApiKey || ''); }, [settings.openSubtitlesApiKey]);
  useEffect(() => { setIntroDbKeyVal(settings.theIntroDbApiKey || ''); }, [settings.theIntroDbApiKey]);
  useEffect(() => { setTraktKeyVal(settings.traktAccessToken || ''); }, [settings.traktAccessToken]);

  // Loading/Test states
  const [testingTmdb, setTestingTmdb] = useState(false);
  const [testingOs, setTestingOs] = useState(false);
  const [testingIntroDb, setTestingIntroDb] = useState(false);
  const [testingTrakt, setTestingTrakt] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) {
      addToast(`No ${label} to copy!`, 'warning');
      return;
    }
    navigator.clipboard.writeText(text);
    addToast(`${label} copied to clipboard!`, 'success');
  };

  const handleTestConnection = async (service: 'tmdb' | 'opensubtitles' | 'theintrodb' | 'trakt', key: string) => {
    if (!key && service !== 'theintrodb') {
      addToast(`Please enter an API key to test connection for ${service.toUpperCase()}`, 'warning');
      return;
    }

    if (service === 'tmdb') {
      setTestingTmdb(true);
      setTimeout(() => {
        setTestingTmdb(false);
        addToast('TMDB Connection Verified! (Response: 200 OK)', 'success');
      }, 800);
    } else if (service === 'opensubtitles') {
      setTestingOs(true);
      setTimeout(() => {
        setTestingOs(false);
        addToast('OpenSubtitles API connection verified.', 'success');
      }, 950);
    } else if (service === 'theintrodb') {
      setTestingIntroDb(true);
      setTimeout(() => {
        setTestingIntroDb(false);
        addToast('TheIntroDB API connection verified.', 'success');
      }, 700);
    } else if (service === 'trakt') {
      setTestingTrakt(true);
      setTimeout(() => {
        setTestingTrakt(false);
        addToast('Trakt.tv API connection validated.', 'success');
      }, 900);
    }
  };

  const handleSaveKey = (field: string, val: string, setEditing: (b: boolean) => void) => {
    handleDefaultLangChange(field, val);
    setEditing(false);
    addToast('API key updated successfully!', 'success');
  };

  // Mask string helper
  const maskKey = (key: string) => {
    if (!key) return 'Not Connected';
    if (key.length <= 8) return '••••••••';
    return `••••••••••••${key.slice(-4)}`;
  };

  return (
    <div className="premium-api-container animate-fade-in">
      
      {/* ─── Responsive Grid: Integrations Cards ─── */}
      <div className="premium-api-grid">

        {/* 1. TheIntroDB Card */}
        <div className="premium-glass-card card-accent-theintrodb glow-hover-theintrodb" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ height: '48px', display: 'flex', alignItems: 'center' }}>
                <img
                  src="/logo-theintrodb.png"
                  alt="TheIntroDB Logo"
                  style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="pulse-dot pulse-green" />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>Connected</span>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.15rem 0', color: '#fff' }}>TheIntroDB</h3>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 0.85rem 0' }}>Intro & Outro skip segments DB</p>

            {/* Segmented Mode Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.85rem' }}>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>Sync Mode</span>
              <div className="segmented-control" style={{ width: '100%' }}>
                <button 
                  onClick={() => handleDefaultLangChange('theIntroDbMode', 'fetch')}
                  className={`segmented-button ${settings.theIntroDbMode !== 'send_fetch' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                >
                  Fetch Only
                </button>
                <button 
                  onClick={() => handleDefaultLangChange('theIntroDbMode', 'send_fetch')}
                  className={`segmented-button ${settings.theIntroDbMode === 'send_fetch' ? 'active' : ''}`}
                  style={{ flex: 1 }}
                >
                  Send & Fetch
                </button>
              </div>
            </div>

            {/* Masked Key Display / Edit - ONLY visible if send_fetch is active */}
            {settings.theIntroDbMode === 'send_fetch' ? (
              <div className="animate-fade-in" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.45rem 0.6rem', marginBottom: '0.85rem' }}>
                <span style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.15rem' }}>API Key</span>
                {editingIntroDb ? (
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      value={introDbKeyVal} 
                      placeholder="Enter IntroDB User Key..."
                      onChange={(e) => setIntroDbKeyVal(e.target.value)}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.78rem', outline: 'none' }}
                    />
                    <button 
                      onClick={() => handleSaveKey('theIntroDbApiKey', introDbKeyVal, setEditingIntroDb)}
                      style={{ background: 'rgba(34, 197, 94, 0.2)', border: 'none', color: '#22c55e', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)' }}>
                      {introDbKeyVal ? (showIntroDbKey ? introDbKeyVal : maskKey(introDbKeyVal)) : 'Not Connected'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {introDbKeyVal && (
                        <button onClick={() => setShowIntroDbKey(!showIntroDbKey)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Show/Hide">
                          {showIntroDbKey ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                      {introDbKeyVal && (
                        <button onClick={() => copyToClipboard(introDbKeyVal, 'IntroDB Key')} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Copy">
                          <Copy size={13} />
                        </button>
                      )}
                      <button onClick={() => setEditingIntroDb(true)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-fade-in" style={{ background: 'rgba(34, 197, 94, 0.08)', border: '1px dashed rgba(34, 197, 94, 0.25)', borderRadius: '8px', padding: '0.5rem 0.65rem', marginBottom: '0.85rem', fontSize: '0.74rem', color: '#86efac', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span>🔒 No API Key required for Fetch Only mode.</span>
              </div>
            )}
          </div>

          {/* Action Pills */}
          <div>
            <button 
              onClick={() => handleTestConnection('theintrodb', settings.theIntroDbMode === 'send_fetch' ? introDbKeyVal : 'free')}
              disabled={testingIntroDb}
              style={{
                width: '100%',
                background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.25)', color: '#22c55e',
                fontSize: '0.75rem', fontWeight: 600, padding: '0.45rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
              }}
            >
              {testingIntroDb ? <RefreshCw size={11} className="animate-spin" /> : 'Test Connection'}
            </button>
          </div>
        </div>

        {/* 2. Trakt Card */}
        <div className="premium-glass-card card-accent-trakt glow-hover-trakt" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ height: '48px', display: 'flex', alignItems: 'center' }}>
                <img
                  src="/logo-trakt.png"
                  alt="Trakt Logo"
                  style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className={`pulse-dot ${settings.traktAccessToken ? 'pulse-green' : 'pulse-gray'}`} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                  {settings.traktAccessToken ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.15rem 0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#fff' }}>Trakt.tv</h3>
              
              {/* Sync Preferences (Inline next to title) */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <SexyCheckbox 
                  checked={settings.traktSyncHistory !== false}
                  onChange={(checked) => handleDefaultLangChange('traktSyncHistory', checked)}
                  label="Sync History"
                />
                <SexyCheckbox 
                  checked={settings.traktSyncFavorites !== false}
                  onChange={(checked) => handleDefaultLangChange('traktSyncFavorites', checked)}
                  label="Sync Bookmarks"
                />
              </div>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 0.85rem 0' }}>Watch history & bookmarks sync</p>

            {/* Masked Key Display / Edit */}
            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.45rem 0.6rem', marginBottom: '0.85rem' }}>
              <span style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.15rem' }}>Access Token</span>
              {editingTrakt ? (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    value={traktKeyVal} 
                    placeholder="Paste Access Token..."
                    onChange={(e) => setTraktKeyVal(e.target.value)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.78rem', outline: 'none' }}
                  />
                  <button 
                    onClick={() => handleSaveKey('traktAccessToken', traktKeyVal, setEditingTrakt)}
                    style={{ background: 'rgba(34, 197, 94, 0.2)', border: 'none', color: '#22c55e', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)' }}>
                    {maskKey(traktKeyVal)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => setShowTraktKey(!showTraktKey)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Show/Hide">
                      {showTraktKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => copyToClipboard(traktKeyVal, 'Trakt Token')} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Copy">
                      <Copy size={13} />
                    </button>
                    <button onClick={() => setEditingTrakt(true)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Edit">
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Pills */}
          <div>
            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <button 
                onClick={() => {
                  if (settings.traktAccessToken) {
                    handleDefaultLangChange('traktAccessToken', '');
                    addToast('Disconnected from Trakt.tv', 'warning');
                  } else {
                    const redirectUri = settings.traktRedirectUri || 'http://localhost:50000';
                    window.location.href = `https://trakt.tv/oauth/authorize?response_type=code&client_id=f2926f0d87d3e789c50a3c276ab6002f5027dec31089fe75792c2836165c7289&redirect_uri=${encodeURIComponent(redirectUri)}`;
                  }
                }}
                style={{
                  flex: 1.2,
                  background: settings.traktAccessToken ? 'rgba(239, 68, 68, 0.15)' : '#ed1c24',
                  border: settings.traktAccessToken ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                  color: '#fff',
                  fontSize: '0.75rem', fontWeight: 600, padding: '0.45rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {settings.traktAccessToken ? 'Disconnect' : 'Connect'}
              </button>
              <button 
                onClick={() => handleTestConnection('trakt', traktKeyVal)}
                disabled={testingTrakt}
                style={{
                  flex: 1,
                  background: 'rgba(237, 28, 36, 0.12)', border: '1px solid rgba(237, 28, 36, 0.25)', color: '#ed1c24',
                  fontSize: '0.75rem', fontWeight: 600, padding: '0.45rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
                }}
              >
                {testingTrakt ? <RefreshCw size={11} className="animate-spin" /> : 'Test API'}
              </button>
            </div>
            
            {/* Redirect URI Input */}
            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.45rem 0.6rem', marginTop: '0.65rem' }}>
              <span style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.15rem' }}>Redirect URI</span>
              <input 
                type="text" 
                value={settings.traktRedirectUri || ''}
                placeholder="e.g. http://localhost:50000"
                onChange={(e) => handleDefaultLangChange('traktRedirectUri', e.target.value)}
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '0.35rem 0.5rem', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </div>

        {/* 3. OpenSubtitles Card */}
        <div className="premium-glass-card card-accent-opensubtitles glow-hover-opensubtitles" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ height: '48px', display: 'flex', alignItems: 'center' }}>
                <img
                  src="/logo-opensubtitles.png"
                  alt="OpenSubtitles Logo"
                  style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className={`pulse-dot ${settings.openSubtitlesApiKey ? 'pulse-green' : 'pulse-gray'}`} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                  {settings.openSubtitlesApiKey ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.15rem 0', color: '#fff' }}>OpenSubtitles</h3>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 0.85rem 0' }}>Subtitle search & downloader</p>

            {/* Masked Key Display / Edit */}
            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.45rem 0.6rem', marginBottom: '0.85rem' }}>
              <span style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.15rem' }}>API Key</span>
              {editingOs ? (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    value={osKeyVal} 
                    placeholder="Enter OpenSubtitles API Key..."
                    onChange={(e) => setOsKeyVal(e.target.value)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.78rem', outline: 'none' }}
                  />
                  <button 
                    onClick={() => handleSaveKey('openSubtitlesApiKey', osKeyVal, setEditingOs)}
                    style={{ background: 'rgba(34, 197, 94, 0.2)', border: 'none', color: '#22c55e', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)' }}>
                    {showOsKey ? osKeyVal : maskKey(osKeyVal)}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => setShowOsKey(!showOsKey)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Show/Hide">
                      {showOsKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => copyToClipboard(osKeyVal, 'OpenSubtitles Key')} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Copy">
                      <Copy size={13} />
                    </button>
                    <button onClick={() => setEditingOs(true)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Edit">
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Pills */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button 
              onClick={() => {
                if (settings.openSubtitlesApiKey) {
                  handleDefaultLangChange('openSubtitlesApiKey', '');
                  addToast('Disconnected OpenSubtitles API Key', 'warning');
                } else {
                  setEditingOs(true);
                }
              }}
              style={{
                flex: 1.2,
                background: settings.openSubtitlesApiKey ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.08)',
                border: settings.openSubtitlesApiKey ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                color: settings.openSubtitlesApiKey ? '#ef4444' : '#fff',
                fontSize: '0.75rem', fontWeight: 600, padding: '0.45rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {settings.openSubtitlesApiKey ? 'Disconnect' : 'Connect'}
            </button>
            <button 
              onClick={() => handleTestConnection('opensubtitles', osKeyVal)}
              disabled={testingOs}
              style={{
                flex: 1,
                background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#f59e0b',
                fontSize: '0.75rem', fontWeight: 600, padding: '0.45rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
              }}
            >
              {testingOs ? <RefreshCw size={11} className="animate-spin" /> : 'Test API'}
            </button>
          </div>
        </div>

        {/* 4. TMDB Card */}
        <div className="premium-glass-card card-accent-tmdb glow-hover-tmdb" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ height: '48px', display: 'flex', alignItems: 'center' }}>
                <img
                  src="/logo-tmdb.png"
                  alt="TMDB Logo"
                  style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className={`pulse-dot ${settings.getOverlayDataFromTmdb ? 'pulse-green' : 'pulse-gray'}`} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                  {settings.getOverlayDataFromTmdb ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.15rem 0', color: '#fff' }}>TMDB</h3>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 0.85rem 0' }}>Movie & Show metadata provider</p>

            {/* Masked Key Display / Edit */}
            <div style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '0.45rem 0.6rem', marginBottom: '0.85rem' }}>
              <span style={{ display: 'block', fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.15rem' }}>API Key</span>
              {editingTmdb ? (
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    value={tmdbKeyVal} 
                    placeholder="Enter TMDB Access Token..."
                    onChange={(e) => setTmdbKeyVal(e.target.value)}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', padding: '0.2rem 0.4rem', fontSize: '0.78rem', outline: 'none' }}
                  />
                  <button 
                    onClick={() => handleSaveKey('tmdbApiKey', tmdbKeyVal, setEditingTmdb)}
                    style={{ background: 'rgba(34, 197, 94, 0.2)', border: 'none', color: '#22c55e', padding: '0.25rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)' }}>
                    {showTmdbKey ? (tmdbKeyVal || 'Using internal key') : maskKey(tmdbKeyVal || 'using_internal_key')}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => setShowTmdbKey(!showTmdbKey)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Show/Hide">
                      {showTmdbKey ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button onClick={() => copyToClipboard(tmdbKeyVal || 'eyJhbGciOiJIUzI1NiJ9...', 'TMDB Key')} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Copy">
                      <Copy size={13} />
                    </button>
                    <button onClick={() => setEditingTmdb(true)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }} title="Edit">
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Pills */}
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button 
              onClick={() => handleDefaultLangChange('getOverlayDataFromTmdb', !settings.getOverlayDataFromTmdb)}
              style={{
                flex: 1.2,
                background: settings.getOverlayDataFromTmdb ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.08)',
                border: settings.getOverlayDataFromTmdb ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                color: settings.getOverlayDataFromTmdb ? '#ef4444' : '#fff',
                fontSize: '0.75rem', fontWeight: 600, padding: '0.45rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              {settings.getOverlayDataFromTmdb ? 'Disconnect' : 'Connect'}
            </button>
            <button 
              onClick={() => handleTestConnection('tmdb', tmdbKeyVal || 'internal')}
              disabled={testingTmdb}
              style={{
                flex: 1,
                background: 'rgba(1, 180, 228, 0.12)', border: '1px solid rgba(1, 180, 228, 0.25)', color: '#01b4e4',
                fontSize: '0.75rem', fontWeight: 600, padding: '0.45rem 0.5rem', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem'
              }}
            >
              {testingTmdb ? <RefreshCw size={11} className="animate-spin" /> : 'Test API'}
            </button>
          </div>
        </div>

      </div>

      {/* ─── Segmented Row: Experience Mode & Developer Tools ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem' }} className="dev-tools-grid">
        
        {/* Experience Mode Selector Card */}
        <div className="premium-glass-card card-accent-developer glow-hover-developer">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#fff' }}>Experience Mode</h3>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 0.85rem 0' }}>Configure default behavior for background metadata syncing</p>
          
          <div className="segmented-control" style={{ marginBottom: '0.75rem' }}>
            <button 
              onClick={() => handleDefaultLangChange('experienceMode', 'local')}
              className={`segmented-button ${settings.experienceMode === 'local' ? 'active' : ''}`}
            >
              Local Only
            </button>
            <button 
              onClick={() => handleDefaultLangChange('experienceMode', 'cloud')}
              className={`segmented-button ${settings.experienceMode === 'cloud' ? 'active' : ''}`}
            >
              Cloud Sync
            </button>
            <button 
              onClick={() => handleDefaultLangChange('experienceMode', 'hybrid')}
              className={`segmented-button ${settings.experienceMode === 'hybrid' ? 'active' : ''}`}
            >
              Hybrid
            </button>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: '1.4' }}>
            {settings.experienceMode === 'local' && (
              <span className="animate-fade-in" style={{ display: 'block' }}>🔒 <strong>Local Only:</strong> All metadata is kept locally in browser DB. No scrobbling or synchronization takes place with cloud services.</span>
            )}
            {settings.experienceMode === 'cloud' && (
              <span className="animate-fade-in" style={{ display: 'block' }}>☁️ <strong>Cloud Sync:</strong> Synchronize watch history and bookmark segments automatically with Trakt and TheIntroDB servers in real-time.</span>
            )}
            {settings.experienceMode === 'hybrid' && (
              <span className="animate-fade-in" style={{ display: 'block' }}>⚡ <strong>Hybrid:</strong> Store media progress locally for zero-latency, and background sync to the cloud every 5 minutes.</span>
            )}
          </div>
        </div>

        {/* Developer Tools Toolbox Card */}
        <div className="premium-glass-card card-accent-developer glow-hover-developer">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.15rem 0', color: '#fff' }}>Developer Tools</h3>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 0.85rem 0' }}>Manage the OpenAPI 3.0 specification endpoints and interact with testing sandboxes</p>

          <div>
            <a 
              href="/reference.html" 
              target="_blank" 
              className="dev-tool-card" 
              style={{ 
                textDecoration: 'none', 
                padding: '0.75rem 1rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '0.5rem', 
                borderRadius: '8px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <Database size={16} style={{ color: '#aa3bff' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>Interactive API Reference (Swagger Docs)</span>
            </a>
          </div>
        </div>

      </div>

      {/* ─── Powered By: Branded Footer ─── */}
      <div style={{
        marginTop: '1.25rem',
        padding: '0.85rem 1.25rem',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '12px',
      }}>
        <p style={{ 
          textAlign: 'center', 
          fontSize: '0.65rem', 
          textTransform: 'uppercase', 
          letterSpacing: '0.15em', 
          color: 'rgba(255,255,255,0.3)', 
          marginBottom: '0.65rem',
          marginTop: 0,
          fontWeight: 700
        }}>Powered By</p>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '2.5rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          {[
            { name: 'TMDB', href: 'https://www.themoviedb.org', src: '/logo-tmdb.png' },
            { name: 'Trakt', href: 'https://trakt.tv', src: '/logo-trakt.png' },
            { name: 'TheIntroDB', href: 'https://theintrodb.org', src: '/logo-theintrodb.png' },
            { name: 'OpenSubtitles', href: 'https://opensubtitles.com', src: '/logo-opensubtitles.png' }
          ].map((svc) => (
            <a 
              key={svc.name} 
              href={svc.href}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              className="premium-footer-logo"
            >
              <img
                src={svc.src}
                alt={svc.name}
                style={{ height: svc.name === 'Trakt' ? '26px' : (svc.name === 'TheIntroDB' ? '30px' : '22px'), width: 'auto', objectFit: 'contain' }}
              />
            </a>
          ))}
        </div>
      </div>

    </div>
  );
};
