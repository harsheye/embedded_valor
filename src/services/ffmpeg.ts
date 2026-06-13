import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ByteSource } from '../utils/remoteByteSource';

export interface MediaStream {
  index: number;
  type: 'video' | 'audio' | 'subtitle';
  codec: string;
  language?: string;
  details: string;
}

export interface ProbeResult {
  duration: string;
  format: string;
  streams: MediaStream[];
}

const MEMFS_MAX_SIZE = 300 * 1024 * 1024; // 300MB

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private isLoading = false;
  private isLoaded = false;
  private progressCallback: ((progress: number) => void) | null = null;
  private logCallback: ((log: string) => void) | null = null;
  private activePromise: Promise<any> = Promise.resolve();

  // Active session file state (persisted across stream switches in a single video playback session)
  private activeFile: File | null = null;
  private activeFilePath: string | null = null;
  private activeMountPoint: string | null = null;
  private activeUseMount = false;

  private async runWithLock<T>(task: () => Promise<T>): Promise<T> {
    const nextPromise = new Promise<T>((resolve, reject) => {
      this.activePromise.then(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      }).catch(async () => {
        try {
          const res = await task();
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
    this.activePromise = nextPromise.catch(() => {});
    return nextPromise;
  }

  async load(onProgress?: (progress: number) => void): Promise<FFmpeg> {
    if (this.isLoaded && this.ffmpeg) return this.ffmpeg;
    if (this.isLoading) {
      // Wait for it to load
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.isLoaded && this.ffmpeg) {
            clearInterval(check);
            resolve(this.ffmpeg!);
          }
        }, 100);
      });
    }

    this.isLoading = true;
    window.dispatchEvent(new CustomEvent('ffmpeg-status-change', { detail: { status: 'loading', progress: 0 } }));
    this.ffmpeg = new FFmpeg();

    if (onProgress) {
      this.progressCallback = onProgress;
    }

    this.ffmpeg.on('progress', ({ progress }) => {
      const p = Math.round(progress * 100);
      if (this.progressCallback) {
        this.progressCallback(p);
      }
      window.dispatchEvent(new CustomEvent('ffmpeg-status-change', { detail: { status: 'loading', progress: p } }));
    });

    this.ffmpeg.on('log', ({ message }) => {
      if (this.logCallback) {
        this.logCallback(message);
      }
      console.log('FFmpeg:', message);
    });

    try {
      await this.ffmpeg.load({
        coreURL: `${window.location.origin}/ffmpeg-core.js`,
        wasmURL: `${window.location.origin}/ffmpeg-core.wasm`,
      });
      this.isLoaded = true;
      this.isLoading = false;
      window.dispatchEvent(new CustomEvent('ffmpeg-status-change', { detail: { status: 'ready', progress: 100 } }));
      return this.ffmpeg;
    } catch (error) {
      this.isLoading = false;
      window.dispatchEvent(new CustomEvent('ffmpeg-status-change', { detail: { status: 'error', progress: 0 } }));
      console.error('Failed to load FFmpeg.wasm', error);
      throw error;
    }
  }

  reset(force = false) {
    if (this.ffmpeg) {
      // Clean up session mounts/files synchronously if possible, or ignore errors
      if (this.activeUseMount && this.activeMountPoint) {
        try {
          this.ffmpeg.unmount(this.activeMountPoint);
          this.ffmpeg.deleteDir(this.activeMountPoint);
        } catch (e) {}
      } else if (this.activeFilePath && !this.activeUseMount) {
        try {
          this.ffmpeg.deleteFile(this.activeFilePath);
        } catch (e) {}
      }

      try {
        this.ffmpeg.terminate();
      } catch (e) {
        console.warn('[FFmpeg] Error during termination:', e);
      }
      this.ffmpeg = null;
    }

    this.activeFile = null;
    this.activeFilePath = null;
    this.activeMountPoint = null;
    this.activeUseMount = false;

    this.isLoaded = false;
    this.isLoading = false;
    if (force) {
      this.activePromise = Promise.resolve();
    }
    window.dispatchEvent(new CustomEvent('ffmpeg-status-change', { detail: { status: 'idle', progress: 0 } }));
  }

  private async mountOrWriteFile(ffmpeg: FFmpeg, file: File): Promise<string> {
    if (this.activeFile === file && this.activeFilePath) {
      // Reuse already mounted or written file for this session
      return this.activeFilePath;
    }

    // Clean up previous file if any
    await this.cleanupSessionFile(ffmpeg);

    const ext = this.getExtension(file.name);
    this.activeFile = file;

    const mountPoint = `/mount_session`;
    const mountedFilePath = `${mountPoint}/${file.name}`;

    if (file.size > MEMFS_MAX_SIZE) {
      try {
        try {
          await ffmpeg.createDir(mountPoint);
        } catch (dirErr) {
          // Ignore if directory already exists
        }
        await ffmpeg.mount('WORKERFS' as any, { files: [file] }, mountPoint);
        this.activeUseMount = true;
        this.activeMountPoint = mountPoint;
        this.activeFilePath = mountedFilePath;
        console.log(`[FFmpeg] Session file mounted via WORKERFS at ${mountedFilePath}`);
      } catch (mountErr) {
        console.warn('[FFmpeg] Failed to mount session file via WORKERFS, falling back to writing:', mountErr);
        this.activeUseMount = false;
      }
    } else {
      this.activeUseMount = false;
    }

    if (!this.activeUseMount) {
      const tempInFile = `input${ext}`;
      let fileData: Uint8Array;
      try {
        if (file.size > MEMFS_MAX_SIZE) {
          const slice = file.slice(0, 2 * 1024 * 1024);
          const buffer = await slice.arrayBuffer();
          fileData = new Uint8Array(buffer);
        } else {
          fileData = await fetchFile(file);
        }
      } catch (err) {
        console.warn('Initial file read failed, attempting to read 2MB header slice:', err);
        const slice = file.slice(0, 2 * 1024 * 1024);
        const buffer = await slice.arrayBuffer();
        fileData = new Uint8Array(buffer);
      }
      await ffmpeg.writeFile(tempInFile, fileData);
      this.activeFilePath = tempInFile;
      console.log(`[FFmpeg] Session file written to MEMFS: ${tempInFile}`);
    }

    return this.activeFilePath!;
  }

  private async cleanupSessionFile(ffmpeg: FFmpeg | null) {
    if (!ffmpeg) return;

    if (this.activeUseMount && this.activeMountPoint) {
      try {
        await ffmpeg.unmount(this.activeMountPoint);
        await ffmpeg.deleteDir(this.activeMountPoint);
        console.log(`[FFmpeg] Session file unmounted from ${this.activeMountPoint}`);
      } catch (e) {
        console.warn('[FFmpeg] Error unmounting session file:', e);
      }
    } else if (this.activeFilePath && !this.activeUseMount) {
      try {
        await ffmpeg.deleteFile(this.activeFilePath);
        console.log(`[FFmpeg] Session file deleted from MEMFS: ${this.activeFilePath}`);
      } catch (e) {
        // ignore
      }
    }

    this.activeFile = null;
    this.activeFilePath = null;
    this.activeMountPoint = null;
    this.activeUseMount = false;
  }

  setLogCallback(callback: ((log: string) => void) | null) {
    this.logCallback = callback;
  }

  setProgressCallback(callback: ((progress: number) => void) | null) {
    this.progressCallback = callback;
  }

  isReady(): boolean {
    return this.isLoaded;
  }

  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }

  /**
   * Probe a local file to inspect its streams (video, audio, subtitles)
   */
  async probeFile(file: File): Promise<ProbeResult> {
    return this.runWithLock(async () => {
      const ffmpeg = await this.load();
      const inputPath = await this.mountOrWriteFile(ffmpeg, file);

      const logs: string[] = [];
      const collectLog = (msg: string) => {
        logs.push(msg);
      };

      const previousLogCallback = this.logCallback;
      this.setLogCallback(collectLog);

      try {
        // Run probe command. We copy streams to null but stop after 0 seconds (-t 0) to make it exit instantly
        // with code 0, flushing all stream metadata logs without processing any media frames.
        await ffmpeg.exec(['-i', inputPath, '-t', '0', '-c', 'copy', '-f', 'null', '-']);
      } catch (err) {
        console.warn('Probe exec finished with warning, resetting worker:', err);
        this.reset();
        throw err;
      } finally {
        // Restore log callback
        this.setLogCallback(previousLogCallback);
      }

      const fullLog = logs.join('\n');
      return this.parseProbeLogs(fullLog);
    });
  }

  private parseProbeLogs(logText: string): ProbeResult {
    const streams: MediaStream[] = [];
    let duration = 'Unknown';
    let format = 'Unknown';

    // Extract duration
    const durationRegex = /Duration:\s*(\d{2}:\d{2}:\d{2}\.\d{2})/;
    const durationMatch = logText.match(durationRegex);
    if (durationMatch) {
      duration = durationMatch[1];
    }

    // Extract format
    const formatRegex = /Input #0,\s*([^,]+)/;
    const formatMatch = logText.match(formatRegex);
    if (formatMatch) {
      format = formatMatch[1];
    }

    const lines = logText.split('\n');
    for (const line of lines) {
      if (line.includes('Output #')) {
        break;
      }
      if (!line.includes('Stream #')) continue;

      // Extract stream index (e.g. Stream #0:1 or Stream #0:2)
      const indexMatch = line.match(/Stream #\d+:(\d+)/);
      if (!indexMatch) continue;
      const index = parseInt(indexMatch[1], 10);

      // Detect type
      let type: 'video' | 'audio' | 'subtitle' | null = null;
      let typeKeyword = '';
      if (line.toLowerCase().includes('video:')) {
        type = 'video';
        typeKeyword = 'video:';
      } else if (line.toLowerCase().includes('audio:')) {
        type = 'audio';
        typeKeyword = 'audio:';
      } else if (line.toLowerCase().includes('subtitle:')) {
        type = 'subtitle';
        typeKeyword = 'subtitle:';
      }

      if (!type) continue;

      // Extract language (optional): e.g. (eng)
      let language: string | undefined = undefined;
      const langMatch = line.match(/\(([^)]+)\)(?=\s*:\s*(?:Video|Audio|Subtitle))/i);
      if (langMatch) {
        language = langMatch[1];
      } else {
        const genericLangMatch = line.match(/\(([a-zA-Z]{3})\)/);
        if (genericLangMatch) {
          language = genericLangMatch[1];
        }
      }

      // Extract details
      const keywordIndex = line.toLowerCase().indexOf(typeKeyword);
      const details = line.substring(keywordIndex + typeKeyword.length).trim();
      const codec = details.split(',')[0].trim();

      streams.push({
        index,
        type,
        codec,
        language,
        details
      });
    }
    console.log('Parsed stream layout:', { duration, format, streams });
    return { duration, format, streams };
  }

  /**
   * Extract a subtitle track as WebVTT or SRT
   */
  async extractSubtitle(file: File, streamIndex: number): Promise<{ url: string; filename: string; format: 'vtt' | 'srt' }> {
    return this.runWithLock(async () => {
      const ffmpeg = await this.load();
      const inputPath = await this.mountOrWriteFile(ffmpeg, file);
      const tempOutFile = 'subtitles.srt';

      try {
        try {
          // Try copy first (instant!)
          await ffmpeg.exec([
            '-i', inputPath,
            '-map', `0:${streamIndex}`,
            '-vn', '-an',
            '-c:s', 'copy',
            tempOutFile
          ]);
        } catch (execErr: any) {
          console.warn('Subtitle copy failed, attempting transcode to srt:', execErr);
          await ffmpeg.exec([
            '-i', inputPath,
            '-map', `0:${streamIndex}`,
            '-vn', '-an',
            '-c:s', 'srt',
            tempOutFile
          ]);
        }

        const data = await ffmpeg.readFile(tempOutFile);
        const blob = new Blob([data as any], { type: 'text/srt' });
        const url = URL.createObjectURL(blob);

        return {
          url,
          filename: `${file.name.replace(/\.[^/.]+$/, '')}.stream_${streamIndex}.srt`,
          format: 'srt'
        };
      } catch (error) {
        console.error('Failed to extract subtitle track, resetting worker:', error);
        this.reset();
        throw new Error('Subtitle extraction failed. The format may not be supported for direct extraction.');
      } finally {
        try {
          await ffmpeg.deleteFile(tempOutFile);
          await ffmpeg.deleteFile('subtitles_copy.srt');
        } catch (e) {}
      }
    });
  }

  /**
   * Extract audio track (and optionally transcode to AAC for browser playability)
   */
  async extractAudio(
    file: File,
    streamIndex: number,
    transcode = true,
    codec = '',
    onProgress?: (p: number) => void
  ): Promise<{ url: string; filename: string; mimeType: string }> {
    return this.runWithLock(async () => {
      const ffmpeg = await this.load();
      const inputPath = await this.mountOrWriteFile(ffmpeg, file);
      
      let outExt = 'mp3';
      let mimeType = 'audio/mp3';
      let tempOutFile = 'audio.mp3';

      if (!transcode) {
        const lowerCodec = codec.toLowerCase();
        if (lowerCodec.includes('aac')) {
          outExt = 'm4a';
          mimeType = 'audio/mp4';
        } else if (lowerCodec.includes('mp3')) {
          outExt = 'mp3';
          mimeType = 'audio/mp3';
        } else if (lowerCodec.includes('opus')) {
          outExt = 'ogg';
          mimeType = 'audio/ogg';
        } else if (lowerCodec.includes('flac')) {
          outExt = 'flac';
          mimeType = 'audio/flac';
        } else if (lowerCodec.includes('vorbis')) {
          outExt = 'ogg';
          mimeType = 'audio/ogg';
        } else if (lowerCodec.includes('ac3') || lowerCodec.includes('eac3') || lowerCodec.includes('dts') || lowerCodec.includes('truehd')) {
          outExt = 'm4a';
          mimeType = 'audio/mp4';
        } else {
          outExt = 'm4a';
          mimeType = 'audio/mp4';
        }
        tempOutFile = `audio_extracted.${outExt}`;
      }

      if (onProgress) {
        this.setProgressCallback(onProgress);
      }

      try {
        let args: string[];
        if (transcode) {
          // Transcode to MP3 (widely supported)
          args = [
            '-i', inputPath,
            '-map', `0:${streamIndex}`,
            '-vn',
            '-acodec', 'libmp3lame',
            '-ab', '192k',
            tempOutFile
          ];
        } else {
          // Demux and copy audio stream without transcoding (very fast!)
          args = [
            '-i', inputPath,
            '-map', `0:${streamIndex}`,
            '-vn',
            '-acodec', 'copy',
            tempOutFile
          ];
        }

        try {
          await ffmpeg.exec(args);
        } catch (execErr: any) {
          console.warn('Audio extraction exec finished with warning/abort, resetting worker:', execErr);
          this.reset();
          throw execErr;
        }

        const data = await ffmpeg.readFile(tempOutFile);
        const blob = new Blob([data as any], { type: mimeType });
        const url = URL.createObjectURL(blob);

        return {
          url,
          filename: `${file.name.replace(/\.[^/.]+$/, '')}.stream_${streamIndex}.${outExt}`,
          mimeType
        };
      } catch (error) {
        console.error('Audio extraction failed, resetting worker:', error);
        this.reset();
        throw error;
      } finally {
        this.setProgressCallback(null);
        try {
          await ffmpeg.deleteFile(tempOutFile);
        } catch (e) {}
      }
    });
  }

  /**
   * Remux / Transcode unsupported video container (like MKV) into MP4
   */
  async remuxVideo(
    file: File,
    options: { transcodeAudio: boolean },
    onProgress?: (p: number) => void
  ): Promise<{ url: string; filename: string }> {
    return this.runWithLock(async () => {
      const ffmpeg = await this.load();
      const inputPath = await this.mountOrWriteFile(ffmpeg, file);
      const tempOutFile = 'output.mp4';

      if (onProgress) {
        this.setProgressCallback(onProgress);
      }

      try {
        let args: string[];
        if (options.transcodeAudio) {
          // Copy video, transcode audio to AAC (very fast compared to video transcoding)
          args = [
            '-i', inputPath,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-strict', 'experimental',
            tempOutFile
          ];
        } else {
          // Copy both video and audio (instant, but might not play if audio codec is incompatible)
          args = [
            '-i', inputPath,
            '-c', 'copy',
            tempOutFile
          ];
        }

        try {
          await ffmpeg.exec(args);
        } catch (execErr: any) {
          console.warn('Video remuxing exec finished with warning/abort, resetting worker:', execErr);
          this.reset();
          throw execErr;
        }

        const data = await ffmpeg.readFile(tempOutFile);
        const blob = new Blob([data as any], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        return {
          url,
          filename: `${file.name.replace(/\.[^/.]+$/, '')}_playable.mp4`
        };
      } catch (error) {
        console.error('Video remuxing failed, resetting worker:', error);
        this.reset();
        throw error;
      } finally {
        this.setProgressCallback(null);
        try {
          await ffmpeg.deleteFile(tempOutFile);
        } catch (e) {}
      }
    });
  }

  /**
   * Probe a remote file's streams using only the first 2MB of headers
   */
  async probeRemoteHeader(_url: string, ext: string, source: ByteSource): Promise<ProbeResult> {
    const ffmpeg = await this.load();
    const tempInFile = `input${ext}`;

    const size = await source.getSize();
    const headerLimit = Math.min(2 * 1024 * 1024, size - 1);
    const headerBytes = await source.read(0, headerLimit);

    await ffmpeg.writeFile(tempInFile, headerBytes);

    const logs: string[] = [];
    const collectLog = (msg: string) => logs.push(msg);

    const previousLogCallback = this.logCallback;
    this.setLogCallback(collectLog);

    try {
      // Run probe command with -t 0 to exit instantly with code 0 and flush logs.
      await ffmpeg.exec(['-i', tempInFile, '-t', '0', '-c', 'copy', '-f', 'null', '-']);
    } catch (err) {
      console.warn('Remote probe exec finished with warning, resetting worker:', err);
      this.reset();
      throw err;
    } finally {
      this.setLogCallback(previousLogCallback);
      try {
        await ffmpeg.deleteFile(tempInFile);
      } catch (e) {}
    }

    const fullLog = logs.join('\n');
    return this.parseProbeLogs(fullLog);
  }

  /**
   * Extract audio segment from a remote byte source using a seek offset
   */
  async extractRemoteAudioSegment(
    source: ByteSource,
    startOffset: number,
    endOffset: number,
    streamIndex: number,
    transcode = true,
    signal?: AbortSignal
  ): Promise<{ url: string; mimeType: string }> {
    const ffmpeg = await this.load();
    const tempInFile = 'chunk.bin';
    const tempOutFile = transcode ? 'audio.mp3' : 'audio.bin';
    const mimeType = transcode ? 'audio/mp3' : 'audio/octet-stream';

    const chunkBytes = await source.read(startOffset, endOffset, signal);
    await ffmpeg.writeFile(tempInFile, chunkBytes);

    try {
      let args: string[];
      if (transcode) {
        args = [
          '-i', tempInFile,
          '-map', `0:${streamIndex}`,
          '-vn',
          '-acodec', 'libmp3lame',
          '-ab', '128k',
          tempOutFile
        ];
      } else {
        args = [
          '-i', tempInFile,
          '-map', `0:${streamIndex}`,
          '-vn',
          '-acodec', 'copy',
          tempOutFile
        ];
      }

      try {
        await ffmpeg.exec(args);
      } catch (execErr: any) {
        console.warn('extractRemoteAudioSegment exec finished with warning/abort, resetting worker:', execErr);
        this.reset();
        throw execErr;
      }
      const data = await ffmpeg.readFile(tempOutFile);
      const blob = new Blob([data as any], { type: mimeType });
      const url = URL.createObjectURL(blob);
      return { url, mimeType };
    } catch (error) {
      this.reset();
      throw error;
    } finally {
      try {
        await ffmpeg.deleteFile(tempInFile);
        await ffmpeg.deleteFile(tempOutFile);
      } catch (e) {}
    }
  }

  /**
   * Extract subtitle segment from a remote byte source using a seek offset
   */
  async extractRemoteSubtitleSegment(
    source: ByteSource,
    startOffset: number,
    endOffset: number,
    streamIndex: number,
    signal?: AbortSignal
  ): Promise<string> {
    const ffmpeg = await this.load();
    const tempInFile = 'chunk.bin';
    const tempOutFile = 'subtitles.srt';

    const chunkBytes = await source.read(startOffset, endOffset, signal);
    await ffmpeg.writeFile(tempInFile, chunkBytes);

    try {
      try {
        await ffmpeg.exec([
          '-i', tempInFile,
          '-map', `0:${streamIndex}`,
          '-c:s', 'srt',
          tempOutFile
        ]);
      } catch (execErr: any) {
        console.warn('extractRemoteSubtitleSegment exec finished with warning/abort, resetting worker:', execErr);
        this.reset();
        throw execErr;
      }

      const data = await ffmpeg.readFile(tempOutFile);
      return new TextDecoder('utf-8').decode(data as any);
    } catch (error) {
      this.reset();
      throw error;
    } finally {
      try {
        await ffmpeg.deleteFile(tempInFile);
        await ffmpeg.deleteFile(tempOutFile);
      } catch (e) {}
    }
  }

  /**
   * Extract audio segment from a single HLS TS segment URL
   */
  async extractHlsAudioSegment(
    segmentUrl: string,
    _streamIndex: number,
    transcode = true
  ): Promise<{ url: string; mimeType: string }> {
    const ffmpeg = await this.load();
    const tempInFile = 'segment.ts';
    const tempOutFile = transcode ? 'audio.mp3' : 'audio.bin';
    const mimeType = transcode ? 'audio/mp3' : 'audio/octet-stream';

    const response = await fetch(segmentUrl);
    const buffer = await response.arrayBuffer();
    await ffmpeg.writeFile(tempInFile, new Uint8Array(buffer));

    try {
      let args: string[];
      if (transcode) {
        args = [
          '-i', tempInFile,
          '-acodec', 'libmp3lame',
          '-ab', '128k',
          tempOutFile
        ];
      } else {
        args = [
          '-i', tempInFile,
          '-acodec', 'copy',
          tempOutFile
        ];
      }

      try {
        await ffmpeg.exec(args);
      } catch (execErr: any) {
        console.warn('extractHlsAudioSegment exec finished with warning/abort, resetting worker:', execErr);
        this.reset();
        throw execErr;
      }
      const data = await ffmpeg.readFile(tempOutFile);
      const blob = new Blob([data as any], { type: mimeType });
      const url = URL.createObjectURL(blob);
      return { url, mimeType };
    } catch (error) {
      this.reset();
      throw error;
    } finally {
      try {
        await ffmpeg.deleteFile(tempInFile);
        await ffmpeg.deleteFile(tempOutFile);
      } catch (e) {}
    }
  }
}

export const ffmpegService = new FFmpegService();
