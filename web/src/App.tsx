import { useEffect } from 'react';
import { useProfileStore } from './stores/useProfileStore.js';
import { useUIStore } from './stores/useUIStore.js';
import { usePlayerStore } from './stores/usePlayerStore.js';
import { fetchProfiles } from './api/client.js';
import curriculumData from './data/curriculum.json';

import { Navbar } from './components/navbar/Navbar.js';
import { HomePage } from './components/home/HomePage.js';
import { CustomVideoPlayer } from './components/player/CustomVideoPlayer.js';
import { PlayerSidebar } from './components/sidebar/PlayerSidebar.js';
import { SettingsPage } from './components/settings/SettingsPage.js';
import { StatsPage } from './components/stats/StatsPage.js';
import { ShortcutsModal } from './components/modals/ShortcutsModal.js';
import { NotesDrawer } from './components/player/NotesDrawer.js';
import { BookmarksDrawer } from './components/player/BookmarksDrawer.js';

export function App() {
  const { setProfiles, activeProfileKey, setActiveProfileKey } = useProfileStore();
  const { currentView, setCurrentView, theme } = useUIStore();
  const { isTheatreMode: playerTheatre, setCurrentVideoId } = usePlayerStore();

  // Manage body scroll and lock viewport when playing video
  useEffect(() => {
    if (currentView === 'player') {
      window.scrollTo(0, 0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [currentView]);

  // Synchronize profiles, themes, and initial URL routing on mount
  useEffect(() => {
    // Set theme attribute
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Inspect initial URL query parameters
    const params = new URLSearchParams(window.location.search);
    const videoParam = params.get('v') || params.get('video') || localStorage.getItem('course_player_current_video');
    const viewParam = params.get('view') as any;

    if (videoParam) {
      setCurrentVideoId(videoParam);
      setCurrentView('player');

      // Auto-align active profile key with the video's parent course
      const matchedVid = (curriculumData.videos as any[]).find((v) => v._id === videoParam);
      if (matchedVid) {
        const matchedProf = (curriculumData.profiles as any[]).find((p) => p._id === matchedVid.profileId);
        if (matchedProf && matchedProf.key && matchedProf.key !== activeProfileKey) {
          setActiveProfileKey(matchedProf.key);
        }
      }
    } else if (viewParam && ['library', 'settings', 'stats'].includes(viewParam)) {
      setCurrentView(viewParam);
    }

    // Load initial profiles
    fetchProfiles()
      .then((data) => {
        setProfiles(data);
      })
      .catch((err) => {
        console.error('Failed to load profiles:', err);
      });
  }, []);

  // Update profile data-profile attribute on root html
  useEffect(() => {
    document.documentElement.setAttribute('data-profile', activeProfileKey);
  }, [activeProfileKey]);

  // Handle browser popstate navigation (Back / Forward buttons & URL sync)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('v') || params.get('video');
      const view = params.get('view') as any;

      if (v) {
        setCurrentVideoId(v);
        setCurrentView('player');
        const matchedVid = (curriculumData.videos as any[]).find((item) => item._id === v);
        if (matchedVid) {
          const matchedProf = (curriculumData.profiles as any[]).find((p) => p._id === matchedVid.profileId);
          if (matchedProf && matchedProf.key) {
            setActiveProfileKey(matchedProf.key);
          }
        }
      } else if (view && ['library', 'settings', 'stats'].includes(view)) {
        setCurrentView(view);
      } else {
        setCurrentView('library');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentVideoId, setCurrentView, setActiveProfileKey]);

  return (
    <div
      className={`w-full max-w-full bg-canvas text-text-main flex flex-col font-sans ${
        currentView === 'player'
          ? 'fixed inset-0 overflow-hidden w-screen h-screen z-0'
          : 'min-h-screen overflow-x-hidden'
      }`}
    >
      <Navbar />

      <main
        className={`flex-1 flex flex-col w-full min-w-0 ${
          currentView === 'player' ? 'h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] overflow-hidden' : 'overflow-hidden'
        }`}
      >
        {currentView === 'library' && <HomePage />}

        {currentView === 'player' && (
          <div className="flex-1 flex h-full max-h-full overflow-hidden w-full min-w-0">
            {/* Player Sidebar */}
            {!playerTheatre && <PlayerSidebar />}

            {/* Video Player Canvas */}
            <div className="flex-1 flex flex-col items-center justify-center bg-black overflow-hidden relative min-w-0 h-full max-h-full">
              <CustomVideoPlayer />
            </div>
          </div>
        )}

        {currentView === 'settings' && <SettingsPage />}

        {currentView === 'stats' && <StatsPage />}
      </main>

      {/* Slide-over Drawers & Modals */}
      <ShortcutsModal />
      <NotesDrawer />
      <BookmarksDrawer />
    </div>
  );
}

export default App;
