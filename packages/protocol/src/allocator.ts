import type { DeviceType, Platform } from './types.js';

/**
 * Thrown by a driver's allocate() when no device is currently available but
 * one may become available later (e.g. all matching devices are already taken).
 * DevicePool treats this as a temporary condition and re-queues the waiter.
 */
export class NoDeviceAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoDeviceAvailableError';
  }
}

export interface AllocationCriteria {
  platform?: Platform;
  /** Serialized regex source — `RegExp.prototype.source`. The driver reconstructs `new RegExp(...)`. */
  deviceNamePattern?: string;
  deviceId?: string;
}

export interface AllocateResult {
  deviceId: string;
  platform: Platform;
  /** Driver name — populated from driver.name. Will be removed once slots read it from the driver directly. */
  driver?: string;
  model?: string;
  osVersion?: string;
  type?: DeviceType;
}
