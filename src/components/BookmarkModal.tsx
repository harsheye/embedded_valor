import React, { useState, useEffect } from 'react';
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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Standard');
  const [favorite, setFavorite] = useState(false);

  const categories = ['Standard', 'Movie Scene', 'Action', 'Funny', 'Hot Scene', 'Outro', 'Intro'];

  useEffect(() => {
    if (initialBookmark) {
      setTitle(initialBookmark.title || initialBookmark.label || '');
      setDescription(initialBookmark.description || '');
      setCategory(initialBookmark.category || 'Standard');
      setFavorite(initialBookmark.favorite || false);
    }
  }, [initialBookmark]);

  const handleSave = () => {
    onSave({
      ...(initialBookmark || {}),
      title: title || undefined,
      description,
      category,
      favorite,
      time: initialBookmark?.time ?? initialTime,
      endTime: initialBookmark?.endTime ?? initialEndTime,
      createdAt: initialBookmark?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="premium-bookmark-modal-overlay animate-fade-in" 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'transparent',
        pointerEvents: 'none'
      }}
    >
      {/* Invisible backdrop for clicks to close */}
      <div 
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} 
        onClick={onClose} 
      />
      <div 
        className="animate-slide-in-right" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '380px',
          background: 'rgba(20, 20, 22, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          padding: '32px 24px',
          color: 'white', 
          pointerEvents: 'auto',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h2 style={{ color: 'white', fontSize: '22px', margin: 0, fontWeight: 600 }}>{initialBookmark ? 'Edit Bookmark' : 'Add Bookmark'}</h2>
          <div style={{ fontSize: '14px', color: '#e50914', fontWeight: 600, background: 'rgba(229, 9, 20, 0.1)', padding: '4px 12px', borderRadius: '12px' }}>
            {formatTime(initialTime)} {initialEndTime ? ` → ${formatTime(initialEndTime)}` : ''}
          </div>
        </div>
        
        <div className="bookmark-modal-content" style={{ flex: 1 }}>
          <div className="bookmark-modal-fields" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Bookmark Title" autoFocus style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#e50914'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
            </div>

            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description (Optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add notes..." style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', minHeight: '100px', fontSize: '15px', outline: 'none', resize: 'vertical', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#e50914'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}></textarea>
            </div>

            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', fontSize: '15px', outline: 'none', cursor: 'pointer', appearance: 'none', transition: 'border-color 0.2s' }} onFocus={e => e.target.style.borderColor = '#e50914'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}>
                {categories.map(cat => <option key={cat} value={cat} style={{ color: 'white', backgroundColor: '#18181b' }}>{cat}</option>)}
              </select>
            </div>

            <div className="field-group-checkbox" style={{ marginTop: '12px' }}>
              <label style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${favorite ? '#e50914' : 'rgba(255,255,255,0.3)'}`, background: favorite ? '#e50914' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                  {favorite && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
                <input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} style={{ display: 'none' }} />
                Mark as Favorite
              </label>
            </div>
          </div>
        </div>

        <div className="bookmark-modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '40px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 600, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>Cancel</button>
          <button onClick={handleSave} style={{ flex: 1, padding: '14px', borderRadius: '12px', color: 'white', background: '#e50914', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 600, transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(229, 9, 20, 0.3)' }} onMouseEnter={e => e.currentTarget.style.background = '#f40b17'} onMouseLeave={e => e.currentTarget.style.background = '#e50914'}>Save</button>
        </div>
      </div>
    </div>
  );
};
