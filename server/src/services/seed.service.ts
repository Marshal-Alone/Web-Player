import fs from 'fs';
import { Profile, IProfile } from '../models/Profile.js';
import { scanProfileLibrary } from './scanner.service.js';
import { getEffectiveLocalPath } from './gdrive.service.js';

export interface SeedResult {
  seeded: boolean;
  profiles: IProfile[];
}

export const DEFAULT_PROFILES = [
  {
    key: 'dsa' as const,
    name: 'DSA',
    order: 0,
    rootPath: 'https://drive.google.com/drive/folders/1rcy3AgCQAX-x8amkpjP1AifrhOhC0eO3?usp=drive_link',
    gdriveUrl: 'https://drive.google.com/drive/folders/1rcy3AgCQAX-x8amkpjP1AifrhOhC0eO3?usp=drive_link',
    resolvedLocalPath: 'G:\\My Drive\\Apna College DSA'
  },
  {
    key: 'development' as const,
    name: 'Development',
    order: 1,
    rootPath: 'https://drive.google.com/drive/folders/1ibiPith7qMfWpeS3Vzh6YX747hBga8bs?usp=sharing',
    gdriveUrl: 'https://drive.google.com/drive/folders/1ibiPith7qMfWpeS3Vzh6YX747hBga8bs?usp=sharing',
    resolvedLocalPath: 'G:\\My Drive\\Apna College Development'
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
        resolvedLocalPath: def.resolvedLocalPath,
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
      // Ensure Google Drive link is set as default path
      if (!profile.rootPath || !profile.rootPath.startsWith('http')) {
        profile.rootPath = def.rootPath;
        modified = true;
      }
      if (!profile.gdriveUrl || !profile.gdriveUrl.startsWith('http')) {
        profile.gdriveUrl = def.gdriveUrl;
        modified = true;
      }
      if (!profile.resolvedLocalPath) {
        profile.resolvedLocalPath = def.resolvedLocalPath;
        modified = true;
      }
      if (modified) {
        await profile.save();
        console.log(`[Seeder] Synchronized profile ${profile.name} with Google Drive link: ${def.rootPath}`);
      }
    }

    profiles.push(profile);

    // If local directory exists and profile has 0 videos, trigger background initial scan
    const localEffective = getEffectiveLocalPath(profile);
    if (localEffective && fs.existsSync(localEffective) && (!profile.stats || profile.stats.totalVideos === 0)) {
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
