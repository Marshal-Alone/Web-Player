import React, { useState, useEffect } from 'react';
import { useProfileStore } from '../../stores/useProfileStore.js';
import { usePlayerStore } from '../../stores/usePlayerStore.js';
import {
  fetchProfiles,
  updateProfile,
  validateProfilePath,
  scanProfile,
  fetchSettings,
  updateSettings,
  bulkMarkProgress,
  fetchLibrary
} from '../../api/client.js';
import {
  Folder,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Info,
  CheckCheck,
  RotateCcw,
  ListChecks
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { profiles, setProfiles, activeProfileKey } = useProfileStore();
  const { setAutoplayEnabled } = usePlayerStore();

  const [paths, setPaths] = useState<{ [id: string]: string }>({});
  const [valResults, setValResults] = useState<{ [id: string]: any }>({});
  const [validating, setValidating] = useState<{ [id: string]: boolean }>({});
  const [scanning, setScanning] = useState<{ [id: string]: boolean }>({});
  const [scanStatus, setScanStatus] = useState<{ [id: string]: string }>({});

  const [settingsData, setSettingsData] = useState({
    autoplay: true,
    autoplayDelay: 5,
    completeThreshold: 95
  });

  // Bulk marking state
  const [selectedBulkProfileId, setSelectedBulkProfileId] = useState<string>('');
  const [bulkSections, setBulkSections] = useState<any[]>([]);
  const [bulkVideos, setBulkVideos] = useState<any[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles().then((data) => {
      setProfiles(data);
      const initialPaths: { [id: string]: string } = {};
      data.forEach((p: any) => {
        initialPaths[p._id] = p.rootPath || '';
      });
      setPaths(initialPaths);

      // Default selected profile for bulk marking
      const current = data.find((p: any) => p.key === activeProfileKey) || data[0];
      if (current) {
        setSelectedBulkProfileId(current._id);
      }
    });

    fetchSettings().then((s) => {
      setSettingsData(s);
    });
  }, [activeProfileKey]);

  // Load sections and videos for selected bulk profile
  useEffect(() => {
    if (!selectedBulkProfileId) return;
    fetchLibrary(selectedBulkProfileId)
      .then((data) => {
        const secs = data.sections || [];
        setBulkSections(secs);
        if (secs.length > 0) {
          setSelectedSectionId(secs[0]._id);
        }

        // Collect all videos
        const allVids: any[] = [];
        secs.forEach((sec: any) => {
          sec.videos.forEach((v: any) => {
            allVids.push({
              _id: v._id,
              badge: v.badge,
              title: v.title,
              sectionName: sec.name
            });
          });
        });
        setBulkVideos(allVids);
        if (allVids.length > 0) {
          setSelectedVideoId(allVids[0]._id);
        }
      })
      .catch(() => {
        setBulkSections([]);
        setBulkVideos([]);
      });
  }, [selectedBulkProfileId]);

  const handleValidate = async (profileId: string) => {
    setValidating((prev) => ({ ...prev, [profileId]: true }));
    setValResults((prev) => ({ ...prev, [profileId]: null }));

    try {
      await updateProfile(profileId, { rootPath: paths[profileId] });
      const res = await validateProfilePath(profileId, paths[profileId]);
      setValResults((prev) => ({ ...prev, [profileId]: res }));
    } catch (err: any) {
      setValResults((prev) => ({
        ...prev,
        [profileId]: { valid: false, error: err.message || 'Validation failed' }
      }));
    } finally {
      setValidating((prev) => ({ ...prev, [profileId]: false }));
    }
  };

  const handleScan = async (profileId: string) => {
    setScanning((prev) => ({ ...prev, [profileId]: true }));
    setScanStatus((prev) => ({ ...prev, [profileId]: 'Scanning library non-invasively...' }));

    try {
      await updateProfile(profileId, { rootPath: paths[profileId] });
      const res = await scanProfile(profileId);
      setScanStatus((prev) => ({
        ...prev,
        [profileId]: `Successfully indexed ${res.sectionsAdded} sections and ${res.videosAdded} videos!`
      }));
      const updated = await fetchProfiles();
      setProfiles(updated);
    } catch (err: any) {
      setScanStatus((prev) => ({
        ...prev,
        [profileId]: `Scan error: ${err.message || 'Failed'}`
      }));
    } finally {
      setScanning((prev) => ({ ...prev, [profileId]: false }));
    }
  };

  const handleSaveSettings = async (updates: Partial<typeof settingsData>) => {
    const next = { ...settingsData, ...updates };
    setSettingsData(next);
    if (updates.autoplay !== undefined) {
      setAutoplayEnabled(updates.autoplay);
    }
    await updateSettings(next);
  };

  const handleExportBackup = () => {
    window.open('/api/backup/export', '_blank');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/backup/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        if (res.ok) {
          alert('Backup imported successfully! Refreshing...');
          window.location.reload();
        } else {
          alert('Failed to import backup.');
        }
      } catch {
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  // Bulk Progress Handlers
  const executeBulkAction = async (
    action: 'mark-all-completed' | 'mark-all-uncompleted' | 'mark-section-completed' | 'mark-up-to-lesson',
    params?: { sectionId?: string; videoId?: string }
  ) => {
    if (!selectedBulkProfileId) return;

    const confirmMsg =
      action === 'mark-all-completed'
        ? 'Are you sure you want to mark ALL videos in this profile as completed?'
        : action === 'mark-all-uncompleted'
        ? 'Are you sure you want to RESET all progress in this profile?'
        : action === 'mark-section-completed'
        ? 'Mark all videos in this section as completed?'
        : 'Mark all videos up to this lesson as completed?';

    if (!window.confirm(confirmMsg)) return;

    setBulkLoading(true);
    setBulkSuccessMsg(null);
    try {
      const res = await bulkMarkProgress(selectedBulkProfileId, {
        action,
        ...params
      });
      setBulkSuccessMsg(`Success: Updated ${res.count} video(s)!`);
      setTimeout(() => setBulkSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Bulk update failed: ${err.message || 'Error'}`);
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-canvas p-6 md:p-8 space-y-8 max-w-4xl mx-auto w-full">
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl font-bold text-text-main tracking-tight">Settings</h1>
        <p className="text-xs text-text-muted mt-1">
          Configure profile course directories, playback rules, bulk progress, and local indexing.
        </p>
      </div>

      {/* Google Drive Tip Banner */}
      <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 flex items-start gap-3 text-xs text-text-main">
        <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-accent-text">Google Drive for Desktop Optimization</p>
          <p className="text-text-muted leading-relaxed">
            For seamless seeking and instant playback, right-click your course folder in File Explorer and select{' '}
            <strong className="text-text-main">Google Drive → Offline access → Available offline</strong>.
            The scanner never downloads file bodies during scans to keep your bandwidth safe.
          </p>
        </div>
      </div>

      {/* Profiles Directory Settings */}
      <div className="space-y-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-dim">
          Course Profiles & Root Folders
        </h2>

        {profiles.map((profile) => {
          const val = valResults[profile._id];
          const isVal = validating[profile._id];
          const isScan = scanning[profile._id];
          const status = scanStatus[profile._id];

          return (
            <div key={profile._id} className="p-5 rounded-2xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                  <h3 className="text-base font-bold text-text-main">{profile.name} Profile</h3>
                </div>
                {profile.lastScannedAt && (
                  <span className="text-[11px] font-mono text-text-dim">
                    Last scanned: {new Date(profile.lastScannedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-muted">
                  Folder Path on Disk (e.g.{' '}
                  <code className="text-[11px] bg-surface px-1 py-0.5 rounded text-text-main">
                    G:\My Drive\Apna College {profile.name}
                  </code>
                  )
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Folder className="w-4 h-4 text-text-dim absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={paths[profile._id] ?? ''}
                      onChange={(e) =>
                        setPaths({ ...paths, [profile._id]: e.target.value })
                      }
                      placeholder={`Enter full path to ${profile.name} course directory`}
                      className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-text-main focus:border-accent focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => handleValidate(profile._id)}
                    disabled={isVal || isScan}
                    className="px-3.5 py-2 rounded-xl bg-surface-hover hover:bg-border text-xs font-semibold text-text-main border border-border transition-colors disabled:opacity-50 shrink-0"
                  >
                    {isVal ? 'Validating…' : 'Validate'}
                  </button>

                  <button
                    onClick={() => handleScan(profile._id)}
                    disabled={isScan || isVal}
                    className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-xs font-semibold text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScan ? 'animate-spin' : ''}`} />
                    <span>{isScan ? 'Scanning…' : 'Rescan'}</span>
                  </button>
                </div>
              </div>

              {/* Validation Result Box */}
              {val && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    val.valid
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}
                >
                  {val.valid ? (
                    <>
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Found <strong>{val.sectionCount}</strong> sections and{' '}
                        <strong>{val.videoCount}</strong> lessons ready to index.
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{val.error || 'Folder not accessible or does not exist'}</span>
                    </>
                  )}
                </div>
              )}

              {/* Scan Status Feedback */}
              {status && (
                <div className="p-3 rounded-xl bg-surface border border-border text-xs text-text-main font-mono">
                  {status}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* NEW: Bulk Marking Videos as Watched Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-dim flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-accent" />
            Bulk Progress Marking
          </h2>
          {bulkSuccessMsg && (
            <span className="text-xs font-semibold text-emerald-400 animate-in fade-in">
              {bulkSuccessMsg}
            </span>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border space-y-6">
          {/* Target Profile Picker */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
            <div>
              <div className="text-sm font-semibold text-text-main">Target Profile</div>
              <div className="text-xs text-text-muted">
                Choose which library profile to apply bulk progress changes to.
              </div>
            </div>
            <select
              value={selectedBulkProfileId}
              onChange={(e) => setSelectedBulkProfileId(e.target.value)}
              className="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-text-main focus:outline-none focus:border-accent"
            >
              {profiles.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick All-or-Nothing Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border pb-5">
            <div>
              <div className="text-sm font-semibold text-text-main">Entire Profile Progress</div>
              <div className="text-xs text-text-muted">
                Mark every single video as completed (100%), or clear all progress.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={bulkLoading}
                onClick={() => executeBulkAction('mark-all-completed')}
                className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark All Watched
              </button>
              <button
                disabled={bulkLoading}
                onClick={() => executeBulkAction('mark-all-uncompleted')}
                className="px-3 py-2 rounded-xl bg-surface hover:bg-surface-hover text-text-muted hover:text-text-main border border-border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset All Progress
              </button>
            </div>
          </div>

          {/* Section-wise Bulk Marking */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-5">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-text-main">Mark Specific Section</div>
              <div className="text-xs text-text-muted">
                Mark all lessons within a single section as watched.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                disabled={bulkSections.length === 0}
                className="bg-surface border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-main focus:outline-none focus:border-accent max-w-xs truncate"
              >
                {bulkSections.map((sec) => (
                  <option key={sec._id} value={sec._id}>
                    {sec.badge ? `${sec.badge}. ` : ''}{sec.name} ({sec.videoCount} lessons)
                  </option>
                ))}
              </select>

              <button
                disabled={bulkLoading || !selectedSectionId}
                onClick={() =>
                  executeBulkAction('mark-section-completed', { sectionId: selectedSectionId })
                }
                className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
              >
                <ListChecks className="w-3.5 h-3.5" />
                Mark Section
              </button>
            </div>
          </div>

          {/* Mark Watched Up-To Lesson */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-text-main">Mark Watched Up To Lesson</div>
              <div className="text-xs text-text-muted">
                Mark all preceding lessons up to (and including) this lesson as watched.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedVideoId}
                onChange={(e) => setSelectedVideoId(e.target.value)}
                disabled={bulkVideos.length === 0}
                className="bg-surface border border-border rounded-xl px-3 py-2 text-xs font-medium text-text-main focus:outline-none focus:border-accent max-w-xs truncate"
              >
                {bulkVideos.map((vid) => (
                  <option key={vid._id} value={vid._id}>
                    {vid.badge ? `${vid.badge} - ` : ''}{vid.title} ({vid.sectionName})
                  </option>
                ))}
              </select>

              <button
                disabled={bulkLoading || !selectedVideoId}
                onClick={() =>
                  executeBulkAction('mark-up-to-lesson', { videoId: selectedVideoId })
                }
                className="px-3.5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark Up To Here
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Playback Behavior Settings */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-dim">
          Playback & Resume Rules
        </h2>

        <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-text-main">Autoplay Next Lesson</div>
              <div className="text-xs text-text-muted">
                Automatically transitions to the next lesson after a 5-second countdown.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settingsData.autoplay}
              onChange={(e) => handleSaveSettings({ autoplay: e.target.checked })}
              className="w-4 h-4 accent-accent rounded cursor-pointer"
            />
          </div>

          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-text-main">Auto-Complete Threshold</div>
              <div className="text-xs text-text-muted">
                Mark video as completed when reaching this percentage of total duration.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-accent-text">
                {settingsData.completeThreshold}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Backup and Progress Export */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-dim">
          Data Backup & Portability
        </h2>

        <div className="p-5 rounded-2xl bg-card border border-border flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-text-main">Export / Import Progress</div>
            <div className="text-xs text-text-muted">
              Backup your watch progress, timestamps, notes, and bookmarks as a single JSON file.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportBackup}
              className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-hover text-xs font-semibold text-text-main border border-border flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>

            <label className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-hover text-xs font-semibold text-text-main border border-border flex items-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
