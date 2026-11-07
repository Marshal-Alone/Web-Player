import fs from 'fs';
import path from 'path';

export interface GDriveResolutionResult {
  isDriveUrl: boolean;
  folderId?: string;
  folderName?: string;
  localPath?: string;
  error?: string;
}

// Extracts folder ID from URLs like:
// https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ
// https://drive.google.com/drive/u/0/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ
// https://drive.google.com/open?id=1aBcDeFgHiJkLmNoPqRsTuVwXyZ
export function extractGDriveFolderId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/(?:drive|docs)\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|open\?id=)([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Given a Google Drive folder URL or ID, fetches the HTML title to discover the folder name,
 * and searches mounted local Google Drive drives (G:\My Drive, etc.) for a match.
 */
export async function resolveGDriveUrlToLocalPath(driveUrlOrId: string): Promise<GDriveResolutionResult> {
  const folderId = extractGDriveFolderId(driveUrlOrId) || (driveUrlOrId.length > 20 && !driveUrlOrId.includes('\\') && !driveUrlOrId.includes('/') ? driveUrlOrId : null);
  if (!folderId) {
    return { isDriveUrl: false };
  }

  let folderName: string | undefined;

  // 1. Attempt to fetch public web page to extract folder name from HTML <title>
  try {
    const url = `https://drive.google.com/drive/folders/${folderId}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (res.ok) {
      const html = await res.text();
      // Match <meta property="og:title" content="..."> or <title>... – Google Drive</title>
      const metaMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      if (metaMatch && metaMatch[1] && metaMatch[1].trim() !== 'Google Drive') {
        folderName = metaMatch[1].trim();
      } else {
        const rawTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (rawTitle && rawTitle[1]) {
          const cleaned = rawTitle[1]
            .replace(/\s*[\u2013\u2014-]\s*Google\s*Drive.*$/i, '')
            .trim();
          if (
            cleaned &&
            cleaned.toLowerCase() !== 'google drive' &&
            !cleaned.toLowerCase().includes('sign in')
          ) {
            folderName = cleaned;
          }
        }
      }
    }
  } catch (err) {
    // web fetch failed or offline
  }

  // 2. Scan mounted drives for matching local Google Drive folders
  const candidateDrives = ['G:\\', 'H:\\', 'F:\\', 'D:\\', 'E:\\', 'C:\\'];
  const potentialPaths: string[] = [];

  for (const drv of candidateDrives) {
    try {
      if (fs.existsSync(drv)) {
        potentialPaths.push(path.join(drv, 'My Drive'));
        potentialPaths.push(drv);
      }
    } catch {}
  }

  // If we found a folder name from Google Drive HTML, check direct match
  if (folderName) {
    for (const base of potentialPaths) {
      const candidate = path.join(base, folderName);
      if (fs.existsSync(candidate)) {
        return {
          isDriveUrl: true,
          folderId,
          folderName,
          localPath: candidate
        };
      }
    }
  }

  // Also check if any subfolder in G:\My Drive matches known course keywords (DSA, Development)
  for (const base of potentialPaths) {
    try {
      if (fs.existsSync(base)) {
        const entries = fs.readdirSync(base, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (folderName && entry.name.toLowerCase() === folderName.toLowerCase()) {
              return {
                isDriveUrl: true,
                folderId,
                folderName: entry.name,
                localPath: path.join(base, entry.name)
              };
            }
          }
        }
      }
    } catch {}
  }

  return {
    isDriveUrl: true,
    folderId,
    folderName,
    error: folderName
      ? `Identified Google Drive folder "${folderName}", but could not locate it automatically under G:\\My Drive. Please ensure Google Drive for Desktop is running.`
      : `Google Drive link recognized (ID: ${folderId}). Please ensure the folder is shared or Google Drive for Desktop is running.`
  };
}
