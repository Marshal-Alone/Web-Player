import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import {
  saveProgress,
  beaconProgress,
  updateVideoDuration,
  fetchVideoDetails
} from '../../api/client.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Settings as SettingsIcon,
  Maximize,
  Minimize,
  Pipette,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  FileText,
  Bookmark,
  Sparkles,
  CloudDownload
} from 'lucide-react';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export const CustomVideoPlayer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<any>(null);

  const {
    currentVideoId,
    video,
    section,
    prevVideo,
    nextVideo,
    isPlaying,
    isTheatreMode,
    playbackSpeed,
    volume,
    isMuted,
    autoplayEnabled,
    isAutoplayCountdownActive,
    autoplayCountdownRemaining,
    isCourseComplete,
    isDriveLoading,
    setCurrentVideoId,
    setVideoData,
    setIsPlaying,
    toggleTheatreMode,
    setPlaybackSpeed,
    setVolume,
    setIsMuted,
    startAutoplayCountdown,
    cancelAutoplayCountdown,
    setAutoplayCountdownRemaining,
    setIsCourseComplete,
    setIsDriveLoading
  } = usePlayerStore();

  const { setCurrentView, setNotesDrawerOpen, setBookmarksDrawerOpen } = useUIStore();

  // Local Player UI state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isSpeedMenuOpen, setIsSpeedMenuOpen] = useState(false);
  const [hudMessage, setHudMessage] = useState<string | null>(null);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);

  const controlsTimeoutRef = useRef<any>(null);
  const hudTimeoutRef = useRef<any>(null);

  const showHud = (msg: string) => {
    setHudMessage(msg);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setHudMessage(null), 1400);
  };

  // Activity timer for hiding controls
  const handleUserActivity = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setIsControlsVisible(false);
        setIsSpeedMenuOpen(false);
      }, 3000);
    }
  };

  // Play / Pause Toggle
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      showHud('Play');
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      showHud('Pause');
    }
  };

  // Seek relative
  const seekRelative = (delta: number) => {
    if (!videoRef.current) return;
    const next = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = next;
    setCurrentTime(next);
    showHud(delta > 0 ? `+${delta}s` : `${delta}s`);
  };

  // Load video metadata and handle resume
  useEffect(() => {
    if (!currentVideoId) return;

    fetchVideoDetails(currentVideoId).then((data) => {
      setVideoData(data);
      if (videoRef.current) {
        setIsDriveLoading(true);
        videoRef.current.playbackRate = playbackSpeed;
        videoRef.current.volume = isMuted ? 0 : volume;

        // Resume: saved position minus 3s (if not completed; if completed start from 0)
        let resumeTime = 0;
        if (data.progress && !data.progress.completed && data.progress.currentTime > 3) {
          resumeTime = Math.max(0, data.progress.currentTime - 3);
        }

        videoRef.current.onloadedmetadata = () => {
          setIsDriveLoading(false);
          const vidDur = videoRef.current?.duration || 0;
          setDuration(vidDur);

          // Lazy duration update to server
          if (vidDur > 0 && (!data.video.duration || data.video.duration === 0)) {
            updateVideoDuration(currentVideoId, vidDur);
          }

          if (resumeTime > 0 && videoRef.current) {
            videoRef.current.currentTime = resumeTime;
            setCurrentTime(resumeTime);
            showHud(`Resumed at ${formatTime(resumeTime)}`);
          }

          videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        };
      }
    });
  }, [currentVideoId]);

  // Periodic progress saving (every 5 seconds)
  useEffect(() => {
    if (!currentVideoId || !isPlaying) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    progressIntervalRef.current = setInterval(() => {
      if (videoRef.current) {
        const cur = videoRef.current.currentTime;
        const dur = videoRef.current.duration || duration;
        saveProgress(currentVideoId, { currentTime: cur, duration: dur });
      }
    }, 5000);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentVideoId, isPlaying, duration]);

  // Save on pause, seek, and visibilitychange
  const flushProgress = useCallback(() => {
    if (videoRef.current && currentVideoId) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration || duration;
      saveProgress(currentVideoId, { currentTime: cur, duration: dur });
    }
  }, [currentVideoId, duration]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) flushProgress();
    };

    const handleBeforeUnload = () => {
      if (videoRef.current && currentVideoId) {
        const cur = videoRef.current.currentTime;
        const dur = videoRef.current.duration || duration;
        beaconProgress(currentVideoId, { currentTime: cur, duration: dur });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushProgress, currentVideoId, duration]);

  // Autoplay countdown timer
  useEffect(() => {
    if (!isAutoplayCountdownActive) return;

    if (autoplayCountdownRemaining <= 0) {
      if (nextVideo) {
        cancelAutoplayCountdown();
        setCurrentVideoId(nextVideo._id);
      } else {
        setIsCourseComplete(true);
      }
      return;
    }

    const timer = setTimeout(() => {
      setAutoplayCountdownRemaining(autoplayCountdownRemaining - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isAutoplayCountdownActive, autoplayCountdownRemaining, nextVideo]);

  // Video onEnded handler
  const handleVideoEnded = () => {
    setIsPlaying(false);
    flushProgress();
    if (autoplayEnabled) {
      if (nextVideo) {
        startAutoplayCountdown();
      } else {
        setIsCourseComplete(true);
      }
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          toggleTheatreMode();
          break;
        case 'n':
          // Timestamped note
          e.preventDefault();
          setNotesDrawerOpen(true);
          break;
        case 'N':
          if (e.shiftKey && nextVideo) {
            e.preventDefault();
            setCurrentVideoId(nextVideo._id);
          }
          break;
        case 'P':
          if (e.shiftKey && prevVideo) {
            e.preventDefault();
            setCurrentVideoId(prevVideo._id);
          }
          break;
        case 'b':
        case 'B':
          e.preventDefault();
          setBookmarksDrawerOpen(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, volume, isMuted, duration, nextVideo, prevVideo]);

  // Volume & Speed handlers
  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
    showHud(`Volume ${Math.round(newVol * 100)}%`);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    showHud(nextMuted ? 'Muted' : `Volume ${Math.round(volume * 100)}%`);
  };

  const handleSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setIsSpeedMenuOpen(false);
    showHud(`${speed}x Speed`);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);

    // Calculate buffered range
    if (videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      const dur = videoRef.current.duration;
      if (dur > 0) {
        setBufferedPercent(Math.min(100, (bufferedEnd / dur) * 100));
      }
    }
  };

  // Seek bar click / drag
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(duration, pos * duration));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    flushProgress();
  };

  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverSeekTime(pos * duration);
    setHoverSeekPos(pos * 100);
  };

  // Double tap gestures (left seeks -10, right seeks +10)
  const lastClickRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });
  const handleVideoAreaClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isLeftSide = clickX < rect.width / 2;

    if (now - lastClickRef.current.time < 300) {
      // Double tap seek
      seekRelative(isLeftSide ? -10 : 10);
    } else {
      // Single tap toggle play
      togglePlay();
    }
    lastClickRef.current = { time: now, x: clickX };
  };

  if (!currentVideoId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-canvas">
        <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center text-text-muted mb-4 border border-border">
          <Play className="w-8 h-8 ml-1" />
        </div>
        <h2 className="text-xl font-bold text-text-main mb-2">No Video Selected</h2>
        <p className="text-sm text-text-muted mb-6 max-w-md">
          Select a lesson from the course path on the left or return to your library.
        </p>
        <button
          onClick={() => setCurrentView('library')}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
        >
          Open Course Library
        </button>
      </div>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleUserActivity}
      className={`relative flex flex-col bg-black select-none ${
        isTheatreMode ? 'w-full h-full' : 'w-full aspect-video max-h-[calc(100vh-8rem)]'
      }`}
    >
      {/* Top Header Bar inside Video Container */}
      <div
        className={`absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-black/80 via-black/40 to-transparent z-20 px-4 flex items-center justify-between transition-opacity duration-200 ${
          isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              flushProgress();
              setCurrentView('library');
            }}
            title="Back to Course Library"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-sm transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Library
          </button>

          {video && (
            <div className="flex items-center gap-2 text-white text-sm font-semibold truncate max-w-xl">
              {video.badge && (
                <span className="px-1.5 py-0.5 rounded bg-accent/40 text-accent-text text-xs font-mono font-bold">
                  {video.badge}
                </span>
              )}
              <span className="truncate">{video.title}</span>
              {section && (
                <span className="text-xs text-white/60 font-normal">
                  ({section.badge ? `${section.badge}. ` : ''}{section.name})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Prev / Next Header Buttons */}
        <div className="flex items-center gap-2">
          <button
            disabled={!prevVideo}
            onClick={() => prevVideo && setCurrentVideoId(prevVideo._id)}
            title={prevVideo ? `Previous: ${prevVideo.title}` : 'No previous video'}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white text-xs backdrop-blur-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            disabled={!nextVideo}
            onClick={() => nextVideo && setCurrentVideoId(nextVideo._id)}
            title={nextVideo ? `Next: ${nextVideo.title}` : 'No next video'}
            className="p-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white text-xs backdrop-blur-sm transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* HTML5 Native Video Tag */}
      <video
        ref={videoRef}
        src={`/api/videos/${currentVideoId}/stream`}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
        onWaiting={() => setIsDriveLoading(true)}
        onPlaying={() => setIsDriveLoading(false)}
        onClick={handleVideoAreaClick}
        onDoubleClick={toggleFullscreen}
        className="w-full h-full object-contain cursor-pointer"
        playsInline
      />

      {/* Google Drive Loading / Buffering State */}
      {isDriveLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs z-10 pointer-events-none">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-surface/90 border border-border shadow-lg text-text-main text-xs font-medium">
            <CloudDownload className="w-4 h-4 text-accent animate-pulse" />
            <span>Loading from Drive…</span>
          </div>
        </div>
      )}

      {/* Transient HUD Indicator (e.g. "+10s", "1.5x Speed") */}
      {hudMessage && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-2 rounded-xl bg-black/75 text-white text-sm font-semibold backdrop-blur-md z-30 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
          {hudMessage}
        </div>
      )}

      {/* Autoplay Next Countdown Overlay */}
      {isAutoplayCountdownActive && nextVideo && (
        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-30 p-6 text-center animate-in fade-in">
          <span className="text-xs uppercase tracking-wider text-text-muted font-bold mb-2">
            Up Next in {autoplayCountdownRemaining}s
          </span>
          <h3 className="text-lg font-bold text-white max-w-md mb-6">
            {nextVideo.badge ? `${nextVideo.badge} - ` : ''}{nextVideo.title}
          </h3>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                cancelAutoplayCountdown();
                setCurrentVideoId(nextVideo._id);
              }}
              className="px-5 py-2.5 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-colors shadow-lg flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Play Now
            </button>
            <button
              onClick={cancelAutoplayCountdown}
              className="px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Course Complete Screen */}
      {isCourseComplete && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-30 p-6 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent mb-4 border border-accent/40">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Course Complete! 🎉</h2>
          <p className="text-sm text-text-muted max-w-sm mb-6">
            You've successfully finished all lessons in this course path.
          </p>
          <button
            onClick={() => setCurrentView('library')}
            className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            Back to Library
          </button>
        </div>
      )}

      {/* Bottom Control Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-6 z-20 flex flex-col gap-2 transition-opacity duration-200 ${
          isControlsVisible || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Custom Seek Bar with Buffered Range & Hover Time */}
        <div
          onMouseMove={handleSeekHover}
          onMouseLeave={() => setHoverSeekTime(null)}
          onClick={handleSeek}
          className="relative h-2 w-full bg-white/20 rounded-full cursor-pointer group flex items-center"
        >
          {/* Buffered Progress */}
          <div
            style={{ width: `${bufferedPercent}%` }}
            className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none"
          />

          {/* Played Progress */}
          <div
            style={{ width: `${progressPercent}%` }}
            className="absolute left-0 top-0 bottom-0 bg-accent rounded-full pointer-events-none transition-all duration-75"
          />

          {/* Scrubber Knob */}
          <div
            style={{ left: `${progressPercent}%` }}
            className="absolute -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md scale-0 group-hover:scale-100 transition-transform pointer-events-none"
          />

          {/* Hover Time Tooltip */}
          {hoverSeekTime !== null && (
            <div
              style={{ left: `${hoverSeekPos}%` }}
              className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/90 text-white text-[11px] font-mono pointer-events-none border border-white/10"
            >
              {formatTime(hoverSeekTime)}
            </div>
          )}
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white text-xs">
          {/* Left Controls: Play, Skip, Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1 hover:text-accent transition-colors"
              title={isPlaying ? 'Pause (Space/K)' : 'Play (Space/K)'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            <button
              onClick={() => seekRelative(-10)}
              className="p-1 hover:text-accent transition-colors"
              title="Skip -10s (J / Left)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekRelative(10)}
              className="p-1 hover:text-accent transition-colors"
              title="Skip +10s (L / Right)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1 group/vol">
              <button
                onClick={toggleMute}
                className="p-1 hover:text-accent transition-colors"
                title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 accent-accent bg-white/20 rounded cursor-pointer opacity-70 group-hover/vol:opacity-100 transition-opacity"
              />
            </div>

            {/* Time Indicator */}
            <span className="font-mono text-white/80 select-none text-[12px]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right Controls: Notes, Bookmarks, Speed Menu, PiP, Theatre, Fullscreen */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNotesDrawerOpen(true)}
              className="p-1.5 hover:text-accent text-white/80 transition-colors"
              title="Take Note (N)"
            >
              <FileText className="w-4 h-4" />
            </button>

            <button
              onClick={() => setBookmarksDrawerOpen(true)}
              className="p-1.5 hover:text-accent text-white/80 transition-colors"
              title="Add Bookmark (B)"
            >
              <Bookmark className="w-4 h-4" />
            </button>

            {/* Speed Gear Menu Popup */}
            <div className="relative">
              <button
                onClick={() => setIsSpeedMenuOpen(!isSpeedMenuOpen)}
                className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-white/10 transition-colors ${
                  isSpeedMenuOpen ? 'text-accent' : 'text-white/80'
                }`}
                title="Playback Speed"
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="font-mono text-[11px] font-semibold">{playbackSpeed}x</span>
              </button>

              {isSpeedMenuOpen && (
                <div className="absolute bottom-9 right-0 w-36 bg-surface border border-border rounded-xl shadow-2xl p-1.5 z-40 animate-in fade-in zoom-in-95">
                  <div className="text-[10px] uppercase font-bold text-text-dim px-2 py-1 border-b border-border mb-1">
                    Playback Speed
                  </div>
                  {SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-xs font-mono transition-colors ${
                        playbackSpeed === speed
                          ? 'bg-accent text-white font-bold'
                          : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                      }`}
                    >
                      <span>{speed}x</span>
                      {playbackSpeed === speed && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theatre Mode Toggle */}
            <button
              onClick={toggleTheatreMode}
              className={`p-1.5 hover:text-accent transition-colors ${
                isTheatreMode ? 'text-accent' : 'text-white/80'
              }`}
              title="Theatre Mode (T)"
            >
              <Pipette className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:text-accent text-white/80 transition-colors"
              title="Fullscreen (F)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
