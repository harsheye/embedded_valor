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
            ? `https://image.tmdb.org/t/p/w500${r.poster_path}` 
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
        const posterPath = m.coverImage.extraLarge || m.coverImage.large || '';
        
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

  const handleRowClick = (res: SearchResult) => {
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

  return (
    <div className="online-search-container">
      <div className="online-search-hero">
        <h1 className="search-title">
          <Sparkles className="title-icon" size={24} />
          Online Streaming Hub
        </h1>
        
        {/* Search Bar & Category Buttons Unified Row */}
        <div className="search-row-container">
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

          <div className="search-category-tabs">
            <button 
              className={`category-tab ${category === 'all' ? 'active' : ''}`}
              onClick={() => { setCategory('all'); setQuery(''); setResults([]); }}
            >
              <Film size={16} />
              Movies & TV Shows
            </button>
            <button 
              className={`category-tab ${category === 'anime' ? 'active' : ''}`}
              onClick={() => { setCategory('anime'); setQuery(''); setResults([]); }}
            >
              <Tv size={16} />
              Anime (AniList)
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="search-error-alert">
          <span>{error}</span>
        </div>
      )}

      {/* Search Results List */}
      <div className="search-results-section">
        {!loading && results.length === 0 && query.trim().length > 0 && (
          <div className="search-no-results">
            <span>No results found for "{query}"</span>
          </div>
        )}

        <div className="search-results-list">
          {results.map((res) => (
            <div 
              key={`${res.type}-${res.id}`} 
              className="search-result-row"
              onClick={() => handleRowClick(res)}
            >
              <div className="row-left">
                <span className={`row-type-tag ${res.type}`}>
                  {res.type === 'movie' ? 'Movie' : (res.type === 'tv' ? 'TV' : 'Anime')}
                </span>
                <span className="row-title" title={res.title}>{res.title}</span>
                <span className="row-year">({res.year})</span>
              </div>
              <div className="row-right">
                {res.rating && (
                  <span className="row-rating">
                    ⭐ {res.rating.toFixed(1)}
                  </span>
                )}
                <button className="row-play-btn">
                  <Play fill="currentColor" size={12} />
                  <span>Stream</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
