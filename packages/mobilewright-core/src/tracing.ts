import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import yazl from 'yazl';
import type { MobilewrightDriver } from '@mobilewright/protocol';

// ─── Playwright-compatible trace event types ────────────────────

interface ContextOptionsEvent {
  version: number;
  type: 'context-options';
  origin: 'testRunner';
  browserName: string;
  platform: string;
  wallTime: number;
  monotonicTime: number;
  options: Record<string, unknown>;
  sdkLanguage: string;
  title?: string;
}

interface BeforeActionEvent {
  type: 'before';
  callId: string;
  startTime: number;
  class: string;
  method: string;
  params: Record<string, unknown>;
  pageId?: string;
  beforeSnapshot?: string;
  stepId?: string;
  parentId?: string;
  stack?: StackFrame[];
}

interface AfterActionEvent {
  type: 'after';
  callId: string;
  endTime: number;
  afterSnapshot?: string;
  error?: { message: string; stack?: string };
  attachments?: TraceAttachment[];
}

interface ScreencastFrameEvent {
  type: 'screencast-frame';
  pageId: string;
  sha1: string;
  width: number;
  height: number;
  timestamp: number;
  frameSwapWallTime?: number;
}

// NodeSnapshot uses Playwright's compact array format:
//   string → text node
//   [tagName] | [tagName, attrs, ...children] → element node
type NodeSnapshot = string | unknown[];

interface FrameSnapshotEvent {
  type: 'frame-snapshot';
  snapshot: {
    snapshotName: string;
    callId: string;
    pageId: string;
    frameId: string;
    frameUrl: string;
    timestamp: number;
    wallTime: number;
    collectionTime: number;
    doctype: string;
    html: NodeSnapshot;
    resourceOverrides: Array<{ url: string; sha1: string }>;
    viewport: { width: number; height: number };
    isMainFrame: boolean;
  };
}

interface ErrorEvent {
  type: 'error';
  message: string;
  stack?: StackFrame[];
}

interface StackFrame {
  file: string;
  line: number;
  column: number;
  function: string;
}

interface TraceAttachment {
  name: string;
  contentType: string;
  sha1?: string;
  base64?: string;
}

type TraceEvent =
  | ContextOptionsEvent
  | BeforeActionEvent
  | AfterActionEvent
  | ScreencastFrameEvent
  | FrameSnapshotEvent
  | ErrorEvent;

type ScreenshotCapture = { sha1: string; width: number; height: number };

// ─── Tracer ─────────────────────────────────────────────────────

export class Tracer {
  private events: TraceEvent[] = [];
  private resources: Map<string, Buffer> = new Map();
  private callCounter = 0;
  private startMonotonic: number;
  private driver: MobilewrightDriver | null = null;

  constructor() {
    this.startMonotonic = Date.now();

    this.events.push({
      version: 8,
      type: 'context-options',
      origin: 'testRunner',
      browserName: '',
      platform: process.platform,
      wallTime: Date.now(),
      monotonicTime: 0,
      options: {},
      sdkLanguage: 'javascript',
    });
  }

  setDriver(driver: MobilewrightDriver): void {
    this.driver = driver;
  }

  private monotonicTime(): number {
    return Date.now() - this.startMonotonic;
  }

  private nextCallId(): string {
    return `call@${++this.callCounter}`;
  }

  private sha1(data: Buffer): string {
    return createHash('sha1').update(data).digest('hex');
  }

  private addResource(data: Buffer): string {
    const hash = this.sha1(data);
    if (!this.resources.has(hash)) {
      this.resources.set(hash, data);
    }
    return hash;
  }

  private async captureScreenshot(): Promise<ScreenshotCapture | null> {
    if (!this.driver) {
      return null;
    }

    try {
      const screenshot = await this.driver.screenshot();
      const sharp = (await import('sharp')).default;
      const metadata = await sharp(screenshot).metadata();
      const sha1 = this.addResource(screenshot);

      return {
        sha1,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
      };
    } catch {
      return null;
    }
  }

  private captureStack(): StackFrame[] {
    const err = new Error();
    const rawStack = err.stack?.split('\n').slice(3) ?? [];
    const frames: StackFrame[] = [];

    for (const line of rawStack) {
      const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/);
      if (match) {
        frames.push({
          function: match[1] ?? '<anonymous>',
          file: match[2],
          line: parseInt(match[3], 10),
          column: parseInt(match[4], 10),
        });
      }
    }

    return frames;
  }

  private pushScreencastFrame(shot: ScreenshotCapture): void {
    this.events.push({
      type: 'screencast-frame',
      pageId: 'device@1',
      sha1: shot.sha1,
      width: shot.width,
      height: shot.height,
      timestamp: this.monotonicTime(),
      frameSwapWallTime: Date.now(),
    });
  }

  private pushFrameSnapshot(snapshotName: string, callId: string, shot: ScreenshotCapture): void {
    this.events.push({
      type: 'frame-snapshot',
      snapshot: {
        snapshotName,
        callId,
        pageId: 'device@1',
        frameId: 'device@1',
        frameUrl: 'mobilewright://device',
        timestamp: this.monotonicTime(),
        wallTime: Date.now(),
        collectionTime: 0,
        doctype: 'html',
        html: [
          'HTML', {},
          ['HEAD', {},
            ['STYLE', {}, 'body{margin:0;padding:0;background:#000}img{width:100%;height:100%;object-fit:contain;display:block}'],
          ],
          ['BODY', {},
            ['IMG', { src: 'screenshot.png' }],
          ],
        ],
        resourceOverrides: [{ url: 'screenshot.png', sha1: shot.sha1 }],
        viewport: { width: shot.width, height: shot.height },
        isMainFrame: true,
      },
    });
  }

  async wrapAction<T>(
    className: string,
    method: string,
    params: Record<string, unknown>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const callId = this.nextCallId();
    const stack = this.captureStack();

    const beforeShot = await this.captureScreenshot();
    if (beforeShot) {
      this.pushScreencastFrame(beforeShot);
      this.pushFrameSnapshot(`before@${callId}`, callId, beforeShot);
    }

    this.events.push({
      type: 'before',
      callId,
      startTime: this.monotonicTime(),
      class: className,
      method,
      params,
      stack,
      pageId: 'device@1',
      ...(beforeShot && { beforeSnapshot: `before@${callId}` }),
    });

    try {
      const result = await fn();

      const afterShot = await this.captureScreenshot();
      if (afterShot) {
        this.pushScreencastFrame(afterShot);
        this.pushFrameSnapshot(`after@${callId}`, callId, afterShot);
      }

      this.events.push({
        type: 'after',
        callId,
        endTime: this.monotonicTime(),
        ...(afterShot && { afterSnapshot: `after@${callId}` }),
      });

      return result;
    } catch (error) {
      const errorShot = await this.captureScreenshot();
      if (errorShot) {
        this.pushScreencastFrame(errorShot);
        this.pushFrameSnapshot(`after@${callId}`, callId, errorShot);
      }

      const err = error instanceof Error ? error : new Error(String(error));

      this.events.push({
        type: 'after',
        callId,
        endTime: this.monotonicTime(),
        ...(errorShot && { afterSnapshot: `after@${callId}` }),
        error: {
          message: err.message,
          stack: err.stack,
        },
      });

      throw error;
    }
  }

  async save(outputPath: string): Promise<void> {
    await mkdir(dirname(outputPath), { recursive: true });

    const zipFile = new yazl.ZipFile();

    const traceContent = this.events.map(e => JSON.stringify(e)).join('\n');
    zipFile.addBuffer(Buffer.from(traceContent), 'trace.trace');
    zipFile.addBuffer(Buffer.from(''), 'trace.network');

    for (const [sha1, data] of this.resources) {
      zipFile.addBuffer(data, `resources/${sha1}`);
    }

    const writeStream = createWriteStream(outputPath);
    const pipelinePromise = pipeline(zipFile.outputStream, writeStream);
    zipFile.end();
    await pipelinePromise;
  }
}
