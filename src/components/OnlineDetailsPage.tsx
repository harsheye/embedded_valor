import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Star, Calendar, Clock, Film, ChevronLeft, ChevronRight, User } from 'lucide-react';
import type { VideoItem } from '../types/media';

interface OnlineDetailsPageProps {
  video: VideoItem;
  onClose: () => void;
  onPlay: (video: VideoItem, season?: number, episode?: number) => void;
  tmdbApiKey?: string;
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string;
}

interface EpisodeItem {
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string;
}

const DEFAULT_TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlMzQwMGRhZWZjODJjNTJlZDEyYzk1MWU1ZWFmYmVhYyIsIm5iZiI6MTc4MzU0MTI2OS44NzUsInN1YiI6IjZhNGVhZTE1MzFhOWUyYmNhZjBmY2RlMiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.GT6_b6NSJwjYCXlbaCi_djq09ug0rKDxY9iouqVrYWY";

export const OnlineDetailsPage: React.FC<OnlineDetailsPageProps> = ({
  video,
  onClose,
  onPlay,
  tmdbApiKey
}) => {
  const [details, setDetails] = useState<any>(null);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [currentSeason, setCurrentSeason] = useState(1);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const castScrollRef = useRef<HTMLDivElement>(null);

  const isAnime = video.type === 'online_anime';

  // Fetch Movie / TV Details & Cast (TMDB)
  useEffect(() => {
    if (isAnime) {
      fetchAniListDetails();
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const isBearer = tmdbApiKey ? tmdbApiKey.length > 50 : true;
        const token = tmdbApiKey || DEFAULT_TMDB_TOKEN;
        const mediaType = video.type === 'online_movie' ? 'movie' : 'tv';
        
        // 1. Fetch Main Details
        let detailsUrl = `https://api.themoviedb.org/3/${mediaType}/${video.tmdbId}?language=en-US`;
        let headers: HeadersInit = { 'accept': 'application/json' };
        if (isBearer) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          detailsUrl += `&api_key=${token}`;
        }

        const detailsRes = await fetch(detailsUrl, { headers });
        if (!detailsRes.ok) throw new Error('Failed to fetch media details');
        const detailsData = await detailsRes.json();
        setDetails(detailsData);

        if (video.type === 'online_tv') {
          setSeasons(detailsData.seasons || []);
          const activeSeason = detailsData.seasons && detailsData.seasons.length > 0 
            ? detailsData.seasons[0].season_number === 0 && detailsData.seasons.length > 1 
              ? detailsData.seasons[1].season_number 
              : detailsData.seasons[0].season_number
            : 1;
          setCurrentSeason(activeSeason);
        }

        // 2. Fetch Credits (Cast)
        let creditsUrl = `https://api.themoviedb.org/3/${mediaType}/${video.tmdbId}/credits?language=en-US`;
        if (!isBearer) creditsUrl += `&api_key=${token}`;
        
        const creditsRes = await fetch(creditsUrl, { headers });
        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          const castList: CastMember[] = (creditsData.cast || [])
            .slice(0, 15)
            .map((c: any) => ({
              id: c.id,
              name: c.name,
              character: c.character,
              profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : ''
            }));
          setCast(castList);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to fetch details');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [video.id, video.tmdbId, video.type, tmdbApiKey]);

  // Fetch TV Episodes when currentSeason changes
  useEffect(() => {
    if (isAnime || video.type !== 'online_tv' || !video.tmdbId) return;

    const fetchEpisodes = async () => {
      setLoadingEpisodes(true);
      try {
        const isBearer = tmdbApiKey ? tmdbApiKey.length > 50 : true;
        const token = tmdbApiKey || DEFAULT_TMDB_TOKEN;
        
        let url = `https://api.themoviedb.org/3/tv/${video.tmdbId}/season/${currentSeason}?language=en-US`;
        let headers: HeadersInit = { 'accept': 'application/json' };
        if (isBearer) {
          headers['Authorization'] = `Bearer ${token}`;
        } else {
          url += `&api_key=${token}`;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to fetch season episodes');
        const data = await res.json();
        
        const mappedEpisodes: EpisodeItem[] = (data.episodes || []).map((e: any) => ({
          episodeNumber: e.episode_number,
          name: e.name || `Episode ${e.episode_number}`,
          overview: e.overview || 'No description available.',
          stillPath: e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : ''
        }));
        
        setEpisodes(mappedEpisodes);
      } catch (err) {
        console.error('Error fetching season episodes:', err);
      } finally {
        setLoadingEpisodes(false);
      }
    };

    fetchEpisodes();
  }, [currentSeason, video.tmdbId, video.type, tmdbApiKey]);

  // Fetch Anime details from AniList
  const fetchAniListDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const graphqlQuery = `
        query ($id: Int) {
          Media (id: $id, type: ANIME) {
            id
            title {
              english
              romaji
              native
            }
            bannerImage
            coverImage {
              extraLarge
              large
            }
            description
            averageScore
            seasonYear
            genres
            episodes
            characters (sort: [ROLE, REPUTATION]) {
              edges {
                node {
                  id
                  name {
                    full
                  }
                  image {
                    large
                  }
                }
                role
              }
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
          variables: { id: video.anilistId }
        })
      });

      if (!res.ok) throw new Error('Failed to fetch Anime details');
      const body = await res.json();
      const media = body.data?.Media;
      
      if (!media) throw new Error('Anime not found');

      setDetails({
        title: media.title.english || media.title.romaji || media.title.native,
        overview: media.description ? media.description.replace(/<[^>]*>/g, '') : '',
        backdrop_path: media.bannerImage || '',
        poster_path: media.coverImage.extraLarge || media.coverImage.large || '',
        vote_average: media.averageScore ? media.averageScore / 10 : null,
        release_date: media.seasonYear ? String(media.seasonYear) : '',
        genres: (media.genres || []).map((g: string) => ({ name: g })),
        episodes_count: media.episodes || 12
      });

      // Map Cast members
      const castList: CastMember[] = (media.characters?.edges || [])
        .slice(0, 15)
        .map((edge: any) => ({
          id: edge.node.id,
          name: edge.node.name.full,
          character: edge.role || 'Character',
          profilePath: edge.node.image?.large || ''
        }));
      setCast(castList);

      // Generate episodes grid for Anime
      const totalEp = media.episodes || 12;
      const animeEps: EpisodeItem[] = Array.from({ length: totalEp }, (_, i) => ({
        episodeNumber: i + 1,
        name: `Episode ${i + 1}`,
        overview: `Watch Episode ${i + 1} of ${media.title.english || media.title.romaji}`,
        stillPath: ''
      }));
      setEpisodes(animeEps);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch AniList details');
    } finally {
      setLoading(false);
    }
  };

  const handleScrollCast = (dir: 'left' | 'right') => {
    if (!castScrollRef.current) return;
    const scrollAmount = 300;
    castScrollRef.current.scrollBy({
      left: dir === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  if (loading) {
    return (
      <div className="details-page-loading">
        <div className="dragon-spinner">
          <div className="dragon-ring"></div>
          <div className="dragon-core"></div>
        </div>
        <p>Loading media catalog details...</p>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="details-page-error">
        <h2>Failed to load details</h2>
        <p>{error || 'Please check your connection and TMDB settings.'}</p>
        <button onClick={onClose} className="btn-back">Go Back</button>
      </div>
    );
  }

  const isMovie = video.type === 'online_movie';
  const backdropUrl = isAnime 
    ? details.backdrop_path 
    : (details.backdrop_path ? `https://image.tmdb.org/t/p/original${details.backdrop_path}` : '');
  const posterUrl = isAnime 
    ? details.poster_path 
    : (details.poster_path ? `https://image.tmdb.org/t/p/w500${details.poster_path}` : '');
  const genresText = (details.genres || []).map((g: any) => g.name).join(', ');
  const releaseYear = details.release_date ? details.release_date.split('-')[0] : '';
  const voteAverage = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';

  return (
    <div className="media-details-page-container animate-fade-in">
      {/* Blurred Backdrop Cover */}
      {backdropUrl && (
        <div 
          className="media-details-backdrop"
          style={{ backgroundImage: `url(${backdropUrl})` }}
        />
      )}
      <div className="media-details-backdrop-overlay" />

      {/* Header bar */}
      <div className="media-details-header">
        <button className="details-close-btn" onClick={onClose} title="Back to search">
          <X size={24} />
        </button>
      </div>

      <div className="media-details-content-wrapper">
        {/* Main Banner / Meta section */}
        <div className="media-details-hero-section">
          {/* Poster Box */}
          <div className="media-details-poster-wrapper">
            {posterUrl ? (
              <img src={posterUrl} alt={details.title || details.name} className="media-details-poster" />
            ) : (
              <div className="media-details-poster-fallback">
                <Film size={48} />
                <span>{details.title || details.name}</span>
              </div>
            )}
          </div>

          {/* Metadata Block */}
          <div className="media-details-meta-block">
            <h1 className="media-details-title">{details.title || details.name}</h1>
            
            <div className="media-details-badges">
              {releaseYear && (
                <span className="meta-badge">
                  <Calendar size={13} style={{ marginRight: '4px' }} />
                  {releaseYear}
                </span>
              )}
              {voteAverage !== 'N/A' && (
                <span className="meta-badge rating">
                  <Star size={13} fill="#fbbf24" color="#fbbf24" style={{ marginRight: '4px' }} />
                  {voteAverage}
                </span>
              )}
              {details.runtime && (
                <span className="meta-badge">
                  <Clock size={13} style={{ marginRight: '4px' }} />
                  {details.runtime} min
                </span>
              )}
              <span className="meta-badge type-label">
                {isMovie ? 'Movie' : (video.type === 'online_tv' ? 'TV Show' : 'Anime')}
              </span>
            </div>

            {genresText && (
              <div className="media-details-genres">
                <strong>Genres:</strong> {genresText}
              </div>
            )}

            <p className="media-details-overview">{details.overview || 'No description available for this catalog entry.'}</p>

            {/* Play Button for Movie */}
            {isMovie && (
              <button 
                className="media-details-play-btn"
                onClick={() => onPlay(video)}
              >
                <Play size={20} fill="currentColor" />
                <span>Play Movie</span>
              </button>
            )}
          </div>
        </div>

        {/* Cast Section */}
        {cast.length > 0 && (
          <div className="media-details-section">
            <div className="section-header-row">
              <h2>Cast & Characters</h2>
              <div className="scroll-arrow-controls">
                <button className="arrow-scroll-btn" onClick={() => handleScrollCast('left')}>
                  <ChevronLeft size={16} />
                </button>
                <button className="arrow-scroll-btn" onClick={() => handleScrollCast('right')}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="cast-scroll-container" ref={castScrollRef}>
              {cast.map((actor) => (
                <div className="actor-card-item" key={actor.id}>
                  <div className="actor-profile-image-wrapper">
                    {actor.profilePath ? (
                      <img src={actor.profilePath} alt={actor.name} className="actor-profile-image" />
                    ) : (
                      <div className="actor-profile-fallback">
                        <User size={24} />
                      </div>
                    )}
                  </div>
                  <div className="actor-card-details">
                    <span className="actor-real-name">{actor.name}</span>
                    <span className="actor-character-name">{actor.character}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Episodes Section for TV Shows and Anime */}
        {!isMovie && (
          <div className="media-details-section">
            <div className="section-header-row tv-selector-row">
              <h2>Episodes</h2>
              
              {video.type === 'online_tv' && seasons.length > 0 && (
                <div className="season-selector-dropdown-wrapper">
                  <select 
                    value={currentSeason}
                    onChange={(e) => setCurrentSeason(Number(e.target.value))}
                    className="season-details-dropdown"
                  >
                    {seasons
                      .filter((s: any) => s.season_number > 0) // Exclude Specials/Season 0
                      .map((s: any) => (
                        <option key={s.id} value={s.season_number}>
                          Season {s.season_number} ({s.episode_count} Episodes)
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {loadingEpisodes ? (
              <div className="episodes-loading-container">
                <div className="dragon-spinner">
                  <div className="dragon-ring"></div>
                </div>
                <span>Fetching season episodes...</span>
              </div>
            ) : (
              <div className="details-episodes-grid">
                {episodes.map((ep) => (
                  <div 
                    className="details-episode-card" 
                    key={ep.episodeNumber}
                    onClick={() => onPlay(video, currentSeason, ep.episodeNumber)}
                  >
                    <div className="episode-card-thumb-wrapper">
                      {ep.stillPath ? (
                        <img src={ep.stillPath} alt={ep.name} className="episode-card-thumb" />
                      ) : (
                        <div className="episode-card-thumb-fallback">
                          <Play size={20} />
                        </div>
                      )}
                      <div className="episode-card-thumb-overlay">
                        <Play size={24} fill="white" />
                      </div>
                      <div className="episode-card-badge">
                        EP {ep.episodeNumber}
                      </div>
                    </div>
                    <div className="episode-card-meta">
                      <h3 className="episode-card-title">{ep.name}</h3>
                      <p className="episode-card-overview" title={ep.overview}>{ep.overview}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
