import type { Platform, DeviceInfo, DeviceType, MobilewrightDriver } from '@mobilewright/protocol';
import { Device } from '@mobilewright/core';
import { MobilecliDriver, DEFAULT_URL } from '@mobilewright/driver-mobilecli';
import { toArray, resolveDriver } from './config.js';
import type { DriverConfig, MobilewrightConfig } from './config.js';

export interface LaunchOptions {
  bundleId?: string;
  installApps?: string | string[];
  autoAppLaunch?: boolean;
  deviceId?: string;
  deviceName?: RegExp;
  url?: string;
  timeout?: number;
  autoStart?: boolean;
  driver?: MobilewrightDriver | DriverConfig;
}

interface PlatformLauncher {
  launch(opts?: LaunchOptions): Promise<Device>;
  devices(): Promise<DeviceInfo[]>;
}

export interface ConnectDeviceParams {
  platform: Platform;
  deviceId: string;
  deviceType?: DeviceType;
  driverConfig?: MobilewrightDriver | DriverConfig;
  url?: string;
  timeout?: number;
}

export interface FindDeviceParams {
  platform: Platform;
  deviceId?: string;
  deviceName?: RegExp;
  driverConfig?: MobilewrightDriver | DriverConfig;
  url?: string;
}

export function createDriver(driverConfig?: MobilewrightDriver | DriverConfig, url?: string): MobilewrightDriver {
  return resolveDriver({ driver: driverConfig, url } as MobilewrightConfig);
}

export async function connectDevice(params: ConnectDeviceParams): Promise<Device> {
  // URL is baked into the driver at construction time; don't override it here.
  // Passing mobilecli's default URL into MobileNextDriver.connect() would send
  // requests to the wrong server.
  const driver = createDriver(params.driverConfig, params.url);
  const device = new Device(driver);
  await device.connect({
    platform: params.platform,
    deviceId: params.deviceId,
    deviceType: params.deviceType,
    timeout: params.timeout,
  });
  return device;
}

export async function installAndLaunchApps(device: Device, opts: LaunchOptions): Promise<void> {
  const appsToInstall = toArray(opts.installApps);
  for (const appPath of appsToInstall) {
    await device.installApp(appPath);
  }
  if (opts.bundleId && opts.autoAppLaunch !== false) {
    await device.launchApp(opts.bundleId);
  }
}

export async function findDevice(params: FindDeviceParams): Promise<DeviceInfo> {
  const url = params.url ?? DEFAULT_URL;
  const driver = createDriver(params.driverConfig, url);
  const devices = await driver.listDevices({ platform: params.platform });

  const match = devices
    .filter((d) => d.state === 'online')
    .filter((d) => !params.deviceId || d.id === params.deviceId)
    .filter((d) => !params.deviceName || params.deviceName.test(d.name))
    .at(0);

  if (!match) {
    throw new Error(`no online ${params.platform} device found`);
  }
  return match;
}

function createLauncher(platform: Platform): PlatformLauncher {
  return {
    async launch(opts: LaunchOptions = {}): Promise<Device> {
      const driver = resolveDriver({ driver: opts.driver, url: opts.url, autoStart: opts.autoStart } as MobilewrightConfig);
      await driver.setup?.();

      const found = await findDevice({
        platform,
        deviceId: opts.deviceId,
        deviceName: opts.deviceName,
        driverConfig: driver,
        url: opts.url,
      });

      const device = await connectDevice({
        platform,
        deviceId: found.id,
        driverConfig: driver,
        url: opts.url,
        timeout: opts.timeout,
      });

      device.onClose(() => driver.teardown?.() ?? Promise.resolve());

      await installAndLaunchApps(device, opts);
      return device;
    },

    async devices(): Promise<DeviceInfo[]> {
      const driver = new MobilecliDriver();
      return driver.listDevices({ platform });
    },
  };
}

/** iOS platform launcher */
export const ios = createLauncher('ios');

/** Android platform launcher */
export const android = createLauncher('android');
