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
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const categories = ['Standard', 'Movie Scene', 'Action', 'Funny', 'Hot Scene', 'Outro', 'Intro'];

  useEffect(() => {
    if (initialBookmark) {
      setTitle(initialBookmark.title || initialBookmark.label || '');
      setDescription(initialBookmark.description || '');
      setCategory(initialBookmark.category || 'Standard');
      setFavorite(initialBookmark.favorite || false);
      if (initialBookmark.thumbnail) {
        setThumbnail(initialBookmark.thumbnail);
      }
    }
  }, [initialBookmark, videoElement]);

  const handleSave = () => {
    onSave({
      ...(initialBookmark || {}),
      title: title || undefined,
      description,
      category,
      favorite,
      thumbnail: thumbnail || undefined,
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
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
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
        className="premium-bookmark-modal animate-scale-up" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: 0,
          color: 'white', 
          pointerEvents: 'auto',
          zIndex: 1001 
        }}
      >
        <h2 style={{ color: 'white', fontSize: '20px', margin: '0 0 20px 0' }}>{initialBookmark ? 'Edit Bookmark' : 'Add Bookmark'}</h2>
        
        <div className="bookmark-modal-content">
          <div className="bookmark-modal-fields" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#ccc', fontSize: '13px' }}>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Bookmark Title" autoFocus style={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', fontSize: '14px' }} />
            </div>

            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#ccc', fontSize: '13px' }}>Description (Optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Add notes..." style={{ color: 'white', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', minHeight: '60px', fontSize: '14px' }}></textarea>
            </div>

            <div className="field-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ color: '#ccc', fontSize: '13px' }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ color: 'white', backgroundColor: '#222', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', fontSize: '14px' }}>
                {categories.map(cat => <option key={cat} value={cat} style={{ color: 'white', backgroundColor: '#222' }}>{cat}</option>)}
              </select>
            </div>

            <div className="field-group-checkbox" style={{ marginTop: '8px' }}>
              <label style={{ color: '#ccc', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} />
                Mark as Favorite
              </label>
            </div>
          </div>
        </div>

        <div className="bookmark-modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
          <button className="bookmark-modal-btn cancel" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', color: '#ccc', background: 'transparent', border: 'none', cursor: 'pointer' }}>Cancel</button>
          <button className="bookmark-modal-btn save" onClick={handleSave} style={{ padding: '10px 20px', borderRadius: '8px', color: 'white', background: '#e50914', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
        </div>
      </div>
    </div>
  );
};
