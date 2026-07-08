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
  // 3. Season 1 Episode 3
  const seasonEpPattern = /^(.*?)\s*season\s*(\d+)\s*episode\s*(\d+)/i;
  // 4. Episode 12 or Ep 12 or Ep.12 or EP12
  const epPattern = /^(.*?)\s*(?:episode|ep|ep\.)\s*(\d+)/i;
  // 5. E03 or e03 (e.g. No.Way.Out.The.Roulette.E03)
  const eOnlyPattern = /^(.*?)\s*[.\-_]?\s*e(\d+)\b/i;
  // 6. Hyphen-separated number (e.g. No Way Out - 03)
  const hyphenEpPattern = /^(.*?)\s*-\s*(\d+)\b/i;

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

  match = cleanTitle.match(seasonEpPattern);
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

  match = cleanTitle.match(eOnlyPattern);
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

  match = cleanTitle.match(hyphenEpPattern);
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
