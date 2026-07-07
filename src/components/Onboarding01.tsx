import {
  IconArchive,
  IconChevronRight,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconDots,
  IconMail,
} from '@tabler/icons-react';
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent } from './ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';
import { CustomSelect } from './CustomSelect';
import { BACKEND_ORIGIN } from '../App';

const initialSteps = [
  {
    id: 'profile',
    title: 'Select User Profile',
    description: 'Select an existing profile, create a server profile, or start with a local profile.',
    completed: false,
    actionLabel: 'Confirm Profile Selection',
    actionHref: '#'
  },
  {
    id: 'storage',
    title: 'Choose Storage Location',
    description: 'Select how Valor should save your settings, ratings, and playback history.',
    completed: false,
    actionLabel: 'Confirm Storage Location',
    actionHref: '#'
  },
  {
    id: 'languages',
    title: 'Preferred Languages',
    description: 'Set your preferred default audio track and subtitle language.',
    completed: false,
    actionLabel: 'Save Preferences',
    actionHref: '#'
  },
  {
    id: 'ready',
    title: 'Ready to stream!',
    description: 'You are all set to start using Valor.',
    completed: false,
    actionLabel: 'Get Started with Valor',
    actionHref: '#'
  }
];

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  actionLabel: string;
  actionHref: string;
}

interface Onboarding01Props {
  settings: any;
  handleDefaultLangChange: (key: string, val: any) => void;
  audioOptions: any[];
  subOptions: any[];
  onComplete: () => void;
  onSelectProfile: (userId: string, storageMode: 'localstorage' | 'file') => void;
  videos: any[];
  openAuthModal: (tab: 'login' | 'signup', targetProfile?: any, onSuccess?: (userId: string) => void) => void;
}

function CircularProgress({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const progress = total > 0 ? ((total - completed) / total) * 100 : 0;
  const strokeDashoffset = 100 - progress;

  return (
    <svg
      className="-rotate-90"
      height="14"
      viewBox="0 0 14 14"
      width="14"
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx="7"
        cy="7"
        fill="none"
        r="6"
        strokeWidth="2"
        stroke="rgba(255,255,255,0.12)"
      />
      <circle
        cx="7"
        cy="7"
        fill="none"
        r="6"
        strokeDasharray="100"
        strokeLinecap="round"
        strokeWidth="2"
        stroke="#3b82f6"
        style={{ strokeDashoffset }}
      />
    </svg>
  );
}

function StepIndicator({ completed }: { completed: boolean }) {
  if (completed) {
    return (
      <IconCircleCheckFilled
        aria-hidden="true"
        className="mt-1 size-4.5 shrink-0 text-primary"
        style={{ width: '18px', height: '18px', color: '#3b82f6' }}
      />
    );
  }
  return (
    <IconCircleDashed
      aria-hidden="true"
      className="mt-1 size-5 shrink-0 stroke-muted-foreground/40"
      strokeWidth={2}
      style={{ width: '20px', height: '20px', color: 'rgba(255,255,255,0.25)' }}
    />
  );
}

export function Onboarding01({
  settings,
  handleDefaultLangChange,
  audioOptions,
  subOptions,
  onComplete,
  onSelectProfile,
  videos,
  openAuthModal
}: Onboarding01Props) {
  const [currentSteps, setCurrentSteps] = useState<OnboardingStep[]>(initialSteps);
  const [openStepId, setOpenStepId] = useState<string | null>(() => {
    const firstIncomplete = initialSteps.find((s) => !s.completed);
    return firstIncomplete?.id ?? initialSteps[0]?.id ?? null;
  });
  const [dismissed, setDismissed] = useState(false);

  // Profile-related states
  const [profiles, setProfiles] = useState<any[]>([]);
  const [onboardingError, setOnboardingError] = useState('');
  const [hasConfiguredProfile, setHasConfiguredProfile] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [chosenMode, setChosenMode] = useState<'server' | 'local' | null>(null);
  const [localProfileName, setLocalProfileName] = useState('');
  const [serverUsername, setServerUsername] = useState('');
  const [serverPassword, setServerPassword] = useState('');

  const secureFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const ipBlockedUntil = localStorage.getItem('valor_ip_blocked_until');
    const accountLockedUntil = localStorage.getItem('valor_account_locked_until');
    const now = Date.now();
    
    if (ipBlockedUntil && new Date(ipBlockedUntil).getTime() > now) {
      const msg = `IP blocked until ${new Date(ipBlockedUntil).toLocaleString()}`;
      setOnboardingError(msg);
      throw new Error(msg);
    }
    
    if (accountLockedUntil && new Date(accountLockedUntil).getTime() > now) {
      const msg = `Account locked until ${new Date(accountLockedUntil).toLocaleString()}`;
      setOnboardingError(msg);
      throw new Error(msg);
    }
    
    const response = await fetch(input, init);
    
    if (response.status === 403) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        if (data.blockedUntil) {
          localStorage.setItem('valor_ip_blocked_until', data.blockedUntil);
          setOnboardingError(`IP blocked until ${new Date(data.blockedUntil).toLocaleString()}`);
        }
        if (data.lockedUntil) {
          localStorage.setItem('valor_account_locked_until', data.lockedUntil);
          setOnboardingError(`Account locked until ${new Date(data.lockedUntil).toLocaleString()}`);
        }
      } catch (e) {}
    }
    
    return response;
  };

  // Fetch server profiles on mount
  React.useEffect(() => {
    secureFetch(`${BACKEND_ORIGIN}/api/profiles`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setProfiles(data);
      })
      .catch(err => console.error('Failed to fetch server profiles:', err));
  }, []);

  // Configuration tracking to prevent moving forward without configuring
  const [hasConfiguredStorage, setHasConfiguredStorage] = useState(false);
  const [hasConfiguredLanguages, setHasConfiguredLanguages] = useState(false);

  const completedCount = currentSteps.filter((s) => s.completed).length;
  const remainingCount = currentSteps.length - completedCount;

  const handleStepClick = (stepId: string) => {
    setOpenStepId(openStepId === stepId ? null : stepId);
  };

  const handleStepAction = (step: OnboardingStep) => {
    const updated = currentSteps.map((s) =>
      s.id === step.id ? { ...s, completed: true } : s
    );
    setCurrentSteps(updated);
    const nextIncomplete = updated.find((s) => !s.completed);
    setOpenStepId(nextIncomplete?.id ?? null);
    
    if (updated.every(s => s.completed) || step.id === 'ready') {
      onComplete();
    }
  };

  const isStepConfigured = (stepId: string) => {
    if (stepId === 'profile') return hasConfiguredProfile;
    if (stepId === 'storage') return hasConfiguredStorage;
    if (stepId === 'languages') return hasConfiguredLanguages;
    return true; // Hotkeys and Ready steps require no special setup to proceed
  };

  const renderValorControls = (stepId: string) => {
    if (stepId === 'profile') {
      const activeUserId = settings.userId;

      const autoAdvance = () => {
        const step = currentSteps.find(s => s.id === 'profile');
        if (step) {
          handleStepAction(step);
        }
      };

      if (chosenMode === null) {
        return (
          <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
              Select where you want to keep your settings and watch history. Server profiles sync across your network, while Local profiles are kept in this browser.
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { setChosenMode('server'); setOnboardingError(''); }}
                style={{
                  padding: '16px',
                  background: 'rgba(59,130,246,0.06)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.06)'}
              >
                <span style={{ fontSize: '1.5rem' }}>🗄️</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Server File Save</span>
              </button>
              <button
                type="button"
                onClick={() => { setChosenMode('local'); setOnboardingError(''); }}
                style={{
                  padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <span style={{ fontSize: '1.5rem' }}>💻</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Local Storage</span>
              </button>
            </div>
          </div>
        );
      }

      if (chosenMode === 'local') {
        return (
          <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Configure Local Profile Name:</span>
            <input
              type="text"
              placeholder="e.g. My Local Profile"
              value={localProfileName}
              onChange={e => setLocalProfileName(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '0.8rem',
                color: '#fff',
                outline: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                disabled={!localProfileName.trim()}
                onClick={() => {
                  const newUserId = 'local_' + Math.random().toString(36).substring(2, 11);
                  localStorage.setItem('valor_active_user_id', newUserId);
                  
                  let localProfiles = [];
                  try {
                    const localSaved = localStorage.getItem('valor_local_profiles');
                    if (localSaved) {
                      localProfiles = JSON.parse(localSaved);
                    }
                  } catch {}
                  
                  const newProfile = {
                    userId: newUserId,
                    name: localProfileName.trim(),
                    storageMode: 'localstorage',
                    hasPassword: false
                  };
                  localProfiles.push(newProfile);
                  localStorage.setItem('valor_local_profiles', JSON.stringify(localProfiles));
                  
                  onSelectProfile(newUserId, 'localstorage');
                  
                  try {
                    const settingsKey = `valor_settings_${newUserId}`;
                    const saved = localStorage.getItem(settingsKey) || '{}';
                    const parsed = JSON.parse(saved);
                    parsed.profileName = localProfileName.trim();
                    parsed.userId = newUserId;
                    parsed.storageMode = 'localstorage';
                    localStorage.setItem(settingsKey, JSON.stringify(parsed));
                  } catch {}
                  
                  setHasConfiguredProfile(true);
                  autoAdvance();
                }}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: localProfileName.trim() ? 'pointer' : 'not-allowed',
                  opacity: localProfileName.trim() ? 1 : 0.6
                }}
              >
                Save & Continue
              </button>
              <button
                type="button"
                onClick={() => { setChosenMode(null); setLocalProfileName(''); }}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                Back
              </button>
            </div>
          </div>
        );
      }

      return (
        <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {onboardingError && (
            <div style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              fontSize: '0.72rem',
              padding: '0.5rem',
              borderRadius: '6px',
              fontWeight: 500
            }}>
              ⚠️ {onboardingError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>Username</label>
            <input
              type="text"
              placeholder="Enter username..."
              value={serverUsername}
              onChange={e => setServerUsername(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.85rem',
                color: '#fff',
                outline: 'none',
                fontFamily: 'Outfit, sans-serif',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>Password</label>
            <input
              type="password"
              placeholder="Enter password..."
              value={serverPassword}
              onChange={e => setServerPassword(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '0.85rem',
                color: '#fff',
                outline: 'none',
                fontFamily: 'Outfit, sans-serif',
                transition: 'border-color 0.2s'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              disabled={!serverUsername.trim() || !serverPassword}
              onClick={async () => {
                setOnboardingError('');
                const profileName = serverUsername.trim();
                try {
                  const res = await secureFetch(`${BACKEND_ORIGIN}/api/profile/migrate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      name: profileName, 
                      username: serverUsername.trim(),
                      password: serverPassword,
                      settings: { ...settings, isOnboarded: false },
                      history: videos 
                    })
                  });
                  const resData = await res.json();
                  if (resData.success) {
                    onSelectProfile(resData.userId, 'file');
                    setHasConfiguredProfile(true);
                    setServerUsername('');
                    setServerPassword('');
                    autoAdvance();
                  } else {
                    setOnboardingError(resData.error || 'Failed to create profile');
                  }
                } catch (err: any) {
                  setOnboardingError(err.message || 'Creation failed.');
                }
              }}
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: (serverUsername.trim() && serverPassword) ? 'pointer' : 'not-allowed',
                opacity: (serverUsername.trim() && serverPassword) ? 1 : 0.6
              }}
            >
              Create & Sync
            </button>

            <button
              type="button"
              disabled={!serverUsername.trim() || !serverPassword}
              onClick={async () => {
                setOnboardingError('');
                try {
                  const res = await secureFetch(`${BACKEND_ORIGIN}/api/profile/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: serverUsername.trim(), password: serverPassword })
                  });
                  const resData = await res.json();
                  if (resData.success) {
                    onSelectProfile(resData.userId, 'file');
                    setHasConfiguredProfile(true);
                    setServerUsername('');
                    setServerPassword('');
                    autoAdvance();
                  } else {
                    setOnboardingError(resData.error || 'Incorrect username or password');
                  }
                } catch (err: any) {
                  setOnboardingError(err.message || 'Login failed.');
                }
              }}
              style={{
                background: '#2ecc71',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: (serverUsername.trim() && serverPassword) ? 'pointer' : 'not-allowed',
                opacity: (serverUsername.trim() && serverPassword) ? 1 : 0.6
              }}
            >
              Login & Sync
            </button>

            <button
              type="button"
              onClick={() => { setChosenMode(null); setServerUsername(''); setServerPassword(''); }}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              Back
            </button>
          </div>

          {profiles.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>Or Select Existing Profile:</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
                {profiles.map(p => {
                  const isSelected = activeUserId === p.userId;
                  return (
                    <div
                      key={p.userId}
                      onClick={() => {
                        setOnboardingError('');
                        if (p.hasPassword) {
                          openAuthModal('login', p, (userId) => {
                            onSelectProfile(userId, 'file');
                            setHasConfiguredProfile(true);
                            autoAdvance();
                          });
                        } else {
                          onSelectProfile(p.userId, 'file');
                          setHasConfiguredProfile(true);
                          autoAdvance();
                        }
                      }}
                      style={{
                        background: isSelected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                        border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        padding: '14px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        }
                      }}
                    >
                      {/* Premium Profile Avatar Circle */}
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: isSelected ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        color: '#fff',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                        position: 'relative'
                      }}>
                        {(p.name?.[0] || 'U').toUpperCase()}
                        
                        {/* Lock Overlay */}
                        {p.hasPassword && (
                          <div style={{
                            position: 'absolute',
                            bottom: '-2px',
                            right: '-2px',
                            background: '#181818',
                            borderRadius: '50%',
                            width: '14px',
                            height: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.6rem',
                            border: '1px solid rgba(255,255,255,0.2)'
                          }}>
                            🔒
                          </div>
                        )}
                      </div>

                      <span style={{ 
                        fontSize: '0.72rem', 
                        fontWeight: isSelected ? 600 : 400, 
                        color: '#fff', 
                        textAlign: 'center', 
                        maxWidth: '100%', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        fontFamily: 'Outfit, sans-serif'
                      }}>
                        {p.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (stepId === 'storage') {
      const isLocal = settings.userId === 'local';
      
      const handleMigrate = () => {
        const name = prompt('Enter a name for your server profile:');
        if (!name) return;
        setIsMigrating(true);
        fetch(`${BACKEND_ORIGIN}/api/profile/migrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, settings, history: videos })
        })
          .then(res => res.json())
          .then(resData => {
            setIsMigrating(false);
            if (resData.success) {
              onSelectProfile(resData.userId, 'file');
              setHasConfiguredStorage(true);
              alert(`Profile successfully migrated! Server UserId: ${resData.userId}`);
            }
          })
          .catch(err => {
            setIsMigrating(false);
            console.error('Failed to migrate:', err);
          });
      };

      return (
        <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {isLocal ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span style={{ fontSize: '0.75rem', color: '#fff' }}>Local Browser Storage Active</span>
                <button
                  type="button"
                  onClick={() => {
                    handleDefaultLangChange('storageMode', 'localstorage');
                    setHasConfiguredStorage(true);
                  }}
                  style={{
                    background: settings.storageMode === 'localstorage' && hasConfiguredStorage ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Confirm Local Mode
                </button>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>Want to sync to server instead?</span>
                <button
                  type="button"
                  onClick={handleMigrate}
                  disabled={isMigrating}
                  style={{
                    background: '#2ecc71',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  {isMigrating ? 'Migrating...' : 'Migrate to Server SQLite'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(59,130,246,0.08)', padding: '0.6rem', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.2)' }}>
              <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 600 }}>SQLite Server Storage Active</span>
              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)' }}>Profile ID: <code>{settings.userId}</code></span>
              <button
                type="button"
                onClick={() => {
                  handleDefaultLangChange('storageMode', 'file');
                  setHasConfiguredStorage(true);
                }}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.4rem',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  marginTop: '4px',
                  cursor: 'pointer'
                }}
              >
                Confirm Server Storage
              </button>
            </div>
          )}
        </div>
      );
    }
    if (stepId === 'languages') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Audio Language</span>
            <CustomSelect
              value={settings.defaultAudio}
              onChange={(val) => {
                handleDefaultLangChange('defaultAudio', val);
                setHasConfiguredLanguages(true);
              }}
              options={audioOptions}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>Subtitle Language</span>
            <CustomSelect
              value={settings.defaultSub}
              onChange={(val) => {
                handleDefaultLangChange('defaultSub', val);
                setHasConfiguredLanguages(true);
              }}
              options={subOptions}
            />
          </div>
        </div>
      );
    }
    if (stepId === 'keybinds') {
      return (
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '0.75rem', marginBottom: '0.75rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>Play/Pause: <b>Space</b></div>
          <div>Fullscreen: <b>F</b></div>
          <div>Lock Player: <b>W</b></div>
          <div>Exit / Back: <b>Esc</b></div>
        </div>
      );
    }
    return null;
  };

  if (dismissed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4" style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'rgba(8, 8, 8, 0.85)', padding: '1rem' }}>
        <div className="text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p className="text-pretty text-muted-foreground" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Checklist dismissed
          </p>
          <button
            className="mt-2 text-primary text-sm underline"
            style={{ marginTop: '0.5rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => setDismissed(false)}
          >
            Show again
          </button>
          <button
            className="mt-2 text-primary text-sm underline"
            style={{ marginTop: '0.5rem', color: '#2ecc71', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={onComplete}
          >
            Finish Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4" style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'rgba(8, 8, 8, 0.85)', padding: '1rem', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
      {/* Stylesheet to ensure pointer hand (cursor pointer) when hovering over all onboarding components and items */}
      <style>{`
        .onboarding-step-row,
        .onboarding-step-container,
        .onboarding-step-inner,
        .onboarding-step-header,
        .step-dot-wrapper,
        .step-title-wrapper,
        .dropdown-item,
        .btn {
          cursor: pointer !important;
        }
      `}</style>
      
      <div className="w-full max-w-lg" style={{ width: '100%', maxWidth: '480px' }}>
        <div className="w-md rounded-lg border bg-card p-4 text-card-foreground shadow-xs" style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '1rem', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.8)' }}>
          <div className="mr-2 mb-4 flex flex-col justify-between sm:flex-row sm:items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={onComplete}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.6)',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                  fontFamily: 'Outfit, sans-serif'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                }}
                title="Skip onboarding"
              >
                Skip
              </button>
              <h3 className="ml-2 text-balance font-semibold text-foreground" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                Get started with Valor
              </h3>
            </div>
            <div className="mt-2 flex items-center justify-end sm:mt-0" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CircularProgress
                completed={remainingCount}
                total={currentSteps.length}
              />
              <div className="mr-3 ml-1.5 text-muted-foreground text-sm" style={{ marginRight: '0.75rem', marginLeft: '0.375rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
                <span className="font-medium text-foreground" style={{ fontWeight: 600, color: '#fff' }}>
                  {completedCount}
                </span>
                {' / '}
                <span className="font-medium text-foreground" style={{ fontWeight: 600, color: '#fff' }}>
                  {currentSteps.length}
                </span>{' '}
                completed
              </div>
              <button
                type="button"
                onClick={() => {
                  openAuthModal('login', null, (userId) => {
                    onSelectProfile(userId, 'file');
                    try {
                      const saved = localStorage.getItem('valor_settings');
                      const parsed = saved ? JSON.parse(saved) : {};
                      parsed.isOnboarded = true;
                      parsed.userId = userId;
                      parsed.storageMode = 'file';
                      localStorage.setItem('valor_settings', JSON.stringify(parsed));
                    } catch {}
                    onComplete();
                  });
                }}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                  marginLeft: '4px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              >
                Login
              </button>
            </div>
          </div>

          <div className="space-y-0" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {currentSteps.map((step, index) => {
              const isOpen = openStepId === step.id;
              const isFirst = index === 0;
              const prevStep = currentSteps[index - 1];
              const isPrevOpen = prevStep && openStepId === prevStep.id;

              const showBorderTop = !(isFirst || isOpen || isPrevOpen);
              const isConfigured = isStepConfigured(step.id);

              return (
                <div
                  className={cn(
                    'group',
                    isOpen && 'rounded-lg',
                    showBorderTop && 'border-border border-t'
                  )}
                  style={{
                    borderTop: showBorderTop ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    borderRadius: isOpen ? '8px' : 0
                  }}
                  key={step.id}
                >
                  <div
                    className={cn(
                      'block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isOpen && 'rounded-lg'
                    )}
                    onClick={() => handleStepClick(step.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStepClick(step.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    style={{ outline: 'none' }}
                  >
                    <div
                      className={cn(
                        'relative rounded-lg transition-colors',
                        isOpen && 'border border-border bg-muted'
                      )}
                      style={{
                        position: 'relative',
                        overflow: 'visible',
                        borderRadius: '8px',
                        border: isOpen ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                        background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent',
                        margin: isOpen ? '4px 0' : 0
                      }}
                    >
                      <div className="relative flex items-center justify-between gap-3 py-3 pr-2 pl-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0.5rem 0.75rem 1rem', gap: '12px' }}>
                        <div className="flex w-full gap-3" style={{ display: 'flex', width: '100%', gap: '12px' }}>
                          <div className="shrink-0" style={{ flexShrink: 0 }}>
                            <StepIndicator completed={step.completed} />
                          </div>
                          <div className="mt-0.5 grow" style={{ flexGrow: 1, minWidth: 0, marginTop: '2px' }}>
                            <h4
                              className={cn(
                                'font-semibold',
                                step.completed
                                  ? 'text-primary'
                                  : 'text-foreground'
                              )}
                              style={{ margin: 0, fontSize: '0.92rem', fontWeight: 600, color: step.completed ? '#3b82f6' : '#fff' }}
                            >
                              {step.title}
                            </h4>
                            <Collapsible open={isOpen}>
                              <CollapsibleContent>
                                <div onClick={(e) => e.stopPropagation()}>
                                  <p className="mt-2 text-pretty text-muted-foreground text-sm sm:max-w-64 md:max-w-xs" style={{ margin: 0, marginTop: '8px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                                    {step.description}
                                  </p>
                                  {renderValorControls(step.id)}
                                  <Button
                                    asChild
                                    className="mt-3"
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      if (!isConfigured) return;
                                      handleStepAction(step);
                                    }}
                                    size="sm"
                                    style={{
                                      marginTop: '12px',
                                      padding: '0.35rem 0.85rem',
                                      fontSize: '0.8rem',
                                      opacity: isConfigured ? 1 : 0.4,
                                      cursor: isConfigured ? 'pointer' : 'not-allowed'
                                    }}
                                  >
                                    <span style={{ cursor: isConfigured ? 'pointer' : 'not-allowed' }}>
                                      {step.actionLabel}
                                    </span>
                                  </Button>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          </div>
                        </div>
                        {!isOpen && (
                          <IconChevronRight
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            style={{ width: '16px', height: '16px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
