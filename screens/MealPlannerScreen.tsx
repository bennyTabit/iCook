import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../constants/colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { isHebrew } from '../lib/i18n';
import { MealType } from '../lib/db';
import type { RecipeSummary } from '../lib/search';
import {
  useMealPlanStore,
  getWeekDays,
  getWeekStart,
  shiftWeek,
} from '../store/mealPlanStore';
import { useRecipeStore } from '../store/recipeStore';

// ── Constants ────────────────────────────────────────────────────────────────

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];

const MEAL_EMOJI: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
};

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatWeekRange(weekStart: string, isHe: boolean): string {
  const days = getWeekDays(weekStart);
  const start = new Date(days[0] + 'T00:00:00');
  const end = new Date(days[6] + 'T00:00:00');
  const monthNames = isHe
    ? ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const startStr = `${start.getDate()} ${monthNames[start.getMonth()]}`;
  const endStr = `${end.getDate()} ${monthNames[end.getMonth()]}`;
  return `${startStr} – ${endStr}`;
}

function getDayLabel(dateStr: string, isHe: boolean): { dayName: string; dayNum: number; isToday: boolean } {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const dayOfWeek = d.getDay(); // 0=Sun
  return {
    dayName: isHe ? DAY_NAMES_HE[dayOfWeek] : DAY_NAMES_EN[dayOfWeek],
    dayNum: d.getDate(),
    isToday,
  };
}

// ── Recipe Picker Modal ──────────────────────────────────────────────────────

function RecipePicker({
  visible,
  onClose,
  onSelect,
  isHe,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (recipe: RecipeSummary) => void;
  isHe: boolean;
}) {
  const { t } = useTranslation();
  const { recipes } = useRecipeStore();
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(600)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setQuery('');
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 600, duration: 180, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  const filtered = useMemo(() => {
    if (!query.trim()) return recipes;
    const q = query.toLowerCase();
    return recipes.filter(
      (r) =>
        r.title_he?.toLowerCase().includes(q) ||
        r.title_en?.toLowerCase().includes(q),
    );
  }, [recipes, query]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.46)' }]}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        style={[
          ps.sheet,
          { transform: [{ translateY: slide }], paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        <View style={ps.handle} />
        <Text style={[ps.title, { textAlign: isHe ? 'right' : 'left' }]}>
          {t('pickRecipe')}
        </Text>
        <TextInput
          style={[ps.search, { textAlign: isHe ? 'right' : 'left' }]}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={Colors.text.tertiary}
          value={query}
          onChangeText={setQuery}
        />
        <FlatList
          data={filtered}
          keyExtractor={(r) => String(r.id)}
          style={{ maxHeight: 380 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[ps.recipeRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(item);
              }}
              activeOpacity={0.7}
            >
              {item.image_uri ? (
                <Image source={{ uri: item.image_uri }} style={ps.thumb} />
              ) : (
                <View style={[ps.thumb, ps.thumbPlaceholder]}>
                  <Text style={{ fontSize: 20 }}>🍳</Text>
                </View>
              )}
              <Text
                style={[ps.recipeTitle, { textAlign: isHe ? 'right' : 'left', flex: 1 }]}
                numberOfLines={1}
              >
                {isHe ? item.title_he : (item.title_en ?? item.title_he)}
              </Text>
              <Ionicons
                name={isHe ? 'chevron-back' : 'chevron-forward'}
                size={16}
                color={Colors.text.tertiary}
              />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={ps.sep} />}
        />
      </Animated.View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  search: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text.primary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recipeRow: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  thumbPlaceholder: {
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  sep: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 56,
  },
});

// ── Meal Row ─────────────────────────────────────────────────────────────────

function MealRow({
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
  const { entries, removeEntry } = useMealPlanStore();

  const meals = entries.filter(
    (e) => e.date === date && e.meal_type === mealType,
  );

  const mealLabel = t(mealType as Parameters<typeof t>[0]);

  return (
    <View style={ms.mealRow}>
      {/* Label row */}
      <View style={[ms.mealHeader, { flexDirection: 'row' }]}>
        {/* Hebrew: 🌅 ארוחת בוקר ➕  |  English: 🌅 Breakfast ➕ */}
        <Text style={ms.mealEmoji}>{MEAL_EMOJI[mealType]}</Text>
        <Text style={[ms.mealLabel, { textAlign: isHe ? 'right' : 'left' }]}>{mealLabel}</Text>
        <TouchableOpacity
          style={ms.addBtn}
          onPress={() => { void Haptics.selectionAsync(); onAdd(date, mealType); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Planned recipes */}
      {meals.map((entry) => (
        <TouchableOpacity
          key={entry.id}
          style={[ms.recipeChip, { flexDirection: isHe ? 'row-reverse' : 'row' }]}
          onPress={() => navigation.navigate('RecipeDetail', { id: entry.recipe_id })}
          activeOpacity={0.75}
        >
          {entry.image_uri ? (
            <Image source={{ uri: entry.image_uri }} style={ms.chipThumb} />
          ) : (
            <View style={[ms.chipThumb, ms.chipThumbEmpty]}>
              <Text style={{ fontSize: 14 }}>🍳</Text>
            </View>
          )}
          <Text
            style={[ms.chipTitle, { textAlign: isHe ? 'right' : 'left', flex: 1 }]}
            numberOfLines={1}
          >
            {isHe ? entry.title_he : (entry.title_en ?? entry.title_he)}
          </Text>
          <TouchableOpacity
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void removeEntry(entry.id);
            }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="close-circle" size={18} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const ms = StyleSheet.create({
  mealRow: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  mealHeader: {
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  mealEmoji: {
    fontSize: 14,
  },
  mealLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    flex: 1,
  },
  addBtn: {
    padding: 2,
  },
  recipeChip: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipThumb: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  chipThumbEmpty: {
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
});

// ── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({
  date,
  isHe,
  onAdd,
  navigation,
}: {
  date: string;
  isHe: boolean;
  onAdd: (date: string, mealType: MealType) => void;
  navigation: any;
}) {
  const C = useThemeColors();
  const { dayName, dayNum, isToday } = getDayLabel(date, isHe);
  const d = new Date(date + 'T00:00:00');
  const monthNum = d.getMonth() + 1;

  return (
    <View style={[ds.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }, isToday && ds.cardToday]}>
      {/* Day header */}
      <View style={[ds.dayHeader, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
        <View style={[ds.dayNumWrap, { backgroundColor: C.surface }, isToday && ds.dayNumWrapToday]}>
          <Text style={[ds.dayNum, { color: C.text.primary }, isToday && ds.dayNumToday]}>{dayNum}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[ds.dayName, { textAlign: isHe ? 'right' : 'left', color: C.text.primary }]}>
            {dayName}
          </Text>
          <Text style={[ds.dayDate, { textAlign: isHe ? 'right' : 'left', color: C.text.tertiary }]}>
            {isHe ? `${dayNum}/${monthNum}` : `${monthNum}/${dayNum}`}
          </Text>
        </View>
        {isToday && (
          <View style={ds.todayBadge}>
            <Text style={ds.todayBadgeText}>{isHe ? 'היום' : 'Today'}</Text>
          </View>
        )}
      </View>

      {/* Divider */}
      <View style={ds.divider} />

      {/* Meal rows */}
      {MEAL_TYPES.map((mt) => (
        <MealRow
          key={mt}
          date={date}
          mealType={mt}
          isHe={isHe}
          onAdd={onAdd}
          navigation={navigation}
        />
      ))}
    </View>
  );
}

const ds = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingTop: 14,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardToday: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  dayHeader: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 10,
  },
  dayNumWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  dayNumWrapToday: {
    backgroundColor: Colors.primary,
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  dayNumToday: {
    color: '#fff',
  },
  dayName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  dayDate: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  todayBadge: {
    backgroundColor: Colors.primary + '18',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 10,
  },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function MealPlannerScreen({ navigation }: { navigation: any }) {
  const C = useThemeColors();
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { entries, weekStart, loading, setWeek, loadWeek } = useMealPlanStore();

  // Picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ date: string; mealType: MealType } | null>(null);
  const { addEntry } = useMealPlanStore();

  // Load current week on mount
  useEffect(() => {
    void loadWeek(weekStart);
  }, []);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekLabel = useMemo(() => formatWeekRange(weekStart, isHe), [weekStart, isHe]);

  function handlePrevWeek() {
    void Haptics.selectionAsync();
    setWeek(shiftWeek(weekStart, -1));
  }

  function handleNextWeek() {
    void Haptics.selectionAsync();
    setWeek(shiftWeek(weekStart, 1));
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
    // Navigate to shopping tab
    navigation.navigate('Shopping');
  }

  const hasEntries = entries.length > 0;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: C.background }]} edges={['left', 'right']}>
      {/* Week navigator header */}
      <View style={[s.weekNav, { flexDirection: isHe ? 'row-reverse' : 'row', backgroundColor: C.surfaceElevated, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={handlePrevWeek} style={s.weekArrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isHe ? 'chevron-forward' : 'chevron-back'} size={22} color={C.text.primary} />
        </TouchableOpacity>
        <Text style={[s.weekLabel, { color: C.text.primary }]}>{weekLabel}</Text>
        <TouchableOpacity onPress={handleNextWeek} style={s.weekArrow} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isHe ? 'chevron-back' : 'chevron-forward'} size={22} color={C.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Day cards */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
        >
          {weekDays.map((date) => (
            <DayCard
              key={date}
              date={date}
              isHe={isHe}
              onAdd={handleAddMeal}
              navigation={navigation}
            />
          ))}
        </ScrollView>
      )}

      {/* Add week to shopping sticky button */}
      {hasEntries && (
        <View style={[s.stickyBottom, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: C.background, borderTopColor: C.border }]}>
          <TouchableOpacity style={s.shoppingBtn} onPress={handleAddToShopping} activeOpacity={0.85}>
            <Ionicons name="basket-outline" size={18} color="#fff" />
            <Text style={s.shoppingBtnText}>{t('addToWeekShopping')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Recipe picker modal */}
      <RecipePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(recipe) => void handlePickRecipe(recipe)}
        isHe={isHe}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  weekNav: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weekArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  weekLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
