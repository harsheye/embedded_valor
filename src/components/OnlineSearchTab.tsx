import React, { useState, useEffect, useRef } from 'react';
import { Search, Film, Tv, Play, Sparkles } from 'lucide-react';
import type { VideoItem } from '../types/media';

interface OnlineSearchTabProps {
  onSelectMedia: (video: VideoItem) => void;
  tmdbApiKey?: string;
}

interface SearchResult {
  id: string | number;
  title: string;
  posterPath: string;
  year: string;
  type: 'movie' | 'tv' | 'anime';
  overview?: string;
  rating?: number;
}

const DEFAULT_TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlMzQwMGRhZWZjODJjNTJlZDEyYzk1MWU1ZWFmYmVhYyIsIm5iZiI6MTc4MzU0MTI2OS44NzUsInN1YiI6IjZhNGVhZTE1MzFhOWUyYmNhZjBmY2RlMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.GT6_b6NSJwjYCXlbaCi_djq09ug0rKDxY9iouqVrYWY";

export const OnlineSearchTab: React.FC<OnlineSearchTabProps> = ({ onSelectMedia, tmdbApiKey }) => {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'anime'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTmdbResults = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isBearer = tmdbApiKey ? tmdbApiKey.length > 50 : true;
      const token = tmdbApiKey || DEFAULT_TMDB_TOKEN;
      
      let url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(searchQuery)}&include_adult=false`;
      let headers: HeadersInit = { 'accept': 'application/json' };
      
      if (isBearer) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        url += `&api_key=${token}`;
      }

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`TMDB Search failed with status: ${res.status}`);
      const data = await res.json();
      
      const mapped: SearchResult[] = (data.results || [])
        .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
        .map((r: any) => {
          const isMovie = r.media_type === 'movie';
          const title = isMovie ? r.title : r.name;
          const date = isMovie ? r.release_date : r.first_air_date;
          const year = date ? date.split('-')[0] : 'N/A';
          const posterPath = r.poster_path 
            ? `https://images.weserv.nl/?url=https://image.tmdb.org/t/p/w500${r.poster_path}` 
            : '';
            
          return {
            id: r.id,
            title: title || 'Unknown Title',
            posterPath,
            year,
            type: isMovie ? 'movie' : ('tv' as any),
            overview: r.overview,
            rating: r.vote_average
          };
        });
      setResults(mapped);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to fetch search results from TMDB.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAniListResults = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const graphqlQuery = `
        query ($search: String) {
          Page (page: 1, perPage: 24) {
            media (search: $search, type: ANIME, sort: POPULARITY_DESC) {
              id
              title {
                english
                romaji
                native
              }
              coverImage {
                extraLarge
                large
              }
              startDate {
                year
              }
              description
              averageScore
              format
            }
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
          variables: { search: searchQuery }
        })
      });

      if (!res.ok) throw new Error(`AniList Search failed with status: ${res.status}`);
      const body = await res.json();
      const mediaList = body.data?.Page?.media || [];
      
      const mapped: SearchResult[] = mediaList.map((m: any) => {
        const title = m.title.english || m.title.romaji || m.title.native || 'Unknown Anime';
        const rawPoster = m.coverImage.extraLarge || m.coverImage.large || '';
        const posterPath = rawPoster ? `https://images.weserv.nl/?url=${encodeURIComponent(rawPoster)}` : '';
        
        return {
          id: m.id,
          title,
          posterPath,
          year: m.startDate.year ? String(m.startDate.year) : 'N/A',
          type: 'anime',
          overview: m.description ? m.description.replace(/<[^>]*>/g, '') : '',
          rating: m.averageScore ? m.averageScore / 10 : undefined
        };
      });
      setResults(mapped);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to fetch search results from AniList.');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search trigger
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setImageErrors({});
      if (category === 'all') {
        fetchTmdbResults(query);
      } else {
        fetchAniListResults(query);
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query, category]);

  const handleCardClick = (res: SearchResult) => {
    const videoItem: VideoItem = {
      id: `${res.type}-${res.id}`,
      title: res.title,
      url: '',
      type: res.type === 'movie' ? 'online_movie' : (res.type === 'tv' ? 'online_tv' : 'online_anime'),
      isRemote: true,
      posterPath: res.posterPath,
      tmdbId: res.type !== 'anime' ? Number(res.id) : undefined,
      anilistId: res.type === 'anime' ? Number(res.id) : undefined,
      audioTracks: [],
      subtitleTracks: []
    };
    onSelectMedia(videoItem);
  };

  const handleImageError = (id: string | number) => {
    setImageErrors(prev => ({ ...prev, [id]: true }));
  };

  return (
    <div className="online-search-container">
      {/* Search Header Row (Dropdown next to Search Bar, NO hero title/container card) */}
      <div className="search-bar-row">
        <div className="search-input-wrapper">
          <Search className="search-bar-icon" size={20} />
          <input
            type="text"
            className="search-bar-input"
            placeholder={category === 'all' ? "Search Movie or TV Series name..." : "Search Anime (e.g. Naruto, One Piece)..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <div className="search-inline-spinner"></div>}
        </div>

        <div className="category-select-wrapper">
          <select 
            className="category-dropdown"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as any);
              setQuery('');
              setResults([]);
            }}
          >
            <option value="all">🎬 Movies & TV Shows</option>
            <option value="anime">🌸 Anime (AniList)</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="search-error-alert">
          <span>{error}</span>
        </div>
      )}

      {/* Search Results Grid */}
      <div className="search-results-section">
        {!loading && results.length === 0 && query.trim().length > 0 && (
          <div className="search-no-results">
            <span>No results found for "{query}"</span>
          </div>
        )}

        <div className="search-results-grid">
          {results.map((res) => {
            const hasError = imageErrors[res.id] || !res.posterPath;
            return (
              <div 
                key={`${res.type}-${res.id}`} 
                className="search-result-card"
                onClick={() => handleCardClick(res)}
              >
                <div className="card-poster-wrapper">
                  {!hasError ? (
                    <img 
                      src={res.posterPath} 
                      alt={res.title} 
                      className="card-poster-image" 
                      loading="lazy"
                      crossOrigin="anonymous"
                      onError={() => handleImageError(res.id)}
                    />
                  ) : (
                    <div className="card-poster-fallback">
                      <div className="fallback-backdrop"></div>
                      {res.type === 'anime' ? <Tv size={32} className="fallback-icon" /> : <Film size={32} className="fallback-icon" />}
                      <span className="fallback-title-text">{res.title}</span>
                    </div>
                  )}
                  
                  <div className="card-hover-overlay">
                    <button className="play-overlay-btn">
                      <Play fill="currentColor" size={20} />
                    </button>
                  </div>
                  
                  {res.rating && (
                    <div className="card-rating-badge">
                      ⭐ {res.rating.toFixed(1)}
                    </div>
                  )}
                </div>
                <div className="card-details">
                  <h3 className="card-title" title={res.title}>{res.title}</h3>
                  <div className="card-meta">
                    <span className="card-year">{res.year}</span>
                    <span className={`card-type-tag ${res.type}`}>
                      {res.type === 'movie' ? 'Movie' : (res.type === 'tv' ? 'TV' : 'Anime')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
