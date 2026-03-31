import React, { useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { isHebrew } from "../lib/i18n";
import { pickRecipeImage, runOCR, parseOcrText } from "../lib/ocr";

// ── OCR loading overlay ───────────────────────────────────────────────────────

function OcrLoadingOverlay({
  visible,
  isHe,
  count,
}: {
  visible: boolean;
  isHe: boolean;
  count: number;
}) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, ol.overlay, { opacity: fade }]}>
      <View style={ol.card}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={ol.text}>
          {isHe ? "מנתח את המתכון..." : "Analysing recipe..."}
        </Text>
        {count > 1 && (
          <Text style={ol.sub}>
            {isHe ? `מעבד ${count} תמונות` : `Processing ${count} photos`}
          </Text>
        )}
        <Text style={ol.sub}>
          {isHe ? "זה עלול לקחת כמה שניות" : "This may take a few seconds"}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Photo strip ───────────────────────────────────────────────────────────────

function PhotoStrip({
  uris,
  onRemove,
  onAdd,
  onProcess,
  ocrLoading,
  isHe,
}: {
  uris: string[];
  onRemove: (index: number) => void;
  onAdd: () => void;
  onProcess: () => void;
  ocrLoading: boolean;
  isHe: boolean;
}) {
  return (
    <View style={ps.container}>
      <View style={[ps.header, { flexDirection: isHe ? "row-reverse" : "row" }]}>
        <Ionicons name="images-outline" size={16} color={Colors.secondary} />
        <Text style={ps.headerText}>
          {isHe ? `${uris.length} תמונות נבחרו` : `${uris.length} photo${uris.length > 1 ? "s" : ""} selected`}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={ps.strip}
      >
        {uris.map((uri, i) => (
          <View key={uri + i} style={ps.thumb}>
            <Image source={{ uri }} style={ps.thumbImg} resizeMode="cover" />
            <TouchableOpacity
              style={ps.removeBtn}
              onPress={() => { void Haptics.selectionAsync(); onRemove(i); }}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
            >
              <Ionicons name="close-circle" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={ps.thumbNum}>
              <Text style={ps.thumbNumText}>{i + 1}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity style={ps.addThumb} onPress={() => { void Haptics.selectionAsync(); onAdd(); }}>
          <Ionicons name="add" size={26} color={Colors.text.tertiary} />
          <Text style={ps.addThumbText}>{isHe ? "עוד" : "Add"}</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={[ps.processBtn, ocrLoading && ps.processBtnDisabled]}
        onPress={onProcess}
        disabled={ocrLoading}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#FF6B6B", "#FF9B6B"]}
          style={ps.processBtnGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="sparkles-outline" size={18} color="#fff" />
          <Text style={ps.processBtnText}>
            {isHe ? "סרוק ונתח מתכון" : "Scan & analyse recipe"}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

type OptionKey = "import" | "scan" | "manual";

type AddOption = {
  key: OptionKey;
  titleHe: string;
  titleEn: string;
  subtitleHe: string;
  subtitleEn: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradientColors: [string, string];
  recommended?: boolean;
};

const OPTIONS: AddOption[] = [
  {
    key: "import",
    titleHe: "ייבוא מלינק",
    titleEn: "Import from link",
    subtitleHe: "הדבק כתובת URL ונמלא את המתכון אוטומטית",
    subtitleEn: "Paste a URL and we'll fill the recipe automatically",
    icon: "link-outline",
    gradientColors: ["#FF6B6B", "#FF9B6B"],
    recommended: true,
  },
  {
    key: "scan",
    titleHe: "סריקת מתכון",
    titleEn: "Scan recipe",
    subtitleHe: "צלם מתכון מנייר, ספר או מסך — ניתן לצלם כמה עמודים",
    subtitleEn: "Photograph a recipe — you can add multiple pages",
    icon: "camera-outline",
    gradientColors: ["#4ECDC4", "#45B7D1"],
  },
  {
    key: "manual",
    titleHe: "הזנה ידנית",
    titleEn: "Enter manually",
    subtitleHe: "כתוב את המתכון שלך שדה אחרי שדה",
    subtitleEn: "Write your recipe field by field",
    icon: "create-outline",
    gradientColors: ["#B1785C", "#D4956E"],
  },
];

export default function AddRecipeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);

  async function pickAndAdd(source: "camera" | "gallery") {
    try {
      if (source === "camera") {
        const { granted } = await ImagePicker.requestCameraPermissionsAsync();
        if (!granted) {
          Alert.alert(
            isHe ? "אין הרשאת מצלמה" : "Camera permission required",
            isHe ? "אנא אפשר גישה למצלמה בהגדרות." : "Please allow camera access in Settings.",
          );
          return;
        }
      } else {
        const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!granted) {
          Alert.alert(
            isHe ? "אין הרשאת גלריה" : "Gallery permission required",
            isHe ? "אנא אפשר גישה לגלריה בהגדרות." : "Please allow photo library access in Settings.",
          );
          return;
        }
      }
      const uri = await pickRecipeImage(source);
      if (!uri) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPendingImages((prev) => [...prev, uri]);
    } catch (e: any) {
      Alert.alert(
        isHe ? "שגיאה" : "Error",
        e?.message ?? (isHe ? "לא ניתן לטעון תמונה" : "Could not load image"),
      );
    }
  }

  function openSourcePicker() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            isHe ? "ביטול" : "Cancel",
            isHe ? "צלם עכשיו" : "Take a photo",
            isHe ? "בחר מהגלריה" : "Choose from gallery",
          ],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) void pickAndAdd("camera");
          else if (index === 2) void pickAndAdd("gallery");
        },
      );
    } else {
      Alert.alert(isHe ? "הוסף תמונה" : "Add image", undefined, [
        { text: isHe ? "צלם עכשיו" : "Take a photo", onPress: () => void pickAndAdd("camera") },
        { text: isHe ? "בחר מהגלריה" : "Choose from gallery", onPress: () => void pickAndAdd("gallery") },
        { text: isHe ? "ביטול" : "Cancel", style: "cancel" },
      ]);
    }
  }

  async function processImages() {
    if (!pendingImages.length) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOcrLoading(true);
    try {
      // Run OCR on every image and combine all raw text into one document.
      const rawTexts: string[] = [];
      for (const uri of pendingImages) {
        const result = await runOCR(uri);
        rawTexts.push(result.rawText);
      }
      const combined = rawTexts.join("\n\n");
      const ocr = parseOcrText(combined);
      navigation.navigate("OcrReview", { ocr });
    } catch (e: any) {
      Alert.alert(
        isHe ? "שגיאת סריקה" : "Scan failed",
        e?.message ?? (isHe ? "לא הצלחנו לעבד את התמונות" : "Could not process the images"),
      );
    } finally {
      setOcrLoading(false);
    }
  }

  function handleOptionPress(key: OptionKey) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "import") navigation.navigate("ImportLink");
    else if (key === "scan") openSourcePicker();
    else navigation.navigate("EditRecipe", { id: null });
  }

  function removeImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <SafeAreaView style={s.container} edges={["left", "right"]}>
      <View style={s.content}>
        <View style={s.header}>
          <Text style={[s.heading, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "איך תוסיף את המתכון?" : "How would you like to add a recipe?"}
          </Text>
          <Text style={[s.headingSub, { textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "בחר את הדרך הנוחה לך" : "Choose the way that works best for you"}
          </Text>
        </View>

        {OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => handleOptionPress(option.key)}
            style={({ pressed }) => [s.card, pressed && s.cardPressed]}
          >
            <LinearGradient
              colors={option.gradientColors}
              style={s.iconCol}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={option.icon} size={26} color="#fff" />
            </LinearGradient>

            <View style={s.cardBody}>
              <View style={[s.titleRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                <Text style={[s.cardTitle, { textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? option.titleHe : option.titleEn}
                </Text>
                {option.recommended && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{isHe ? "מומלץ" : "Recommended"}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.cardSub, { textAlign: isHe ? "right" : "left" }]}>
                {isHe ? option.subtitleHe : option.subtitleEn}
              </Text>
            </View>

            <Ionicons
              name={isHe ? "chevron-back" : "chevron-forward"}
              size={18}
              color={Colors.text.tertiary}
              style={{ marginRight: isHe ? 0 : 14, marginLeft: isHe ? 14 : 0 }}
            />
          </Pressable>
        ))}

        {/* Photo strip — appears once at least one image is picked */}
        {pendingImages.length > 0 && (
          <PhotoStrip
            uris={pendingImages}
            onRemove={removeImage}
            onAdd={openSourcePicker}
            onProcess={processImages}
            ocrLoading={ocrLoading}
            isHe={isHe}
          />
        )}
      </View>

      <OcrLoadingOverlay visible={ocrLoading} isHe={isHe} count={pendingImages.length} />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 20, gap: 12 },
  header: { marginBottom: 6, gap: 4 },
  heading: { fontSize: 22, fontWeight: "700", color: Colors.text.primary },
  headingSub: { fontSize: 14, color: Colors.text.secondary },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.82, transform: [{ scale: 0.984 }] },
  iconCol: {
    width: 64,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
  },
  cardBody: { flex: 1, paddingVertical: 16, paddingLeft: 14, gap: 4 },
  titleRow: { alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: Colors.text.primary },
  cardSub: { fontSize: 13, color: Colors.text.secondary, lineHeight: 18 },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
});

// photo strip
const ps = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  header: { alignItems: "center", gap: 6 },
  headerText: { fontSize: 13, fontWeight: "600", color: Colors.text.secondary },
  strip: { gap: 10, paddingVertical: 2 },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  thumbImg: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 10,
  },
  thumbNum: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  thumbNumText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  addThumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  addThumbText: { fontSize: 11, color: Colors.text.tertiary, fontWeight: "600" },
  processBtn: { borderRadius: 14, overflow: "hidden" },
  processBtnDisabled: { opacity: 0.5 },
  processBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  processBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
});

// OCR overlay
const ol = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 12,
    width: 220,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  text: { fontSize: 16, fontWeight: "700", color: Colors.text.primary, textAlign: "center" },
  sub: { fontSize: 13, color: Colors.text.secondary, textAlign: "center" },
});
