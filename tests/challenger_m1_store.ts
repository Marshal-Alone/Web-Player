/**
 * Challenger Test Harness: Zustand Store State Mutations & DOM Synchronization
 * Tests useUIStore and useProfileStore under both Node.js headless and simulated DOM environments.
 */

import { assert } from './e2e/framework/assert';

async function runStoreTests() {
  console.log('================================================================');
  console.log('   CHALLENGER: ZUSTAND STORE EMPIRICAL VERIFICATION HARNESS    ');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(` ✔ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(` ✘ FAIL: ${name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  // 1. PURE HEADLESS NODE ENVIRONMENT (no window / document)
  console.log('\n--- Scenario 1: Headless Node Environment (Window Undefined) ---');

  // Dynamically import stores in Node environment
  const { useUIStore } = await import('../web/src/stores/useUIStore.js');
  const { useProfileStore } = await import('../web/src/stores/useProfileStore.js');

  test('useUIStore initializes with expected defaults', () => {
    const state = useUIStore.getState();
    assert.equal(state.currentView, 'library', 'Initial view should be library');
    assert.equal(state.theme, 'dark', 'Initial theme should default to dark in Node');
    assert.equal(state.isShortcutsModalOpen, false, 'Modal should start closed');
    assert.equal(state.isNotesDrawerOpen, false, 'Notes drawer should start closed');
    assert.equal(state.isBookmarksDrawerOpen, false, 'Bookmarks drawer should start closed');
    assert.equal(state.isResourcesDrawerOpen, false, 'Resources drawer should start closed');
  });

  test('useUIStore view transitions update state cleanly', () => {
    const views = ['player', 'stats', 'settings', 'library'] as const;
    for (const v of views) {
      useUIStore.getState().setCurrentView(v);
      assert.equal(useUIStore.getState().currentView, v, `Current view should be ${v}`);
    }
  });

  test('useUIStore drawers and modal toggles operate independently', () => {
    const store = useUIStore.getState();
    store.setShortcutsModalOpen(true);
    store.setNotesDrawerOpen(true);
    assert.equal(useUIStore.getState().isShortcutsModalOpen, true);
    assert.equal(useUIStore.getState().isNotesDrawerOpen, true);
    assert.equal(useUIStore.getState().isBookmarksDrawerOpen, false);

    store.setNotesDrawerOpen(false);
    assert.equal(useUIStore.getState().isNotesDrawerOpen, false);
    assert.equal(useUIStore.getState().isShortcutsModalOpen, true, 'Shortcuts modal should remain true');

    // Clean up
    store.setShortcutsModalOpen(false);
    store.setBookmarksDrawerOpen(false);
    store.setResourcesDrawerOpen(false);
  });

  test('useProfileStore initializes with expected defaults in Node', () => {
    const state = useProfileStore.getState();
    assert.equal(state.activeProfileKey, 'dsa', 'Default profile should be dsa');
    assert.deepEqual(state.profiles, [], 'Profiles list should start empty');
    assert.equal(state.isLoading, false, 'isLoading should default to false');
    assert.equal(state.error, null, 'error should default to null');
    assert.equal(state.getActiveProfile(), undefined, 'getActiveProfile should return undefined when empty');
  });

  test('useProfileStore switching profiles updates state', () => {
    useProfileStore.getState().setActiveProfileKey('development');
    assert.equal(useProfileStore.getState().activeProfileKey, 'development');

    useProfileStore.getState().setActiveProfileKey('dsa');
    assert.equal(useProfileStore.getState().activeProfileKey, 'dsa');
  });

  test('useProfileStore setProfiles and getActiveProfile mapping', () => {
    const mockProfiles = [
      {
        _id: 'p1',
        key: 'dsa' as const,
        name: 'DSA Course',
        rootPath: 'G:\\Drive\\DSA',
        order: 1,
        stats: { totalSections: 10, totalVideos: 50, watchedVideos: 5, totalDuration: 50000, watchTime: 5000 },
        createdAt: '2026-11-07',
        updatedAt: '2026-11-07'
      },
      {
        _id: 'p2',
        key: 'development' as const,
        name: 'Development Course',
        rootPath: 'G:\\Drive\\Dev',
        order: 2,
        stats: { totalSections: 20, totalVideos: 100, watchedVideos: 25, totalDuration: 100000, watchTime: 25000 },
        createdAt: '2026-11-07',
        updatedAt: '2026-11-07'
      }
    ];

    useProfileStore.getState().setProfiles(mockProfiles);
    assert.equal(useProfileStore.getState().profiles.length, 2);

    useProfileStore.getState().setActiveProfileKey('dsa');
    const dsaProf = useProfileStore.getState().getActiveProfile();
    assert.ok(dsaProf, 'DSA profile should be found');
    assert.equal(dsaProf?.name, 'DSA Course');

    useProfileStore.getState().setActiveProfileKey('development');
    const devProf = useProfileStore.getState().getActiveProfile();
    assert.ok(devProf, 'Development profile should be found');
    assert.equal(devProf?.name, 'Development Course');
  });

  test('Cross-store resilience: view switching does not mutate or reset profile store', () => {
    useProfileStore.getState().setActiveProfileKey('development');
    assert.equal(useProfileStore.getState().activeProfileKey, 'development');

    // Cycle through all views
    const views = ['library', 'player', 'stats', 'settings', 'library'] as const;
    for (const v of views) {
      useUIStore.getState().setCurrentView(v);
      assert.equal(useUIStore.getState().currentView, v);
      // Profile store must remain completely untouched
      assert.equal(
        useProfileStore.getState().activeProfileKey,
        'development',
        'Profile should remain development during view switch'
      );
      assert.equal(
        useProfileStore.getState().getActiveProfile()?.name,
        'Development Course',
        'Active profile lookup must persist across view transitions'
      );
    }
  });

  // 2. SIMULATED DOM ENVIRONMENT (mocking window, document, localStorage)
  console.log('\n--- Scenario 2: Simulated DOM Environment (Sync & Storage) ---');

  const storageMap: Record<string, string> = {};
  const mockLocalStorage = {
    getItem: (key: string) => storageMap[key] || null,
    setItem: (key: string, val: string) => {
      storageMap[key] = val;
    },
    removeItem: (key: string) => {
      delete storageMap[key];
    },
    clear: () => {
      for (const k of Object.keys(storageMap)) delete storageMap[k];
    }
  };

  const attributes: Record<string, string> = {};
  const classListSet = new Set<string>();

  const mockDocumentElement = {
    classList: {
      add: (cls: string) => classListSet.add(cls),
      remove: (cls: string) => classListSet.delete(cls),
      contains: (cls: string) => classListSet.has(cls)
    },
    setAttribute: (k: string, v: string) => {
      attributes[k] = v;
    },
    getAttribute: (k: string) => attributes[k] || null
  };

  // Attach to global
  (globalThis as any).window = globalThis;
  (globalThis as any).localStorage = mockLocalStorage;
  (globalThis as any).document = {
    documentElement: mockDocumentElement
  };

  test('DOM & Storage Sync: setTheme updates localStorage and documentElement', () => {
    useUIStore.getState().setTheme('light');
    assert.equal(mockLocalStorage.getItem('course_player_theme'), 'light', 'Theme should be saved to localStorage');
    assert.equal(attributes['data-theme'], 'light', 'data-theme attribute should be light');
    assert.ok(classListSet.has('light'), 'classList should contain light');
    assert.ok(!classListSet.has('dark'), 'classList should not contain dark');

    useUIStore.getState().setTheme('dark');
    assert.equal(mockLocalStorage.getItem('course_player_theme'), 'dark', 'Theme should be saved to localStorage');
    assert.equal(attributes['data-theme'], 'dark', 'data-theme attribute should be dark');
    assert.ok(classListSet.has('dark'), 'classList should contain dark');
    assert.ok(!classListSet.has('light'), 'classList should not contain light');
  });

  test('DOM & Storage Sync: toggleTheme cycles theme and syncs DOM', () => {
    useUIStore.getState().setTheme('dark');
    useUIStore.getState().toggleTheme();
    assert.equal(useUIStore.getState().theme, 'light');
    assert.equal(mockLocalStorage.getItem('course_player_theme'), 'light');
    assert.equal(attributes['data-theme'], 'light');

    useUIStore.getState().toggleTheme();
    assert.equal(useUIStore.getState().theme, 'dark');
    assert.equal(mockLocalStorage.getItem('course_player_theme'), 'dark');
    assert.equal(attributes['data-theme'], 'dark');
  });

  test('DOM & Storage Sync: setActiveProfileKey updates localStorage and documentElement', () => {
    useProfileStore.getState().setActiveProfileKey('development');
    assert.equal(
      mockLocalStorage.getItem('course_player_active_profile'),
      'development',
      'Active profile key should be saved to localStorage'
    );
    assert.equal(attributes['data-profile'], 'development', 'data-profile attribute should be development');

    useProfileStore.getState().setActiveProfileKey('dsa');
    assert.equal(
      mockLocalStorage.getItem('course_player_active_profile'),
      'dsa',
      'Active profile key should be saved to localStorage'
    );
    assert.equal(attributes['data-profile'], 'dsa', 'data-profile attribute should be dsa');
  });

  test('Adversarial stress: rapid profile and view alternations maintain integrity', () => {
    for (let i = 0; i < 50; i++) {
      const p = i % 2 === 0 ? 'dsa' : 'development';
      const v = (['library', 'player', 'stats', 'settings'] as const)[i % 4];
      useProfileStore.getState().setActiveProfileKey(p);
      useUIStore.getState().setCurrentView(v);
      assert.equal(useProfileStore.getState().activeProfileKey, p);
      assert.equal(useProfileStore.getState().getActiveProfile()?.key, p);
      assert.equal(useUIStore.getState().currentView, v);
      assert.equal(attributes['data-profile'], p);
    }
  });

  console.log('\n================================================================');
  console.log(` RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStoreTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
