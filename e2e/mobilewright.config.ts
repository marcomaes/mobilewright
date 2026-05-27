import { defineConfig } from 'mobilewright';
import type { MobilewrightConfig } from 'mobilewright';
import { MobilecliDriver } from '@mobilewright/driver-mobilecli';
import { MobileNextDriver } from '@mobilewright/driver-mobilenext';
import type { MobilewrightDriver } from '@mobilewright/protocol';

function resolveDriver(): MobilewrightDriver {
  const name = process.env['MOBILEWRIGHT_DRIVER'] ?? 'mobilecli';
  console.log(`Using driver: ${name}`);

  switch (name) {
    case 'mobilenext':
      if (!process.env['MOBILENEXT_API_KEY']) {
        throw new Error('MOBILENEXT_API_KEY is required for mobilenext driver');
      }
      return new MobileNextDriver({ apiKey: process.env['MOBILENEXT_API_KEY'] });

    case 'mobilecli':
      return new MobilecliDriver();

    default:
      throw new Error(`Unknown driver: ${name}. Use 'mobilecli' or 'mobilenext'`);
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
