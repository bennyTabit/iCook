import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
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
import { useCollectionStore } from '../store/collectionStore';
import type { Collection } from '../lib/db';

// ── Color + Icon pickers ───────────────────────────────────────────────────

const PRESET_COLORS = [
  '#FF6B6B', '#FF9B6B', '#FFD93D', '#6BCB77',
  '#4D96FF', '#C77DFF', '#FF6DB2', '#4ECDC4',
];

const PRESET_ICONS = ['📁', '❤️', '⭐', '🔖', '🏷️', '🍽️', '🥗', '🎉', '🌙', '☀️', '🏠', '🌿'];

// ── Edit Modal ─────────────────────────────────────────────────────────────

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
      <Pressable style={em.backdrop} onPress={onClose} />
      <View style={[em.sheet, { paddingBottom: Math.max(insets.bottom, 20), backgroundColor: C.surfaceElevated }]}>
        <View style={[em.handle, { backgroundColor: C.border }]} />
        <Text style={[em.title, { textAlign: isHe ? 'right' : 'left', color: C.text.primary }]}>
          {initial ? t('editCollection') : t('newCollection')}
        </Text>

        {/* Name input */}
        <TextInput
          style={[em.input, { textAlign: isHe ? 'right' : 'left', backgroundColor: C.surface, borderColor: C.border, color: C.text.primary }]}
          placeholder={t('collectionName')}
          placeholderTextColor={C.text.tertiary}
          value={name}
          onChangeText={setName}
          autoFocus
        />

        {/* Icon picker */}
        <Text style={[em.sectionLabel, { textAlign: isHe ? 'right' : 'left', color: C.text.secondary }]}>{t('pickIcon')}</Text>
        <View style={em.iconGrid}>
          {PRESET_ICONS.map((ic) => (
            <TouchableOpacity
              key={ic}
              style={[em.iconBtn, { backgroundColor: C.surface }, icon === ic && { borderColor: color, borderWidth: 2 }]}
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
        <Text style={[em.sectionLabel, { textAlign: isHe ? 'right' : 'left', color: C.text.secondary }]}>{t('pickColor')}</Text>
        <View style={em.colorRow}>
          {PRESET_COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              style={[em.colorDot, { backgroundColor: c }, color === c && [em.colorDotActive, { borderColor: C.text.primary }]]}
              onPress={() => { void Haptics.selectionAsync(); setColor(c); }}
              accessibilityRole="button"
              accessibilityLabel={c}
              accessibilityState={{ selected: color === c }}
            />
          ))}
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[em.saveBtn, { backgroundColor: color, opacity: name.trim() ? 1 : 0.5 }]}
          onPress={handleSave}
          disabled={!name.trim()}
          accessibilityRole="button"
          accessibilityLabel={isHe ? "שמור אוסף" : "Save collection"}
        >
          <Text style={em.saveBtnText}>{t('save')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const em = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 18 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 16 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  iconBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: Colors.text.primary },
  saveBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
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
    <SafeAreaView style={[s.container, { backgroundColor: C.background }]} edges={['left', 'right']}>
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
          ListHeaderComponent={
            <TouchableOpacity
              style={s.addRow}
              onPress={handleOpenNew}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "צור אוסף חדש" : "New collection"}
            >
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={s.addRowText}>{t('newCollection')}</Text>
            </TouchableOpacity>
          }
        />
      )}

      <EditCollectionModal
        visible={modalVisible}
        initial={editing}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
        isHe={isHe}
      />
    </SafeAreaView>
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
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginBottom: 8 },
  addRowText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
});
