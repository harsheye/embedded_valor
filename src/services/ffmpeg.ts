import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';
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

const MEMFS_MAX_SIZE = 150 * 1024 * 1024; // 150MB

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private isLoading = false;
  private isLoaded = false;
  private progressCallback: ((progress: number) => void) | null = null;
  private logCallback: ((log: string) => void) | null = null;
  private activePromise: Promise<any> = Promise.resolve();

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

  reset() {
    if (this.ffmpeg) {
      try {
        this.ffmpeg.terminate();
      } catch (e) {
        console.warn('[FFmpeg] Error during termination:', e);
      }
      this.ffmpeg = null;
    }
    this.isLoaded = false;
    this.isLoading = false;
    window.dispatchEvent(new CustomEvent('ffmpeg-status-change', { detail: { status: 'idle', progress: 0 } }));
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
      const ext = this.getExtension(file.name);
      const mountPoint = `/mount_${Date.now()}`;
      const mountedFilePath = `${mountPoint}/${file.name}`;
      let useMount = false;

      if (file.size > MEMFS_MAX_SIZE) {
        try {
          await ffmpeg.createDir(mountPoint);
          await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, mountPoint);
          useMount = true;
          console.log(`[FFmpeg] Successfully mounted local file via WORKERFS at ${mountedFilePath}`);
        } catch (mountErr) {
          console.warn('[FFmpeg] Failed to mount local file via WORKERFS, falling back to writing to virtual FS:', mountErr);
        }
      }

      if (!useMount) {
        // Fallback or small file: write to virtual FS (using slice if large to avoid OOM)
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
      }

      const inputPath = useMount ? mountedFilePath : `input${ext}`;
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
        console.warn('Probe exec finished with warning:', err);
      } finally {
        // Restore log callback
        this.setLogCallback(previousLogCallback);
        // Clean up
        if (useMount) {
          try {
            await ffmpeg.unmount(mountPoint);
            await ffmpeg.deleteDir(mountPoint);
          } catch (e) {
            console.warn('[FFmpeg] Cleanup of mounted directory failed:', e);
          }
        } else {
          try {
            await ffmpeg.deleteFile(`input${ext}`);
          } catch (e) {
            // ignore
          }
        }
        // Always reset instance after running exec
        this.reset();
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
      const ext = this.getExtension(file.name);
      const tempOutFile = 'subtitles.srt'; // Extract as SRT, we will parse or convert in JS

      const mountPoint = `/mount_${Date.now()}`;
      const mountedFilePath = `${mountPoint}/${file.name}`;
      let useMount = false;

      if (file.size > MEMFS_MAX_SIZE) {
        try {
          await ffmpeg.createDir(mountPoint);
          await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, mountPoint);
          useMount = true;
          console.log(`[FFmpeg] Successfully mounted local file for subtitle extraction via WORKERFS at ${mountedFilePath}`);
        } catch (mountErr) {
          console.warn('[FFmpeg] Failed to mount local file for subtitle extraction, falling back to writing to virtual FS:', mountErr);
        }
      }

      if (!useMount) {
        const tempInFile = `input${ext}`;
        await ffmpeg.writeFile(tempInFile, await fetchFile(file));
      }

      const inputPath = useMount ? mountedFilePath : `input${ext}`;

      try {
        try {
          // ffmpeg -i input.mkv -map 0:s:index -c:s copy output.srt
          // Or if subtitle is ASS, we can copy it, but srt is widely supported by our parser.
          // Wait, let's map stream by its absolute stream index (0:streamIndex)
          await ffmpeg.exec([
            '-i', inputPath,
            '-map', `0:${streamIndex}`,
            '-vn', '-an',
            '-c:s', 'srt', // Transcode to SRT
            tempOutFile
          ]);
        } catch (execErr: any) {
          console.warn('Subtitle extraction exec finished with warning/abort:', execErr);
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
        console.warn('Text conversion failed, attempting raw copy...');
        // Try again with copying codec directly
        try {
          const copyOutFile = 'subtitles_copy.srt';
          try {
            await ffmpeg.exec([
              '-i', inputPath,
              '-map', `0:${streamIndex}`,
              '-vn', '-an',
              '-c:s', 'copy',
              copyOutFile
            ]);
          } catch (execErr: any) {
            console.warn('Subtitle raw copy exec finished with warning/abort:', execErr);
          }
          const data = await ffmpeg.readFile(copyOutFile);
          const blob = new Blob([data as any], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          return {
            url,
            filename: `${file.name.replace(/\.[^/.]+$/, '')}.stream_${streamIndex}.srt`,
            format: 'srt'
          };
        } catch (e) {
          console.error('Failed to extract subtitle track', e);
          throw new Error('Subtitle extraction failed. The format may not be supported for direct extraction.');
        }
      } finally {
        // Clean up
        if (useMount) {
          try {
            await ffmpeg.unmount(mountPoint);
            await ffmpeg.deleteDir(mountPoint);
          } catch (e) {}
        } else {
          try {
            await ffmpeg.deleteFile(`input${ext}`);
          } catch (e) {}
        }
        try {
          await ffmpeg.deleteFile(tempOutFile);
          await ffmpeg.deleteFile('subtitles_copy.srt');
        } catch (e) {}
        // Always reset instance after running exec
        this.reset();
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
    onProgress?: (p: number) => void
  ): Promise<{ url: string; filename: string; mimeType: string }> {
    return this.runWithLock(async () => {
      const ffmpeg = await this.load();
      const ext = this.getExtension(file.name);
      
      // Choose output format and codec based on transcoding option
      const tempOutFile = transcode ? 'audio.mp3' : 'audio_extracted.bin';
      const mimeType = transcode ? 'audio/mp3' : 'audio/octet-stream';
      const outExt = transcode ? 'mp3' : 'bin';

      if (onProgress) {
        this.setProgressCallback(onProgress);
      }

      const mountPoint = `/mount_${Date.now()}`;
      const mountedFilePath = `${mountPoint}/${file.name}`;
      let useMount = false;

      if (file.size > MEMFS_MAX_SIZE) {
        try {
          await ffmpeg.createDir(mountPoint);
          await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, mountPoint);
          useMount = true;
          console.log(`[FFmpeg] Successfully mounted local file for audio extraction via WORKERFS at ${mountedFilePath}`);
        } catch (mountErr) {
          console.warn('[FFmpeg] Failed to mount local file for audio extraction, falling back to writing to virtual FS:', mountErr);
        }
      }

      if (!useMount) {
        const tempInFile = `input${ext}`;
        await ffmpeg.writeFile(tempInFile, await fetchFile(file));
      }

      const inputPath = useMount ? mountedFilePath : `input${ext}`;

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
          console.warn('Audio extraction exec finished with warning/abort:', execErr);
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
        console.error('Audio extraction failed', error);
        throw error;
      } finally {
        this.setProgressCallback(null);
        // Clean up
        if (useMount) {
          try {
            await ffmpeg.unmount(mountPoint);
            await ffmpeg.deleteDir(mountPoint);
          } catch (e) {}
        } else {
          try {
            await ffmpeg.deleteFile(`input${ext}`);
          } catch (e) {}
        }
        try {
          await ffmpeg.deleteFile(tempOutFile);
        } catch (e) {}
        // Always reset instance after running exec
        this.reset();
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
      const ext = this.getExtension(file.name);
      const tempOutFile = 'output.mp4';

      if (onProgress) {
        this.setProgressCallback(onProgress);
      }

      const mountPoint = `/mount_${Date.now()}`;
      const mountedFilePath = `${mountPoint}/${file.name}`;
      let useMount = false;

      if (file.size > MEMFS_MAX_SIZE) {
        try {
          await ffmpeg.createDir(mountPoint);
          await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, mountPoint);
          useMount = true;
          console.log(`[FFmpeg] Successfully mounted local file for video remuxing via WORKERFS at ${mountedFilePath}`);
        } catch (mountErr) {
          console.warn('[FFmpeg] Failed to mount local file for video remuxing, falling back to writing to virtual FS:', mountErr);
        }
      }

      if (!useMount) {
        const tempInFile = `input${ext}`;
        await ffmpeg.writeFile(tempInFile, await fetchFile(file));
      }

      const inputPath = useMount ? mountedFilePath : `input${ext}`;

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
          console.warn('Video remuxing exec finished with warning/abort:', execErr);
        }

        const data = await ffmpeg.readFile(tempOutFile);
        const blob = new Blob([data as any], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        return {
          url,
          filename: `${file.name.replace(/\.[^/.]+$/, '')}_playable.mp4`
        };
      } catch (error) {
        console.error('Video remuxing failed', error);
        throw error;
      } finally {
        this.setProgressCallback(null);
        if (useMount) {
          try {
            await ffmpeg.unmount(mountPoint);
            await ffmpeg.deleteDir(mountPoint);
          } catch (e) {}
        } else {
          try {
            await ffmpeg.deleteFile(`input${ext}`);
          } catch (e) {}
        }
        try {
          await ffmpeg.deleteFile(tempOutFile);
        } catch (e) {}
        // Always reset instance after running exec
        this.reset();
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
      console.warn('Remote probe exec finished with warning:', err);
    } finally {
      this.setLogCallback(previousLogCallback);
      try {
        await ffmpeg.deleteFile(tempInFile);
      } catch (e) {}
      // Always reset instance after running exec
      this.reset();
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
        console.warn('extractRemoteAudioSegment exec finished with warning/abort:', execErr);
      }
      const data = await ffmpeg.readFile(tempOutFile);
      const blob = new Blob([data as any], { type: mimeType });
      const url = URL.createObjectURL(blob);
      return { url, mimeType };
    } finally {
      try {
        await ffmpeg.deleteFile(tempInFile);
        await ffmpeg.deleteFile(tempOutFile);
      } catch (e) {}
      // Always reset instance after running exec
      this.reset();
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
        console.warn('extractRemoteSubtitleSegment exec finished with warning/abort:', execErr);
      }

      const data = await ffmpeg.readFile(tempOutFile);
      return new TextDecoder('utf-8').decode(data as any);
    } finally {
      try {
        await ffmpeg.deleteFile(tempInFile);
        await ffmpeg.deleteFile(tempOutFile);
      } catch (e) {}
      // Always reset instance after running exec
      this.reset();
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
        console.warn('extractHlsAudioSegment exec finished with warning/abort:', execErr);
      }
      const data = await ffmpeg.readFile(tempOutFile);
      const blob = new Blob([data as any], { type: mimeType });
      const url = URL.createObjectURL(blob);
      return { url, mimeType };
    } finally {
      try {
        await ffmpeg.deleteFile(tempInFile);
        await ffmpeg.deleteFile(tempOutFile);
      } catch (e) {}
      // Always reset instance after running exec
      this.reset();
    }
  }
}

export const ffmpegService = new FFmpegService();
