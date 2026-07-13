import { FFmpeg } from '@ffmpeg/ffmpeg';
import { 
  FFmpegManager, 
  DemuxManager, 
  PacketReader, 
  BufferManager, 
  BufferScheduler, 
  ChunkManifest, 
  AudioScheduler, 
  PlaybackQueue 
} from '../mediaPipeline';
import { PlaybackState } from './PlaybackState';
import { PlaybackSession } from './PlaybackSession';
import { Timeline } from './Timeline';

// Concurrency Worker pool limiter helper
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

export class PlaybackController {
  private audioCtx: AudioContext;
  private videoEl: HTMLVideoElement | null = null;
  private packetReader: PacketReader;
  private bufferManager: BufferManager;
  private scheduler: BufferScheduler;
  private ff: FFmpeg | null = null;

  private audioScheduler: AudioScheduler;
  private playbackQueue: PlaybackQueue;
  private fetchingKeys = new Set<number>();

  private manifest = new ChunkManifest();
  private listenersBound = false;
  private onBufferingChange: ((buffering: boolean) => void) | null = null;
  private gainNode: GainNode;

  public state = new PlaybackState();
  public session = new PlaybackSession();
  public timeline: Timeline;

  constructor(
    private ffmpegMgr: FFmpegManager,
    private demuxMgr: DemuxManager,
    seekMap?: any[]
  ) {
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.packetReader = new PacketReader(this.demuxMgr, this.audioCtx);
    this.bufferManager = new BufferManager(this.packetReader, (buffering) => {
      console.log(`[PlaybackController-${this.session.instanceId}] BufferManager callback triggered: buffering=${buffering}`);
      this.state.isBuffering = buffering;
      if (this.onBufferingChange) {
        this.onBufferingChange(buffering);
      }
    });
    this.scheduler = new BufferScheduler(this.bufferManager.getCache(), this.manifest);
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);

    this.audioScheduler = new AudioScheduler(this.audioCtx, this.gainNode);
    this.playbackQueue = new PlaybackQueue(this.bufferManager.getCache(), this.audioScheduler, this.manifest);
    this.timeline = new Timeline(seekMap);
    
    console.log(`[PlaybackController-${this.session.instanceId}] Created controller instance.`);
  }

  get instanceId(): string {
    return this.session.instanceId;
  }

  getBufferManager(): BufferManager {
    return this.bufferManager;
  }

  getFFmpeg(): FFmpeg | null {
    return this.ff;
  }

  getCurrentTime(): number {
    return this.videoEl ? this.videoEl.currentTime : 0;
  }

  async initialize(videoEl: HTMLVideoElement, streamIndex: number | null): Promise<void> {
    this.videoEl = videoEl;
    this.videoEl.muted = true; // Mute video element - audio is played via AudioContext
    this.state.activeStreamIndex = typeof streamIndex === 'number' ? streamIndex : -1;
    this.bufferManager.resetFailures();
    
    // 1. Setup new playback generation to initialize abort signals and sessionId correctly
    const generation = this.startNewPlaybackGeneration('initialize');
    console.log(`[PlaybackController-${this.instanceId}] Initializing controller. session=${this.session.sessionId}, track=${this.state.activeStreamIndex}`);

    this.ff = await this.ffmpegMgr.load();
    if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) {
      console.log(`[PlaybackController-${this.instanceId}] Init aborted during ffmpeg load.`);
      return;
    }

    await this.demuxMgr.getMountedInputPath(this.ff);
    if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) {
      console.log(`[PlaybackController-${this.instanceId}] Init aborted during demux mount.`);
      return;
    }

    // Bind event listeners only if we are still active
    if (!this.session.abortController.signal.aborted && generation === this.session.playbackGeneration) {
      this.videoEl.addEventListener('timeupdate', this.onTimeUpdate);
      this.videoEl.addEventListener('play', this.onPlayEvent);
      this.videoEl.addEventListener('pause', this.onPauseEvent);
      this.listenersBound = true;
      console.log(`[PlaybackController-${this.instanceId}] Event listeners bound to video element.`);

      const resumeTime = this.videoEl.currentTime;
      const startChunk = Math.floor(resumeTime / 10) * 10;
      const chunkId = `audio_${this.state.activeStreamIndex}_${startChunk}`;
      console.log(`[PlaybackController-${this.instanceId}] PLAYER INITIALIZED: resumeTime=${resumeTime.toFixed(3)}s, initialAudioChunkId=${chunkId}`);

      // 2. Warm the audio pipeline by fetching/decoding the initial chunk(s) asynchronously before play begins
      console.log(`[PlaybackController-${this.instanceId}] Warming audio pipeline: pre-buffering chunk ${startChunk}s for resumeTime=${resumeTime.toFixed(3)}s`);
      this.fillBufferWindow(resumeTime, 'initialize', generation, true).then(() => {
        if (generation === this.session.playbackGeneration) {
          this.hydrateManifestFromCache();
          console.log(`[PlaybackController-${this.instanceId}] Audio pipeline warmed successfully. Initial chunks cached.`);
        }
      }).catch(err => {
        console.warn(`[PlaybackController-${this.instanceId}] Background pre-buffering failed:`, err);
      });
    }
  }

  setBufferingCallback(cb: (buffering: boolean) => void): void {
    console.log(`[PlaybackController-${this.instanceId}] setBufferingCallback registered.`);
    this.onBufferingChange = cb;
    this.bufferManager.setBufferingCallback((bmBuffering) => {
      this.state.isBuffering = bmBuffering;
      if (!this.videoEl) {
        cb(bmBuffering);
        return;
      }
      const needsBuffering = bmBuffering && this.scheduler.shouldBuffer(this.videoEl.currentTime);
      cb(needsBuffering);
    });
  }

  private startHeartbeat(): void {
    if (this.session.heartbeatIntervalId) return;
    console.log(`[PlaybackController-${this.instanceId}] Starting heartbeat safety net timer.`);
    this.session.heartbeatIntervalId = setInterval(() => {
      this.runSchedulerCycle('heartbeat');
    }, 250);
  }

  private stopHeartbeat(): void {
    if (this.session.heartbeatIntervalId) {
      console.log(`[PlaybackController-${this.instanceId}] Stopping heartbeat safety net timer.`);
      clearInterval(this.session.heartbeatIntervalId);
      this.session.heartbeatIntervalId = null;
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
    const generation = this.session.startNewGeneration(reason);
    this.fetchingKeys.clear();
    this.bufferManager.clearActiveFills();
    return generation;
  }

  private resetQueueAndTimeline(): void {
    this.playbackQueue.clear();
    this.manifest.clear();
    this.scheduler.reset();
  }

  beginSeekTransaction(reason = 'external'): number {
    this.session.maintenanceFrozen = true;
    this.stopHeartbeat();
    console.log(`[PlaybackController-${this.instanceId}] Seek transaction started (${reason}).`);
    return this.session.playbackGeneration;
  }

  endSeekTransaction(reason = 'external'): void {
    this.session.maintenanceFrozen = false;
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
    if (this.session.abortController.signal.aborted) return;
    if (this.session.maintenanceFrozen) return;
    if (!this.videoEl) return;
    const currentTime = this.videoEl.currentTime;

    // Evict old cache items via bufferManager cache
    this.bufferManager.getCache().evict(currentTime);

    if (this.videoEl.paused) return;

    // Drift detection & correction loop
    const audioPlayhead = this.audioScheduler.getCurrentPlayhead();
    if (this.timeline.checkDrift(currentTime, audioPlayhead)) {
      console.warn(`[PlaybackController-${this.instanceId}] Audio-Video sync drift detected: Video=${currentTime.toFixed(3)}s, Audio=${audioPlayhead?.toFixed(3)}s. Re-syncing scheduler...`);
      this.audioScheduler.stopAll();
      this.playbackQueue.clear();
      this.hydrateManifestFromCache();
    }

    // Update queue to schedule cached chunks and prune completed
    this.playbackQueue.update(currentTime, this.state.playbackRate);

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
    generation = this.session.playbackGeneration,
    showCurrentBuffering = false
  ): Promise<void> {
    if (!this.ff) return;
    if (this.state.activeStreamIndex === -1 || this.state.activeStreamIndex === null || typeof this.state.activeStreamIndex !== 'number') return;
    if (generation !== this.session.playbackGeneration) return;
    if (this.session.maintenanceFrozen && callerName !== 'seek' && callerName !== 'playSyncedFromCurrentTime' && callerName !== 'play' && callerName !== 'switchAudioTrack') return;

    const signal = this.session.chunkAbortController.signal;
    const currentChunk = Math.floor(currentTime / 10) * 10;

    // If scheduler says we don't need to buffer, skip
    if (!this.scheduler.shouldBuffer(currentTime)) return;

    const missing = this.scheduler.getMissingTargets(currentTime);
    if (missing.length === 0) return;

    // PROXIMITY SORTING: nearest chunks to current playback time have highest priority
    missing.sort((a, b) => Math.abs(a - currentTime) - Math.abs(b - currentTime));

    console.log(`[PlaybackController-${this.instanceId}] [${new Date().toISOString()}] fillBufferWindow called by '${callerName}'. Missing targets: [${missing.join(', ')}]`);

    const chunkSize = 10;
    const activeSession = this.session.sessionId;

    // Concurrency Worker pool limiter (limit = 3 concurrent fetch tasks)
    const tasks = missing.map((target) => async () => {
      // Discard immediately if the media session is obsolete
      if (this.session.sessionId !== activeSession || this.session.abortController.signal.aborted) return;

      const key = `audio_${this.state.activeStreamIndex}_${target}`;
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
          this.state.activeStreamIndex,
          requestStart,
          requestDuration,
          this.timeline.seekMap,
          signal,
          showCurrentBuffering && target === currentChunk,
          target
        );

        // Discard result if session changed during async await
        if (this.session.sessionId !== activeSession || this.session.abortController.signal.aborted) {
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
          this.playbackQueue.update(this.videoEl.currentTime, this.state.playbackRate);
        }
      } catch (err: any) {
        console.warn(`[PlaybackController-${this.instanceId}] Buffering chunk ${target} failed: ${err?.message || err}`);
        
        this.manifest.transitionTo(target, 'FAILED');
        this.manifest.transitionTo(target, 'COOLDOWN');

        // Self-healing: Reset to EMPTY after 8 seconds cooldown
        const targetSession = this.session.sessionId;
        setTimeout(() => {
          if (this.session.sessionId === targetSession && this.manifest.getState(target) === 'COOLDOWN') {
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
    if (this.session.abortController.signal.aborted) return;
    if (!this.videoEl) return;
    if (this.session.isTransitioningState) return;
    this.session.isTransitioningState = true;
    this.state.isPlaying = true;

    try {
      console.log(`[PlaybackController-${this.instanceId}] Playback State: PLAYING`);
      const generation = this.startNewPlaybackGeneration('play');
      await this.audioScheduler.resume();
      if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) return;

      this.bufferManager.resetFailures();
      this.scheduler.reset();
      this.playbackQueue.clear();
      this.manifest.clear();
      this.fetchingKeys.clear();
      
      const currentTime = this.videoEl.currentTime;
      
      // 1. Pre-fetch and pre-decode the audio chunk for the current position so it's ready in memory
      await this.fillBufferWindow(currentTime, 'play', generation, true);
      if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) return;

      // 2. Play the video element
      await this.videoEl.play();
      if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) return;

      // 3. Once video element is active, fetch the real playhead and schedule audio
      const syncedTime = this.videoEl.currentTime;
      this.playbackQueue.clear();
      this.hydrateManifestFromCache();
      this.playbackQueue.update(syncedTime, this.state.playbackRate);
      
      this.startHeartbeat();
    } finally {
      this.session.isTransitioningState = false;
    }
  }

  async playSyncedFromCurrentTime(): Promise<void> {
    if (this.session.abortController.signal.aborted) return;
    if (!this.videoEl) return;
    if (this.session.isTransitioningState) return;
    this.session.isTransitioningState = true;
    this.state.isPlaying = true;

    try {
      console.log(`[PlaybackController-${this.instanceId}] Playback State: PLAYING_SYNCED`);
      const generation = this.startNewPlaybackGeneration('playSyncedFromCurrentTime');
      this.resetQueueAndTimeline();
      this.hydrateManifestFromCache();

      // 1. Pre-fetch and pre-decode the audio chunk
      await this.fillBufferWindow(this.videoEl.currentTime, 'playSyncedFromCurrentTime', generation, true);
      if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) return;

      // 2. Resume context and play
      await this.audioScheduler.resume();
      if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) return;

      await this.videoEl.play();
      if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) return;

      // 3. Once video element is active, schedule matching audio playhead
      const syncedTime = this.videoEl.currentTime;
      this.playbackQueue.clear();
      this.hydrateManifestFromCache();
      this.playbackQueue.update(syncedTime, this.state.playbackRate);
      
      this.startHeartbeat();
    } finally {
      this.session.isTransitioningState = false;
    }
  }

  pause(): void {
    if (this.session.abortController.signal.aborted) return;
    if (this.session.isTransitioningState) return;
    this.session.isTransitioningState = true;
    this.state.isPlaying = false;

    try {
      console.log(`[PlaybackController-${this.instanceId}] Playback State: PAUSED`);
      
      // Cancel current playback generation & downloads immediately
      this.startNewPlaybackGeneration('pause');

      if (this.videoEl) {
        this.videoEl.pause();
      }
      this.stopHeartbeat();
      this.playbackQueue.clear();
      this.audioScheduler.stopAll();
      this.audioScheduler.suspend().catch(console.error);
    } finally {
      this.session.isTransitioningState = false;
    }
  }

  async seek(time: number): Promise<void> {
    if (this.session.abortController.signal.aborted) return;
    if (this.session.isTransitioningState) return;
    this.session.isTransitioningState = true;

    const wasPlaying = this.videoEl ? !this.videoEl.paused : false;
    
    // 1. Transactional initialization: abort previous fetches/processes and freeze heartbeat
    const generation = this.startNewPlaybackGeneration('seek');
    this.beginSeekTransaction('seek');
    
    this.fetchingKeys.clear();
    this.playbackQueue.clear();
    this.manifest.clear();
    this.bufferManager.clear();
    this.bufferManager.resetFailures();
    this.scheduler.reset();
    this.audioScheduler.stopAll();

    try {
      if (this.videoEl) {
        this.videoEl.currentTime = time;
      }

      // 2. Pre-buffer and decode the target audio chunk for the new position
      await this.fillBufferWindow(time, 'seek', generation);
      if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) return;

      // 3. Resume audio contexts and restart playback contiguously
      if (wasPlaying && this.videoEl) {
        await this.videoEl.play();
        if (this.session.abortController.signal.aborted || generation !== this.session.playbackGeneration) return;
        
        const syncedTime = this.videoEl.currentTime;
        this.playbackQueue.clear();
        this.hydrateManifestFromCache();
        this.playbackQueue.update(syncedTime, this.state.playbackRate);
      } else {
        this.playbackQueue.update(time, this.state.playbackRate);
      }
    } finally {
      this.endSeekTransaction('seek');
      this.session.isTransitioningState = false;
    }
  }

  async setPlaybackRate(rate: number): Promise<void> {
    this.state.playbackRate = rate;
    if (this.videoEl) {
      this.videoEl.playbackRate = rate;
    }
    this.audioScheduler.updatePlaybackRate(rate);
  }

  setVolume(volume: number, isMuted: boolean): void {
    this.state.volume = volume;
    this.state.isMuted = isMuted;
    if (this.gainNode) {
      this.gainNode.gain.value = isMuted ? 0 : volume;
    }
  }

  async switchAudioTrack(streamIndex: number | null): Promise<void> {
    if (this.session.abortController.signal.aborted) return;
    this.state.activeStreamIndex = typeof streamIndex === 'number' ? streamIndex : -1;
    console.log(`[PlaybackController-${this.instanceId}] switchAudioTrack called. streamIndex=${this.state.activeStreamIndex}`);
    this.fetchingKeys.clear();
    this.playbackQueue.clear();
    this.manifest.clear();
    this.bufferManager.clear();
    this.bufferManager.resetFailures();
    this.scheduler.reset();

    if (this.videoEl) {
      const isPlaying = !this.videoEl.paused;
      const currentTime = this.videoEl.currentTime;
      await this.fillBufferWindow(currentTime, 'switchAudioTrack');
      
      if (isPlaying && this.videoEl) {
        const syncedTime = this.videoEl.currentTime;
        this.playbackQueue.clear();
        this.hydrateManifestFromCache();
        this.playbackQueue.update(syncedTime, this.state.playbackRate);
      } else {
        this.playbackQueue.update(currentTime, this.state.playbackRate);
      }
    }
  }

  async destroy(): Promise<void> {
    console.log(`[PlaybackController-${this.instanceId}] destroy called.`);
    
    // Abort any active fetches, decodes, and scheduler updates immediately by moving generation forward
    this.startNewPlaybackGeneration('destroy');
    this.session.destroy();
    
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
    this.audioScheduler.stopAll();
    
    if (this.audioCtx) {
      await this.audioCtx.close().catch(() => {});
    }
    if (this.ff) {
      await this.demuxMgr.cleanup(this.ff).catch(() => {});
    }
    this.bufferManager.clear();
  }
}
