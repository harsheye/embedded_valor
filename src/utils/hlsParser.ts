export interface HlsSegment {
  uri: string;
  duration: number;
  startTime: number;
}

export interface HlsVariant {
  uri: string;
  bandwidth: number;
  resolution?: string;
  codecs?: string;
}

export interface HlsTrack {
  type: 'audio' | 'subtitles';
  name: string;
  language: string;
  uri: string;
  groupId: string;
}

export interface HlsPlaylist {
  variants: HlsVariant[];
  tracks: HlsTrack[];
  segments: HlsSegment[];
}

export function parseHlsManifest(manifestText: string, baseUrl: string): HlsPlaylist {
  const variants: HlsVariant[] = [];
  const tracks: HlsTrack[] = [];
  const segments: HlsSegment[] = [];

  const lines = manifestText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const resolveUrl = (uri: string) => {
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    if (uri.startsWith('/')) {
      try {
        const origin = new URL(baseUrl).origin;
        return origin + uri;
      } catch (e) {
        return uri;
      }
    }
    const parent = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    return parent + uri;
  };

  let currentStreamInf: { bandwidth: number; resolution?: string; codecs?: string } | null = null;
  let currentSegmentDuration = 0;
  let currentStartTime = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
      const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
      const codecsMatch = line.match(/CODECS="([^"]+)"/);
      
      currentStreamInf = {
        bandwidth: bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0,
        resolution: resolutionMatch ? resolutionMatch[1] : undefined,
        codecs: codecsMatch ? codecsMatch[1] : undefined
      };
    } else if (line.startsWith('#EXT-X-MEDIA:')) {
      const typeMatch = line.match(/TYPE=(AUDIO|SUBTITLES)/i);
      const nameMatch = line.match(/NAME="([^"]+)"/);
      const langMatch = line.match(/LANGUAGE="([^"]+)"/);
      const uriMatch = line.match(/URI="([^"]+)"/);
      const groupMatch = line.match(/GROUP-ID="([^"]+)"/);

      if (typeMatch && nameMatch && langMatch && uriMatch && groupMatch) {
        tracks.push({
          type: typeMatch[1].toLowerCase() as 'audio' | 'subtitles',
          name: nameMatch[1],
          language: langMatch[1],
          uri: resolveUrl(uriMatch[1]),
          groupId: groupMatch[1]
        });
      }
    } else if (line.startsWith('#EXTINF:')) {
      const parts = line.split(':');
      if (parts.length > 1) {
        currentSegmentDuration = parseFloat(parts[1].split(',')[0]);
      }
    } else if (!line.startsWith('#')) {
      if (currentStreamInf) {
        variants.push({
          uri: resolveUrl(line),
          bandwidth: currentStreamInf.bandwidth,
          resolution: currentStreamInf.resolution,
          codecs: currentStreamInf.codecs
        });
        currentStreamInf = null;
      } else if (currentSegmentDuration > 0) {
        segments.push({
          uri: resolveUrl(line),
          duration: currentSegmentDuration,
          startTime: currentStartTime
        });
        currentStartTime += currentSegmentDuration;
        currentSegmentDuration = 0;
      }
    }
  }

  return { variants, tracks, segments };
}
