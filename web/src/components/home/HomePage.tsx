import React, { useState, useEffect } from 'react';
import { useProfileStore } from '../../stores/useProfileStore.js';
import { usePlayerStore } from '../../stores/usePlayerStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { fetchLibrary, fetchContinue } from '../../api/client.js';
import {
  Play,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  FolderOpen,
  ArrowRight
} from 'lucide-react';

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '0m';
  const m = Math.floor(sec / 60);
  const hrs = Math.floor(m / 60);
  if (hrs > 0) {
    return `${hrs}h ${m % 60}m`;
  }
  return `${m}m`;
}

export const HomePage: React.FC = () => {
  const { getActiveProfile, activeProfileKey } = useProfileStore();
  const { setCurrentVideoId } = usePlayerStore();
  const { setCurrentView } = useUIStore();

  const profile = getActiveProfile();
  const [libraryData, setLibraryData] = useState<any>(null);
  const [continueData, setContinueData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profile?._id) return;
    setIsLoading(true);

    Promise.all([fetchLibrary(profile._id), fetchContinue(profile._id)])
      .then(([lib, cont]) => {
        setLibraryData(lib);
        setContinueData(cont.continueVideo);
      })
      .finally(() => setIsLoading(false));
  }, [profile?._id, activeProfileKey]);

  const handleStartLesson = (videoId: string) => {
    setCurrentVideoId(videoId);
    setCurrentView('player');
  };

  // Filter lessons based on search query
  const filteredSections = libraryData?.sections
    ?.map((sec: any) => {
      const matchingVideos = sec.videos.filter((v: any) =>
        v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.badge && v.badge.includes(searchQuery))
      );
      return {
        ...sec,
        matchingVideos
      };
    })
    .filter((sec: any) =>
      searchQuery.trim() === ''
        ? true
        : sec.matchingVideos.length > 0 ||
          sec.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const overallPercent = libraryData?.overallProgress?.percent || 0;
  const totalVideos = libraryData?.overallProgress?.totalVideos || 0;
  const totalCompleted = libraryData?.overallProgress?.totalCompleted || 0;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-canvas w-full min-w-0">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-8 w-full min-w-0">
      {/* Profile Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-main tracking-tight">
              {profile?.name || 'Course Library'}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-accent/20 text-accent-text border border-accent/30">
              {activeProfileKey.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            {profile?.rootPath ? (
              <span className="font-mono text-text-dim">{profile.rootPath}</span>
            ) : (
              'Folder not configured. Go to Settings to set the course directory.'
            )}
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 rounded-xl bg-card border border-border flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-accent" />
            <div>
              <div className="text-[10px] uppercase font-bold text-text-dim">Sections</div>
              <div className="text-sm font-mono font-bold text-text-main">
                {libraryData?.sections?.length || 0}
              </div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-card border border-border flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-text-dim">Completed</div>
              <div className="text-sm font-mono font-bold text-text-main">
                {totalCompleted} / {totalVideos}
              </div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-card border border-border flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-accent" />
            <div>
              <div className="text-[10px] uppercase font-bold text-text-dim">Progress</div>
              <div className="text-sm font-mono font-bold text-accent-text">
                {overallPercent}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Watching Hero Card */}
      {continueData && (
        <div className="relative rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/15 via-card to-card p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 overflow-hidden">
          <div className="flex items-center gap-5">
            <div
              onClick={() => handleStartLesson(continueData.video._id)}
              className="w-16 h-16 rounded-2xl bg-accent text-white flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform shrink-0"
            >
              <Play className="w-8 h-8 ml-1" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] uppercase font-bold tracking-wider text-accent-text">
                  Continue Watching
                </span>
                {continueData.section && (
                  <span className="text-xs text-text-dim font-medium">
                    • {continueData.section.name}
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-text-main mb-2">
                {continueData.video.badge ? `${continueData.video.badge} - ` : ''}
                {continueData.video.title}
              </h2>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span>{continueData.percent}% watched</span>
                <span>•</span>
                <span>Resume from {Math.floor(continueData.currentTime / 60)}m</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleStartLesson(continueData.video._id)}
            className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-sm shadow-md transition-colors flex items-center gap-2 self-stretch md:self-center justify-center shrink-0"
          >
            <span>Resume Lesson</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search lessons across all sections (e.g. 'Binary Search', 'Routes', '672')..."
          className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-main placeholder:text-text-dim focus:border-accent focus:outline-none transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-dim hover:text-text-main"
          >
            Clear
          </button>
        )}
      </div>

      {/* Section Cards Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-dim">
          Course Sections ({filteredSections?.length || 0})
        </h3>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-card animate-pulse border border-border" />
            ))}
          </div>
        ) : !profile?.rootPath ? (
          <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-3">
            <FolderOpen className="w-10 h-10 text-accent mx-auto" />
            <h4 className="text-base font-bold text-text-main">Configure Your Course Folder</h4>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              Please open Settings and enter the path to your Google Drive or local video folder for {profile?.name}.
            </p>
            <button
              onClick={() => setCurrentView('settings')}
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors"
            >
              Open Settings
            </button>
          </div>
        ) : filteredSections?.length === 0 ? (
          <div className="p-8 rounded-2xl bg-card border border-border text-center text-text-muted text-sm">
            No sections or lessons match "{searchQuery}".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSections?.map((section: any) => {
              const secPercent =
                section.videoCount > 0
                  ? Math.round((section.completedCount / section.videoCount) * 100)
                  : 0;

              return (
                <div
                  key={section._id}
                  className="rounded-2xl bg-card border border-border hover:border-accent/50 p-5 flex flex-col justify-between transition-colors shadow-sm group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {section.badge ? (
                        <span className="px-2 py-0.5 rounded-md bg-surface border border-border text-xs font-mono font-bold text-text-muted">
                          {section.badge}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-xs font-mono font-semibold text-text-dim">
                        {section.completedCount}/{section.videoCount} completed
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-text-main group-hover:text-accent-text transition-colors line-clamp-2">
                      {section.name}
                    </h4>
                  </div>

                  <div className="mt-5 space-y-3">
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-text-dim">
                        <span>Progress</span>
                        <span className="font-mono">{secPercent}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden">
                        <div
                          style={{ width: `${secPercent}%` }}
                          className="h-full bg-accent transition-all duration-300"
                        />
                      </div>
                    </div>

                    {/* Lessons Preview or Action */}
                    <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[11px] text-text-dim flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(section.totalDuration)}
                      </span>

                      {section.videos.length > 0 && (
                        <button
                          onClick={() => handleStartLesson(section.videos[0]._id)}
                          className="flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
                        >
                          <span>Open</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  </div>
  );
};
