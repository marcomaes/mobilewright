/**
 * DummyDriver — a minimal third-party driver that only imports from
 * @mobilewright/protocol. Proves that a driver author does not need to depend
 * on the mobilewright framework package — only the protocol.
 *
 * Used in smoke tests to verify the third-party driver path end-to-end.
 */
import type {
  AllocateResult,
  AllocationCriteria,
  AppInfo,
  ConnectionConfig,
  DeviceInfo,
  GestureSequence,
  HardwareButton,
  LaunchOptions,
  ListDevicesOptions,
  MobilewrightDriver,
  Orientation,
  RecordingOptions,
  RecordingResult,
  ScreenSize,
  ScreenshotOptions,
  Session,
  SwipeDirection,
  SwipeOptions,
  ViewNode,
} from '@mobilewright/protocol';
import { NoDeviceAvailableError } from '@mobilewright/protocol';

const FAKE_DEVICE_ID = 'dummy-device-001';
const FAKE_PLATFORM = 'ios' as const;

export class DummyDriver implements MobilewrightDriver {
  readonly name = 'dummy';

  private allocated = new Set<string>();
  private setupCalled = false;
  private teardownCalled = false;

  // ── Lifecycle ────────────────────────────────────────────────

  async setup(): Promise<void> {
    this.setupCalled = true;
  }

  async teardown(): Promise<void> {
    this.teardownCalled = false;
  }

  get wasSetup(): boolean { return this.setupCalled; }
  get wasTornDown(): boolean { return this.teardownCalled; }

  // ── Pool management (coordinator-side) ──────────────────────

  async allocate(
    _criteria: AllocationCriteria,
    takenDeviceIds: ReadonlySet<string>,
    _signal?: AbortSignal,
  ): Promise<AllocateResult> {
    if (takenDeviceIds.has(FAKE_DEVICE_ID)) {
      throw new NoDeviceAvailableError(`${FAKE_DEVICE_ID} is already taken`);
    }
    this.allocated.add(FAKE_DEVICE_ID);
    return { deviceId: FAKE_DEVICE_ID, platform: FAKE_PLATFORM, driver: this.name };
  }

  async release(deviceId: string): Promise<void> {
    this.allocated.delete(deviceId);
  }

  // ── Per-device control (worker-side) ────────────────────────

  async connect(_config: ConnectionConfig): Promise<Session> {
    return { deviceId: FAKE_DEVICE_ID, platform: FAKE_PLATFORM };
  }

  async disconnect(): Promise<void> {}

  async getViewHierarchy(): Promise<ViewNode[]> { return []; }

  async tap(_x: number, _y: number): Promise<void> {}
  async doubleTap(_x: number, _y: number): Promise<void> {}
  async longPress(_x: number, _y: number, _duration?: number): Promise<void> {}
  async typeText(_text: string): Promise<void> {}
  async swipe(_direction: SwipeDirection, _opts?: SwipeOptions): Promise<void> {}
  async gesture(_gestures: GestureSequence): Promise<void> {}
  async pressButton(_button: HardwareButton): Promise<void> {}

  async screenshot(_opts?: ScreenshotOptions): Promise<Buffer> {
    return Buffer.alloc(0);
  }

  async getScreenSize(): Promise<ScreenSize> {
    return { width: 390, height: 844, scale: 3 };
  }

  async getOrientation(): Promise<Orientation> { return 'portrait'; }
  async setOrientation(_orientation: Orientation): Promise<void> {}

  async launchApp(_bundleId: string, _opts?: LaunchOptions): Promise<void> {}
  async terminateApp(_bundleId: string): Promise<void> {}
  async listApps(): Promise<AppInfo[]> { return []; }
  async getForegroundApp(): Promise<AppInfo> { return { bundleId: 'com.example.app' }; }
  async installApp(_path: string): Promise<void> {}
  async uninstallApp(_bundleId: string): Promise<void> {}

  async listDevices(_opts?: ListDevicesOptions): Promise<DeviceInfo[]> {
    return [{ id: FAKE_DEVICE_ID, name: 'Dummy iPhone', platform: FAKE_PLATFORM, type: 'simulator', state: 'online' }];
  }

  async openUrl(_url: string): Promise<void> {}

  async startRecording(_opts: RecordingOptions): Promise<void> {}
  async stopRecording(): Promise<RecordingResult> { return { output: '' }; }
}
