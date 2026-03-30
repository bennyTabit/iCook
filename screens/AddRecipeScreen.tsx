import React from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { Typography } from "../constants/typography";
import { isHebrew } from "../lib/i18n";
import { pickRecipeImage, requestMediaPermissions, runOCR } from "../lib/ocr";

type AddOption = {
  key: "import" | "scan" | "manual";
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  recommended?: boolean;
  onPress: () => void;
};

export default function AddRecipeScreen({ navigation }: any) {
  const { t } = useTranslation();
  const isHe = isHebrew();

  function showCameraGuidance() {
    Alert.alert(
      isHe ? "סריקת מתכון" : "Scan recipe",
      isHe ? "כוון את המצלמה למתכון" : "Point the camera at your recipe",
    );
  }

  function chooseScanSource(): Promise<"camera" | "gallery" | null> {
    return new Promise((resolve) => {
      Alert.alert(
        isHe ? "סריקת מתכון" : "Scan recipe",
        isHe ? "איך תרצה להוסיף תמונה?" : "How would you like to add an image?",
        [
          {
            text: isHe ? "מצלמה" : "Camera",
            onPress: () => {
              showCameraGuidance();
              resolve("camera");
            },
          },
          {
            text: isHe ? "גלריה" : "Gallery",
            onPress: () => resolve("gallery"),
          },
          {
            text: isHe ? "ביטול" : "Cancel",
            style: "cancel",
            onPress: () => resolve(null),
          },
        ],
      );
    });
  }

  async function handleScanPress() {
    const granted = await requestMediaPermissions();
    if (!granted) {
      Alert.alert(
        isHe ? "אין הרשאות" : "Permissions required",
        isHe
          ? "נדרשות הרשאות מצלמה וגלריה כדי לסרוק מתכון."
          : "Camera and gallery permissions are required to scan a recipe.",
      );
      return;
    }

    const source = await chooseScanSource();
    if (!source) return;

    try {
      const imageUri = await pickRecipeImage(source);
      if (!imageUri) return;
      const ocr = await runOCR(imageUri);
      navigation.navigate("OcrReview", { ocr });
    } catch (e: any) {
      Alert.alert(
        isHe ? "שגיאת סריקה" : "Scan failed",
        e?.message ??
          (isHe ? "לא הצלחנו לעבד את התמונה" : "Could not process image"),
      );
    }
  }

  const options: AddOption[] = [
    {
      key: "import",
      title: isHe ? "ייבוא מלינק" : "Import from link",
      subtitle: isHe ? "הדבק כתובת ונמלא עבורך" : "Paste a URL and auto-fill",
      icon: "link-outline",
      iconColor: Colors.primary,
      recommended: true,
      onPress: () => navigation.navigate("ImportLink"),
    },
    {
      key: "scan",
      title: isHe ? "סריקת מתכון" : "Scan recipe",
      subtitle: isHe
        ? "צלם דף ונחלץ את הפרטים"
        : "Capture a page and extract details",
      icon: "scan-outline",
      iconColor: Colors.secondary,
      onPress: () => {
        void handleScanPress();
      },
    },
    {
      key: "manual",
      title: isHe ? "הזנה ידנית" : "Manual entry",
      subtitle: isHe
        ? "בוא נכניס את המתכון שלך 🍝"
        : "Let us add your recipe 🍝",
      icon: "create-outline",
      iconColor: "#B1785C",
      onPress: () => navigation.navigate("EditRecipe", { id: null }),
    },
  ];

  return (
    <SafeAreaView style={s.container} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={[s.title, { textAlign: isHe ? "right" : "left" }]}>
          {isHe
            ? "איך תרצה להוסיף מתכון?"
            : "How would you like to add a recipe?"}
        </Text>
        <Text style={[s.subtitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe
            ? "בחר את הדרך הנוחה לך"
            : "Choose the way that works best for you"}
        </Text>

        {options.map((option) => (
          <Pressable
            key={option.key}
            onPress={option.onPress}
            style={({ pressed }) => [s.card, pressed && s.cardPressed]}
          >
            {option.recommended && (
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {isHe ? "מומלץ" : "Recommended"}
                </Text>
              </View>
            )}

            <View
              style={[s.iconWrap, { backgroundColor: option.iconColor + "20" }]}
            >
              <Ionicons name={option.icon} size={24} color={option.iconColor} />
            </View>

            <View style={s.cardBody}>
              <Text
                style={[s.cardTitle, { textAlign: isHe ? "right" : "left" }]}
              >
                {option.title}
              </Text>
              <Text
                style={[s.cardSub, { textAlign: isHe ? "right" : "left" }]}
                numberOfLines={1}
              >
                {option.subtitle}
              </Text>
            </View>

            <Ionicons
              name={isHe ? "chevron-back" : "chevron-forward"}
              size={18}
              color={Colors.text.tertiary}
            />
          </Pressable>
        ))}

        <Text style={[s.footerNote, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "עוד רגע וזה מוכן!" : "You are one step away!"}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 28 },
  title: {
    ...Typography.h2,
    color: Colors.text.primary,
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
  },
  badge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    ...Typography.caption,
    color: "#fff",
    fontWeight: "700",
    fontSize: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, paddingTop: 2 },
  cardTitle: {
    ...Typography.body,
    color: Colors.text.primary,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardSub: {
    ...Typography.caption,
    color: Colors.text.secondary,
  },
  footerNote: {
    ...Typography.bodySmall,
    color: Colors.text.tertiary,
    marginTop: 8,
  },
});
