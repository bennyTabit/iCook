import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Colors } from "../constants/colors";
import { isHebrew } from "../lib/i18n";
import * as Haptics from "expo-haptics";

import HomeScreen from "../screens/HomeMainScreen";
import SearchScreen from "../screens/SearchScreen";
import ShoppingScreen from "../screens/ShoppingScreen";
import ProfileScreen from "../screens/ProfileScreen";
import MealPlannerScreen from "../screens/MealPlannerScreen";
import RecipeDetailScreen from "../screens/RecipeDetailScreen";
import AddRecipeScreen from "../screens/AddRecipeScreen";
import OcrReviewScreen from "../screens/OcrReviewScreen";
import ImportLinkScreen from "../screens/ImportLinkScreen";
import EditRecipeScreen from "../screens/EditRecipeScreen";

export type TabParamList = {
  Home: undefined;
  Search: undefined;
  Add: undefined;
  Shopping: undefined;
  MealPlanner: undefined;
  Profile: undefined;
  RecipeDetail: { id: number };
  AddRecipe: undefined;
  OcrReview: { ocr: import("../lib/ocr").OcrResult };
  ImportLink: undefined;
  EditRecipe: { id: number | null };
};

const Tab = createBottomTabNavigator<TabParamList>();

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  titleHe: string;
  titleEn: string;
  subHe: string;
  subEn: string;
  screen: keyof TabParamList;
};

const MENU_ITEMS: MenuItem[] = [
  {
    icon: "create-outline",
    iconBg: "#FF6B6B",
    titleHe: "הוסף מתכון",
    titleEn: "Add recipe",
    subHe: "כתוב מתכון ידנית",
    subEn: "Write a recipe from scratch",
    screen: "AddRecipe",
  },
  {
    icon: "camera-outline",
    iconBg: "#4ECDC4",
    titleHe: "סריקת מתכון",
    titleEn: "Scan recipe",
    subHe: "צלם מתכון מנייר או ספר",
    subEn: "Photograph a recipe card or book",
    screen: "AddRecipe",
  },
  {
    icon: "link-outline",
    iconBg: "#7F77DD",
    titleHe: "ייבוא מלינק",
    titleEn: "Import from link",
    subHe: "הכנס כתובת URL של מתכון",
    subEn: "Paste a recipe website URL",
    screen: "ImportLink",
  },
  {
    icon: "person-outline",
    iconBg: "#888780",
    titleHe: "פרופיל והגדרות",
    titleEn: "Profile & settings",
    subHe: "שפה, ערכת נושא ועוד",
    subEn: "Language, theme and more",
    screen: "Profile",
  },
];

function AddPlaceholderScreen() {
  return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
}

function HeaderIconButton({
  icon,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={s.headerIconBtn}
      activeOpacity={0.75}
    >
      <Ionicons name={icon} size={20} color={Colors.text.primary} />
    </TouchableOpacity>
  );
}

function getTabIconName(
  routeName: keyof TabParamList,
  focused: boolean,
): keyof typeof Ionicons.glyphMap {
  if (routeName === "Home") return focused ? "home" : "home-outline";
  if (routeName === "Search") return focused ? "search" : "search-outline";
  if (routeName === "Add") return "add";
  if (routeName === "Shopping") return focused ? "basket" : "basket-outline";
  if (routeName === "MealPlanner") return focused ? "calendar" : "calendar-outline";
  return focused ? "person" : "person-outline";
}

function AddTabButton({
  onPress,
  onLongPress,
}: {
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={s.addBtnWrap}
      activeOpacity={0.88}
    >
      <LinearGradient
        colors={["#FF6B6B", "#FF9B6B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.addBtn}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </LinearGradient>
    </TouchableOpacity>
  );
}

function MenuSheet({
  visible,
  onClose,
  navRef,
  isHe,
  insets,
}: {
  visible: boolean;
  onClose: () => void;
  navRef: React.RefObject<any>;
  isHe: boolean;
  insets: { bottom: number };
}) {
  const [mounted, setMounted] = useState(false);
  const slide = useRef(new Animated.Value(400)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slide, {
          toValue: 0,
          tension: 58,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 400,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  function handleNavigate(screen: keyof TabParamList) {
    onClose();
    // small delay lets the close animation start before screen push
    setTimeout(() => navRef.current?.navigate(screen), 80);
  }

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: fade }]}
        pointerEvents="box-none"
      >
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.46)" },
          ]}
          onPress={onClose}
        />
      </Animated.View>

      {/* sheet */}
      <Animated.View
        style={[
          s.sheet,
          {
            transform: [{ translateY: slide }],
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        {/* drag handle */}
        <View style={s.handle} />

        {/* header */}
        <Text style={[s.sheetTitle, { textAlign: isHe ? "right" : "left" }]}>
          {isHe ? "תפריט" : "Menu"}
        </Text>

        {/* items */}
        {MENU_ITEMS.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[
              s.menuItem,
              { flexDirection: isHe ? "row-reverse" : "row" },
            ]}
            onPress={() => {
              void Haptics.selectionAsync();
              handleNavigate(item.screen);
            }}
            activeOpacity={0.72}
          >
            <View style={[s.menuItemIcon, { backgroundColor: item.iconBg }]}>
              <Ionicons name={item.icon} size={20} color="#fff" />
            </View>
            <View
              style={[
                s.menuItemText,
                { alignItems: isHe ? "flex-end" : "flex-start", flex: 1 },
              ]}
            >
              <Text style={s.menuItemTitle}>
                {isHe ? item.titleHe : item.titleEn}
              </Text>
              <Text style={s.menuItemSub}>
                {isHe ? item.subHe : item.subEn}
              </Text>
            </View>
            <Ionicons
              name={isHe ? "chevron-back-outline" : "chevron-forward-outline"}
              size={16}
              color={Colors.text.tertiary}
              style={{ alignSelf: "center" }}
            />
          </TouchableOpacity>
        ))}

        {/* cancel */}
        <View style={s.sheetDivider} />
        <TouchableOpacity
          style={s.cancelBtn}
          onPress={() => {
            void Haptics.selectionAsync();
            onClose();
          }}
          activeOpacity={0.75}
        >
          <Text style={s.cancelText}>{isHe ? "ביטול" : "Cancel"}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

export default function TabNavigator() {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuNavRef = useRef<any>(null);

  function handleMenuOpen(nav: any) {
    menuNavRef.current = nav;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuOpen(true);
  }

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route, navigation }) => ({
          tabBarActiveTintColor: "#FFFFFF",
          tabBarInactiveTintColor: "#7E7A74",
          tabBarStyle: {
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 10,
            height: 66 + Math.max(insets.bottom - 2, 0),
            paddingTop: 9,
            paddingBottom: Math.max(insets.bottom, 10),
            paddingHorizontal: 6,
            borderTopWidth: 0,
            borderRadius: 24,
            backgroundColor: "#FFF8F3",
            shadowColor: Colors.shadow,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.08,
            shadowRadius: 14,
            elevation: 8,
            direction: isHe ? "rtl" : "ltr",
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 1 },
          tabBarActiveBackgroundColor:
            route.name === "Add" ? "transparent" : Colors.primary,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={getTabIconName(route.name, focused)}
              size={23}
              color={color}
            />
          ),
          tabBarItemStyle: {
            paddingTop: 1,
            borderRadius: 16,
            marginHorizontal: 2,
            marginTop: route.name === "Add" ? -8 : 0,
          },
          sceneStyle: {
            backgroundColor: Colors.background,
            paddingBottom: 76 + Math.max(insets.bottom - 2, 0),
          },
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: "center",
          headerStyle: {
            backgroundColor: Colors.surfaceElevated,
          },
          headerTitleStyle: {
            color: Colors.text.primary,
            fontWeight: "600",
            fontSize: 18,
          },
          headerLeft: () =>
            isHe ? null : (
              <HeaderIconButton
                icon="menu"
                onPress={() => handleMenuOpen(navigation)}
              />
            ),
          headerRight: () =>
            isHe ? (
              <HeaderIconButton
                icon="menu"
                onPress={() => handleMenuOpen(navigation)}
              />
            ) : null,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: t("home") }}
          listeners={{
            tabPress: () => {
              void Haptics.selectionAsync();
            },
          }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{ title: t("search"), headerShown: false }}
          listeners={{
            tabPress: () => {
              void Haptics.selectionAsync();
            },
          }}
        />
        <Tab.Screen
          name="Add"
          component={AddPlaceholderScreen}
          options={({ navigation }) => ({
            title: "",
            tabBarLabel: "",
            headerShown: false,
            tabBarButton: () => (
              <AddTabButton
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate("AddRecipe");
                }}
                onLongPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleMenuOpen(navigation);
                }}
              />
            ),
          })}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
            },
          }}
        />
        <Tab.Screen
          name="Shopping"
          component={ShoppingScreen}
          options={{ title: t("shopping"), headerShown: false }}
          listeners={{
            tabPress: () => {
              void Haptics.selectionAsync();
            },
          }}
        />
        <Tab.Screen
          name="MealPlanner"
          component={MealPlannerScreen}
          options={{ title: t("mealPlanner"), headerShown: true }}
          listeners={{
            tabPress: () => {
              void Haptics.selectionAsync();
            },
          }}
        />

        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: t("profile"),
            headerShown: false,
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
          }}
        />

        <Tab.Screen
          name="RecipeDetail"
          component={RecipeDetailScreen}
          options={{
            title: "",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
          }}
        />
        <Tab.Screen
          name="AddRecipe"
          component={AddRecipeScreen}
          options={{
            title: isHe ? "הוסף מתכון" : "Add recipe",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
          }}
        />
        <Tab.Screen
          name="OcrReview"
          component={OcrReviewScreen}
          options={{
            title: isHe ? "סריקת מתכון" : "OCR review",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
          }}
        />
        <Tab.Screen
          name="ImportLink"
          component={ImportLinkScreen}
          options={{
            title: isHe ? "ייבוא מלינק" : "Import link",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
          }}
        />
        <Tab.Screen
          name="EditRecipe"
          component={EditRecipeScreen}
          options={{
            title: isHe ? "עריכת מתכון" : "Edit recipe",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
          }}
        />
      </Tab.Navigator>

      <MenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        navRef={menuNavRef}
        isHe={isHe}
        insets={insets}
      />
    </>
  );
}

const s = StyleSheet.create({
  // header button
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1E7",
    borderWidth: 1,
    borderColor: "#FFD4C0",
  },

  // floating add button
  addBtnWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
  },
  addBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 3,
    borderColor: "#FFF8F3",
  },

  // menu sheet
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text.tertiary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  menuItem: {
    alignItems: "center",
    paddingVertical: 13,
    gap: 14,
    borderRadius: 14,
    marginHorizontal: -6,
    paddingHorizontal: 6,
  },
  menuItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  menuItemText: {
    gap: 2,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  menuItemSub: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
});
