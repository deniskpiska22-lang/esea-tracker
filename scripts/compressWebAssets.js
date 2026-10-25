import { readdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

async function compressDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await compressDirectory(filename);
    else if (/\.(?:js|css|json|svg|xml|html|txt)$/.test(filename)) {
      const body = await readFile(filename);
      if (body.length >= 1024) await writeFile(filename + '.gz', gzipSync(body, { level: 9 }));
    }
  }
}
await compressDirectory('dist');
