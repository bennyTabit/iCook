import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import TabNavigator from "./TabNavigator";
import OnboardingScreen from "../screens/OnboardingScreen";
import { Colors } from "../constants/colors";

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("icook.onboarding.done")
      .then((v) => {
        setNeedsOnboarding(!v);
        setReady(true);
      })
      .catch(() => {
        // If AsyncStorage fails, skip onboarding gracefully
        setNeedsOnboarding(false);
        setReady(true);
      });
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: "#FCFAF5" }} />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surfaceElevated },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: { fontWeight: "600", fontSize: 18 },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: "slide_from_right",
      }}
    >
      {needsOnboarding ? (
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false, animation: "fade" }}
        />
      ) : null}
      <Stack.Screen
        name="Tabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
