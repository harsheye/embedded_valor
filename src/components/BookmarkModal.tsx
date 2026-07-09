import React, { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import type { Bookmark } from '../types/media';

interface BookmarkModalProps {
  initialTime: number;
  initialEndTime?: number;
  initialBookmark?: Bookmark;
  videoElement: HTMLVideoElement | null;
  onSave: (bm: Partial<Bookmark>) => void;
  onClose: () => void;
}

export const BookmarkModal: React.FC<BookmarkModalProps> = ({ 
  initialTime, 
  initialEndTime,
  initialBookmark,
  videoElement,
  onSave, 
  onClose 
}) => {
  const [newBookmarkLabel, setNewBookmarkLabel] = useState(initialBookmark?.title || initialBookmark?.label || '');
  const [bookmarkType, setBookmarkType] = useState<'standard' | 'intro' | 'outro'>(
    initialBookmark?.category === 'Intro' ? 'intro' : 
    initialBookmark?.category === 'Outro' ? 'outro' : 'standard'
  );
  
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const parseTimeStringToSeconds = (val: string): number => {
    const clean = val.replace(/[^0-9:]/g, '');
    const parts = clean.split(':').map(Number);
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    const parsed = parseInt(clean, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const [startTimeStr, setStartTimeStr] = useState(formatTime(initialBookmark?.time ?? initialTime));
  const [endTimeStr, setEndTimeStr] = useState(formatTime(initialBookmark?.endTime ?? (initialEndTime || initialTime + 90)));
  const [newBookmarkTime, setNewBookmarkTime] = useState(initialBookmark?.time ?? initialTime);
  const [newBookmarkEndTime, setNewBookmarkEndTime] = useState(initialBookmark?.endTime ?? (initialEndTime || initialTime + 90));
  
  const [skipEnabled, setSkipEnabled] = useState(
    initialBookmark?.category === 'Intro' || initialBookmark?.category === 'Outro'
  );

  const [thumbnail, setThumbnail] = useState(initialBookmark?.thumbnail || '');

  useEffect(() => {
    if (!initialBookmark && videoElement && !thumbnail) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 480;
        canvas.height = (480 / videoElement.videoWidth) * videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL('image/jpeg', 0.6));
        }
      } catch (e) {
        console.warn('Failed to capture thumbnail', e);
      }
    }
  }, [videoElement, initialBookmark, thumbnail]);

  const handleSaveBookmark = () => {
    let finalCategory = 'Custom';
    if (bookmarkType === 'intro') finalCategory = 'Intro';
    if (bookmarkType === 'outro') finalCategory = 'Outro';

    onSave({
      title: newBookmarkLabel || 'Untitled Bookmark',
      label: newBookmarkLabel || 'Untitled Bookmark',
      description: '',
      category: finalCategory,
      favorite: initialBookmark?.favorite || false,
      thumbnail: thumbnail,
      time: newBookmarkTime,
      endTime: (bookmarkType === 'intro' || bookmarkType === 'outro') ? newBookmarkEndTime : undefined,
      createdAt: initialBookmark?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div 
      className="bookmark-dialog-overlay animate-fade-in" 
      onClick={onClose}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'none',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        zIndex: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: '0'
      }}
    >
      <div 
        className="bookmark-dialog-box animate-slide-in-right" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(18, 18, 18, 0.96)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRight: 'none',
          borderRadius: '16px 0 0 16px',
          padding: '1.5rem',
          width: '360px',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          fontFamily: 'sans-serif'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}>
            {initialBookmark ? 'Edit Bookmark' : 'Add Bookmark'}
          </h3>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.6)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.15s ease' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="dialog-field">
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.4rem', fontWeight: 600 }}>Label</label>
          <input 
            type="text" 
            value={newBookmarkLabel} 
            onChange={(e) => setNewBookmarkLabel(e.target.value)}
            placeholder="e.g. Intro Start"
            autoFocus
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '6px',
              color: '#fff',
              padding: '0.6rem 0.85rem',
              fontSize: '0.9rem',
              width: '100%',
              boxSizing: 'border-box',
              outline: 'none'
            }}
          />
        </div>

        {/* Custom Dropdown Selection for Bookmark Type */}
        <div className="dialog-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', fontWeight: 600 }}>Type</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <button
              onClick={() => setTypeDropdownOpen(prev => !prev)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#fff',
                padding: '0.6rem 0.85rem',
                fontSize: '0.9rem',
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box'
              }}
            >
              <span>
                {bookmarkType === 'standard' ? 'Standard Bookmark' :
                 bookmarkType === 'intro' ? 'Intro Section' : 'Outro Section'}
              </span>
              <ChevronRight size={16} style={{ transform: typeDropdownOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
            {typeDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  right: 0,
                  marginBottom: '4px',
                  background: 'rgba(25, 25, 25, 0.98)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  zIndex: 200,
                  boxShadow: '0 -10px 25px rgba(0,0,0,0.5)',
                  overflow: 'hidden'
                }}
              >
                {[
                  { value: 'standard', label: 'Standard Bookmark' },
                  { value: 'intro', label: 'Intro Section' },
                  { value: 'outro', label: 'Outro Section' }
                ].map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      setBookmarkType(opt.value as any);
                      setTypeDropdownOpen(false);
                      if (opt.value === 'intro') {
                        setSkipEnabled(true);
                        if (!newBookmarkLabel) setNewBookmarkLabel('Intro');
                      } else if (opt.value === 'outro') {
                        setSkipEnabled(true);
                        if (!newBookmarkLabel) setNewBookmarkLabel('Outro');
                      } else {
                        setSkipEnabled(false);
                        if (!newBookmarkLabel) setNewBookmarkLabel(`Bookmark @ ${formatTime(newBookmarkTime)}`);
                      }
                    }}
                    style={{
                      padding: '0.6rem 0.85rem',
                      fontSize: '0.85rem',
                      color: bookmarkType === opt.value ? '#e50914' : 'rgba(255,255,255,0.85)',
                      background: bookmarkType === opt.value ? 'rgba(255,255,255,0.04)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (bookmarkType !== opt.value) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    }}
                    onMouseLeave={(e) => {
                      if (bookmarkType !== opt.value) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
          <div className="dialog-field" style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.4rem', fontWeight: 600 }}>
              Start Time
            </label>
            <input 
              type="text" 
              value={startTimeStr} 
              placeholder="e.g. 1:20"
              onChange={(e) => {
                const val = e.target.value;
                setStartTimeStr(val);
                const parsed = parseTimeStringToSeconds(val);
                setNewBookmarkTime(parsed);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#fff',
                padding: '0.6rem 0.85rem',
                fontSize: '0.9rem',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none'
              }}
            />
          </div>
          
          {bookmarkType === 'intro' && (
            <div className="dialog-field" style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '0.4rem', fontWeight: 600 }}>
                End Time
              </label>
              <input 
                type="text" 
                value={endTimeStr} 
                placeholder="e.g. 2:50"
                onChange={(e) => {
                  const val = e.target.value;
                  setEndTimeStr(val);
                  const parsed = parseTimeStringToSeconds(val);
                  setNewBookmarkEndTime(parsed);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '0.6rem 0.85rem',
                  fontSize: '0.9rem',
                  width: '100%',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          )}
        </div>

        {(bookmarkType === 'intro' || bookmarkType === 'outro') && (
          <div className="dialog-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
            <input 
              type="checkbox"
              id="enable-auto-skip-checkbox"
              checked={skipEnabled}
              onChange={(e) => setSkipEnabled(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="enable-auto-skip-checkbox" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', userSelect: 'none' }}>
              Enable Auto-Skip
            </label>
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button 
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              color: 'rgba(255, 255, 255, 0.8)',
              padding: '0.6rem 1.2rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            Cancel
          </button>
          <button 
            onClick={handleSaveBookmark}
            style={{
              background: '#e50914',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              padding: '0.6rem 1.4rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(229,9,20,0.3)',
              transition: 'background 0.2s, transform 0.1s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f40b17'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#e50914'}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
