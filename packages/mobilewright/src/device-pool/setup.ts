import { DevicePool } from './application/device-pool.js';
import { DevicePoolHttpServer } from './adapters/http-server.js';
import { COORDINATOR_URL_ENV } from './client-factory.js';
import { loadConfig, resolveDriver } from '../config.js';
import type { FullConfig } from '@playwright/test';
import type { MobilewrightDriver } from '@mobilewright/protocol';

interface ActiveCoordinator {
  pool: DevicePool;
  server: DevicePoolHttpServer;
  driver: MobilewrightDriver;
}

let active: ActiveCoordinator | undefined;

/**
 * Playwright globalSetup entry point. Receives the resolved FullConfig so
 * that CLI overrides (e.g. --workers 2) are reflected in maxSlots.
 */
export default async function setup(playwrightConfig: FullConfig): Promise<() => Promise<void>> {
  const config = await loadConfig(process.cwd(), playwrightConfig.configFile);
  const driver = resolveDriver(config);
  await driver.setup?.();

  // Use the resolved worker count from Playwright's FullConfig so CLI flags
  // like --workers 2 are respected, not just the value in the config file.
  const maxSlots = playwrightConfig.workers;
  const pool = new DevicePool({ driver, maxSlots });
  const server = new DevicePoolHttpServer({ pool });
  const port = await server.listen();

  process.env[COORDINATOR_URL_ENV] = `http://127.0.0.1:${port}`;
  active = { pool, server, driver };

  return async () => {
    if (!active) {
      return;
    }
    await active.pool.shutdown();
    await active.server.close();
    await active.driver.teardown?.();
    delete process.env[COORDINATOR_URL_ENV];
    active = undefined;
  };
}
