import React, { useEffect, useState } from 'react';
import { I18nManager, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import './lib/i18n'; // initialize i18n before anything else
import RootNavigator from './navigation/RootNavigator';
import { initDB } from './lib/db';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Colors } from './constants/colors';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useRecipeStore } from './store/recipeStore';

type DBState = 'loading' | 'ready' | 'error';

export default function App() {
  const [dbState, setDbState] = useState<DBState>('loading');
  const [dbError, setDbError] = useState<string | null>(null);

  const bootDB = () => {
    setDbState('loading');
    setDbError(null);
    initDB()
      .then(() => setDbState('ready'))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[App] initDB failed:', msg);
        setDbError(msg);
        setDbState('error');
      });
  };

  useEffect(() => {
    // Force RTL for Hebrew at app boot (must run before first render)
    if (!I18nManager.isRTL) {
      I18nManager.forceRTL(true);
    }
    bootDB();
  }, []);

  // Delta sync: when auth session restores on boot, pull any missing cloud recipes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        useRecipeStore.getState().pullFromCloud();
      }
    });
    return unsub;
  }, []);

  if (dbState === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (dbState === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.emoji}>🍳</Text>
        <Text style={styles.titleHe}>לא ניתן לאתחל את מסד הנתונים</Text>
        <Text style={styles.titleEn}>Could not initialize the database</Text>
        {__DEV__ && dbError && (
          <Text style={styles.debugText}>{dbError}</Text>
        )}
        <TouchableOpacity style={styles.button} onPress={bootDB}>
          <Text style={styles.buttonText}>נסה שוב / Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ErrorBoundary context="app-root">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 52, marginBottom: 20 },
  titleHe: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  titleEn: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  debugText: {
    fontSize: 11,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
