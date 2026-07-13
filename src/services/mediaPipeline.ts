import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import type { ByteSource } from './local/localByteSource';
import { extractLocalSubtitleSegment } from './local/ffmpegLocal';
import { extractRemoteSubtitleSegment } from './remote/ffmpegRemote';
import { parseSubtitles } from '../utils/subtitleParser';
import { logger } from '../utils/logger';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MediaStreamInfo {
  index: number;
  type: 'video' | 'audio' | 'subtitle';
  codec: string;
  language?: string;
  details: string;
}

export interface ProbeResult {
  duration: number; // in seconds
  streams: MediaStreamInfo[];
}

export interface AudioPacket {
  startTime: number; // presentation timestamp start
  endTime: number;   // presentation timestamp end
  buffer: AudioBuffer;
  duration: number;
  sampleRate: number;
  channels: number;
}

// ─── 1. FileReader & ByteSource ──────────────────────────────────────────────

export class FileReaderService {
  constructor(private source: ByteSource) {}

  async getSize(): Promise<number> {
    return this.source.getSize();
  }

  async read(start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
    return this.source.read(start, end, signal);
  }
}

// ─── 2. FFmpegManager ────────────────────────────────────────────────────────

export class FFmpegManager {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private logCollector: string[] = [];

  constructor(private videoId: string) {}

  async load(onProgress?: (progress: number) => void): Promise<FFmpeg> {
    if (this.ffmpeg && this.isLoaded) return this.ffmpeg;

    const ff = new FFmpeg();

    if (onProgress) {
      ff.on('progress', ({ progress }) => {
        onProgress(Math.round(progress * 100));
      });
    }

    ff.on('log', ({ message }) => {
      this.logCollector.push(message);
      if (import.meta.env?.DEV) {
        const msg = message.toLowerCase();
        if (msg.includes('error') || msg.includes('failed')) {
          logger.ffmpegError(message);
        } else if (msg.includes('warning')) {
          logger.ffmpegWarning(message);
        }
      }
    });

    await ff.load({
      coreURL: `${window.location.origin}/ffmpeg-core.js`,
      wasmURL: `${window.location.origin}/ffmpeg-core.wasm`,
    });

    this.ffmpeg = ff;
    this.isLoaded = true;
    return ff;
  }

  getLogs(): string[] {
    return this.logCollector;
  }

  clearLogs(): void {
    this.logCollector = [];
  }

  async destroy(): Promise<void> {
    if (this.ffmpeg) {
      try {
        this.ffmpeg.terminate();
      } catch {}
      this.ffmpeg = null;
      this.isLoaded = false;
    }
  }
}

// ─── 3. DemuxManager ─────────────────────────────────────────────────────────

export class DemuxManager {
  private mountedPath: string | null = null;
  private uniqueId = Math.random().toString(36).substring(2, 9);

  constructor(
    private ffmpegMgr: FFmpegManager,
    private videoFileOrSource: File | ByteSource
  ) {}

  async getMountedInputPath(ff: FFmpeg): Promise<string> {
    if (this.mountedPath) return this.mountedPath;

    if (this.videoFileOrSource instanceof File) {
      const mountPoint = `/input_${this.uniqueId}`;
      const ext = this.videoFileOrSource.name.substring(this.videoFileOrSource.name.lastIndexOf('.')) || '.mkv';
      const cleanName = `input${ext}`;
      const inputPath = `${mountPoint}/${cleanName}`;
      const cleanFile = new File([this.videoFileOrSource], cleanName, { type: this.videoFileOrSource.type });

      try {
        await ff.createDir(mountPoint);
      } catch {}

      try {
        await ff.mount('WORKERFS' as any, { files: [cleanFile] }, mountPoint);
        this.mountedPath = inputPath;
        logger.success(`[DemuxManager] WORKERFS mounted at ${inputPath}`);
      } catch (err) {
        logger.warn('[DemuxManager] WORKERFS mount failed, writing to MEMFS:', err);
        const buffer = await new Response(this.videoFileOrSource).arrayBuffer();
        await ff.writeFile(inputPath, new Uint8Array(buffer));
        this.mountedPath = inputPath;
      }
    } else {
      // Remote source fallback
      this.mountedPath = `remote_input_${this.uniqueId}.mkv`;
    }
    return this.mountedPath;
  }

  async probe(ff: FFmpeg): Promise<ProbeResult> {
    const inputPath = await this.getMountedInputPath(ff);
    
    if (!(this.videoFileOrSource instanceof File)) {
      // remote probe: load first 2MB
      const source = this.videoFileOrSource as ByteSource;
      const size = await source.getSize();
      const bytes = await source.read(0, Math.min(2 * 1024 * 1024, size - 1));
      await ff.writeFile(inputPath, bytes);
    }

    this.ffmpegMgr.clearLogs();
    try {
      await ff.exec(['-i', inputPath, '-t', '0', '-c', 'copy', '-f', 'null', '-']);
    } catch {}

    const logs = this.ffmpegMgr.getLogs().join('\n');
    return this.parseProbeLogs(logs);
  }

  private parseProbeLogs(logText: string): ProbeResult {
    const streams: MediaStreamInfo[] = [];
    let duration = 0;

    const durationMatch = logText.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (durationMatch) {
      const hrs = parseInt(durationMatch[1], 10);
      const mins = parseInt(durationMatch[2], 10);
      const secs = parseInt(durationMatch[3], 10);
      const ms = parseInt(durationMatch[4], 10);
      duration = hrs * 3600 + mins * 60 + secs + ms / 100;
    }

    const lines = logText.split('\n');
    for (const line of lines) {
      if (!line.includes('Stream #')) continue;

      const indexMatch = line.match(/Stream #\d+:(\d+)/);
      if (!indexMatch) continue;
      const index = parseInt(indexMatch[1], 10);

      let type: 'video' | 'audio' | 'subtitle' | null = null;
      let keyword = '';
      if (line.toLowerCase().includes('video:')) {
        type = 'video';
        keyword = 'video:';
      } else if (line.toLowerCase().includes('audio:')) {
        type = 'audio';
        keyword = 'audio:';
      } else if (line.toLowerCase().includes('subtitle:')) {
        type = 'subtitle';
        keyword = 'subtitle:';
      }

      if (!type) continue;

      let language: string | undefined = undefined;
      const langMatch = line.match(/\(([^)]+)\)(?=\s*:\s*(?:Video|Audio|Subtitle))/i);
      if (langMatch) {
        language = langMatch[1];
      }

      const keywordIndex = line.toLowerCase().indexOf(keyword);
      const details = line.substring(keywordIndex + keyword.length).trim();
      const codec = details.split(',')[0].trim();

      streams.push({ index, type, codec, language, details });
    }

    return { duration, streams };
  }

  private getMkvHeaderOnly(bytes: Uint8Array): Uint8Array {
    for (let i = 0; i <= bytes.length - 4; i++) {
      if (bytes[i] === 0x1f && bytes[i + 1] === 0x43 && bytes[i + 2] === 0xb6 && bytes[i + 3] === 0x75) {
        return bytes.subarray(0, i);
      }
    }
    return bytes;
  }

  /**
   * Slice a short segment of audio into WAV bytes
   */
  async sliceAudio(
    ff: FFmpeg,
    streamIndex: number,
    startTime: number,
    duration: number,
    seekMap?: any[],
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const mountedInputPath = await this.getMountedInputPath(ff);
    const tempOutFile = `slice_${streamIndex}_${startTime}.wav`;
    const isRemoteSource = !(this.videoFileOrSource instanceof File);
    const inputPath = isRemoteSource
      ? `remote_input_${this.uniqueId}_${streamIndex}_${Math.floor(startTime * 1000)}_${Math.random().toString(36).substring(2, 7)}.mkv`
      : mountedInputPath;
    let ffmpegSeekTime = startTime;

    if (isRemoteSource) {
      // Remote chunk: resolve byte range and write chunk
      const source = this.videoFileOrSource as ByteSource;
      const seekList = seekMap || [];
      
      let startOffset = 0;
      let endOffset = 8 * 1024 * 1024;
      let offsetTime = 0;
      const fileSize = await source.getSize();

      const matchedStart = seekList.reduce((prev: any, curr: any) => {
        return curr.time <= startTime ? curr : prev;
      }, seekList[0]);

      if (matchedStart) {
        startOffset = matchedStart.offset;
        offsetTime = matchedStart.time || 0;
        const targetEndTime = startTime + duration + 30;
        const matchedEnd = seekList.reduce((prev: any, curr: any) => {
          return curr.time <= targetEndTime ? curr : prev;
        }, matchedStart);
        endOffset = matchedEnd ? matchedEnd.offset + 8 * 1024 * 1024 : startOffset + 24 * 1024 * 1024;
      } else {
        // Linear fallback
        const size = await source.getSize();
        startOffset = Math.floor((startTime / 3600) * size);
        endOffset = Math.min(startOffset + 24 * 1024 * 1024, size);
        offsetTime = startTime;
      }

      endOffset = Math.min(endOffset, fileSize - 1);
      ffmpegSeekTime = Math.max(0, startTime - offsetTime);

      // Fetch chunk
      const headerProbeBytes = await source.read(0, Math.min(2 * 1024 * 1024, fileSize - 1), signal);
      const headerBytes = this.getMkvHeaderOnly(headerProbeBytes);
      const chunkBytes = await source.read(startOffset, endOffset, signal);

      const concatenated = new Uint8Array(headerBytes.length + chunkBytes.length);
      concatenated.set(headerBytes, 0);
      concatenated.set(chunkBytes, headerBytes.length);

      await ff.writeFile(inputPath, concatenated);
      console.log(
        `[DemuxManager] Remote audio slice start=${startTime}s offset=${offsetTime}s ffmpegSeek=${ffmpegSeekTime}s header=${headerBytes.length} bytes=${startOffset}-${endOffset}`
      );
    }

    try {
      const runSlice = async (seekSeconds: number): Promise<Uint8Array> => {
        const args = [
          '-ss', seekSeconds.toString(),
          '-i', inputPath,
          '-t', duration.toString(),
          '-map', `0:${streamIndex}`,
          '-vn',
          '-acodec', 'pcm_s16le',
          '-ac', '2',
          '-ar', '44100',
          '-f', 'wav',
          tempOutFile
        ];

        console.log(`[FFmpeg Command] ffmpeg ${args.join(" ")}`);
        const startTimeMs = performance.now();
        const code = await ff.exec(args);
        const durationMs = performance.now() - startTimeMs;
        console.log(`[FFmpeg Status] Exit code: ${code}, Duration: ${durationMs.toFixed(2)}ms`);
        if (code !== 0) {
          throw new Error(`FFmpeg slicing returned exit code ${code}`);
        }

        const outputData = await ff.readFile(tempOutFile);
        return outputData as Uint8Array;
      };

      let outputData = await runSlice(ffmpegSeekTime);
      if (isRemoteSource && outputData.byteLength <= 512 && ffmpegSeekTime > 0) {
        console.warn(
          `[DemuxManager] Remote audio slice was empty at seek ${ffmpegSeekTime}s; retrying from start of byte window.`
        );
        try {
          await ff.deleteFile(tempOutFile);
        } catch {}
        outputData = await runSlice(0);
      }
      return outputData;
    } finally {
      try {
        await ff.deleteFile(tempOutFile);
        if (isRemoteSource) {
          await ff.deleteFile(inputPath);
        }
      } catch {}
    }
  }

  async cleanup(ff: FFmpeg): Promise<void> {
    if (this.mountedPath) {
      if (this.videoFileOrSource instanceof File) {
        const mountPoint = this.mountedPath.substring(0, this.mountedPath.lastIndexOf('/'));
        try {
          await ff.unmount(mountPoint);
          await ff.deleteDir(mountPoint);
        } catch {}
      } else {
        try {
          await ff.deleteFile(this.mountedPath);
        } catch {}
      }
      this.mountedPath = null;
    }
  }
}

// ─── 4. PacketReader ─────────────────────────────────────────────────────────

export class PacketReader {
  constructor(
    private demuxMgr: DemuxManager,
    private audioCtx: AudioContext
  ) {}

  async readAudioPacket(
    ff: FFmpeg,
    streamIndex: number,
    startTime: number,
    duration: number,
    seekMap?: any[],
    signal?: AbortSignal
  ): Promise<AudioPacket> {
    const wavBytes = await this.demuxMgr.sliceAudio(ff, streamIndex, startTime, duration, seekMap, signal);
    console.log("Read WAV:", startTime, wavBytes.length);
    
    // Web Audio decoding
    const buffer = await this.audioCtx.decodeAudioData(wavBytes.buffer.slice(0));

    // Print first 10 non-zero samples from channel 0 to verify data
    const channelData = buffer.getChannelData(0);
    const nonZeroSamples: number[] = [];
    for (let i = 0; i < channelData.length && nonZeroSamples.length < 10; i++) {
      if (channelData[i] !== 0) {
        nonZeroSamples.push(channelData[i]);
      }
    }
    console.log(`[PacketReader] First non-zero samples for chunk ${startTime}s: [${nonZeroSamples.join(', ')}]`);
    
    return {
      startTime,
      endTime: startTime + buffer.duration,
      buffer,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels
    };
  }
}

// ─── 5. BufferManager & PacketCache ──────────────────────────────────────────

export class PacketCache {
  private cache = new Map<number, AudioPacket>(); // keyed by integer startTime

  constructor(
    private keepBehind = 30, // seconds to keep behind currentTime
    private keepAhead = 90   // seconds to keep ahead currentTime
  ) {}

  add(packet: AudioPacket, keyStartTime = packet.startTime): void {
    const key = Math.floor(keyStartTime / 10) * 10;
    this.cache.set(key, packet);
  }

  get(time: number): AudioPacket | null {
    const key = Math.floor(time);
    const exact = this.cache.get(key);
    if (exact && time >= exact.startTime && time < exact.endTime) {
      return exact;
    }

    return Array.from(this.cache.values()).find(packet => time >= packet.startTime && time < packet.endTime) || null;
  }

  hasChunk(startTime: number): boolean {
    const chunkKey = Math.floor(startTime / 10) * 10;
    return this.cache.has(chunkKey);
  }

  hasCoverage(startTime: number, endTime: number): boolean {
    const packets = this.getAllPackets().sort((a, b) => a.startTime - b.startTime);
    let coveredUntil = startTime;

    for (const packet of packets) {
      if (packet.endTime <= coveredUntil) continue;
      if (packet.startTime > coveredUntil + 0.15) continue;
      coveredUntil = Math.max(coveredUntil, packet.endTime);
      if (coveredUntil >= endTime - 0.15) return true;
    }

    return false;
  }

  getAllPackets(): AudioPacket[] {
    return Array.from(this.cache.values());
  }

  getEntries(): { chunkKey: number; packet: AudioPacket }[] {
    return Array.from(this.cache.entries()).map(([chunkKey, packet]) => ({ chunkKey, packet }));
  }

  evict(currentTime: number): void {
    for (const [key, packet] of this.cache.entries()) {
      if (packet.endTime < currentTime - this.keepBehind || packet.startTime > currentTime + this.keepAhead) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export interface TimeRange {
  start: number;
  end: number;
}

export class BufferScheduler {
  private readonly lowWaterMark = 15;   // seconds
  private readonly highWaterMark = 50;  // seconds
  private readonly chunkSize = 10;      // seconds
  private isBufferingState = true;      // Start true to buffer 50s initially

  constructor(private cache: PacketCache, private manifest: ChunkManifest) {}

  shouldBuffer(currentTime: number): boolean {
    const bufferedAhead = this.getBufferedAhead(currentTime);

    if (this.isBufferingState) {
      if (bufferedAhead >= this.highWaterMark) {
        this.isBufferingState = false;
      }
    } else {
      if (bufferedAhead < this.lowWaterMark) {
        this.isBufferingState = true;
      }
    }

    return this.isBufferingState;
  }

  reset(): void {
    this.isBufferingState = true;
  }

  getBufferedAhead(currentTime: number): number {
    const ranges = this.getBufferedRanges();
    const activeRange = ranges.find(r => currentTime >= r.start && currentTime <= r.end);
    if (activeRange) {
      return activeRange.end - currentTime;
    }
    return 0;
  }

  getBufferedRanges(): TimeRange[] {
    const ranges: TimeRange[] = [];
    const packets = this.cache.getAllPackets().sort((a, b) => a.startTime - b.startTime);
    for (const p of packets) {
      if (ranges.length === 0) {
        ranges.push({ start: p.startTime, end: p.endTime });
      } else {
        const last = ranges[ranges.length - 1];
        if (p.startTime <= last.end + 0.5) {
          last.end = Math.max(last.end, p.endTime);
        } else {
          ranges.push({ start: p.startTime, end: p.endTime });
        }
      }
    }
    return ranges;
  }

  getMissingTargets(currentTime: number): number[] {
    const missing: number[] = [];
    const startChunk = Math.floor(currentTime / this.chunkSize) * this.chunkSize;
    const limit = startChunk + this.highWaterMark;
    for (let t = startChunk; t < limit; t += this.chunkSize) {
      const state = this.manifest.getState(t);
      const requiredStart = Math.max(t, currentTime);
      const requiredEnd = t + this.chunkSize;
      const hasCoverage = this.cache.hasCoverage(requiredStart, requiredEnd);
      const hasChunk = this.cache.hasChunk(t);
      if (!hasChunk && (!hasCoverage || state === 'EMPTY')) {
        missing.push(t);
      }
    }
    return missing;
  }
}

export class BufferManager {
  private packetCache = new PacketCache(60, 120);
  private subtitleCache = new Map<string, any[]>(); // keyed by streamIndex_offsetTime
  private activeFills = new Map<string, Promise<any>>();
  private failedFills = new Map<string, { count: number; lastTime: number }>();
  private isBuffering = false;

  private readonly COOLDOWN_MS = 8000;
  private readonly MAX_RETRIES = 3;

  constructor(
    private packetReader: PacketReader,
    private onBufferingChange?: (buffering: boolean) => void
  ) {}

  getCache(): PacketCache {
    return this.packetCache;
  }

  getSubtitleCache(): Map<string, any[]> {
    return this.subtitleCache;
  }

  isFailedOrInCooldown(key: string): boolean {
    const record = this.failedFills.get(key);
    if (!record) return false;

    if (record.count >= this.MAX_RETRIES) {
      return true;
    }

    const elapsed = Date.now() - record.lastTime;
    if (elapsed < this.COOLDOWN_MS) {
      console.log(`[BufferManager] Key ${key} is in failure cooldown (${((this.COOLDOWN_MS - elapsed)/1000).toFixed(1)}s remaining). Skipping request.`);
      return true;
    }

    return false;
  }

  markFailed(key: string): void {
    const record = this.failedFills.get(key) || { count: 0, lastTime: 0 };
    record.count += 1;
    record.lastTime = Date.now();
    this.failedFills.set(key, record);
    console.warn(`[BufferManager] Key ${key} failed. Attempt count: ${record.count}/${this.MAX_RETRIES}`);
  }

  resetFailures(): void {
    this.failedFills.clear();
  }

  setBufferingCallback(cb: (buffering: boolean) => void): void {
    this.onBufferingChange = cb;
  }

  private setBuffering(state: boolean): void {
    if (this.isBuffering === state) return;
    this.isBuffering = state;
    if (this.onBufferingChange) {
      this.onBufferingChange(state);
    }
  }

  async getOrFetchPacket(
    ff: FFmpeg,
    streamIndex: number,
    startTime: number,
    duration: number,
    seekMap?: any[],
    signal?: AbortSignal,
    showBuffering = false,
    cacheKeyStartTime = startTime
  ): Promise<AudioPacket> {
    // Critical validation
    if (streamIndex === null || streamIndex === undefined || streamIndex === -1 || isNaN(streamIndex)) {
      throw new Error(`Invalid audio stream selection streamIndex: ${streamIndex}`);
    }

    const chunkKey = Math.floor(cacheKeyStartTime / 10) * 10;
    const key = `audio_${streamIndex}_${chunkKey}`;

    // Check Cooldown/Failure
    if (this.isFailedOrInCooldown(key)) {
      throw new Error(`Buffer request for key ${key} blocked due to cooldown or retry limit`);
    }

    // 1. Check Cache
    const cached = this.packetCache.get(startTime);
    if (cached) {
      return cached;
    }

    // 2. Check if a fetch is already in flight for this chunk
    let promise = this.activeFills.get(key);
    if (!promise) {
      this.setBuffering(true);
      console.log(`[BufferManager] [${new Date().toISOString()}] Launching single-flight audio request for: ${key}`);
      promise = this.packetReader.readAudioPacket(ff, streamIndex, startTime, duration, seekMap, signal)
        .then((packet) => {
          console.log("Cache Insert:", chunkKey, "packetStart:", packet.startTime, "duration:", packet.duration);
          this.packetCache.add(packet, chunkKey);
          return packet;
        })
        .catch((err) => {
          this.markFailed(key);
          throw err;
        })
        .finally(() => {
          this.activeFills.delete(key);
          if (this.activeFills.size === 0) {
            this.setBuffering(false);
          }
        });
      this.activeFills.set(key, promise);
    } else {
      console.log(`[BufferManager] [${new Date().toISOString()}] Re-using existing single-flight audio request for: ${key}`);
    }

    return promise;
  }

  async getOrFetchSubtitles(
    videoId: string,
    streamIndex: number,
    startTime: number,
    duration: number,
    codec: string,
    isRemote: boolean,
    videoFile: File | null,
    cachedSource: any,
    startOffset: number,
    endOffset: number,
    signal?: AbortSignal
  ): Promise<any[]> {
    // Critical validation
    if (streamIndex === null || streamIndex === undefined || streamIndex === -1 || isNaN(streamIndex)) {
      throw new Error(`Invalid subtitle stream selection streamIndex: ${streamIndex}`);
    }

    const key = `sub_${streamIndex}_${Math.floor(startTime)}`;

    // Check Cooldown/Failure
    if (this.isFailedOrInCooldown(key)) {
      throw new Error(`Subtitle request for key ${key} blocked due to cooldown or retry limit`);
    }

    // 1. Check Cache
    const cached = this.subtitleCache.get(key);
    if (cached) {
      console.log(`[BufferManager] [${new Date().toISOString()}] Cache hit for subtitle request: ${key}`);
      return cached;
    }

    // 2. Check if a fetch is already in flight
    let promise = this.activeFills.get(key);
    if (!promise) {
      this.setBuffering(true);
      console.log(`[BufferManager] [${new Date().toISOString()}] Launching single-flight subtitle request for: ${key}`);
      promise = (async () => {
        let text = '';
        if (!isRemote && videoFile) {
          text = await extractLocalSubtitleSegment(videoId, videoFile, startTime, duration, { index: streamIndex, codec }, signal);
        } else {
          text = await extractRemoteSubtitleSegment(videoId, cachedSource, startOffset, endOffset, { index: streamIndex, codec }, signal);
        }
        const isAss = /ass|ssa/i.test(codec);
        const isVtt = /webvtt/i.test(codec);
        const formatExt = isAss ? 'ass' : (isVtt ? 'vtt' : 'srt');
        const parsedCues = parseSubtitles(text, `subtitles.${formatExt}`);
        this.subtitleCache.set(key, parsedCues);
        return parsedCues;
      })()
      .catch((err) => {
        this.markFailed(key);
        throw err;
      })
      .finally(() => {
        this.activeFills.delete(key);
        if (this.activeFills.size === 0) {
          this.setBuffering(false);
        }
      });
      this.activeFills.set(key, promise);
    } else {
      console.log(`[BufferManager] [${new Date().toISOString()}] Re-using existing single-flight subtitle request for: ${key}`);
    }

    return promise;
  }

  clear(): void {
    this.activeFills.clear();
    this.packetCache.clear();
    this.subtitleCache.clear();
    this.setBuffering(false);
  }
}

// ─── 5.5 Playback Queue & Audio Scheduler ────────────────────────────────────

export type ChunkState =
  | 'EMPTY'
  | 'FETCHING'
  | 'DECODED'
  | 'CACHED'
  | 'QUEUED'
  | 'PLAYING'
  | 'PLAYED'
  | 'EVICTABLE'
  | 'REMOVED'
  | 'FAILED'
  | 'COOLDOWN';

export class ChunkManifest {
  public readonly instanceId = Math.random().toString(36).substring(7);
  private states = new Map<number, ChunkState>();

  private static LEGAL_TRANSITIONS: Record<ChunkState, ChunkState[]> = {
    EMPTY: ['FETCHING'],
    FETCHING: ['DECODED', 'FAILED'],
    DECODED: ['CACHED'],
    CACHED: ['QUEUED', 'EVICTABLE', 'EMPTY'],
    QUEUED: ['PLAYING', 'EVICTABLE', 'EMPTY', 'PLAYED'],
    PLAYING: ['PLAYED', 'EVICTABLE', 'EMPTY'],
    PLAYED: ['EVICTABLE', 'EMPTY'],
    EVICTABLE: ['REMOVED', 'EMPTY'],
    FAILED: ['COOLDOWN'],
    COOLDOWN: ['EMPTY'],
    REMOVED: ['EMPTY']
  };

  getState(chunkKey: number): ChunkState {
    return this.states.get(chunkKey) || 'EMPTY';
  }

  transitionTo(chunkKey: number, nextState: ChunkState): void {
    const currentState = this.getState(chunkKey);
    if (currentState === nextState) return;

    const allowed = ChunkManifest.LEGAL_TRANSITIONS[currentState];
    if (!allowed || !allowed.includes(nextState)) {
      console.warn(
        `[ChunkManifest-${this.instanceId}] Invalid chunk state transition: chunk ${chunkKey}s, ${currentState} -> ${nextState}`
      );
    }

    console.log(`[ChunkManifest-${this.instanceId}] Chunk ${chunkKey}s: ${currentState} -> ${nextState}`);
    this.states.set(chunkKey, nextState);
  }

  clear(): void {
    this.states.clear();
  }
}

export class AudioScheduler {
  public readonly instanceId = Math.random().toString(36).substring(7);
  private activeNodes: { node: AudioBufferSourceNode; startTime: number; endTime: number }[] = [];

  constructor(private audioCtx: AudioContext, private gainNode: GainNode) {}

  schedule(packet: AudioPacket, currentTime: number, playbackRate: number): void {
    // Don't schedule if chunk is already fully played
    if (packet.endTime <= currentTime) return;

    // Check if we already scheduled a node covering this timeframe to prevent duplicates
    const alreadyScheduled = this.activeNodes.some(node => node.startTime === packet.startTime);
    if (alreadyScheduled) return;

    const source = this.audioCtx.createBufferSource();
    source.buffer = packet.buffer;
    source.playbackRate.value = playbackRate;
    source.connect(this.gainNode);
    console.log(`[AudioScheduler-${this.instanceId}] Created new AudioBufferSourceNode for chunk starting at ${packet.startTime}s: YES`);

    // Math: when to start audio source relative to AudioContext.currentTime
    const timeDelta = packet.startTime - currentTime;
    const playOffset = Math.max(0, currentTime - packet.startTime);
    const audioStartTime = this.audioCtx.currentTime + (timeDelta > 0 ? timeDelta / playbackRate : 0);

    console.log({
      instanceId: this.instanceId,
      chunk: packet.startTime,
      audioContextState: this.audioCtx.state,
      currentAudioTime: this.audioCtx.currentTime,
      scheduledStartTime: audioStartTime,
      bufferDuration: packet.buffer.duration,
      gain: this.gainNode.gain.value
    });

    source.onended = () => {
      console.log(`[AudioScheduler-${this.instanceId}] Chunk ended:`, packet.startTime);
    };

    source.start(audioStartTime, playOffset);

    this.activeNodes.push({
      node: source,
      startTime: packet.startTime,
      endTime: packet.endTime
    });
    console.log(`[AudioScheduler-${this.instanceId}] Active Sources: ${this.activeNodes.length}`);
  }

  stopAll(): void {
    console.log(`[AudioScheduler-${this.instanceId}] stopAll called. Stopping ${this.activeNodes.length} active nodes.`);
    for (const active of this.activeNodes) {
      try {
        console.log(`[AudioScheduler-${this.instanceId}] source.stop() called for chunk starting at ${active.startTime}s: YES`);
        active.node.stop();
      } catch (e: any) {
        console.log(`[AudioScheduler-${this.instanceId}] source.stop() failed or already stopped for chunk starting at ${active.startTime}s: ${e.message}`);
      }
    }
    this.activeNodes = [];
    console.log(`[AudioScheduler-${this.instanceId}] Active Sources: 0`);
  }

  evictPlayed(currentTime: number): number[] {
    const evictedStartTimes: number[] = [];
    this.activeNodes = this.activeNodes.filter(node => {
      if (node.endTime <= currentTime) {
        evictedStartTimes.push(node.startTime);
        return false;
      }
      return true;
    });
    return evictedStartTimes;
  }

  async suspend(): Promise<void> {
    if (this.audioCtx.state !== 'suspended') {
      await this.audioCtx.suspend();
    }
  }

  async resume(): Promise<void> {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  updatePlaybackRate(rate: number): void {
    for (const active of this.activeNodes) {
      try {
        active.node.playbackRate.value = rate;
      } catch {}
    }
  }
}

export class PlaybackQueue {
  public readonly instanceId = Math.random().toString(36).substring(7);
  private scheduledTimes = new Set<number>();

  constructor(
    private cache: PacketCache,
    private audioScheduler: AudioScheduler,
    private manifest: ChunkManifest
  ) {}

  update(currentTime: number, playbackRate: number): void {

    // Reschedule any cached packets that fall within the upcoming 50-second window and are not yet scheduled
    const highWaterTarget = currentTime + 50;
    const cachedPackets = this.cache.getEntries()
      .filter(({ packet }) => packet.endTime > currentTime && packet.startTime < highWaterTarget)
      .sort((a, b) => {
        const aCoversPlayhead = currentTime >= a.packet.startTime && currentTime < a.packet.endTime;
        const bCoversPlayhead = currentTime >= b.packet.startTime && currentTime < b.packet.endTime;
        if (aCoversPlayhead !== bCoversPlayhead) return aCoversPlayhead ? -1 : 1;
        return a.packet.startTime - b.packet.startTime;
      });

    for (const { chunkKey, packet } of cachedPackets) {
      if (packet.endTime > currentTime && packet.startTime < highWaterTarget) {
        if (!this.scheduledTimes.has(chunkKey)) {
          this.scheduledTimes.add(chunkKey);
          
          this.manifest.transitionTo(chunkKey, 'QUEUED');
          console.log(`[PlaybackQueue-${this.instanceId}] Scheduling Audio:`, chunkKey);
          this.audioScheduler.schedule(packet, currentTime, playbackRate);
          console.log(`[PlaybackQueue-${this.instanceId}] Scheduled cached chunk ${chunkKey}s on-the-fly.`);
        }
      }
    }

    // Evict played chunks from scheduled tracking based on audioScheduler's evicted nodes
    const evicted = this.audioScheduler.evictPlayed(currentTime);
    for (const startTime of evicted) {
      const chunkKey = Math.floor(startTime / 10) * 10;
      this.scheduledTimes.delete(chunkKey);
      this.manifest.transitionTo(chunkKey, 'PLAYED');
    }
  }

  hasScheduled(startTime: number): boolean {
    const chunkKey = Math.floor(startTime / 10) * 10;
    return this.scheduledTimes.has(chunkKey);
  }

  markScheduled(startTime: number): void {
    const chunkKey = Math.floor(startTime / 10) * 10;
    this.scheduledTimes.add(chunkKey);
  }

  clear(): void {
    this.audioScheduler.stopAll();
    this.scheduledTimes.clear();
  }

  getQueueSize(): number {
    return this.scheduledTimes.size;
  }
}

async function runWithLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: Promise<T>[] = [];
  const executing: Promise<any>[] = [];
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    if (limit <= tasks.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

// ─── 6. PlaybackController ───────────────────────────────────────────────────

export class PlaybackController {
  private audioCtx: AudioContext;
  private videoEl: HTMLVideoElement | null = null;
  private packetReader: PacketReader;
  private bufferManager: BufferManager;
  private scheduler: BufferScheduler;
  private ff: FFmpeg | null = null;
  private abortController = new AbortController();

  // Track settings
  private activeStreamIndex = -1;
  private playbackRate = 1.0;

  private audioScheduler: AudioScheduler;
  private playbackQueue: PlaybackQueue;
  private fetchingKeys = new Set<number>();

  // Architectural manifest & session tracking
  private manifest = new ChunkManifest();
  private sessionId = '';
  private playbackGeneration = 0;
  private chunkAbortController = new AbortController();
  private heartbeatIntervalId: any = null;
  private isTransitioningState = false;
  private maintenanceFrozen = false;
  private listenersBound = false;
  public readonly instanceId = Math.random().toString(36).substring(7);

  private onBufferingChange: ((buffering: boolean) => void) | null = null;
  private gainNode: GainNode;

  constructor(
    private ffmpegMgr: FFmpegManager,
    private demuxMgr: DemuxManager,
    private seekMap?: any[]
  ) {
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.packetReader = new PacketReader(this.demuxMgr, this.audioCtx);
    this.bufferManager = new BufferManager(this.packetReader, (buffering) => {
      console.log(`[PlaybackController-${this.instanceId}] BufferManager callback triggered: buffering=${buffering}`);
      if (this.onBufferingChange) {
        this.onBufferingChange(buffering);
      }
    });
    this.scheduler = new BufferScheduler(this.bufferManager.getCache(), this.manifest);
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);

    this.audioScheduler = new AudioScheduler(this.audioCtx, this.gainNode);
    this.playbackQueue = new PlaybackQueue(this.bufferManager.getCache(), this.audioScheduler, this.manifest);
    console.log(`[PlaybackController-${this.instanceId}] Created controller instance.`);
  }

  getBufferManager(): BufferManager {
    return this.bufferManager;
  }

  getFFmpeg(): FFmpeg | null {
    return this.ff;
  }

  async initialize(videoEl: HTMLVideoElement, streamIndex: number | null): Promise<void> {
    this.videoEl = videoEl;
    this.videoEl.muted = true; // Mute video element - audio is played via AudioContext
    this.activeStreamIndex = typeof streamIndex === 'number' ? streamIndex : -1;
    this.bufferManager.resetFailures();
    this.sessionId = Math.random().toString(36).substring(7);
    console.log(`[PlaybackController-${this.instanceId}] Initializing controller. session=${this.sessionId}, track=${this.activeStreamIndex}`);

    this.ff = await this.ffmpegMgr.load();
    if (this.abortController.signal.aborted) {
      console.log(`[PlaybackController-${this.instanceId}] Init aborted during ffmpeg load.`);
      return;
    }

    await this.demuxMgr.getMountedInputPath(this.ff);
    if (this.abortController.signal.aborted) {
      console.log(`[PlaybackController-${this.instanceId}] Init aborted during demux mount.`);
      return;
    }

    // Bind event listeners only if we are still active
    if (!this.abortController.signal.aborted) {
      this.videoEl.addEventListener('timeupdate', this.onTimeUpdate);
      this.videoEl.addEventListener('play', this.onPlayEvent);
      this.videoEl.addEventListener('pause', this.onPauseEvent);
      this.listenersBound = true;
      console.log(`[PlaybackController-${this.instanceId}] Event listeners bound to video element.`);
    }
  }

  setBufferingCallback(cb: (buffering: boolean) => void): void {
    console.log(`[PlaybackController-${this.instanceId}] setBufferingCallback registered.`);
    this.onBufferingChange = cb;
    this.bufferManager.setBufferingCallback((bmBuffering) => {
      if (!this.videoEl) {
        cb(bmBuffering);
        return;
      }
      const needsBuffering = bmBuffering && this.scheduler.shouldBuffer(this.videoEl.currentTime);
      cb(needsBuffering);
    });
  }

  private startHeartbeat(): void {
    if (this.heartbeatIntervalId) return;
    console.log(`[PlaybackController-${this.instanceId}] Starting heartbeat safety net timer.`);
    this.heartbeatIntervalId = setInterval(() => {
      this.runSchedulerCycle('heartbeat');
    }, 250);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      console.log(`[PlaybackController-${this.instanceId}] Stopping heartbeat safety net timer.`);
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private onTimeUpdate = () => {
    this.runSchedulerCycle('timeupdate');
  };

  private onPlayEvent = () => {
    console.log(`[PlaybackController-${this.instanceId}] Native play event detected.`);
    this.play().catch(console.error);
  };

  private onPauseEvent = () => {
    console.log(`[PlaybackController-${this.instanceId}] Native pause event detected.`);
    this.pause();
  };

  private heartbeatTickCount = 0;

  private startNewPlaybackGeneration(reason: string): number {
    this.playbackGeneration++;
    this.sessionId = Math.random().toString(36).substring(7);
    this.chunkAbortController.abort();
    this.chunkAbortController = new AbortController();
    this.fetchingKeys.clear();
    this.bufferManager.clearActiveFills();
    console.log(
      `[PlaybackController-${this.instanceId}] New playback generation ${this.playbackGeneration} (${reason}). session=${this.sessionId}`
    );
    return this.playbackGeneration;
  }

  private resetQueueAndTimeline(): void {
    this.playbackQueue.clear();
    this.manifest.clear();
    this.scheduler.reset();
  }

  beginSeekTransaction(reason = 'external'): number {
    this.maintenanceFrozen = true;
    this.stopHeartbeat();
    console.log(`[PlaybackController-${this.instanceId}] Seek transaction started (${reason}).`);
    return this.playbackGeneration;
  }

  endSeekTransaction(reason = 'external'): void {
    this.maintenanceFrozen = false;
    console.log(`[PlaybackController-${this.instanceId}] Seek transaction ended (${reason}).`);
  }

  private hydrateManifestFromCache(): void {
    for (const packet of this.bufferManager.getCache().getAllPackets()) {
      const chunkKey = Math.floor(packet.startTime / 10) * 10;
      const state = this.manifest.getState(chunkKey);
      if (state === 'EMPTY') {
        this.manifest.transitionTo(chunkKey, 'FETCHING');
        this.manifest.transitionTo(chunkKey, 'DECODED');
      } else if (state === 'FETCHING') {
        this.manifest.transitionTo(chunkKey, 'DECODED');
      }
      if (this.manifest.getState(chunkKey) !== 'CACHED') {
        this.manifest.transitionTo(chunkKey, 'CACHED');
      }
    }
  }

  private runSchedulerCycle(callerName: string): void {
    if (this.abortController.signal.aborted) return;
    if (this.maintenanceFrozen) return;
    if (!this.videoEl) return;
    const currentTime = this.videoEl.currentTime;

    // Evict old cache items via bufferManager cache
    this.bufferManager.getCache().evict(currentTime);

    if (this.videoEl.paused) return;

    // Update queue to schedule cached chunks and prune completed
    this.playbackQueue.update(currentTime, this.playbackRate);

    if (callerName === 'heartbeat') {
      this.heartbeatTickCount++;
      if (this.heartbeatTickCount % 20 === 0) {
        const bufferedRanges = this.bufferManager.getCache().getAllPackets()
          .map(p => `${p.startTime}-${p.endTime.toFixed(1)}`).join(', ');
        console.log(`[PlaybackController-${this.instanceId}] Video Time: ${currentTime.toFixed(2)}, AudioContext Time: ${this.audioCtx.currentTime.toFixed(2)}, Queue Size: ${this.playbackQueue.getQueueSize()}, Buffered: [${bufferedRanges || 'none'}]`);
      }
    }

    // Check if buffering is needed
    this.fillBufferWindow(currentTime, callerName).catch(console.error);
  }

  private async fillBufferWindow(
    currentTime: number,
    callerName = 'unknown',
    generation = this.playbackGeneration,
    showCurrentBuffering = false
  ): Promise<void> {
    if (!this.ff) return;
    if (this.activeStreamIndex === -1 || this.activeStreamIndex === null || typeof this.activeStreamIndex !== 'number') return;
    if (generation !== this.playbackGeneration) return;
    if (this.maintenanceFrozen && callerName !== 'seek' && callerName !== 'playSyncedFromCurrentTime' && callerName !== 'play' && callerName !== 'switchAudioTrack') return;

    const signal = this.chunkAbortController.signal;
    const currentChunk = Math.floor(currentTime / 10) * 10;

    // If scheduler says we don't need to buffer, skip
    if (!this.scheduler.shouldBuffer(currentTime)) return;

    const missing = this.scheduler.getMissingTargets(currentTime);
    if (missing.length === 0) return;

    // PROXIMITY SORTING: nearest chunks to current playback time have highest priority
    missing.sort((a, b) => Math.abs(a - currentTime) - Math.abs(b - currentTime));

    console.log(`[PlaybackController-${this.instanceId}] [${new Date().toISOString()}] fillBufferWindow called by '${callerName}'. Missing targets: [${missing.join(', ')}]`);

    const chunkSize = 10;
    const activeSession = this.sessionId;

    // Concurrency Worker pool limiter (limit = 3 concurrent fetch tasks)
    const tasks = missing.map((target) => async () => {
      // Discard immediately if the media session is obsolete
      if (this.sessionId !== activeSession || this.abortController.signal.aborted) return;

      const key = `audio_${this.activeStreamIndex}_${target}`;
      const targetHasCoverage = this.bufferManager.getCache().hasCoverage(
        Math.max(target, currentTime),
        target + chunkSize
      );
      const targetHasChunk = this.bufferManager.getCache().hasChunk(target);
      
      // Deduplicate if already scheduled/fetching or failed
      if (
        this.fetchingKeys.has(target) ||
        targetHasChunk ||
        (targetHasCoverage && this.playbackQueue.hasScheduled(target)) ||
        this.bufferManager.isFailedOrInCooldown(key)
      ) {
        return;
      }

      this.fetchingKeys.add(target);
      const currentState = this.manifest.getState(target);
      if (!targetHasCoverage && !targetHasChunk && currentState !== 'EMPTY' && currentState !== 'FETCHING') {
        this.manifest.transitionTo(target, 'EMPTY');
      }
      if (this.manifest.getState(target) !== 'FETCHING') {
        this.manifest.transitionTo(target, 'FETCHING');
      }

      try {
        const requestStart = target === currentChunk ? Math.max(currentTime, target) : target;
        const requestDuration = Math.max(0.25, target + chunkSize - requestStart);
        console.log(
          `[PlaybackController-${this.instanceId}] Requesting chunk ${target}s from ${requestStart.toFixed(3)}s for ${requestDuration.toFixed(3)}s`
        );
        const packet = await this.bufferManager.getOrFetchPacket(
          this.ff!,
          this.activeStreamIndex,
          requestStart,
          requestDuration,
          this.seekMap,
          signal,
          showCurrentBuffering && target === currentChunk,
          target
        );

        // Discard result if session changed during async await
        // Discard result if session changed during async await
        if (this.sessionId !== activeSession || this.abortController.signal.aborted) {
          console.log(`[PlaybackController-${this.instanceId}] Discarding fetched chunk ${target}s due to session ID change.`);
          return;
        }

        // A current chunk can legitimately be short when playback starts inside that chunk.
        if (packet.duration <= 0.05) {
          throw new Error(`Chunk ${target}s is truncated/too short: duration=${packet.duration}s`);
        }

        this.manifest.transitionTo(target, 'DECODED');
        this.manifest.transitionTo(target, 'CACHED');

        // Immediately schedule newly fetched packet if playhead is still relevant
        if (this.videoEl && !this.videoEl.paused) {
          this.playbackQueue.update(this.videoEl.currentTime, this.playbackRate);
        }
      } catch (err: any) {
        console.warn(`[PlaybackController-${this.instanceId}] Buffering chunk ${target} failed: ${err?.message || err}`);
        
        this.manifest.transitionTo(target, 'FAILED');
        this.manifest.transitionTo(target, 'COOLDOWN');

        // Self-healing: Reset to EMPTY after 8 seconds cooldown
        const targetSession = this.sessionId;
        setTimeout(() => {
          if (this.sessionId === targetSession && this.manifest.getState(target) === 'COOLDOWN') {
            this.manifest.transitionTo(target, 'EMPTY');
          }
        }, 8000);

        this.playbackQueue.clear(); // Safe state cleanup on failure
      } finally {
        this.fetchingKeys.delete(target);
      }
    });

    await runWithLimit(tasks, 3);
  }

  async play(): Promise<void> {
    if (this.abortController.signal.aborted) return;
    if (!this.videoEl) return;
    if (this.isTransitioningState) return;
    this.isTransitioningState = true;

    try {
      console.log(`[PlaybackController-${this.instanceId}] Playback State: PLAYING`);
      await this.audioScheduler.resume();

      this.bufferManager.resetFailures();
      this.scheduler.reset();
      this.playbackQueue.clear();
      this.manifest.clear();
      // Sync manifest from cache
      for (const packet of this.bufferManager.getCache().getAllPackets()) {
        const chunkKey = Math.floor(packet.startTime / 10) * 10;
        this.manifest.transitionTo(chunkKey, 'CACHED');
      }
      this.fetchingKeys.clear();
      const currentTime = this.videoEl.currentTime;
      await this.fillBufferWindow(currentTime, 'play');
      this.playbackQueue.update(currentTime, this.playbackRate);
      this.startHeartbeat();

      await this.videoEl.play();
    } finally {
      this.isTransitioningState = false;
    }
  }

  async playSyncedFromCurrentTime(): Promise<void> {
    if (this.abortController.signal.aborted) return;
    if (!this.videoEl) return;
    if (this.isTransitioningState) return;
    this.isTransitioningState = true;

    try {
      console.log(`[PlaybackController-${this.instanceId}] Playback State: PLAYING_SYNCED`);
      const generation = this.startNewPlaybackGeneration('playSyncedFromCurrentTime');
      this.resetQueueAndTimeline();
      this.hydrateManifestFromCache();

      await this.fillBufferWindow(this.videoEl.currentTime, 'playSyncedFromCurrentTime', generation, true);
      if (generation !== this.playbackGeneration) return;

      await this.audioScheduler.resume();
      await this.videoEl.play();
      if (generation !== this.playbackGeneration) return;

      const syncedTime = this.videoEl.currentTime;
      this.playbackQueue.clear();
      this.hydrateManifestFromCache();
      this.playbackQueue.update(syncedTime, this.playbackRate);
      this.startHeartbeat();
    } finally {
      this.isTransitioningState = false;
    }
  }

  pause(): void {
    if (this.abortController.signal.aborted) return;
    if (this.isTransitioningState) return;
    this.isTransitioningState = true;

    try {
      console.log(`[PlaybackController-${this.instanceId}] Playback State: PAUSED`);
      if (this.videoEl) {
        this.videoEl.pause();
      }
      this.stopHeartbeat();
      this.playbackQueue.clear();
      this.audioScheduler.suspend().catch(console.error);
    } finally {
      this.isTransitioningState = false;
    }
  }

  async seek(time: number): Promise<void> {
    if (this.abortController.signal.aborted) return;
    this.fetchingKeys.clear();
    this.playbackQueue.clear();
    this.manifest.clear();
    this.bufferManager.clear();
    this.bufferManager.resetFailures();
    this.scheduler.reset();

    if (this.videoEl) {
      this.videoEl.currentTime = time;
    }

    await this.fillBufferWindow(time, 'seek');
    this.playbackQueue.update(time, this.playbackRate);
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this.playbackRate = rate;
    if (this.videoEl) {
      this.videoEl.playbackRate = rate;
    }
    this.audioScheduler.updatePlaybackRate(rate);
  }

  setVolume(volume: number, isMuted: boolean): void {
    if (this.gainNode) {
      this.gainNode.gain.value = isMuted ? 0 : volume;
    }
  }

  async switchAudioTrack(streamIndex: number | null): Promise<void> {
    if (this.abortController.signal.aborted) return;
    this.activeStreamIndex = typeof streamIndex === 'number' ? streamIndex : -1;
    console.log(`[PlaybackController-${this.instanceId}] switchAudioTrack called. streamIndex=${this.activeStreamIndex}`);
    this.fetchingKeys.clear();
    this.playbackQueue.clear();
    this.manifest.clear();
    this.bufferManager.clear();
    this.bufferManager.resetFailures();
    this.scheduler.reset();

    if (this.videoEl) {
      const currentTime = this.videoEl.currentTime;
      await this.fillBufferWindow(currentTime, 'switchAudioTrack');
      this.playbackQueue.update(currentTime, this.playbackRate);
    }
  }

  async destroy(): Promise<void> {
    console.log(`[PlaybackController-${this.instanceId}] destroy called.`);
    this.abortController.abort();
    this.stopHeartbeat();
    if (this.videoEl && this.listenersBound) {
      this.videoEl.removeEventListener('timeupdate', this.onTimeUpdate);
      this.videoEl.removeEventListener('play', this.onPlayEvent);
      this.videoEl.removeEventListener('pause', this.onPauseEvent);
      this.listenersBound = false;
      console.log(`[PlaybackController-${this.instanceId}] Event listeners removed from video element.`);
    }
    this.fetchingKeys.clear();
    this.playbackQueue.clear();
    this.manifest.clear();
    if (this.audioCtx) {
      await this.audioCtx.close().catch(() => {});
    }
    if (this.ff) {
      await this.demuxMgr.cleanup(this.ff).catch(() => {});
    }
    this.bufferManager.clear();
  }
}
