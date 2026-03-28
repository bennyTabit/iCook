import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { Colors } from '../constants/colors';

import HomeScreen     from '../screens/HomeScreen';
import SearchScreen   from '../screens/SearchScreen';
import ShoppingScreen from '../screens/ShoppingScreen';
import ProfileScreen  from '../screens/ProfileScreen';

export type TabParamList = {
  Home:     undefined;
  Search:   undefined;
  Shopping: undefined;
  Profile:  undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function AddButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.fab} activeOpacity={0.85}>
      <View style={s.fabInner}>
        <View style={s.fabH} />
        <View style={s.fabV} />
      </View>
    </TouchableOpacity>
  );
}

function TabIcon({ emoji }: { emoji: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      {/* Replace with @expo/vector-icons in production */}
    </View>
  );
}

export default function TabNavigator({ navigation }: any) {
  const { t } = useTranslation();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: {
          backgroundColor:  Colors.background,
          borderTopWidth:   0.5,
          borderTopColor:   Colors.border,
          height:           60,
          paddingBottom:    8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: t('home'), tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} /> }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: t('search'), tabBarIcon: ({ color }) => <TabIcon emoji="🔍" color={color} /> }}
      />
      {/* FAB center button — navigates to AddRecipe stack screen */}
      <Tab.Screen
        name="Shopping"
        component={ShoppingScreen}
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarButton: () => (
            <AddButton onPress={() => navigation.navigate('AddRecipe')} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t('profile'), tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

const s = StyleSheet.create({
  fab:      { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14, alignSelf: 'center' },
  fabInner: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  fabH:     { position: 'absolute', width: 18, height: 2, backgroundColor: '#fff', borderRadius: 1 },
  fabV:     { position: 'absolute', width: 2, height: 18, backgroundColor: '#fff', borderRadius: 1 },
});
