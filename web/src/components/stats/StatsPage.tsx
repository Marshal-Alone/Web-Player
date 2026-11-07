import React, { useState, useEffect, useMemo } from 'react';
import { useProfileStore } from '../../stores/useProfileStore.js';
import { fetchStats } from '../../api/client.js';
import { Clock, Flame, Award, Calendar, BarChart2, CheckCircle2, Search, BookOpen } from 'lucide-react';

function formatDisplayDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function getActivityLevel(minutes: number): number {
  if (!minutes || minutes <= 0) return 0;
  if (minutes <= 20) return 1;
  if (minutes <= 45) return 2;
  if (minutes <= 90) return 3;
  return 4;
}

export const StatsPage: React.FC = () => {
  const { getActiveProfile } = useProfileStore();
  const profile = getActiveProfile();

  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'12' | '26' | '52'>('26');
  const [hoveredDay, setHoveredDay] = useState<{ date: string; minutes: number } | null>(null);
  const [sectionFilter, setSectionFilter] = useState('');

  useEffect(() => {
    setIsLoading(true);
    fetchStats(profile?._id)
      .then((data) => setStats(data))
      .finally(() => setIsLoading(false));
  }, [profile?._id]);

  // Group heatmap into week columns of 7 days (Sunday to Saturday)
  const { columns, monthHeaders } = useMemo(() => {
    if (!stats?.heatmap || !Array.isArray(stats.heatmap)) {
      return { columns: [], monthHeaders: [] };
    }

    const numWeeks = timeframe === '12' ? 12 : timeframe === '26' ? 26 : 52;
    const daysNeeded = numWeeks * 7;
    const sliced = stats.heatmap.slice(-daysNeeded);

    const cols: Array<Array<{ date: string; minutes: number; dayOfWeek: number }>> = [];
    for (let i = 0; i < sliced.length; i += 7) {
      cols.push(sliced.slice(i, i + 7));
    }

    // Determine month headers above columns
    const headers: Array<{ colIndex: number; label: string }> = [];
    let prevMonth = -1;
    let prevColWithHeader = -10;

    cols.forEach((col, colIdx) => {
      if (col.length > 0) {
        const parts = col[0].date.split('-');
        if (parts.length === 3) {
          const m = Number(parts[1]) - 1;
          // Place header if month changed and not too close to previous header
          if (m !== prevMonth && colIdx - prevColWithHeader >= 2) {
            const d = new Date(Number(parts[0]), m, Number(parts[2]));
            headers.push({
              colIndex: colIdx,
              label: d.toLocaleDateString('en-US', { month: 'short' })
            });
            prevMonth = m;
            prevColWithHeader = colIdx;
          }
        }
      }
    });

    return { columns: cols, monthHeaders: headers };
  }, [stats?.heatmap, timeframe]);

  // Filter curriculum section progress
  const filteredSections = useMemo(() => {
    if (!stats?.sectionProgress) return [];
    if (!sectionFilter.trim()) return stats.sectionProgress;
    const q = sectionFilter.toLowerCase();
    return stats.sectionProgress.filter((s: any) => s.name.toLowerCase().includes(q));
  }, [stats?.sectionProgress, sectionFilter]);

  if (isLoading) {
    return (
      <div className="flex-1 p-6 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
        <div className="h-8 w-48 bg-card rounded-lg motion-safe:animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-card rounded-2xl motion-safe:animate-pulse" />
          <div className="h-28 bg-card rounded-2xl motion-safe:animate-pulse" />
          <div className="h-28 bg-card rounded-2xl motion-safe:animate-pulse" />
          <div className="h-28 bg-card rounded-2xl motion-safe:animate-pulse" />
        </div>
        <div className="h-72 bg-card rounded-2xl motion-safe:animate-pulse" />
      </div>
    );
  }

  const max7DayMinutes = Math.max(1, ...(stats?.past7Days || []).map((d: any) => d.minutes));
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden bg-canvas w-full min-w-0">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-8 w-full min-w-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-2xl font-bold text-text-main tracking-tight">Learning Analytics</h1>
            <p className="text-xs text-text-muted mt-1">
              Consistency, daily streaks, watch time, and course progress for{' '}
              <span className="text-accent font-medium">{profile?.name || 'courses'}</span>.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1 rounded-full bg-surface border border-border text-xs text-text-muted">
              {stats?.completedVideos || 0} / {stats?.totalVideos || 0} lessons done
            </span>
          </div>
        </div>

        {/* Metric Cards (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-text-dim">Watched today</div>
              <div className="text-xl font-bold font-mono text-text-main">
                {stats?.minutesToday || 0}m
              </div>
              <div className="text-[11px] text-text-muted truncate mt-0.5">
                {stats?.secondsToday > 0 ? `${stats.secondsToday}s session time` : 'No study time yet'}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center shrink-0">
              <BarChart2 className="w-6 h-6 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-text-dim">Past 7 days</div>
              <div className="text-xl font-bold font-mono text-text-main">
                {stats?.minutesWeek || 0}m
              </div>
              <div className="text-[11px] text-text-muted truncate mt-0.5">
                {stats?.activeDaysCount || 0} active study days
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-surface border border-border text-text-muted flex items-center justify-center shrink-0">
              <Flame className="w-6 h-6 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-text-dim">Daily streak</div>
              <div className="text-xl font-bold font-mono text-text-main">
                {stats?.streak || 0} {stats?.streak === 1 ? 'day' : 'days'}
              </div>
              <div className="text-[11px] text-text-muted truncate mt-0.5">
                Best streak: {stats?.bestStreak || 0} {stats?.bestStreak === 1 ? 'day' : 'days'}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-text-dim">Course completion</div>
              <div className="text-xl font-bold font-mono text-text-main">
                {stats?.completionPercent || 0}%
              </div>
              <div className="text-[11px] text-text-muted truncate mt-0.5">
                {stats?.completedVideos || 0} completed
              </div>
            </div>
          </div>
        </div>

        {/* Study Activity Heatmap Card */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-text-main">Study Activity Heatmap</h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mt-0.5">
                  <span>{stats?.totalHoursAllTime || 0} hours total watch time</span>
                  <span className="text-border-strong">/</span>
                  <span>{stats?.activeDaysCount || 0} active days</span>
                  <span className="text-border-strong">/</span>
                  <span>{stats?.bestStreak || 0} days best streak</span>
                </div>
              </div>
            </div>

            {/* Timeframe selector tabs */}
            <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setTimeframe('12')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  timeframe === '12'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                12 Weeks
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('26')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  timeframe === '26'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                26 Weeks
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('52')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                  timeframe === '52'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                Full Year
              </button>
            </div>
          </div>

          {/* Heatmap Container */}
          <div className="overflow-x-auto pb-2 pt-1 w-full min-w-0">
            <div className="inline-block min-w-fit">
              {/* Month Headers */}
              <div className="flex mb-1.5 pl-7 text-[10px] text-text-dim relative h-4">
                {monthHeaders.map((mh) => (
                  <div
                    key={`${mh.colIndex}-${mh.label}`}
                    style={{
                      position: 'absolute',
                      left: `calc(1.75rem + ${mh.colIndex} * 18px)`
                    }}
                    className="whitespace-nowrap"
                  >
                    {mh.label}
                  </div>
                ))}
              </div>

              {/* Grid: Weekdays on left + Columns on right */}
              <div className="flex gap-1.5 items-start">
                {/* Weekday Labels (Sun to Sat) */}
                <div className="flex flex-col gap-1 text-[9px] text-text-dim w-5 shrink-0 pt-0.5">
                  <span className="h-3.5 flex items-center justify-end leading-none"> </span>
                  <span className="h-3.5 flex items-center justify-end leading-none">Mon</span>
                  <span className="h-3.5 flex items-center justify-end leading-none"> </span>
                  <span className="h-3.5 flex items-center justify-end leading-none">Wed</span>
                  <span className="h-3.5 flex items-center justify-end leading-none"> </span>
                  <span className="h-3.5 flex items-center justify-end leading-none">Fri</span>
                  <span className="h-3.5 flex items-center justify-end leading-none"> </span>
                </div>

                {/* Week Columns */}
                <div className="flex gap-1">
                  {columns.map((col, colIdx) => (
                    <div key={`col-${colIdx}`} className="flex flex-col gap-1">
                      {col.map((day) => {
                        const level = getActivityLevel(day.minutes);
                        const isHovered = hoveredDay?.date === day.date;
                        let cellClass = 'bg-activity-0 border border-activity-border';
                        if (level === 1) cellClass = 'bg-activity-1 border border-activity-border/40';
                        else if (level === 2) cellClass = 'bg-activity-2 border border-transparent';
                        else if (level === 3) cellClass = 'bg-activity-3 border border-transparent';
                        else if (level === 4) cellClass = 'bg-activity-4 border border-transparent';

                        return (
                          <div
                            key={day.date}
                            onMouseEnter={() => setHoveredDay(day)}
                            onMouseLeave={() => setHoveredDay(null)}
                            className={`w-3.5 h-3.5 rounded-[3px] transition-transform duration-100 cursor-pointer ${cellClass} ${
                              isHovered ? 'scale-125 ring-2 ring-accent z-10' : ''
                            }`}
                            title={`${day.date}: ${day.minutes} minutes watched`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Hover Detail & Heatmap Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border text-xs">
            <div className="text-text-muted min-h-[1.25rem]">
              {hoveredDay ? (
                <span>
                  <strong className="text-text-main">{formatDisplayDate(hoveredDay.date)}</strong>:{' '}
                  {hoveredDay.minutes > 0 ? (
                    <span className="text-accent font-semibold">{hoveredDay.minutes} minutes watched</span>
                  ) : (
                    'No study activity'
                  )}
                </span>
              ) : (
                <span className="text-text-dim text-xs">Hover over any day to see watch time</span>
              )}
            </div>

            {/* 5-Level Legend */}
            <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
              <span>Less</span>
              <div
                className="w-3.5 h-3.5 rounded-[3px] bg-activity-0 border border-activity-border"
                title="0 minutes"
              />
              <div
                className="w-3.5 h-3.5 rounded-[3px] bg-activity-1 border border-activity-border/40"
                title="1-20 minutes"
              />
              <div
                className="w-3.5 h-3.5 rounded-[3px] bg-activity-2"
                title="21-45 minutes"
              />
              <div
                className="w-3.5 h-3.5 rounded-[3px] bg-activity-3"
                title="46-90 minutes"
              />
              <div
                className="w-3.5 h-3.5 rounded-[3px] bg-activity-4"
                title="90+ minutes"
              />
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Past 7 Days Daily Watch Time Bar Chart */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-text-main">Weekly Watch Time Distribution</h2>
              <p className="text-xs text-text-muted mt-0.5">Daily watch duration over the last 7 days</p>
            </div>
            <span className="text-xs font-medium text-accent">
              {stats?.minutesWeek || 0}m total this week
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 sm:gap-4 pt-4">
            {(stats?.past7Days || []).map((d: any) => {
              const isToday = d.date === todayStr;
              const heightPercent = d.minutes > 0 ? Math.max(16, Math.round((d.minutes / max7DayMinutes) * 100)) : 8;
              return (
                <div key={d.date} className="flex flex-col items-center gap-2 group">
                  <span className="text-[11px] text-text-muted group-hover:text-text-main">
                    {d.minutes}m
                  </span>
                  <div className="w-full h-24 bg-surface rounded-lg p-1 flex items-end justify-center border border-border/50">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full rounded-md transition-opacity duration-200 ${
                        isToday
                          ? 'bg-accent shadow-xs'
                          : d.minutes > 0
                          ? 'bg-activity-3 opacity-80 group-hover:opacity-100'
                          : 'bg-surface-hover/50'
                      }`}
                    />
                  </div>
                  <div className="flex flex-col items-center">
                    <span
                      className={`text-xs font-medium ${
                        isToday ? 'text-accent font-bold' : 'text-text-dim'
                      }`}
                    >
                      {d.day}
                    </span>
                    <span className="text-[10px] text-text-dim">{d.date.slice(5)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Course Curriculum Breakdown */}
        {stats?.sectionProgress && stats.sectionProgress.length > 0 && (
          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-accent" />
                  Curriculum Section Progress
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Completion status for all {stats.sectionProgress.length} sections in {profile?.name || 'course'}
                </p>
              </div>

              {/* Section search */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter sections..."
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-surface border border-border text-xs text-text-main placeholder:text-text-dim focus-visible:outline-hidden focus-visible:border-accent active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Section Progress Rows */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredSections.map((sec: any) => {
                const isComplete = sec.percent >= 100;
                return (
                  <div
                    key={sec._id}
                    className="p-3.5 rounded-xl bg-surface border border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-border transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                          isComplete
                            ? 'bg-accent/20 text-accent'
                            : sec.percent > 0
                            ? 'bg-accent/15 text-accent'
                            : 'bg-surface-hover text-text-dim'
                        }`}
                      >
                        {sec.order}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-text-main truncate">{sec.name}</div>
                        <div className="text-[11px] text-text-dim mt-0.5">
                          {sec.completedVideos} of {sec.totalVideos} lessons completed
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:w-56 shrink-0">
                      <div className="flex-1 bg-surface-hover h-2 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${sec.percent}%` }}
                          className={`h-full rounded-full transition-opacity duration-200 ${
                            isComplete ? 'bg-accent' : 'bg-accent/70'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-xs font-mono font-medium w-11 text-right ${
                          isComplete ? 'text-accent font-bold' : 'text-text-muted'
                        }`}
                      >
                        {sec.percent}%
                      </span>
                      {isComplete && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
                    </div>
                  </div>
                );
              })}

              {filteredSections.length === 0 && (
                <div className="p-8 text-center text-xs text-text-muted">
                  No sections match "{sectionFilter}"
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
