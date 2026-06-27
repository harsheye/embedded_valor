export interface ParsedLibraryItem {
  id: string;
  title: string;
  type: 'movie' | 'series';
  seriesTitle?: string;
  season?: number;
  episode?: number;
  originalTitle: string;
}

export function classifyVideoTitle(title: string): {
  type: 'movie' | 'series';
  seriesTitle?: string;
  season?: number;
  episode?: number;
  displayTitle: string;
} {
  // Clean file extensions
  const cleanTitle = title.replace(/\.[^/.]+$/, "");

  // Common TV Show patterns:
  // 1. S01E03 or s1e3 or S1 E3 or S01.E03
  const sPattern = /^(.*?)\s*[.\-_]?\s*s(\d+)\s*[.\-_.\s]?e(\d+)/i;
  // 2. 1x03 or 01x03
  const xPattern = /^(.*?)\s*(\d+)x(\d+)/i;
  // 3. Episode 12 or Ep 12 or Ep.12 or EP12
  const epPattern = /^(.*?)\s*(?:episode|ep|ep\.)\s*(\d+)/i;

  let match = cleanTitle.match(sPattern);
  if (match) {
    const cleanSeriesTitle = match[1].replace(/[.\-_]/g, ' ').trim();
    return {
      type: 'series',
      seriesTitle: cleanSeriesTitle || 'Unknown Series',
      season: parseInt(match[2], 10),
      episode: parseInt(match[3], 10),
      displayTitle: `${cleanSeriesTitle} - Season ${match[2]} Episode ${match[3]}`
    };
  }

  match = cleanTitle.match(xPattern);
  if (match) {
    const cleanSeriesTitle = match[1].replace(/[.\-_]/g, ' ').trim();
    return {
      type: 'series',
      seriesTitle: cleanSeriesTitle || 'Unknown Series',
      season: parseInt(match[2], 10),
      episode: parseInt(match[3], 10),
      displayTitle: `${cleanSeriesTitle} - Season ${match[2]} Episode ${match[3]}`
    };
  }

  match = cleanTitle.match(epPattern);
  if (match) {
    const cleanSeriesTitle = match[1].replace(/[.\-_]/g, ' ').trim();
    return {
      type: 'series',
      seriesTitle: cleanSeriesTitle || 'Unknown Series',
      season: 1,
      episode: parseInt(match[2], 10),
      displayTitle: `${cleanSeriesTitle} - Episode ${match[2]}`
    };
  }

  // Fallback to Movie
  return {
    type: 'movie',
    displayTitle: cleanTitle
  };
}
