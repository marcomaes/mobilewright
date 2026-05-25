import { defineConfig } from 'mobilewright';
import type { MobilewrightConfig } from 'mobilewright';
import { MobilecliDriver } from '@mobilewright/driver-mobilecli';
import { MobileUseDriver } from '@mobilewright/driver-mobile-use';
import type { MobilewrightDriver } from '@mobilewright/protocol';

function resolveDriver(): MobilewrightDriver {
  const name = process.env['MOBILEWRIGHT_DRIVER'] ?? 'mobilecli';
  console.log(`Using driver: ${name}`);

  switch (name) {
    case 'mobile-use':
      if (!process.env['MOBILE_USE_API_KEY']) {
        throw new Error('MOBILE_USE_API_KEY is required for mobile-use driver');
      }
      return new MobileUseDriver({ apiKey: process.env['MOBILE_USE_API_KEY'] });

    case 'mobilecli':
      return new MobilecliDriver();

    default:
      throw new Error(`Unknown driver: ${name}. Use 'mobilecli' or 'mobile-use'`);
  }
}

const config: MobilewrightConfig = defineConfig({
  testDir: './src',
  testMatch: '**/*.test.ts',
  retries: 0,
  timeout: 60_000,
  platform: 'ios',

  // parallel by test() instead of parallel by file
  fullyParallel: true,

  // pass a driver instance — any class implementing MobilewrightDriver works
  driver: resolveDriver(),

  // filter used devices with regexp
  // deviceName: /Max/,
});

export default config;
