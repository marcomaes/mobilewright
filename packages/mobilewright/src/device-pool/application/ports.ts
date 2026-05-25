import type { AllocationCriteria, DeviceType, Platform } from '@mobilewright/protocol';

// Moved to @mobilewright/protocol — re-exported here so existing imports in the codebase keep working.
export { NoDeviceAvailableError } from '@mobilewright/protocol';
export type { AllocationCriteria, AllocateResult } from '@mobilewright/protocol';

export interface AllocationHandle {
  allocationId: string;
  deviceId: string;
  platform: Platform;
  driver?: string;
  model?: string;
  osVersion?: string;
  type?: DeviceType;
}

/**
 * Port consumed by the test fixture. The HTTP adapter is one implementation.
 */
export interface DevicePoolClient {
  allocate(criteria: AllocationCriteria): Promise<AllocationHandle>;
  release(allocationId: string): Promise<void>;
  isAppInstalled(allocationId: string, bundleId: string): Promise<boolean>;
  recordAppInstalled(allocationId: string, bundleId: string): Promise<void>;
}
