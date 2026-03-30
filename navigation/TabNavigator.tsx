import React from "react";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
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
  Profile: undefined;
  RecipeDetail: { id: number };
  AddRecipe: undefined;
  OcrReview: { ocr: import("../lib/ocr").OcrResult };
  ImportLink: undefined;
  EditRecipe: { id: number | null };
};

const Tab = createBottomTabNavigator<TabParamList>();

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

export default function TabNavigator() {
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();

  function openMenu(nav: any) {
    Alert.alert(
      isHe ? "תפריט" : "Menu",
      isHe ? "בחר/י פעולה" : "Choose an action",
      [
        {
          text: isHe ? "הוסף מתכון" : "Add recipe",
          onPress: () => nav.navigate("AddRecipe"),
        },
        {
          text: isHe ? "ייבוא מלינק" : "Import link",
          onPress: () => nav.navigate("ImportLink"),
        },
        {
          text: isHe ? "פרופיל" : "Profile",
          onPress: () => nav.navigate("Profile"),
        },
        { text: isHe ? "ביטול" : "Cancel", style: "cancel" },
      ],
    );
  }

  return (
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
        sceneStyle: { backgroundColor: Colors.background },
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
              onPress={() => openMenu(navigation)}
            />
          ),
        headerRight: () =>
          isHe ? (
            <HeaderIconButton
              icon="menu"
              onPress={() => openMenu(navigation)}
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
        options={{ title: t("search") }}
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
                Alert.alert(isHe ? "מתכון חדש" : "New recipe");
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
        options={{ title: t("shopping") }}
        listeners={{
          tabPress: () => {
            void Haptics.selectionAsync();
          },
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t("profile") }}
        listeners={{
          tabPress: () => {
            void Haptics.selectionAsync();
          },
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
  );
}

const s = StyleSheet.create({
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
});
