import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useProfileStore } from '../../stores/useProfileStore.js';
import { usePlayerStore } from '../../stores/usePlayerStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { fetchLibrary, toggleComplete } from '../../api/client.js';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  ArrowLeft,
  ChevronsLeft,
  ChevronsRight,
  BookOpen
} from 'lucide-react';

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const PlayerSidebar: React.FC = () => {
  const { getActiveProfile, activeProfileKey } = useProfileStore();
  const {
    currentVideoId,
    setCurrentVideoId,
    isSidebarCollapsed,
    toggleSidebar
  } = usePlayerStore();
  const { setCurrentView } = useUIStore();

  const profile = getActiveProfile();
  const [libraryData, setLibraryData] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const activeSectionRef = useRef<HTMLDivElement>(null);
  const activeLessonRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Smoothly scroll the sidebar to center the current folder / lesson
  const scrollToActive = useCallback((smooth = true) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const target = activeLessonRef.current || activeSectionRef.current;
    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const currentScrollTop = container.scrollTop;
    const relativeOffset = targetRect.top - containerRect.top;

    // Position the active section/lesson neatly near the top of the sidebar (with 16px padding)
    const newScrollTop = Math.max(0, currentScrollTop + relativeOffset - 16);

    container.scrollTo({
      top: newScrollTop,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, []);

  const loadData = () => {
    const targetId = profile?._id || activeProfileKey || 'dsa';
    fetchLibrary(targetId).then((data) => {
      setLibraryData(data);
      if (!data?.sections) return;

      const newExpanded = new Set<string>();
      let activeFound = false;

      // Expand the section containing the current video if it exists
      for (const sec of data.sections) {
        if (currentVideoId && sec.videos?.some((v: any) => v._id === currentVideoId)) {
          newExpanded.add(sec._id);
          activeFound = true;
          break;
        }
      }

      // If active video not found or not set, auto-select first video and expand its section
      if (!activeFound) {
        for (const sec of data.sections) {
          if (sec.videos && sec.videos.length > 0) {
            setCurrentVideoId(sec.videos[0]._id);
            newExpanded.add(sec._id);
            activeFound = true;
            break;
          }
        }
      }

      // ONLY if active video still wasn't found, ensure first 2 sections are expanded
      if (!activeFound) {
        for (const sec of data.sections) {
          if (sec.videos && sec.videos.length > 0) {
            newExpanded.add(sec._id);
            if (newExpanded.size >= 2) break;
          }
        }
      }

      setExpandedSections((prev) => {
        const combined = new Set(prev);
        newExpanded.forEach((id) => combined.add(id));
        return combined;
      });
    });
  };

  const toggleExpandAll = () => {
    if (!libraryData?.sections) return;
    if (expandedSections.size >= libraryData.sections.length) {
      setExpandedSections(new Set());
    } else {
      setExpandedSections(new Set(libraryData.sections.map((s: any) => s._id)));
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?._id, activeProfileKey, currentVideoId]);

  // Auto-expand current playing folder and scroll directly to it
  useEffect(() => {
    if (!libraryData?.sections || !currentVideoId) return;

    // Expand current folder
    for (const sec of libraryData.sections) {
      const hasCurrent = sec.videos?.some((v: any) => v._id === currentVideoId);
      if (hasCurrent) {
        setExpandedSections((prev) => {
          if (prev.has(sec._id)) return prev;
          const next = new Set(prev);
          next.add(sec._id);
          return next;
        });
        break;
      }
    }

    // Scroll immediately and with progressive delays to guarantee layout settled
    const t1 = setTimeout(() => scrollToActive(false), 50);
    const t2 = setTimeout(() => scrollToActive(true), 200);
    const t3 = setTimeout(() => scrollToActive(true), 450);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [currentVideoId, libraryData, isSidebarCollapsed, scrollToActive]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const handleToggleComplete = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    await toggleComplete(videoId);
    loadData();
  };

  const overallPercent = libraryData?.overallProgress?.percent || 0;

  if (isSidebarCollapsed) {
    return (
      <aside className="w-12 border-r border-border bg-surface flex flex-col items-center py-3 select-none z-20 shrink-0 h-full justify-between">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={toggleSidebar}
            title="Expand Course Path"
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-hover/70 hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronsRight className="w-4 h-4 text-accent" />
          </button>

          <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <BookOpen className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Clean vertical text orientation without any rotate-180 invert */}
        <div className="flex-1 flex items-center justify-center py-6 overflow-hidden">
          <span
            className="text-[11px] font-semibold tracking-wider uppercase text-text-dim whitespace-nowrap select-none"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed'
            }}
          >
            {profile?.name || 'Course Path'}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 pb-2">
          <span className="text-[10px] font-mono font-semibold text-accent">
            {overallPercent}%
          </span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 md:w-96 border-r border-border bg-surface flex flex-col h-full select-none z-20 shrink-0">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-border flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentView('library')}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Library
          </button>
          <button
            onClick={toggleSidebar}
            title="Collapse Sidebar"
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
        </div>

        <div>
          <h2 className="text-sm font-bold text-text-main truncate">
            {profile?.name || 'Course Path'}
          </h2>
          <div className="flex items-center justify-between text-xs text-text-muted mt-1">
            <span className="flex items-center gap-2">
              <span>Overall Progress</span>
              <button
                onClick={toggleExpandAll}
                className="text-[10px] text-accent hover:underline font-normal"
              >
                {expandedSections.size >= (libraryData?.sections?.length || 1) ? 'Collapse all' : 'Expand all'}
              </button>
            </span>
            <span className="font-mono font-semibold text-text-main">{overallPercent}%</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-card rounded-full overflow-hidden mt-1.5 border border-border">
            <div
              style={{ width: `${overallPercent}%` }}
              className="h-full bg-accent transition-opacity duration-300"
            />
          </div>
        </div>
      </div>

      {/* Accordion Sections List */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {libraryData?.sections?.map((section: any) => {
          const isExpanded = expandedSections.has(section._id);
          const hasCurrent = section.videos.some((v: any) => v._id === currentVideoId);

          return (
            <div
              key={section._id}
              ref={hasCurrent ? activeSectionRef : null}
              className={`rounded-xl border transition-colors overflow-hidden ${
                hasCurrent
                  ? 'border-accent/60 bg-accent/10 ring-1 ring-accent/30 shadow-xs'
                  : 'border-border/60 bg-card/40 hover:bg-card/70'
              }`}
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section._id)}
                className="w-full p-3 flex items-center justify-between text-left transition-colors"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-dim shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-dim shrink-0" />
                  )}
                  {section.badge && (
                    <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono font-bold text-text-muted shrink-0">
                      {section.badge}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-text-main truncate">
                    {section.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono text-text-dim">
                    {section.completedCount}/{section.videoCount}
                  </span>
                </div>
              </button>

              {/* Lesson Items */}
              {isExpanded && (
                <div className="border-t border-border/40 divide-y divide-border/20">
                  {section.videos.length === 0 ? (
                    <div className="px-4 py-2.5 text-[11px] text-text-dim italic">
                      No video files in this folder (Documentation or Resource links only)
                    </div>
                  ) : (
                    section.videos.map((lesson: any) => {
                      const isActive = lesson._id === currentVideoId;
                      const isCompleted = lesson.progress?.completed || false;
                      const lessonPercent = lesson.progress?.percent || 0;

                      return (
                        <div
                          key={lesson._id}
                          ref={isActive ? activeLessonRef : null}
                          onClick={() => setCurrentVideoId(lesson._id)}
                        className={`group px-3 py-2.5 flex flex-col gap-1 cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-accent/20 border-l-4 border-l-accent text-text-main font-medium'
                            : 'hover:bg-surface-hover/70 text-text-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            {/* Complete Toggle Checkmark */}
                            <button
                              onClick={(e) => handleToggleComplete(e, lesson._id)}
                              className="shrink-0 text-text-dim hover:text-accent transition-colors"
                              title={isCompleted ? 'Mark incomplete' : 'Mark completed'}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                              ) : (
                                <Circle className="w-4 h-4 text-border-strong hover:text-text-main" />
                              )}
                            </button>

                            {/* Badge Number */}
                            {lesson.badge && (
                              <span className="text-[11px] font-mono font-bold px-1 rounded bg-surface border border-border text-text-dim shrink-0">
                                {lesson.badge}
                              </span>
                            )}

                            {/* Lesson Title */}
                            <span
                              className={`text-xs truncate ${
                                isActive ? 'text-accent-text font-semibold' : 'text-text-main'
                              }`}
                            >
                              {lesson.title}
                            </span>
                          </div>

                          {/* Duration */}
                          <span className="text-[11px] font-mono text-text-dim shrink-0">
                            {formatDuration(lesson.duration)}
                          </span>
                        </div>

                        {/* Thin per-video progress bar */}
                        {lessonPercent > 0 && !isCompleted && (
                          <div className="w-full h-1 bg-surface rounded-full overflow-hidden mt-0.5">
                            <div
                              style={{ width: `${lessonPercent}%` }}
                              className="h-full bg-accent/70"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
