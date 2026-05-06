/**
 * ImageViewer — fullscreen lightbox with horizontal swipe between images.
 * Close button top-right, page dots + counter at bottom.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width: SW, height: SH } = Dimensions.get('window');

interface ImageViewerProps {
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export default function ImageViewer({
  images,
  initialIndex = 0,
  visible,
  onClose,
}: ImageViewerProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatRef = useRef<FlatList<string>>(null);

  // When the modal opens, jump to the correct image without animation
  useEffect(() => {
    if (visible && images.length > 0) {
      setCurrentIndex(initialIndex);
      const t = setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [visible, initialIndex]);

  const handleViewableChange = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0] != null && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  function handleClose() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  }

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={s.backdrop}>
        {/* ── Image pager ── */}
        <FlatList
          ref={flatRef}
          data={images}
          keyExtractor={(uri, i) => `${uri}-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={handleViewableChange}
          viewabilityConfig={viewabilityConfig}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({
            length: SW,
            offset: SW * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={s.page}>
              <Image
                source={{ uri: item }}
                style={s.image}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* ── Close button (top-right, RTL-aware via absolute right) ── */}
        <TouchableOpacity
          style={[s.closeBtn, { top: insets.top + 12 }]}
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        {/* ── Counter (top-center, only when multiple) ── */}
        {images.length > 1 && (
          <View style={[s.counter, { top: insets.top + 14 }]} pointerEvents="none">
            <Text style={s.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* ── Dot indicators (bottom) ── */}
        {images.length > 1 && (
          <View style={[s.dots, { bottom: insets.bottom + 24 }]} pointerEvents="none">
            {images.map((_, i) => (
              <View key={i} style={[s.dot, i === currentIndex && s.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  page: {
    width: SW,
    height: SH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SW,
    height: SH,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  counterText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.40)',
  },
  dotActive: {
    width: 22,
    borderRadius: 3.5,
    backgroundColor: '#fff',
  },
});
