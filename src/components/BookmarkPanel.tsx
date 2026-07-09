import React, { useState, useMemo } from 'react';
import { Search, Pencil, Trash, Play, Bookmark as BookmarkIcon, Clock, Film, Image as ImageIcon, Heart } from 'lucide-react';
import type { Bookmark } from '../types/media';

interface BookmarkPanelProps {
  bookmarks: Bookmark[];
  onJump: (time: number) => void;
  onEdit: (bm: Bookmark) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export const BookmarkPanel: React.FC<BookmarkPanelProps> = ({ bookmarks, onJump, onEdit, onDelete, onAdd, onClose }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'recent' | 'favorites'>('all');

  const filteredBookmarks = useMemo(() => {
    let result = bookmarks;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(bm => 
        (bm.title || bm.label || '').toLowerCase().includes(s) || 
        (bm.description || '').toLowerCase().includes(s) ||
        (bm.category || '').toLowerCase().includes(s)
      );
    }
    if (filter === 'favorites') {
      result = result.filter(bm => bm.favorite);
    }
    if (filter === 'recent') {
      result = [...result].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else {
      // default sort by timeline
      result = [...result].sort((a, b) => a.time - b.time);
    }
    return result;
  }, [bookmarks, search, filter]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="premium-bookmark-panel animate-scale-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bookmark-panel-header">
        <div className="bookmark-panel-title">
          <BookmarkIcon size={18} />
          <span>Bookmarks</span>
        </div>
        <button className="bookmark-add-btn" onClick={onAdd}>+ New</button>
      </div>

      <div className="bookmark-search-container">
        <Search size={14} className="search-icon" />
        <input 
          type="text" 
          placeholder="Search bookmarks..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bookmark-filters">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Timeline</button>
        <button className={filter === 'recent' ? 'active' : ''} onClick={() => setFilter('recent')}>Recent</button>
        <button className={filter === 'favorites' ? 'active' : ''} onClick={() => setFilter('favorites')}>Favorites</button>
      </div>

      <div className="bookmark-list">
        {filteredBookmarks.length === 0 ? (
          <div className="bookmark-empty-state">
            <BookmarkIcon size={32} className="empty-icon" />
            <p>No bookmarks yet</p>
            <span>Save memorable moments while watching.</span>
            <button className="empty-add-btn" onClick={onAdd}>Create First Bookmark</button>
          </div>
        ) : (
          filteredBookmarks.map(bm => (
            <div className="premium-bookmark-card" key={bm.id}>
              {bm.thumbnail && (
                <div className="bookmark-card-thumbnail" style={{ backgroundImage: `url(${bm.thumbnail})` }}>
                  <div className="bookmark-card-play-overlay" onClick={() => onJump(bm.time)}>
                    <Play fill="white" size={24} />
                  </div>
                </div>
              )}
              <div className="bookmark-card-content">
                <div className="bookmark-card-top">
                  <div className="bookmark-card-title">
                    {bm.category === 'Movie Scene' && '🎬 '}
                    {bm.category === 'Action' && '💥 '}
                    {bm.category === 'Funny' && '😂 '}
                    {bm.category === 'Hot Scene' && '🔥 '}
                    {bm.category === 'Outro' && '🏁 '}
                    {bm.title || bm.label}
                  </div>
                  {bm.favorite && <Heart size={14} fill="#e50914" color="#e50914" />}
                </div>
                
                <div className="bookmark-card-time">
                  {formatTime(bm.time)}
                  {bm.endTime ? ` → ${formatTime(bm.endTime)}` : ''}
                </div>

                {bm.description && (
                  <div className="bookmark-card-notes">Notes available</div>
                )}
                
                <div className="bookmark-card-actions">
                  <button onClick={() => onJump(bm.time)}><Play size={12} /> Jump</button>
                  <button onClick={() => onEdit(bm)}><Pencil size={12} /> Edit</button>
                  <button className="danger" onClick={() => onDelete(bm.id)}><Trash size={12} /> Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
