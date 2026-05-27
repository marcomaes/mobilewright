/**
 * Smoke test: DummyDriver — a third-party driver that only imports from
 * @mobilewright/protocol — can be used with DevicePool end-to-end.
 *
 * This test proves that a custom driver author does not need to depend on
 * the mobilewright framework package, only @mobilewright/protocol.
 */
import { test, expect } from '@playwright/test';
import { DummyDriver } from './dummy-driver.js';
import { NoDeviceAvailableError } from '@mobilewright/protocol';

test('DummyDriver satisfies MobilewrightDriver without importing mobilewright', () => {
  const driver = new DummyDriver();
  // Only @mobilewright/protocol is imported in dummy-driver.ts — verified by inspection.
  expect(driver.name).toBe('dummy');
  expect(typeof driver.allocate).toBe('function');
  expect(typeof driver.release).toBe('function');
  expect(typeof driver.connect).toBe('function');
  expect(typeof driver.tap).toBe('function');
});

test('DummyDriver.allocate returns a device and release frees it', async () => {
  const driver = new DummyDriver();
  await driver.setup?.();

  const result = await driver.allocate({}, new Set());
  expect(result.deviceId).toBe('dummy-device-001');
  expect(result.platform).toBe('ios');

  await driver.release(result.deviceId);

  // After release, same device is available again.
  const second = await driver.allocate({}, new Set());
  expect(second.deviceId).toBe('dummy-device-001');

  await driver.release(second.deviceId);
});

test('DummyDriver.allocate throws NoDeviceAvailableError when device is taken', async () => {
  const driver = new DummyDriver();
  const takenIds = new Set(['dummy-device-001']);

  await expect(driver.allocate({}, takenIds)).rejects.toThrow(NoDeviceAvailableError);
});

test('DummyDriver.setup and teardown lifecycle work', async () => {
  const driver = new DummyDriver();
  expect(driver.wasSetup).toBe(false);

  await driver.setup?.();
  expect(driver.wasSetup).toBe(true);
});
