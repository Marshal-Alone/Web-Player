import * as fs from 'fs';
import * as path from 'path';

/**
 * Fixture generator for Local Course Player test suites.
 * Creates realistic mock directory structures modeling Google Drive folders:
 * - DSA curriculum with natural sort sections (01, 02, 10)
 * - Development curriculum with sections (01, 57, 100) and lesson badges (671, 672, 1001)
 * - Subtitles (.srt, .vtt), supplementary documents (.pdf), and noise files (.DS_Store, Thumbs.db)
 * - Edge case folders (unbadged folders, decimal badge numbering, empty sections)
 */

export const FIXTURES_ROOT = path.resolve(__dirname);
export const MOCK_DSA_PATH = path.join(FIXTURES_ROOT, 'mock_dsa');
export const MOCK_DEV_PATH = path.join(FIXTURES_ROOT, 'mock_dev');
export const MOCK_EDGE_PATH = path.join(FIXTURES_ROOT, 'mock_edge_cases');
export const MOCK_RENAME_PATH = path.join(FIXTURES_ROOT, 'mock_rename');

/**
 * Creates a synthetic but well-formed dummy MP4 byte buffer.
 * Contains standard ISO BMFF box headers: ftyp (isom/mp42) + mdat padding.
 * Sized sufficiently for Range header partial content testing.
 */
function createDummyMp4(sizeInBytes: number = 65536): Buffer {
  const buf = Buffer.alloc(sizeInBytes, 0);

  // ftyp box (32 bytes)
  buf.writeUInt32BE(32, 0); // box size = 32
  buf.write('ftyp', 4, 'ascii'); // box type
  buf.write('isom', 8, 'ascii'); // major brand
  buf.writeUInt32BE(512, 12); // minor version
  buf.write('isom', 16, 'ascii'); // compatible brand 1
  buf.write('iso2', 20, 'ascii'); // compatible brand 2
  buf.write('mp41', 24, 'ascii'); // compatible brand 3
  buf.write('mp42', 28, 'ascii'); // compatible brand 4

  // mdat box header
  buf.writeUInt32BE(sizeInBytes - 32, 32); // remaining size
  buf.write('mdat', 36, 'ascii');

  // Fill remainder with recognizable deterministic repeating pattern
  for (let i = 40; i < sizeInBytes; i++) {
    buf[i] = i % 251;
  }

  return buf;
}

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:04,500
Welcome to this lecture on Course Foundations.

2
00:00:05,000 --> 00:00:09,800
Today we will understand the core algorithms step-by-step.

3
00:00:10,000 --> 00:00:15,000
Make sure to follow along and write notes.
`;

const SAMPLE_VTT = `WEBVTT - Local Course Player Subtitle Track

1
00:00:01.000 --> 00:00:04.500
Welcome to this lecture on Course Foundations.

2
00:00:05.000 --> 00:00:09.800
Today we will understand the core algorithms step-by-step.

3
00:00:10.000 --> 00:00:15.000
Make sure to follow along and write notes.
`;

const SAMPLE_PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer << /Size 4 /Root 1 0 R >>
startxref
190
%%EOF
`;

export function generateFixtures(): void {
  // Ensure directories
  const dirsToCreate = [
    // DSA
    path.join(MOCK_DSA_PATH, '01. Flowcharts & Pseudocode'),
    path.join(MOCK_DSA_PATH, '02. Arrays & Strings'),
    path.join(MOCK_DSA_PATH, '10. Advanced Dynamic Programming'),

    // DEV
    path.join(MOCK_DEV_PATH, '01. Introduction to Web'),
    path.join(MOCK_DEV_PATH, '57. Project - Phase 2 (Part e)'),
    path.join(MOCK_DEV_PATH, '100. Deployment & DevOps'),

    // Edge Cases
    path.join(MOCK_EDGE_PATH, 'Unbadged Folder'),
    path.join(MOCK_EDGE_PATH, 'Empty Section'),
    path.join(MOCK_EDGE_PATH, 'Multi Number 01.5 - Special Topic'),

    // Rename
    path.join(MOCK_RENAME_PATH, 'Original Folder')
  ];

  for (const dir of dirsToCreate) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Populate DSA
  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '01. Flowcharts & Pseudocode', '001 - Flowchart Basics.mp4'),
    createDummyMp4(65536)
  );
  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '01. Flowcharts & Pseudocode', '001 - Flowchart Basics.srt'),
    SAMPLE_SRT,
    'utf-8'
  );
  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '01. Flowcharts & Pseudocode', '001 - Flowchart Basics.vtt'),
    SAMPLE_VTT,
    'utf-8'
  );
  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '01. Flowcharts & Pseudocode', '002 - Variables and Datatypes.mp4'),
    createDummyMp4(49152)
  );
  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '01. Flowcharts & Pseudocode', 'Notes - Flowcharts.pdf'),
    SAMPLE_PDF,
    'utf-8'
  );

  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '02. Arrays & Strings', '003 - Array Basics.mp4'),
    createDummyMp4(32768)
  );
  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '02. Arrays & Strings', '004 - 2D Arrays.mp4'),
    createDummyMp4(40960)
  );
  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '02. Arrays & Strings', 'Array Cheat Sheet.pdf'),
    SAMPLE_PDF,
    'utf-8'
  );

  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '10. Advanced Dynamic Programming', '050 - DP Introduction.mp4'),
    createDummyMp4(57344)
  );
  fs.writeFileSync(
    path.join(MOCK_DSA_PATH, '10. Advanced Dynamic Programming', '100 - Matrix Chain Multiplication.mp4'),
    createDummyMp4(73728)
  );

  // Populate DEV
  fs.writeFileSync(
    path.join(MOCK_DEV_PATH, '01. Introduction to Web', '001 - How the Web Works.mp4'),
    createDummyMp4(65536)
  );
  fs.writeFileSync(
    path.join(MOCK_DEV_PATH, '01. Introduction to Web', 'web_syllabus.pdf'),
    SAMPLE_PDF,
    'utf-8'
  );

  fs.writeFileSync(
    path.join(MOCK_DEV_PATH, '57. Project - Phase 2 (Part e)', '671 - Project Architecture.mp4'),
    createDummyMp4(81920)
  );
  fs.writeFileSync(
    path.join(MOCK_DEV_PATH, '57. Project - Phase 2 (Part e)', '672 - Connecting Login Route.mp4'),
    createDummyMp4(65536)
  );
  fs.writeFileSync(
    path.join(MOCK_DEV_PATH, '57. Project - Phase 2 (Part e)', '672 - Connecting Login Route.srt'),
    SAMPLE_SRT,
    'utf-8'
  );

  fs.writeFileSync(
    path.join(MOCK_DEV_PATH, '100. Deployment & DevOps', '1001 - Dockerizing the Backend.mp4'),
    createDummyMp4(98304)
  );

  // Populate Edge Cases
  fs.writeFileSync(
    path.join(MOCK_EDGE_PATH, 'Unbadged Folder', 'Bonus Video.mp4'),
    createDummyMp4(32768)
  );
  fs.writeFileSync(
    path.join(MOCK_EDGE_PATH, 'Unbadged Folder', '.DS_Store'),
    Buffer.from([0x00, 0x00, 0x00, 0x01, 0x42, 0x75, 0x64, 0x31])
  );
  fs.writeFileSync(
    path.join(MOCK_EDGE_PATH, 'Unbadged Folder', 'Thumbs.db'),
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
  );
  fs.writeFileSync(
    path.join(MOCK_EDGE_PATH, 'Unbadged Folder', 'lecture_notes.txt'),
    'Plain text lecture summary notes'
  );

  fs.writeFileSync(
    path.join(MOCK_EDGE_PATH, 'Multi Number 01.5 - Special Topic', '001.5 - Decimal Subtopic.mp4'),
    createDummyMp4(32768)
  );

  // Populate Rename Fixture
  fs.writeFileSync(
    path.join(MOCK_RENAME_PATH, 'Original Folder', 'Initial File.mp4'),
    createDummyMp4(49152)
  );
}

// Execute if run directly
if (require.main === module) {
  generateFixtures();
  console.log('Fixtures generated successfully.');
}
