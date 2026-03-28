import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './lib/i18n'; // initialize i18n before anything else
import RootNavigator from './navigation/RootNavigator';
import { initDB } from './lib/db';

export default function App() {
  useEffect(() => {
    // Force RTL for Hebrew at app boot (must run before first render)
    if (!I18nManager.isRTL) {
      I18nManager.forceRTL(true);
    }
    // Initialize SQLite schema + seed data
    initDB().catch(console.error);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
