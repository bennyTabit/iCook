// shoppingStore tests — uses Zustand setState to reset between tests
// and fake timers to ensure unique item IDs (store uses Date.now() for IDs).

const flushPromises = () => new Promise<void>((r) => setImmediate(r));

describe('shoppingStore', () => {
  let useShoppingStore: any;

  beforeAll(async () => {
    jest.resetModules();
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.clear();
    ({ useShoppingStore } = require('../store/shoppingStore'));
    await flushPromises();
  });

  beforeEach(async () => {
    // Reset store state to empty before each test
    useShoppingStore.setState({ items: [], grouped: {} });
    await flushPromises();
    // Use fake timers so each addItem gets a unique Date.now() ID
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function addItem(text: string) {
    useShoppingStore.getState().addItem(text);
    // Advance time by 1ms so the next addItem gets a different Date.now()
    jest.advanceTimersByTime(1);
  }

  it('starts with an empty list', () => {
    expect(useShoppingStore.getState().items).toHaveLength(0);
  });

  it('adds items to the list', () => {
    addItem('חלב');
    expect(useShoppingStore.getState().items.some((i: any) => i.text === 'חלב')).toBe(true);
  });

  it('auto-categorizes dairy items', () => {
    addItem('חלב');
    const item = useShoppingStore.getState().items.find((i: any) => i.text === 'חלב');
    expect(item?.category).toBe('🧀 מוצרי חלב');
  });

  it('auto-categorizes egg items', () => {
    addItem('ביצים');
    const item = useShoppingStore.getState().items.find((i: any) => i.text === 'ביצים');
    expect(item?.category).toBe('🥚 ביצים');
  });

  it('assigns fallback category for unknown items', () => {
    addItem('פלפל שחור');
    const item = useShoppingStore.getState().items.find((i: any) => i.text === 'פלפל שחור');
    expect(item?.category).toBe('🛒 אחר');
  });

  it('toggles item checked status', () => {
    addItem('ביצים');
    const item = useShoppingStore.getState().items.find((i: any) => i.text === 'ביצים');
    expect(item).toBeTruthy();
    useShoppingStore.getState().checkItem(item.id);
    const updated = useShoppingStore.getState().items.find((i: any) => i.id === item.id);
    expect(updated?.checked).toBe(true);
  });

  it('removes an item', () => {
    addItem('לחם');
    const item = useShoppingStore.getState().items.find((i: any) => i.text === 'לחם');
    useShoppingStore.getState().removeItem(item.id);
    expect(useShoppingStore.getState().items.find((i: any) => i.id === item.id)).toBeUndefined();
  });

  it('clears checked items while keeping unchecked', () => {
    addItem('גבינה');
    addItem('יוגורט');
    // Both items now have distinct IDs since we advanced time by 1ms between adds
    const item = useShoppingStore.getState().items.find((i: any) => i.text === 'גבינה');
    expect(item).toBeTruthy();
    useShoppingStore.getState().checkItem(item.id);
    useShoppingStore.getState().clearChecked();
    expect(useShoppingStore.getState().items.find((i: any) => i.text === 'גבינה')).toBeUndefined();
    expect(useShoppingStore.getState().items.find((i: any) => i.text === 'יוגורט')).toBeTruthy();
  });

  it('does not add duplicate items', () => {
    addItem('קמח');
    addItem('קמח'); // duplicate — should be ignored
    const items = useShoppingStore.getState().items.filter((i: any) => i.text === 'קמח');
    expect(items).toHaveLength(1);
  });

  it('clears all items', () => {
    addItem('עגבניות');
    addItem('בצל');
    useShoppingStore.getState().clearAll();
    expect(useShoppingStore.getState().items).toHaveLength(0);
  });
});
