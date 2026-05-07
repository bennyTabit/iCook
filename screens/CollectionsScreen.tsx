import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../constants/colors';
import { useThemeColors } from '../hooks/useThemeColors';
import { isHebrew } from '../lib/i18n';
import { useCollectionStore } from '../store/collectionStore';
import type { Collection } from '../lib/db';

// ── Color + Icon pickers ───────────────────────────────────────────────────

const PRESET_COLORS = [
  '#FF6B6B', '#FF9B6B', '#FFD93D', '#6BCB77',
  '#4D96FF', '#C77DFF', '#FF6DB2', '#4ECDC4',
];

const PRESET_ICONS = ['📁', '❤️', '⭐', '🔖', '🏷️', '🍽️', '🥗', '🎉', '🌙', '☀️', '🏠', '🌿'];

// ── Edit / Create Modal ────────────────────────────────────────────────────

function EditCollectionModal({
  visible,
  initial,
  onSave,
  onClose,
  isHe,
}: {
  visible: boolean;
  initial?: Collection | null;
  onSave: (name_he: string, name_en: string, color: string, icon: string) => void;
  onClose: () => void;
  isHe: boolean;
}) {
  const C = useThemeColors();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setName(isHe ? (initial?.name_he ?? '') : (initial?.name_en ?? initial?.name_he ?? ''));
      setColor(initial?.color ?? PRESET_COLORS[0]);
      setIcon(initial?.icon ?? PRESET_ICONS[0]);
    }
  }, [visible, initial]);

  function handleSave() {
    if (!name.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(name.trim(), name.trim(), color, icon);
    onClose();
  }

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* KeyboardAvoidingView lifts the sheet above the keyboard */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Semi-transparent backdrop — tap to dismiss */}
        <Pressable style={em.backdrop} onPress={onClose} />

        {/* Sheet */}
        <View style={[em.sheet, { backgroundColor: C.surfaceElevated }]}>
          {/* Drag handle */}
          <View style={[em.handle, { backgroundColor: C.border }]} />

          {/* Header row: title + close button */}
          <View style={[em.headerRow, { flexDirection: isHe ? 'row-reverse' : 'row' }]}>
            <Text style={[em.title, { color: C.text.primary, flex: 1, textAlign: isHe ? 'right' : 'left' }]}>
              {initial ? t('editCollection') : t('newCollection')}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={isHe ? 'סגור' : 'Close'}
            >
              <Ionicons name="close-circle" size={24} color={C.text.tertiary} />
            </TouchableOpacity>
          </View>

          {/* Scrollable body — stays accessible even when keyboard is open */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[em.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
          >
            {/* Name input */}
            <TextInput
              style={[em.input, {
                textAlign: isHe ? 'right' : 'left',
                backgroundColor: C.surface,
                borderColor: C.border,
                color: C.text.primary,
              }]}
              placeholder={t('collectionName')}
              placeholderTextColor={C.text.tertiary}
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            {/* Icon picker */}
            <Text style={[em.sectionLabel, { textAlign: isHe ? 'right' : 'left', color: C.text.secondary }]}>
              {t('pickIcon')}
            </Text>
            <View style={em.iconGrid}>
              {PRESET_ICONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[
                    em.iconBtn,
                    { backgroundColor: C.surface },
                    icon === ic && { borderColor: color, borderWidth: 2, backgroundColor: color + '18' },
                  ]}
                  onPress={() => { void Haptics.selectionAsync(); setIcon(ic); }}
                  accessibilityRole="button"
                  accessibilityLabel={ic}
                  accessibilityState={{ selected: icon === ic }}
                >
                  <Text style={{ fontSize: 22 }}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Color picker */}
            <Text style={[em.sectionLabel, { textAlign: isHe ? 'right' : 'left', color: C.text.secondary }]}>
              {t('pickColor')}
            </Text>
            <View style={em.colorRow}>
              {PRESET_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    em.colorDot,
                    { backgroundColor: c },
                    color === c && em.colorDotActive,
                  ]}
                  onPress={() => { void Haptics.selectionAsync(); setColor(c); }}
                  accessibilityRole="button"
                  accessibilityLabel={c}
                  accessibilityState={{ selected: color === c }}
                />
              ))}
            </View>

            {/* Preview strip */}
            <View style={[em.preview, { backgroundColor: color + '18', borderColor: color + '40' }]}>
              <View style={[em.previewIcon, { backgroundColor: color + '30' }]}>
                <Text style={{ fontSize: 22 }}>{icon}</Text>
              </View>
              <Text style={[em.previewName, { color: color }]} numberOfLines={1}>
                {name.trim() || (isHe ? 'שם האוסף' : 'Collection name')}
              </Text>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[em.saveBtn, { backgroundColor: color, opacity: name.trim() ? 1 : 0.45 }]}
              onPress={handleSave}
              disabled={!name.trim()}
              accessibilityRole="button"
              accessibilityLabel={isHe ? 'שמור אוסף' : 'Save collection'}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={em.saveBtnText}>{t('save')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const em = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    // max height so it never covers full screen
    maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
  headerRow: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: '700' },
  scrollContent: { gap: 0 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 10,
  },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  colorDotActive: { borderWidth: 3, borderColor: '#1A1A1A' },
  // Live preview strip
  preview: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 16,
  },
  previewIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  previewName: { fontSize: 15, fontWeight: '700', flex: 1 },
  // Save
  saveBtn: {
    borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ── Collection Card ────────────────────────────────────────────────────────

function CollectionCard({
  item,
  isHe,
  onPress,
  onEdit,
  onDelete,
}: {
  item: Collection;
  isHe: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const C = useThemeColors();
  const { t } = useTranslation();
  const name = isHe ? item.name_he : (item.name_en ?? item.name_he);

  return (
    <TouchableOpacity
      style={[cc.card, { backgroundColor: C.surfaceElevated, borderLeftColor: item.color, borderLeftWidth: 4 }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={isHe ? "הקש לצפייה באוסף" : "Tap to view collection"}
    >
      <View style={[cc.iconWrap, { backgroundColor: item.color + '22' }]}>
        <Text style={{ fontSize: 28 }}>{item.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[cc.name, { textAlign: isHe ? 'right' : 'left', color: C.text.primary }]} numberOfLines={1}>{name}</Text>
        <Text style={[cc.count, { textAlign: isHe ? 'right' : 'left', color: C.text.secondary }]}>
          {item.recipe_count ?? 0} {isHe ? 'מתכונים' : 'recipes'}
        </Text>
      </View>
      <View style={cc.actions}>
        <TouchableOpacity
          onPress={onEdit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={cc.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={isHe ? `ערוך ${name}` : `Edit ${name}`}
        >
          <Ionicons name="pencil-outline" size={18} color={C.text.tertiary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={cc.actionBtn}
          accessibilityRole="button"
          accessibilityLabel={isHe ? `מחק ${name}` : `Delete ${name}`}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const cc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  count: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
});

// ── Main Screen ────────────────────────────────────────────────────────────

export default function CollectionsScreen({ navigation }: { navigation: any }) {
  const C = useThemeColors();
  const { t } = useTranslation();
  const isHe = isHebrew();
  const { collections, loading, loadCollections, createCollection, updateCollection, deleteCollection } = useCollectionStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);

  useEffect(() => { void loadCollections(); }, []);

  function handleOpenNew() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditing(null);
    setModalVisible(true);
  }

  function handleEdit(col: Collection) {
    void Haptics.selectionAsync();
    setEditing(col);
    setModalVisible(true);
  }

  function handleDelete(col: Collection) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t('deleteCollection'),
      t('deleteCollectionConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => { void deleteCollection(col.id); },
        },
      ]
    );
  }

  async function handleSave(name_he: string, name_en: string, color: string, icon: string) {
    if (editing) {
      await updateCollection(editing.id, { name_he, name_en, color, icon });
    } else {
      await createCollection(name_he, name_en, color, icon);
    }
  }

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      <ScreenHeader
        title={isHe ? 'האוספים שלי' : 'My Collections'}
        subtitle={isHe ? 'ארגן את המתכונים שלך' : 'Organize your recipes'}
        rightAction={
          <TouchableOpacity
            onPress={handleOpenNew}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={isHe ? "צור אוסף חדש" : "New collection"}
          >
            <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
          </TouchableOpacity>
        }
      />

      {collections.length === 0 && !loading ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>📁</Text>
          <Text style={[s.emptyTitle, { textAlign: 'center', color: C.text.primary }]}>{t('noCollections')}</Text>
          <Text style={[s.emptySub, { textAlign: 'center', color: C.text.secondary }]}>{t('noCollectionsSub')}</Text>
          <TouchableOpacity
            style={s.createBtn}
            onPress={handleOpenNew}
            accessibilityRole="button"
            accessibilityLabel={isHe ? "צור אוסף חדש" : "Create new collection"}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.createBtnText}>{t('createCollection')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => String(c.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
          renderItem={({ item }) => (
            <CollectionCard
              item={item}
              isHe={isHe}
              onPress={() => navigation.navigate('CollectionDetail', { id: item.id, name: isHe ? item.name_he : (item.name_en ?? item.name_he) })}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
        />
      )}

      <EditCollectionModal
        visible={modalVisible}
        initial={editing}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
        isHe={isHe}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginBottom: 8 },
  emptySub: { fontSize: 15, color: Colors.text.secondary, marginBottom: 24 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20 },
  createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
