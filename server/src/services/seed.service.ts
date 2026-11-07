import fs from 'fs';
import { Profile, IProfile } from '../models/Profile.js';
import { scanProfileLibrary } from './scanner.service.js';

export interface SeedResult {
  seeded: boolean;
  profiles: IProfile[];
}

export const DEFAULT_PROFILES = [
  {
    key: 'dsa' as const,
    name: 'DSA',
    order: 0,
    rootPath: 'G:\\My Drive\\Apna College DSA',
    gdriveUrl: 'https://drive.google.com/drive/folders/1rcy3AgCQAX-x8amkpjP1AifrhOhC0eO3?usp=drive_link'
  },
  {
    key: 'development' as const,
    name: 'Development',
    order: 1,
    rootPath: 'G:\\My Drive\\Apna College Development',
    gdriveUrl: 'https://drive.google.com/drive/folders/1ibiPith7qMfWpeS3Vzh6YX747hBga8bs?usp=sharing'
  }
];

export async function seedDefaultProfiles(): Promise<SeedResult> {
  let createdAny = false;
  const profiles: IProfile[] = [];

  for (const def of DEFAULT_PROFILES) {
    let profile = await Profile.findOne({ key: def.key });
    let modified = false;

    if (!profile) {
      profile = await Profile.create({
        key: def.key,
        name: def.name,
        rootPath: def.rootPath,
        gdriveUrl: def.gdriveUrl,
        order: def.order,
        stats: {
          totalSections: 0,
          totalVideos: 0,
          totalDuration: 0
        }
      });
      createdAny = true;
      console.log(`[Seeder] Seeded default profile: ${def.name} (${def.key}) -> ${def.rootPath}`);
    } else {
      // Update with hardcoded fallback paths and URLs if missing or empty
      if (!profile.rootPath || profile.rootPath.trim() === '') {
        profile.rootPath = def.rootPath;
        modified = true;
      }
      if (!profile.gdriveUrl || profile.gdriveUrl.trim() === '') {
        profile.gdriveUrl = def.gdriveUrl;
        modified = true;
      }
      if (modified) {
        await profile.save();
        console.log(`[Seeder] Updated profile ${profile.name} with hardcoded defaults`);
      }
    }

    profiles.push(profile);

    // If directory exists locally and profile has 0 videos, trigger background initial scan
    if (profile.rootPath && fs.existsSync(profile.rootPath) && (!profile.stats || profile.stats.totalVideos === 0)) {
      const pid = profile._id.toString();
      const pName = profile.name;
      scanProfileLibrary(pid)
        .then((res) => {
          console.log(`[Seeder] Auto-scanned library for ${pName}: indexed ${res.videosAdded} videos across ${res.sectionsAdded} sections`);
        })
        .catch((err) => {
          console.warn(`[Seeder] Auto-scan for ${pName} scheduled for later:`, err.message);
        });
    }
  }

  return {
    seeded: createdAny,
    profiles
  };
}
