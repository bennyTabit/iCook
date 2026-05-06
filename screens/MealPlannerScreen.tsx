import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../constants/colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { isHebrew } from '../lib/i18n';
import { MealType } from '../lib/db';
import { parseNutrition, perServing } from '../lib/nutrition';
import type { RecipeSummary } from '../lib/search';
import {
  useMealPlanStore,
  getWeekDays,
  getWeekStart,
} from '../store/mealPlanStore';
import RecipePickerModal from '../components/RecipePickerModal';
import ScreenHeader from '../components/ScreenHeader';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
};

// Short names indexed by getDay() (0=Sun)
const DAY_SHORT_HE = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAY_SHORT_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DAY_FULL_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_FULL_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTH_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const MONTH_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Scrollable day strip constants ────────────────────────────────────────────

const SCREEN_W = Dimensions.get('window').width;
const DAY_W = SCREEN_W / 7; // exactly 7 columns wide

// 181 days centred on today (90 past + today + 90 future)
const STRIP_ORIGIN = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return new Date(d.toISOString().slice(0, 10) + 'T00:00:00');
})();

const ALL_DAYS: string[] = Array.from({ length: 181 }, (_, i) => {
  const d = new Date(STRIP_ORIGIN);
  d.setDate(STRIP_ORIGIN.getDate() + i);
  return d.toISOString().slice(0, 10);
});

/** Scroll offset that centres the given index in the viewport */
function centredOffset(idx: number): number {
  return Math.max(0, idx * DAY_W - (SCREEN_W - DAY_W) / 2);
}

// ── DayStrip ──────────────────────────────────────────────────────────────────

function DayStrip({
  selectedDate,
  hasEntryOnDate,
  isHe,
  onSelectDate,
}: {
  selectedDate: string;
  hasEntryOnDate: (date: string) => boolean;
  isHe: boolean;
  onSelectDate: (date: string) => void;
}) {
  const C = useThemeColors();
  const today = toDateStr(new Date());
  const listRef = useRef<FlatList<string>>(null);
  const mounted = useRef(false);

  // Scroll to centre a day in the viewport
  const scrollTo = useCallback((idx: number, animated: boolean) => {
    listRef.current?.scrollToOffset({ offset: centredOffset(idx), animated });
  }, []);

  // Scroll whenever selectedDate changes (initial mount = no animation)
  useEffect(() => {
    const idx = ALL_DAYS.indexOf(selectedDate);
    if (idx < 0) return;
    if (!mounted.current) {
      mounted.current = true;
      // Delay so FlatList has fully laid out
      const t = setTimeout(() => scrollTo(idx, false), 80);
      return () => clearTimeout(t);
    }
    scrollTo(idx, true);
  }, [selectedDate, scrollTo]);

  const handleDayPress = useCallback(
    (date: string) => {
      void Haptics.selectionAsync();
      onSelectDate(date);
    },
    [onSelectDate],
  );

  const renderItem = useCallback(
    ({ item: date }: { item: string }) => {
      const d = new Date(date + 'T00:00:00');
      const dow = d.getDay();
      const dayNum = d.getDate();
      const isSelected = date === selectedDate;
      const isToday = date === today;
      const hasMeals = hasEntryOnDate(date);
      const shortName = isHe ? DAY_SHORT_HE[dow] : DAY_SHORT_EN[dow];

      // Show month name above the 1st of each month (invisible placeholder otherwise
      // so every row has the same height → getItemLayout stays accurate)
      const isFirstOfMonth = dayNum === 1;
      const monthName = isFirstOfMonth
        ? (isHe ? MONTH_HE[d.getMonth()] : MONTH_EN[d.getMonth()])
        : null;

      return (
        <TouchableOpacity
          style={[ds.dayCol, { width: DAY_W }]}
          onPress={() => handleDayPress(date)}
          activeOpacity={0.75}
        >
          {/* Month label — only visible on 1st; occupies space always */}
          <Text
            style={[ds.monthLabel, { color: Colors.primary, opacity: isFirstOfMonth ? 1 : 0 }]}
          >
            {monthName ?? ' '}
          </Text>

          <Text style={[ds.dayName, { color: isSelected ? Colors.primary : C.text.tertiary }]}>
            {shortName}
          </Text>

          <View
            style={[
              ds.dayCircle,
              isSelected && { backgroundColor: Colors.primary },
              isToday && !isSelected && { borderWidth: 2, borderColor: Colors.primary },
            ]}
          >
            <Text
              style={[
                ds.dayNum,
                {
                  color: isSelected
                    ? '#fff'
                    : isToday
                    ? Colors.primary
                    : C.text.primary,
                },
              ]}
            >
              {dayNum}
            </Text>
          </View>

          {/* Meal dot */}
          <View style={ds.dotSlot}>
            {hasMeals && (
              <View
                style={[
                  ds.dot,
                  { backgroundColor: isSelected ? Colors.primary : C.text.tertiary },
                ]}
              />
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [selectedDate, hasEntryOnDate, isHe, today, handleDayPress, C],
  );

  return (
    <View
      style={[
        ds.container,
        { backgroundColor: C.surfaceElevated, borderBottomColor: C.border },
      ]}
    >
      <FlatList
        ref={listRef}
        horizontal
        data={ALL_DAYS}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: DAY_W,
          offset: DAY_W * index,
          index,
        })}
        snapToInterval={DAY_W}
        snapToAlignment="start"
        decelerationRate="fast"
        initialNumToRender={14}
        maxToRenderPerBatch={14}
        windowSize={5}
        removeClippedSubviews
        // Required when using scrollToOffset before layout is complete
        onScrollToIndexFailed={() => {}}
      />
    </View>
  );
}

const ds = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingBottom: 6,
  },
  dayCol: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  monthLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    height: 14,
    lineHeight: 14,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 14,
    fontWeight: '700',
  },
  dotSlot: {
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});

// ── MealSection ───────────────────────────────────────────────────────────────

function MealSection({
  date,
  mealType,
  isHe,
  onAdd,
  navigation,
}: {
  date: string;
  mealType: MealType;
  isHe: boolean;
  onAdd: (date: string, mealType: MealType) => void;
  navigation: any;
}) {
  const { t } = useTranslation();
  const C = useThemeColors();
  const { entries, removeEntry } = useMealPlanStore();
  const meals = entries.filter((e) => e.date === date && e.meal_type === mealType);
  const mealLabel = t(mealType as Parameters<typeof t>[0]);

  return (
    <View style={[ms.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
      {/* Header row */}
      <View
        style={[
          ms.header,
          { flexDirection: isHe ? 'row-reverse' : 'row', borderBottomColor: C.border },
        ]}
      >
        <Text style={ms.emoji}>{MEAL_EMOJI[mealType]}</Text>
        <Text
          style={[
            ms.label,
            { color: C.text.primary, textAlign: isHe ? 'right' : 'left' },
          ]}
        >
          {mealLabel}
        </Text>
        <TouchableOpacity
          style={[ms.addBtn, { backgroundColor: Colors.primary + '18' }]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAdd(date, mealType);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isHe ? `הוסף ל${mealLabel}` : `Add to ${mealLabel}`}
        >
          <Ionicons name="add" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Empty slot */}
      {meals.length === 0 ? (
        <TouchableOpacity
          style={[ms.emptySlot, { borderColor: C.border }]}
          onPress={() => {
            void Haptics.selectionAsync();
            onAdd(date, mealType);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={22} color={C.text.tertiary} />
          <Text style={[ms.emptyText, { color: C.text.tertiary }]}>
            {isHe ? 'הוסף מתכון' : 'Add a recipe'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View>
          {meals.map((entry, idx) => {
            const nut = parseNutrition(entry.ai_nutrition);
            const cals = nut ? perServing(nut).calories : null;
            return (
              <TouchableOpacity
                key={entry.id}
                style={[
                  ms.recipeRow,
                  { flexDirection: isHe ? 'row-reverse' : 'row', borderTopColor: C.border },
                  idx > 0 && ms.recipeRowBorder,
                ]}
                onPress={() => navigation.navigate('RecipeDetail', { id: entry.recipe_id })}
                activeOpacity={0.75}
              >
                {entry.image_uri ? (
                  <Image source={{ uri: entry.image_uri }} style={ms.thumb} />
                ) : (
                  <View style={[ms.thumb, ms.thumbEmpty, { backgroundColor: C.surface }]}>
                    <Text style={{ fontSize: 22 }}>🍳</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      ms.recipeTitle,
                      { color: C.text.primary, textAlign: isHe ? 'right' : 'left' },
                    ]}
                    numberOfLines={2}
                  >
                    {isHe ? entry.title_he : (entry.title_en ?? entry.title_he)}
                  </Text>
                  {cals ? (
                    <Text
                      style={[
                        ms.recipeCals,
                        { color: C.text.tertiary, textAlign: isHe ? 'right' : 'left' },
                      ]}
                    >
                      🔥 {cals} {isHe ? "קל׳" : 'kcal'}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    void removeEntry(entry.id);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                >
                  <Ionicons name="close-circle" size={22} color={C.text.tertiary} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ms = StyleSheet.create({
  section: {
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emoji: { fontSize: 20 },
  label: { flex: 1, fontSize: 17, fontWeight: '700' },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 14,
    paddingVertical: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14, fontWeight: '600' },
  recipeRow: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recipeRowBorder: { borderTopWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56, height: 56, borderRadius: 14 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  recipeTitle: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  recipeCals: { fontSize: 12, marginTop: 3 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MealPlannerScreen({ navigation }: { navigation: any }) {
  const C = useThemeColors();
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { entries, weekStart, loading, setWeek, loadWeek, addEntry } = useMealPlanStore();

  const todayStr = toDateStr(new Date());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ date: string; mealType: MealType } | null>(
    null,
  );

  // Initial load for current week
  useEffect(() => {
    loadWeek(getWeekStart(new Date(), isHe));
  }, []);

  // Whenever the selected day crosses into a different week, load that week's entries
  useEffect(() => {
    const newWeekStart = getWeekStart(new Date(selectedDate + 'T00:00:00'), isHe);
    if (newWeekStart !== weekStart) {
      setWeek(newWeekStart);
    }
  }, [selectedDate]);

  // ── Derived labels ──────────────────────────────────────────────────────────

  const weekLabel = useMemo(() => {
    const weekDays = getWeekDays(weekStart);
    const s = new Date(weekDays[0] + 'T00:00:00');
    const e = new Date(weekDays[6] + 'T00:00:00');
    const months = isHe ? MONTH_HE : MONTH_EN;
    return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]}`;
  }, [weekStart, isHe]);

  const selectedDayLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const dow = d.getDay();
    const months = isHe ? MONTH_HE : MONTH_EN;
    const dayFull = isHe ? `יום ${DAY_FULL_HE[dow]}` : DAY_FULL_EN[dow];
    const dateStr = isHe
      ? `${d.getDate()} ${months[d.getMonth()]}`
      : `${months[d.getMonth()]} ${d.getDate()}`;
    return `${dayFull}, ${dateStr}`;
  }, [selectedDate, isHe]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const hasEntryOnDate = useCallback(
    (date: string) => entries.some((e) => e.date === date),
    [entries],
  );

  function handleSelectDate(date: string) {
    setSelectedDate(date);
  }

  function handleGoToToday() {
    void Haptics.selectionAsync();
    setSelectedDate(todayStr);
  }

  function handleAddMeal(date: string, mealType: MealType) {
    setPickerTarget({ date, mealType });
    setPickerVisible(true);
  }

  async function handlePickRecipe(recipe: RecipeSummary) {
    if (!pickerTarget) return;
    setPickerVisible(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await addEntry(pickerTarget.date, pickerTarget.mealType, recipe.id);
  }

  function handleAddToShopping() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    useMealPlanStore.getState().addWeekToShopping(isHe);
    navigation.navigate('Shopping');
  }

  const hasEntries = entries.length > 0;
  const isSelectedToday = selectedDate === todayStr;

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      {/* Shared header — subtitle shows the week range */}
      <ScreenHeader
        title={isHe ? 'תכנון ארוחות' : 'Meal Planner'}
        subtitle={weekLabel}
      />

      {/* Smooth scrollable day strip */}
      <DayStrip
        selectedDate={selectedDate}
        hasEntryOnDate={hasEntryOnDate}
        isHe={isHe}
        onSelectDate={handleSelectDate}
      />

      {/* Selected day label + "Today" jump pill */}
      <View
        style={[
          s.dayBanner,
          {
            borderBottomColor: C.border,
            flexDirection: isHe ? 'row-reverse' : 'row',
          },
        ]}
      >
        <Text
          style={[
            s.dayBannerText,
            { color: C.text.primary, textAlign: isHe ? 'right' : 'left', flex: 1 },
          ]}
        >
          {isSelectedToday
            ? (isHe ? `היום — ${selectedDayLabel}` : `Today — ${selectedDayLabel}`)
            : selectedDayLabel}
        </Text>

        {!isSelectedToday && (
          <TouchableOpacity
            style={[s.todayPill, { backgroundColor: Colors.primary + '15' }]}
            onPress={handleGoToToday}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[s.todayPillText, { color: Colors.primary }]}>
              {isHe ? 'היום' : 'Today'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Meal sections */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: Math.max(insets.bottom, 16) + (hasEntries ? 80 : 16) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {MEAL_TYPES.map((mt) => (
            <MealSection
              key={mt}
              date={selectedDate}
              mealType={mt}
              isHe={isHe}
              onAdd={handleAddMeal}
              navigation={navigation}
            />
          ))}
        </ScrollView>
      )}

      {/* Add week to shopping — sticky at bottom */}
      {hasEntries && (
        <View
          style={[
            s.stickyBottom,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: C.background,
              borderTopColor: C.border,
            },
          ]}
        >
          <TouchableOpacity
            style={s.shoppingBtn}
            onPress={handleAddToShopping}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isHe ? 'הוסף שבוע לקניות' : 'Add week to shopping list'}
          >
            <Ionicons name="basket-outline" size={18} color="#fff" />
            <Text style={s.shoppingBtnText}>{t('addToWeekShopping')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <RecipePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(recipe) => void handlePickRecipe(recipe)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dayBanner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 8,
  },
  dayBannerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  todayPill: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  todayPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scroll: {
    paddingTop: 16,
  },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  shoppingBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shoppingBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
