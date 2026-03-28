import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import TabNavigator from "./TabNavigator";

import RecipeDetailScreen from "../screens/RecipeDetailScreen";
import AddRecipeScreen from "../screens/AddRecipeScreen";
import OcrReviewScreen from "../screens/OcrReviewScreen";
import ImportLinkScreen from "../screens/ImportLinkScreen";
import EditRecipeScreen from "../screens/EditRecipeScreen";

export type RootStackParamList = {
  Tabs: undefined;
  RecipeDetail: { id: number };
  AddRecipe: undefined;
  OcrReview: { ocr: import("../lib/ocr").OcrResult };
  ImportLink: undefined;
  EditRecipe: { id: number | null };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#FF6B6B" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "500" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen
        name="Tabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RecipeDetail"
        component={RecipeDetailScreen}
        options={{ title: "" }}
      />
      <Stack.Screen
        name="AddRecipe"
        component={AddRecipeScreen}
        options={{ title: "הוסף מתכון" }}
      />
      <Stack.Screen
        name="OcrReview"
        component={OcrReviewScreen}
        options={{ title: "סריקת מתכון" }}
      />
      <Stack.Screen
        name="ImportLink"
        component={ImportLinkScreen}
        options={{ title: "ייבוא מלינק" }}
      />
      <Stack.Screen
        name="EditRecipe"
        component={EditRecipeScreen}
        options={{ title: "עריכת מתכון" }}
      />
    </Stack.Navigator>
  );
}
