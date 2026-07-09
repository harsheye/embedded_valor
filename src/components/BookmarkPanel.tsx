import React, { useMemo } from 'react';
import { Pencil, Trash, Play, Bookmark as BookmarkIcon, Heart } from 'lucide-react';
import type { Bookmark } from '../types/media';

interface BookmarkPanelProps {
  bookmarks: Bookmark[];
  onJump: (time: number) => void;
  onEdit: (bm: Bookmark) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export const BookmarkPanel: React.FC<BookmarkPanelProps> = ({ bookmarks, onJump, onEdit, onDelete, onAdd }) => {
  const sortedBookmarks = useMemo(() => {
    return [...bookmarks].sort((a, b) => a.time - b.time);
  }, [bookmarks]);

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

      <div className="bookmark-list">
        {sortedBookmarks.length === 0 ? (
          <div className="bookmark-empty-state">
            <BookmarkIcon size={32} className="empty-icon" />
            <p>No bookmarks yet</p>
            <span>Save memorable moments while watching.</span>
            <button className="empty-add-btn" onClick={onAdd}>Create First Bookmark</button>
          </div>
        ) : (
          sortedBookmarks.map(bm => (
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
