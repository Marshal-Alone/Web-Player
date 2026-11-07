import { Profile, IProfile } from '../models/Profile.js';

export interface SeedResult {
  seeded: boolean;
  profiles: IProfile[];
}

export async function seedDefaultProfiles(): Promise<SeedResult> {
  const defaultProfiles = [
    { key: 'dsa', name: 'DSA', order: 0, rootPath: '' },
    { key: 'development', name: 'Development', order: 1, rootPath: '' }
  ] as const;

  let createdAny = false;
  const profiles: IProfile[] = [];

  for (const def of defaultProfiles) {
    let profile = await Profile.findOne({ key: def.key });
    if (!profile) {
      profile = await Profile.create({
        key: def.key,
        name: def.name,
        rootPath: def.rootPath,
        order: def.order,
        stats: {
          totalSections: 0,
          totalVideos: 0,
          totalDuration: 0
        }
      });
      createdAny = true;
      console.log(`[Seeder] Seeded default profile: ${def.name} (${def.key})`);
    }
    profiles.push(profile);
  }

  return {
    seeded: createdAny,
    profiles
  };
}
