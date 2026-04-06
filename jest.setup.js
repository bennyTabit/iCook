// Prevent Expo SDK 54 lazy globals from firing outside test scope.
// These lazy getters in expo/src/winter/installGlobal.ts call require()
// from within a getter, which Jest forbids outside module scope.

if (typeof globalThis.__ExpoImportMetaRegistry === 'undefined') {
  Object.defineProperty(globalThis, '__ExpoImportMetaRegistry', {
    value: { url: null },
    configurable: true,
    writable: true,
  });
}

// structuredClone — use Node's built-in (available in Node 17+) or a shim
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

// Mock AsyncStorage with a resettable in-memory store
const asyncStorageStore = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(asyncStorageStore[key] ?? null)),
  setItem: jest.fn((key, val) => {
    asyncStorageStore[key] = val;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    delete asyncStorageStore[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(asyncStorageStore).forEach((k) => delete asyncStorageStore[k]);
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => Promise.resolve(Object.keys(asyncStorageStore))),
  multiGet: jest.fn((keys) =>
    Promise.resolve(keys.map((k) => [k, asyncStorageStore[k] ?? null]))
  ),
  multiSet: jest.fn((pairs) => {
    pairs.forEach(([k, v]) => { asyncStorageStore[k] = v; });
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((k) => delete asyncStorageStore[k]);
    return Promise.resolve();
  }),
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: false, canAskAgain: true }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('mock-id'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

// Mock expo-sqlite — provide a minimal in-memory implementation
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execAsync: jest.fn().mockResolvedValue(undefined),
    runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
}));

// Mock firebase
jest.mock('./lib/firebase', () => ({
  auth: {},
  db: {},
  storage: {},
}));

// Silence console.warn in tests
global.console.warn = jest.fn();
