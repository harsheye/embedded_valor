import React, { useState } from 'react';
import { Check } from 'lucide-react';
import type { CustomAudioTrack, CustomSubtitleTrack } from '../types/media';
import type { MediaStream } from '../services/ffmpeg';

export interface AudioSubPopoverProps {
  audioStreams: MediaStream[];
  audioTracks: CustomAudioTrack[];
  selectedAudioTrack: CustomAudioTrack | null;
  setSelectedAudioTrack: (track: CustomAudioTrack | null) => void;
  setActiveAudioStreamIndex: (idx: number | null) => void;
  handleSelectEmbeddedAudio: (index: number, codec: string, language?: string) => Promise<void>;
  customAudioInputRef: React.RefObject<HTMLInputElement | null>;
  
  subtitleStreams: MediaStream[];
  subtitleTracks: CustomSubtitleTrack[];
  selectedSubTrack: CustomSubtitleTrack | null;
  setSelectedSubTrack: (track: CustomSubtitleTrack | null) => void;
  setActiveSubStreamIndex: (idx: number | null) => void;
  handleSelectEmbeddedSubtitle: (index: number, codec: string, language?: string) => Promise<void>;
  customSubInputRef: React.RefObject<HTMLInputElement | null>;
  
  currentTime: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setCurrentTime: (time: number) => void;
  setShowAudioSubMenu: (show: boolean) => void;
  audioSubTimeoutRef: React.RefObject<any>;
  
  // Helpers
  getLangLabel: (lang?: string, fallback?: string) => string;
  formatTime: (secs: number) => string;
  cleanSubtitleText: (text: string) => string;
}

export const AudioSubPopover: React.FC<AudioSubPopoverProps> = ({
  audioStreams,
  audioTracks,
  selectedAudioTrack,
  setSelectedAudioTrack,
  setActiveAudioStreamIndex,
  handleSelectEmbeddedAudio,
  customAudioInputRef,
  subtitleStreams,
  subtitleTracks,
  selectedSubTrack,
  setSelectedSubTrack,
  setActiveSubStreamIndex,
  handleSelectEmbeddedSubtitle,
  customSubInputRef,
  currentTime,
  videoRef,
  setCurrentTime,
  setShowAudioSubMenu,
  audioSubTimeoutRef,
  getLangLabel,
  formatTime,
  cleanSubtitleText
}) => {
  const [subSearchQuery, setSubSearchQuery] = useState('');

  return (
    <div 
      className={`audio-sub-popover-center animate-fade-in ${selectedSubTrack ? 'has-transcript' : ''}`}
      onMouseEnter={() => {
        if (audioSubTimeoutRef.current) clearTimeout(audioSubTimeoutRef.current);
      }}
    >
      <div className="popover-cols">
        {/* Audio Column */}
        <div className="popover-col">
          <h4>Audio</h4>
          <div className="popover-options">
            {/* Default Original Audio if streams are available, or default selector */}
            <label className="popover-option" onClick={() => { setSelectedAudioTrack(null); setActiveAudioStreamIndex(null); setShowAudioSubMenu(false); }}>
              <input type="radio" name="audio-lang" checked={selectedAudioTrack === null} readOnly />
              <span>Original</span>
              {selectedAudioTrack === null && <Check size={14} className="check-icon" />}
            </label>

            {/* Scanned/Probed Embedded Tracks */}
            {audioStreams.map((s) => {
              const active = selectedAudioTrack?.streamIndex === s.index;
              const label = getLangLabel(s.language, `Track #${s.index}`);
              return (
                <label key={`embed-aud-${s.index}`} className="popover-option" onClick={() => { handleSelectEmbeddedAudio(s.index, s.codec, s.language); setShowAudioSubMenu(false); }}>
                  <input type="radio" name="audio-lang" checked={active} readOnly />
                  <span>{label}</span>
                  {active && <Check size={14} className="check-icon" />}
                </label>
              );
            })}

            {/* Custom Uploaded Tracks */}
            {audioTracks.map((track) => {
              const active = selectedAudioTrack?.id === track.id;
              return (
                <label key={track.id} className="popover-option" onClick={() => { setSelectedAudioTrack(track); setShowAudioSubMenu(false); }}>
                  <input type="radio" name="audio-lang" checked={active} readOnly />
                  <span>{track.name}</span>
                  {active && <Check size={14} className="check-icon" />}
                </label>
              );
            })}

            {/* Custom Add Trigger */}
            <label className="popover-option add-custom-btn" onClick={() => { customAudioInputRef.current?.click(); setShowAudioSubMenu(false); }}>
              <span>+ Add Custom File</span>
            </label>
          </div>
        </div>

        {/* Subtitles Column */}
        <div className="popover-col">
          <h4>Subtitles</h4>
          <div className="popover-options">
            {/* Off */}
            <label className="popover-option" onClick={() => { setSelectedSubTrack(null); setActiveSubStreamIndex(null); setShowAudioSubMenu(false); }}>
              <input type="radio" name="sub-lang" checked={selectedSubTrack === null} readOnly />
              <span>Off</span>
              {selectedSubTrack === null && <Check size={14} className="check-icon" />}
            </label>

            {/* Scanned/Probed Embedded Tracks */}
            {subtitleStreams.map((s) => {
              const active = selectedSubTrack?.streamIndex === s.index;
              const label = getLangLabel(s.language, `Track #${s.index}`);
              return (
                <label key={`embed-sub-${s.index}`} className="popover-option" onClick={() => { handleSelectEmbeddedSubtitle(s.index, s.codec, s.language); setShowAudioSubMenu(false); }}>
                  <input type="radio" name="sub-lang" checked={active} readOnly />
                  <span>{label}</span>
                  {active && <Check size={14} className="check-icon" />}
                </label>
              );
            })}

            {/* Custom Uploaded Tracks */}
            {subtitleTracks.map((track) => {
              const active = selectedSubTrack?.id === track.id;
              return (
                <label key={track.id} className="popover-option" onClick={() => { setSelectedSubTrack(track); setShowAudioSubMenu(false); }}>
                  <input type="radio" name="sub-lang" checked={active} readOnly />
                  <span>{track.name}</span>
                  {active && <Check size={14} className="check-icon" />}
                </label>
              );
            })}

            {/* Custom Add Trigger */}
            <label className="popover-option add-custom-btn" onClick={() => { customSubInputRef.current?.click(); setShowAudioSubMenu(false); }}>
              <span>+ Add Custom File</span>
            </label>
          </div>
        </div>

        {/* Subtitle Cue Transcript Column */}
        {selectedSubTrack && (
          <div className="popover-col popover-transcript-col">
            <h4>Subtitle View</h4>
            <div className="transcript-search-box">
              <input 
                type="text" 
                placeholder="Search subtitles..." 
                value={subSearchQuery}
                onChange={(e) => setSubSearchQuery(e.target.value)}
                className="transcript-search-input"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="transcript-cues-list">
              {(selectedSubTrack.cues || []).map((cue, originalIdx) => {
                const isMatched = cleanSubtitleText(cue.text).toLowerCase().includes(subSearchQuery.toLowerCase());
                if (!isMatched) return null;
                
                const isActive = currentTime >= cue.startTime && currentTime <= cue.endTime;
                return (
                  <div 
                    key={cue.id || originalIdx} 
                    id={`cue-item-${originalIdx}`}
                    className={`transcript-cue-item ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        videoRef.current.currentTime = cue.startTime;
                        setCurrentTime(cue.startTime);
                      }
                    }}
                  >
                    <span className="cue-time">{formatTime(cue.startTime)}</span>
                    <span className="cue-text">{cleanSubtitleText(cue.text)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
