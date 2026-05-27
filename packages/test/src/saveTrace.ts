import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { dirname } from 'node:path';
import yazl from 'yazl';
import type { Tracer } from '@mobilewright/core';

export async function saveTrace(tracer: Tracer, outputPath: string): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });

  const zipFile = new yazl.ZipFile();
  zipFile.addBuffer(Buffer.from(tracer.serializeEvents()), 'trace.trace');
  zipFile.addBuffer(Buffer.from(''), 'trace.network');

  for (const [sha1, data] of tracer.resourceEntries) {
    zipFile.addBuffer(data, `resources/${sha1}`);
  }

  const writeStream = createWriteStream(outputPath);
  const pipelinePromise = pipeline(zipFile.outputStream, writeStream);
  zipFile.end();
  await pipelinePromise;
}
