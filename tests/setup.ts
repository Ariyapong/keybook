import { afterEach, vi } from "vitest";

// Workaround for vitest 2.x treating beforeEach return values as cleanup callbacks.
// When a beforeEach uses `() => mock.mockReset()` (arrow without braces), vitest
// stores the returned spy as a cleanup function and calls it after the test.
// Reset all mocks in afterEach so any such cleanup invocations are no-ops.
afterEach(() => vi.resetAllMocks());
