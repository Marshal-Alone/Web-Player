import React, { useState, useEffect } from 'react';
import { useProfileStore } from '../../stores/useProfileStore.js';
import { fetchStats } from '../../api/client.js';
import { Clock, Flame, Award, Calendar, BarChart2 } from 'lucide-react';

export const StatsPage: React.FC = () => {
  const { getActiveProfile } = useProfileStore();
  const profile = getActiveProfile();

  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    fetchStats(profile?._id)
      .then((data) => setStats(data))
      .finally(() => setIsLoading(false));
  }, [profile?._id]);

  if (isLoading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-6">
        <div className="h-8 w-48 bg-card rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-card rounded-2xl animate-pulse" />
          <div className="h-28 bg-card rounded-2xl animate-pulse" />
          <div className="h-28 bg-card rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-canvas p-6 md:p-8 space-y-8 max-w-5xl mx-auto w-full">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-text-main tracking-tight">Learning Analytics</h1>
        <p className="text-xs text-text-muted mt-1">
          Monitor your study consistency, daily streaks, and watch time for {profile?.name || 'courses'}.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold text-text-dim">Watched Today</div>
            <div className="text-xl font-bold font-mono text-text-main">
              {stats?.minutesToday || 0}m
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold text-text-dim">Past 7 Days</div>
            <div className="text-xl font-bold font-mono text-text-main">
              {stats?.minutesWeek || 0}m
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold text-text-dim">Daily Streak</div>
            <div className="text-xl font-bold font-mono text-text-main">
              {stats?.streak || 0} {stats?.streak === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-bold text-text-dim">Completion</div>
            <div className="text-xl font-bold font-mono text-text-main">
              {stats?.completionPercent || 0}%
            </div>
          </div>
        </div>
      </div>

      {/* 12-Week Activity Heatmap */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-bold text-text-main">12-Week Study Heatmap (84 Days)</h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-text-dim">
            <span>Less</span>
            <div className="w-3 h-3 rounded-xs bg-surface border border-border" />
            <div className="w-3 h-3 rounded-xs bg-accent/30" />
            <div className="w-3 h-3 rounded-xs bg-accent/60" />
            <div className="w-3 h-3 rounded-xs bg-accent" />
            <span>More</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="grid grid-flow-col grid-rows-7 gap-1.5 pt-2 overflow-x-auto pb-2">
          {stats?.heatmap?.map((item: any) => {
            let color = 'bg-surface border border-border/50';
            if (item.minutes > 60) color = 'bg-accent';
            else if (item.minutes > 30) color = 'bg-accent/70';
            else if (item.minutes > 0) color = 'bg-accent/35';

            return (
              <div
                key={item.date}
                title={`${item.date}: ${item.minutes} minutes watched`}
                className={`w-3.5 h-3.5 rounded-xs transition-colors cursor-pointer hover:ring-2 hover:ring-accent ${color}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
