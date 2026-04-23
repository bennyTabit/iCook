import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  UIManager,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { useTranslation } from "react-i18next";
import { generateChefScript, isClaudeConfigured } from "../lib/chefAI";
import { synthesizeAudio, isElevenLabsConfigured, clearChefAudioCache, type ChefGender } from "../lib/chefVoice";
import { Colors } from "../constants/colors";
import { useThemeColors } from "../hooks/useThemeColors";
import { isHebrew } from "../lib/i18n";
import { getRecipeById, insertRecipe, getRecipeUserData, upsertRecipeUserData, type RecipeUserData } from "../lib/db";
import { logCook } from '../lib/cookLog';
import { UNICODE_FRACTIONS, formatScaled, parseNumericToken, scaleIngredientText, parseLeadingQty } from '../lib/scaling';
import { useRecipeStore } from "../store/recipeStore";
import { useShoppingStore } from "../store/shoppingStore";
import { useCollectionStore } from "../store/collectionStore";
import { shareRecipe } from "../lib/sharing";
import Toast from "../components/Toast";
import type { Recipe } from "../lib/db";

type DraftRecipe = {
  title: string;
  ingredients: string[];
  steps: string[];
  source_type?: "ocr" | "url" | "manual";
};

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseSectionLines(notes: string, section: "ingredients" | "steps") {
  if (!notes.trim()) return [];
  const lines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const ingredientMarkers = ["מרכיבים", "ingredients"];
  const stepMarkers = ["שלבים", "steps", "הוראות"];
  const noteMarkers = ["הערות", "notes"];
  const markers = section === "ingredients" ? ingredientMarkers : stepMarkers;
  const stopMarkers = section === "ingredients"
    ? [...stepMarkers, ...noteMarkers]
    : [...ingredientMarkers, ...noteMarkers];

  let inSection = false;
  const out: string[] = [];
  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[:：]/g, "").trim();
    if (markers.some((m) => normalized.includes(m))) {
      inSection = true;
      continue;
    }
    if (inSection && stopMarkers.some((m) => normalized.includes(m))) break;
    if (!inSection) continue;
    out.push(line.replace(/^([-*•]\s*|\d+[.)]\s*)/, "").trim());
  }
  return out.filter(Boolean);
}

// Scaling helpers are imported from lib/scaling.ts

function parseMinutesFromStep(step: string) {
  const m = step.match(/(\d+)\s*(דקות|דקה|min|minutes)/i);
  if (!m) return null;
  const parsed = parseInt(m[1], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

// ─── Cooking Mode Overlay ─────────────────────────────────────────────────────

type ChefPhase = "preparing" | "intro" | "cooking";

function CookingModeOverlay({
  steps,
  ingredients,
  recipeName,
  isHe,
  onClose,
}: {
  steps: string[];
  ingredients: string[];
  recipeName: string;
  isHe: boolean;
  onClose: () => void;
}) {
  useKeepAwake();
  const C = useThemeColors();

  // ── Chef AI state ─────────────────────────────────────────────────────────
  const [phase, setPhase]           = useState<ChefPhase>("preparing");
  const [chefGender, setChefGender] = useState<ChefGender>('female');
  const chefGenderRef               = useRef<ChefGender>('female');
  const [loadingMsg, setLoadingMsg] = useState(isHe ? "השף קורא את המתכון..." : "Chef is reading your recipe...");
  const [narrations, setNarrations] = useState<string[]>(steps); // fallback = raw steps

  // ── Preparing animation ───────────────────────────────────────────────────
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const [msgIdx, setMsgIdx] = useState(0);

  const preparingMessages = isHe
    ? ["השף קורא את המתכון...", "מכין הנחיות מותאמות אישית...", "מייצר קול לכל שלב...", "כמעט מוכן..."]
    : ["Chef is reading your recipe...", "Preparing personalized instructions...", "Generating voice for each step...", "Almost ready..."];

  useEffect(() => {
    if (phase !== "preparing") return;
    const makeDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1,   duration: 350, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 350, useNativeDriver: true }),
        Animated.delay(Math.max(0, 700 - delay)),
      ]));
    const anims = [makeDot(dot1, 0), makeDot(dot2, 220), makeDot(dot3, 440)];
    anims.forEach(a => a.start());
    const msgTimer = setInterval(() => setMsgIdx(i => (i + 1) % preparingMessages.length), 2800);
    return () => { anims.forEach(a => a.stop()); clearInterval(msgTimer); };
  }, [phase]);
  const [outroText, setOutroText]   = useState(isHe ? "כל הכבוד! בתיאבון!" : "Amazing! Enjoy your meal!");
  const [audioUris, setAudioUris]   = useState<(string | null)[]>(Array(steps.length).fill(null));
  const [audioReady, setAudioReady] = useState(0); // steps with audio ready

  // ── Playback state ────────────────────────────────────────────────────────
  const [current, setCurrent]         = useState(0);
  const [isMuted, setIsMuted]         = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timerSec, setTimerSec]       = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerDone, setTimerDone]     = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const isMutedRef         = useRef(false);
  const soundRef           = useRef<Audio.Sound | null>(null);
  const abortRef           = useRef(new AbortController());
  const timerIntervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const narrationsRef         = useRef<string[]>(steps);
  const audioUrisRef          = useRef<(string | null)[]>(Array(steps.length).fill(null));
  const ingredientIntroUriRef = useRef<string | null>(null);
  const ingredientIntroText   = useRef<string>('');
  const isFirstStepRef        = useRef(true);

  const total    = Math.max(steps.length, 1);
  const isLast   = current >= steps.length - 1;
  const stepText = steps[current] ?? "";
  const stepNarration = narrationsRef.current[current] ?? stepText;
  const stepMinutes   = parseMinutesFromStep(stepText);
  const progress      = (current + 1) / total;
  const hasAI         = isClaudeConfigured() || isElevenLabsConfigured();

  // ── Audio helpers ─────────────────────────────────────────────────────────

  async function stopAudio() {
    Speech.stop();
    setIsSpeaking(false);
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }

  async function playFileAudio(uri: string, onDone?: () => void) {
    if (isMutedRef.current) { onDone?.(); return; }
    await stopAudio();
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume: 1 });
      soundRef.current = sound;
      setIsSpeaking(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsSpeaking(false);
          soundRef.current = null;
          onDone?.();
        }
      });
    } catch (err) {
      console.warn("[CookMode] playFileAudio error:", err);
      setIsSpeaking(false);
      onDone?.();
    }
  }

  function speakFallback(text: string, onDone?: () => void) {
    if (isMutedRef.current) { onDone?.(); return; }
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, {
      language: isHe ? "he-IL" : "en-US",
      rate: 0.88,
      onDone: () => { setIsSpeaking(false); onDone?.(); },
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }

  // Wait up to `timeoutMs` for background audio generation to finish for a step
  async function waitForStepAudio(idx: number, timeoutMs = 6000): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const uri = audioUrisRef.current[idx];
      if (uri) return uri;
      await new Promise(r => setTimeout(r, 250));
    }
    return null;
  }

  async function speakStep(idx: number, onDone?: () => void) {
    if (isMutedRef.current) { onDone?.(); return; }
    const narration = narrationsRef.current[idx] ?? steps[idx] ?? "";

    // Use cached audio if ready, otherwise wait up to 6s for background generation
    let uri = audioUrisRef.current[idx];
    if (!uri && isElevenLabsConfigured()) {
      setIsLoadingAudio(true);
      uri = await waitForStepAudio(idx, 6000);
      setIsLoadingAudio(false);
    }

    if (uri) {
      await playFileAudio(uri, onDone);
    } else {
      speakFallback(narration, onDone);
    }
  }

  // ── Timer helpers ─────────────────────────────────────────────────────────

  function clearTimer() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    setTimerSec(null);
    setTimerRunning(false);
    setTimerDone(false);
  }

  function startTimer(minutes: number) {
    clearTimer();
    setTimerSec(minutes * 60);
    setTimerDone(false);
    setTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      setTimerSec((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          setTimerRunning(false);
          setTimerDone(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const msg = isHe ? "הטיימר הסתיים! אפשר להמשיך." : "Timer done! You can move on.";
          const timerUri = audioUrisRef.current.find(u => u?.includes('timer'));
          void (timerUri ? playFileAudio(timerUri) : speakFallback(msg));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  // ── AI Initialization ─────────────────────────────────────────────────────

  useEffect(() => {
    void initChef();
    return () => {
      abortRef.current.abort();
      void stopAudio();
      clearTimer();
    };
  }, []);

  async function initChef() {
    const signal = abortRef.current.signal;

    console.log('[initChef] 🚀 Starting');
    console.log('[initChef] Claude configured:', isClaudeConfigured());
    console.log('[initChef] ElevenLabs configured:', isElevenLabsConfigured());

    // ── Step 1: Generate chef narrations with Claude ──
    if (isClaudeConfigured()) {
      setLoadingMsg(isHe ? "השף קורא את המתכון..." : "Chef is reading your recipe...");
      const script = await generateChefScript(recipeName, steps, ingredients, isHe, signal);
      if (signal.aborted) return;

      if (script) {
        narrationsRef.current = script.steps;
        setNarrations(script.steps);
        setOutroText(script.outro);
        ingredientIntroText.current = script.ingredientIntro;

        // ── Step 2: Generate ingredient intro audio ──
        if (isElevenLabsConfigured()) {
          setLoadingMsg(isHe ? "מכין את קול השף..." : "Preparing chef voice...");
          const ingIntroUri = await synthesizeAudio(script.ingredientIntro, chefGenderRef.current, isHe, signal);
          if (signal.aborted) return;
          if (ingIntroUri) ingredientIntroUriRef.current = ingIntroUri;

          // Also generate step 1 audio
          const step1Uri = await synthesizeAudio(script.intro + " " + script.steps[0], chefGenderRef.current, isHe, signal);
          if (signal.aborted) return;
          if (step1Uri) {
            audioUrisRef.current[0] = step1Uri;
            setAudioUris(prev => { const n = [...prev]; n[0] = step1Uri; return n; });
            setAudioReady(1);
          }
        } else {
          // No ElevenLabs: go straight to intro phase with expo-speech
          setPhase("intro");
          const fallbackIntro = script.ingredientIntro || script.intro;
          speakFallback(fallbackIntro);
          void generateRemainingAudio(signal, 0);
          return;
        }
      } else {
        // Claude failed: skip to ElevenLabs with raw steps, or go straight to cooking
        if (!isElevenLabsConfigured()) {
          setPhase("cooking");
          const intro = isHe ? `בואו נכין את ${recipeName}! יש ${total} שלבים.` : `Let's cook ${recipeName}! ${total} steps. Let's go!`;
          speakFallback(intro, () => setTimeout(() => speakStep(0), 300));
          return;
        }
        setLoadingMsg(isHe ? "מכין את קול השף..." : "Preparing chef voice...");
        const uri = await synthesizeAudio(steps[0] ?? "", chefGenderRef.current, isHe, signal);
        if (signal.aborted) return;
        if (uri) {
          audioUrisRef.current[0] = uri;
          setAudioUris(prev => { const n = [...prev]; n[0] = uri; return n; });
          setAudioReady(1);
        }
      }
    } else if (isElevenLabsConfigured()) {
      // No Claude, but has ElevenLabs: generate voice for raw steps
      setLoadingMsg(isHe ? "מכין את קול השף..." : "Preparing chef voice...");
      const intro = isHe ? `בואו נכין את ${recipeName}! יש ${total} שלבים. מתחילים!` : `Let's cook ${recipeName}! ${total} steps. Let's go!`;
      const introAndStep1 = intro + " " + (steps[0] ?? "");
      const uri = await synthesizeAudio(introAndStep1, chefGenderRef.current, isHe, signal);
      if (signal.aborted) return;
      if (uri) {
        audioUrisRef.current[0] = uri;
        setAudioUris(prev => { const n = [...prev]; n[0] = uri; return n; });
        setAudioReady(1);
      }
    } else {
      // No API keys: basic expo-speech mode
      setPhase("cooking");
      const intro = isHe ? `בואו נכין את ${recipeName}! יש ${total} שלבים. מתחילים!` : `Let's cook ${recipeName}! ${total} steps. Let's go!`;
      speakFallback(intro, () => setTimeout(() => speakStep(0), 300));
      return;
    }

    // ── Show ingredient intro screen and play ingredient intro ──
    if (signal.aborted) return;
    setPhase("intro");
    if (ingredientIntroUriRef.current) {
      void playFileAudio(ingredientIntroUriRef.current);
    } else {
      const fallback = ingredientIntroText.current || (isHe ? `בואו נכין את ${recipeName}!` : `Let's cook ${recipeName}!`);
      speakFallback(fallback);
    }

    // ── Generate remaining audio in background ──
    void generateRemainingAudio(signal, 1);
  }

  async function generateRemainingAudio(signal: AbortSignal, startIdx: number) {
    for (let i = startIdx; i < steps.length; i++) {
      if (signal.aborted) break;
      const narration = narrationsRef.current[i] ?? steps[i] ?? "";
      const uri = await synthesizeAudio(narration, chefGenderRef.current, isHe, signal);
      if (signal.aborted) break;
      if (uri) {
        audioUrisRef.current[i] = uri;
        setAudioUris(prev => { const n = [...prev]; n[i] = uri; return n; });
        setAudioReady(prev => prev + 1);
      }
    }
  }

  // ── Step change ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (isFirstStepRef.current) { isFirstStepRef.current = false; return; }
    clearTimer();
    void speakStep(current);
  }, [current]);

  // Auto-start timer after speech finishes
  useEffect(() => {
    if (!isSpeaking && stepMinutes && timerSec === null && !timerDone && phase === "cooking") {
      const t = setTimeout(() => startTimer(stepMinutes), 600);
      return () => clearTimeout(t);
    }
  }, [isSpeaking, stepMinutes, phase]);

  // ── Controls ──────────────────────────────────────────────────────────────

  function toggleMute() {
    void Haptics.selectionAsync();
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);
    if (next) { void stopAudio(); } else { void speakStep(current); }
  }

  function repeatStep() {
    void Haptics.selectionAsync();
    void speakStep(current);
  }

  function goPrev() {
    void Haptics.selectionAsync();
    setCurrent((x) => Math.max(x - 1, 0));
  }

  async function goNext() {
    void Haptics.selectionAsync();
    if (current < steps.length - 1) {
      setCurrent((x) => x + 1);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await stopAudio();
      const outroUri = isElevenLabsConfigured()
        ? await synthesizeAudio(outroText, chefGenderRef.current, isHe, abortRef.current.signal)
        : null;
      if (outroUri) {
        await playFileAudio(outroUri, () => setTimeout(onClose, 600));
      } else {
        speakFallback(outroText, () => setTimeout(onClose, 600));
      }
    }
  }

  // ── Preparing screen ──────────────────────────────────────────────────────

  if (phase === "preparing") {
    return (
      <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
        <SafeAreaView style={[cm.container, { backgroundColor: C.background, justifyContent: "center", alignItems: "center" }]} edges={["top", "bottom"]}>
          <TouchableOpacity style={[cm.iconBtn, { backgroundColor: C.surface, borderColor: C.border, position: "absolute", top: 16, left: 16 }]} onPress={onClose}>
            <Ionicons name="close" size={20} color={C.text.secondary} />
          </TouchableOpacity>

          {/* Chef emoji */}
          <Text style={cm.preparingEmoji}>{chefGender === 'female' ? '👩‍🍳' : '👨‍🍳'}</Text>
          <Text style={[cm.preparingTitle, { color: C.text.primary }]}>
            {isHe ? "השף מתכונן..." : "Chef is preparing..."}
          </Text>

          {/* Gender toggle */}
          <View style={cm.genderToggle}>
            <TouchableOpacity
              style={[cm.genderBtn, chefGender === 'female' && { backgroundColor: '#2E9E8F' }]}
              onPress={() => { setChefGender('female'); chefGenderRef.current = 'female'; }}
            >
              <Text style={[cm.genderBtnText, chefGender === 'female' && { color: '#fff' }]}>
                👩‍🍳 {isHe ? "שפית" : "Female"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cm.genderBtn, chefGender === 'male' && { backgroundColor: '#2E9E8F' }]}
              onPress={() => { setChefGender('male'); chefGenderRef.current = 'male'; }}
            >
              <Text style={[cm.genderBtnText, chefGender === 'male' && { color: '#fff' }]}>
                👨‍🍳 {isHe ? "שף" : "Male"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Pulsing dots */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 4 }}>
            {[dot1, dot2, dot3].map((anim, i) => (
              <Animated.View
                key={i}
                style={{
                  width: 12, height: 12, borderRadius: 6,
                  backgroundColor: C.primary,
                  opacity: anim,
                  transform: [{ scale: anim }],
                }}
              />
            ))}
          </View>

          {/* Cycling status message */}
          <Text style={[cm.preparingMsg, { color: C.text.secondary }]}>
            {preparingMessages[msgIdx]}
          </Text>

          {/* Progress bar — appears once audio starts generating */}
          {audioReady > 0 ? (
            <>
              <View style={[cm.preparingBar, { backgroundColor: C.border }]}>
                <View style={[cm.preparingBarFill, {
                  backgroundColor: C.secondary,
                  width: `${Math.max(8, Math.round((audioReady / Math.max(total, 1)) * 100))}%` as any,
                }]} />
              </View>
              <Text style={{ color: C.text.tertiary, fontSize: 13, marginTop: 6 }}>
                {audioReady}/{total} {isHe ? "שלבים מוכנים" : "steps ready"}
              </Text>
            </>
          ) : (
            <Text style={{ color: C.text.tertiary, fontSize: 13, marginTop: 4 }}>
              {isHe ? `"${recipeName}"` : `"${recipeName}"`}
            </Text>
          )}

          {/* Skip to basic mode */}
          <TouchableOpacity
            style={[cm.skipBtn, { borderColor: C.border }]}
            onPress={() => {
              abortRef.current.abort();
              abortRef.current = new AbortController();
              setPhase("cooking");
              const intro = isHe ? `בואו נכין את ${recipeName}!` : `Let's cook ${recipeName}!`;
              speakFallback(intro, () => speakFallback(steps[0] ?? ""));
            }}
          >
            <Text style={[cm.skipBtnText, { color: C.text.secondary }]}>
              {isHe ? "דלג — השתמש בקול בסיסי" : "Skip — use basic voice"}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── Ingredient intro screen ───────────────────────────────────────────────

  if (phase === "intro") {
    return (
      <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
        <SafeAreaView style={[cm.container, { backgroundColor: C.background, justifyContent: "flex-start" }]} edges={["top", "bottom"]}>
          {/* Close */}
          <TouchableOpacity
            style={[cm.iconBtn, { backgroundColor: C.surface, borderColor: C.border, position: "absolute", top: 16, left: 16, zIndex: 10 }]}
            onPress={onClose}
          >
            <Ionicons name="close" size={20} color={C.text.secondary} />
          </TouchableOpacity>

          {/* Title */}
          <View style={{ alignItems: "center", paddingTop: 60, paddingBottom: 20 }}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>{chefGender === 'female' ? '👩‍🍳' : '👨‍🍳'}</Text>
            <Text style={[cm.preparingTitle, { color: C.text.primary }]}>
              {isHe ? "מה צריך להכין?" : "Let's get ready!"}
            </Text>
            <Text style={{ fontSize: 14, color: C.text.secondary, marginTop: 4 }}>
              {isHe ? "וודאו שיש לכם את כל המרכיבים" : "Make sure you have everything ready"}
            </Text>
            {isSpeaking && (
              <View style={[cm.speakingBadge, { backgroundColor: C.secondary + "20", borderColor: C.secondary + "50", marginTop: 10 }]}>
                <Ionicons name="musical-notes" size={11} color={C.secondary} />
                <Text style={[cm.speakingBadgeText, { color: C.secondary }]}>
                  {isHe ? "השף מדבר..." : "Chef speaking..."}
                </Text>
              </View>
            )}
          </View>

          {/* Ingredient list */}
          <View style={[cm.ingredientsPanel, { backgroundColor: C.surfaceElevated, borderColor: C.border, marginHorizontal: 20, flex: 1, maxHeight: "55%" }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ingredients.map((ing, i) => (
                <View key={i} style={{ flexDirection: isHe ? "row-reverse" : "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: i < ingredients.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primary, marginHorizontal: 10 }} />
                  <Text style={{ fontSize: 16, color: C.text.primary, flex: 1, textAlign: isHe ? "right" : "left" }}>
                    {ing}
                  </Text>
                </View>
              ))}
              {ingredients.length === 0 && (
                <Text style={{ color: C.text.tertiary, textAlign: "center", padding: 20 }}>
                  {isHe ? "אין מרכיבים" : "No ingredients listed"}
                </Text>
              )}
            </ScrollView>
          </View>

          {/* Start cooking button */}
          <TouchableOpacity
            style={[cm.navBtnPrimary, { marginHorizontal: 20, marginTop: 16, marginBottom: 8, justifyContent: "center" }]}
            onPress={() => {
              void stopAudio();
              setPhase("cooking");
              void speakStep(0);
            }}
          >
            <Text style={cm.navBtnPrimaryText}>
              {isHe ? "מוכנים! נתחיל לבשל 🍳" : "Ready! Let's cook 🍳"}
            </Text>
          </TouchableOpacity>

          {/* Replay intro */}
          <TouchableOpacity
            style={{ alignItems: "center", paddingBottom: 12 }}
            onPress={() => {
              if (ingredientIntroUriRef.current) void playFileAudio(ingredientIntroUriRef.current);
              else speakFallback(ingredientIntroText.current);
            }}
          >
            <Text style={{ color: C.text.tertiary, fontSize: 13 }}>
              🔁 {isHe ? "האזן שוב" : "Listen again"}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  // ── Cook mode screen ──────────────────────────────────────────────────────

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[cm.container, { backgroundColor: C.background }]} edges={["top", "bottom"]}>

        {/* Header */}
        <View style={cm.header}>
          <TouchableOpacity
            style={[cm.iconBtn, { backgroundColor: C.surface, borderColor: C.border }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={isHe ? "סגור" : "Close"}
          >
            <Ionicons name="close" size={20} color={C.text.secondary} />
          </TouchableOpacity>

          <View style={cm.headerCenter}>
            <Text style={cm.headerEmoji}>{chefGender === 'female' ? '👩‍🍳' : '👨‍🍳'}</Text>
            <Text style={[cm.headerTitle, { color: C.text.primary }]} numberOfLines={1}>{recipeName}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[cm.iconBtn, { backgroundColor: showIngredients ? C.primary + "20" : C.surface, borderColor: showIngredients ? C.primary : C.border }]}
              onPress={() => { void Haptics.selectionAsync(); setShowIngredients(v => !v); }}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "מרכיבים" : "Ingredients"}
            >
              <Ionicons name="list-outline" size={18} color={showIngredients ? C.primary : C.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[cm.iconBtn, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={repeatStep}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "חזור" : "Repeat"}
            >
              <Ionicons name="refresh-outline" size={18} color={C.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[cm.iconBtn, { backgroundColor: isMuted ? C.border : C.surface, borderColor: C.border }]}
              onPress={toggleMute}
              accessibilityRole="button"
              accessibilityLabel={isMuted ? (isHe ? "הפעל" : "Unmute") : (isHe ? "השתק" : "Mute")}
            >
              <Ionicons
                name={isMuted ? "volume-mute-outline" : isSpeaking ? "volume-high" : "volume-high-outline"}
                size={18}
                color={isMuted ? C.text.tertiary : isSpeaking ? C.secondary : C.text.secondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress bar */}
        <View style={[cm.progressTrack, { backgroundColor: C.border }]}>
          <View style={[cm.progressFill, { width: `${progress * 100}%` as any, backgroundColor: C.primary }]} />
        </View>

        {/* Step dots */}
        <View style={cm.dotsRow}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[
                cm.dot, { backgroundColor: C.border },
                i === current && { backgroundColor: C.primary, transform: [{ scale: 1.3 }] },
                i < current && { backgroundColor: C.secondary },
              ]}
            />
          ))}
        </View>

        {/* Step card */}
        <View style={[cm.stepCard, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>

          {/* Top row: step counter + speaking status */}
          <View style={{ flexDirection: isHe ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={[cm.stepBadge, { backgroundColor: C.primary + "18", borderColor: C.primary + "40" }]}>
              <Text style={[cm.stepBadgeText, { color: C.primary }]}>
                {isHe ? `שלב ${current + 1} מתוך ${total}` : `Step ${current + 1} of ${total}`}
              </Text>
            </View>
            {isSpeaking && !isMuted ? (
              <View style={[cm.speakingBadge, { backgroundColor: C.secondary + "20", borderColor: C.secondary + "50" }]}>
                <Ionicons name={audioUrisRef.current[current] ? "musical-notes" : "mic"} size={14} color={C.secondary} />
                <Text style={[cm.speakingBadgeText, { color: C.secondary }]}>
                  {audioUrisRef.current[current]
                    ? (isHe ? "השף מדבר..." : "Chef speaking...")
                    : (isHe ? "מקריא..." : "Reading...")}
                </Text>
              </View>
            ) : isLoadingAudio ? (
              <View style={[cm.speakingBadge, { backgroundColor: C.border + "80", borderColor: C.border }]}>
                <Ionicons name="hourglass-outline" size={14} color={C.text.tertiary} />
                <Text style={[cm.speakingBadgeText, { color: C.text.tertiary }]}>
                  {isHe ? "מכין קול..." : "Loading voice..."}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: C.border + "60" }} />

          {/* AI narration — main text with quantities */}
          <Text style={[cm.stepText, { textAlign: isHe ? "right" : "left", color: C.text.primary }]}>
            {stepNarration !== stepText ? stepNarration : stepText}
          </Text>

          {/* Original recipe step as a styled note box */}
          {stepNarration !== stepText && (
            <View style={[cm.stepOriginalBox, { backgroundColor: C.background, borderColor: C.border, borderLeftColor: isHe ? undefined : C.primary + "60", borderRightColor: isHe ? C.primary + "60" : undefined }]}>
              <Text style={[cm.stepOriginalText, { color: C.text.secondary, textAlign: isHe ? "right" : "left" }]}>
                {stepText}
              </Text>
            </View>
          )}

          {/* Live timer */}
          {timerSec !== null && (
            <TouchableOpacity
              onPress={() => { if (!timerRunning && !timerDone) startTimer(stepMinutes ?? 0); }}
              activeOpacity={timerRunning || timerDone ? 1 : 0.7}
              style={[
                cm.timerChip,
                { backgroundColor: timerDone ? C.secondary + "20" : timerRunning ? C.primary + "15" : "#FFF0F0" },
                { borderColor: timerDone ? C.secondary + "60" : timerRunning ? C.primary + "40" : "#FFCACA" },
              ]}
            >
              <Ionicons
                name={timerDone ? "checkmark-circle" : timerRunning ? "timer" : "timer-outline"}
                size={16}
                color={timerDone ? C.secondary : C.primary}
              />
              <Text style={[cm.timerChipText, { color: timerDone ? C.secondary : C.primary, fontSize: 15 }]}>
                {timerDone ? (isHe ? "הטיימר הסתיים ✓" : "Timer done ✓") : formatTime(timerSec)}
              </Text>
              {!timerRunning && !timerDone && (
                <Text style={[cm.timerChipText, { color: C.text.tertiary, fontWeight: "500", fontSize: 12 }]}>
                  {isHe ? "· הקש להתחיל" : "· tap to start"}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Ingredients quick-reference panel */}
        {showIngredients && ingredients.length > 0 && (
          <View style={[cm.ingredientsPanel, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <Text style={[cm.ingredientsPanelTitle, { color: C.text.secondary }]}>
              {isHe ? "🧂 מרכיבים" : "🧂 Ingredients"}
            </Text>
            {ingredients.map((ing, i) => (
              <Text key={i} style={[cm.ingredientsPanelItem, { color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
                • {ing}
              </Text>
            ))}
          </View>
        )}

        {/* Navigation */}
        <View style={cm.navRow}>
          <TouchableOpacity
            style={[cm.navBtn, { borderColor: C.border, backgroundColor: C.surface }, current <= 0 && cm.navBtnDisabled]}
            disabled={current <= 0}
            onPress={goPrev}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={isHe ? "שלב קודם" : "Previous step"}
          >
            <Ionicons name={isHe ? "chevron-forward" : "chevron-back"} size={20} color={current <= 0 ? C.text.tertiary : C.text.primary} />
            <Text style={[cm.navBtnText, { color: current <= 0 ? C.text.tertiary : C.text.primary }]}>
              {isHe ? "הקודם" : "Back"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[cm.navBtnPrimary, { backgroundColor: isLast ? C.secondary : C.primary }]}
            onPress={() => void goNext()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={isLast ? (isHe ? "סיום בישול" : "Done cooking") : (isHe ? "שלב הבא" : "Next step")}
          >
            <Text style={cm.navBtnPrimaryText}>
              {isLast ? (isHe ? "סיום בישול 🎉" : "Done cooking 🎉") : (isHe ? "הבא" : "Next")}
            </Text>
            {!isLast && <Ionicons name={isHe ? "chevron-back" : "chevron-forward"} size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RecipeDetailScreen({ route, navigation }: any) {
  const C = useThemeColors();
  const id: number | undefined = route.params?.id;
  const draft: DraftRecipe | undefined = route.params?.draft;
  const isDraft = !!draft;
  const { t } = useTranslation();
  const isHe = isHebrew();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { toggleFav, removeRecipe, loadRecipes } = useRecipeStore();
  const { addFromRecipe } = useShoppingStore();
  const { collections, loadCollections, addRecipe: addToCol, removeRecipe: removeFromCol, getRecipeCollections } = useCollectionStore();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [toast, setToast] = useState("");
  const [ingredientDone, setIngredientDone] = useState<Record<number, boolean>>({});
  const [stepDone, setStepDone] = useState<Record<number, boolean>>({});
  const [checklistMode, setChecklistMode] = useState(false);
  const [cookingMode, setCookingMode] = useState(false);
  const [timerLeftSec, setTimerLeftSec] = useState(0);
  const [servings, setServings] = useState(2);
  const [cookHistory, setCookHistory] = useState(0);
  const [collectionModalVisible, setCollectionModalVisible] = useState(false);
  const [recipeCollectionIds, setRecipeCollectionIds] = useState<number[]>([]);
  const [userData, setUserData] = useState<RecipeUserData>({ recipe_id: 0, rating: null, personal_note: null, last_cooked_at: null });
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const noteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const favScale = useRef(new Animated.Value(1)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const timerWasRunningRef = useRef(false);
  const heroHeight = Math.max(240, Math.round(height * 0.36));

  async function loadRecipe() {
    if (!id) return;
    const fresh = await getRecipeById(id);
    setRecipe(fresh);
    if (id) {
      const ud = await getRecipeUserData(id);
      setUserData(ud);
      setNoteText(ud.personal_note ?? '');
    }
  }

  useEffect(() => {
    if (isDraft) return;
    void loadRecipe();
  }, [id, isDraft]);

  useFocusEffect(
    React.useCallback(() => {
      if (isDraft) return () => {};
      void loadRecipe();
      return () => {};
    }, [id, isDraft]),
  );

  useEffect(() => {
    if (isDraft) { setServings(2); return; }
    setServings(recipe?.servings ?? 2);
  }, [recipe?.servings, isDraft]);

  const historyKey = useMemo(
    () => `icook.cooked.${id ?? draft?.title ?? "draft"}`,
    [id, draft?.title],
  );

  useEffect(() => {
    async function hydrateCookHistory() {
      const raw = await AsyncStorage.getItem(historyKey);
      setCookHistory(raw ? parseInt(raw, 10) || 0 : 0);
    }
    void hydrateCookHistory();
  }, [historyKey]);

  // Timer countdown
  useEffect(() => {
    if (timerLeftSec <= 0) return;
    const timer = setInterval(
      () => setTimerLeftSec((s) => Math.max(s - 1, 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [timerLeftSec]);

  useEffect(() => {
    if (timerLeftSec > 0) return;
    if (!timerWasRunningRef.current) return;
    timerWasRunningRef.current = false;
    showToast(isHe ? "הטיימר הסתיים ⏰" : "Timer finished ⏰");
  }, [timerLeftSec, isHe]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const title = isDraft
    ? (draft?.title ?? "")
    : isHe
      ? (recipe?.title_he ?? "")
      : (recipe?.title_en ?? recipe?.title_he ?? "");

  const isFav = !isDraft && recipe ? recipe.is_favorite === 1 : false;

  const rawIngredients = useMemo(() => {
    if (isDraft) return draft?.ingredients ?? [];
    return parseSectionLines(
      isHe
        ? (recipe?.notes_he ?? "")
        : (recipe?.notes_en ?? recipe?.notes_he ?? ""),
      "ingredients",
    );
  }, [isDraft, draft?.ingredients, recipe?.notes_he, recipe?.notes_en, isHe]);

  const rawSteps = useMemo(() => {
    if (isDraft) return draft?.steps ?? [];
    return parseSectionLines(
      isHe
        ? (recipe?.notes_he ?? "")
        : (recipe?.notes_en ?? recipe?.notes_he ?? ""),
      "steps",
    );
  }, [isDraft, draft?.steps, recipe?.notes_he, recipe?.notes_en, isHe]);

  const baseServings = isDraft ? 2 : Math.max(recipe?.servings ?? 2, 1);
  const ratio = Math.max(servings, 1) / baseServings;

  const shownIngredients = useMemo(
    () => rawIngredients.map((ing) => scaleIngredientText(ing, ratio)),
    [rawIngredients, ratio],
  );

  const timerLabel = timerLeftSec > 0
    ? `${Math.floor(timerLeftSec / 60)}:${String(timerLeftSec % 60).padStart(2, "0")}`
    : null;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleDelete() {
    if (!id) return;
    Alert.alert(
      isHe ? "מחיקת מתכון" : "Delete recipe",
      isHe ? "האם למחוק את המתכון?" : "Delete this recipe?",
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            await removeRecipe(id);
            await clearChefAudioCache(); // free up storage when recipe is deleted
            navigation.goBack();
          },
        },
      ],
    );
  }

  async function handleOpenCollectionModal() {
    if (!id) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await loadCollections();
    const cols = await getRecipeCollections(id);
    setRecipeCollectionIds(cols.map((c) => c.id));
    setCollectionModalVisible(true);
  }

  async function handleToggleCollection(collectionId: number) {
    if (!id) return;
    void Haptics.selectionAsync();
    if (recipeCollectionIds.includes(collectionId)) {
      await removeFromCol(collectionId, id);
      setRecipeCollectionIds((prev) => prev.filter((x) => x !== collectionId));
    } else {
      await addToCol(collectionId, id);
      setRecipeCollectionIds((prev) => [...prev, collectionId]);
    }
  }

  async function handleSaveDraft() {
    if (!draft || !title.trim()) {
      Alert.alert(t("error"), t("titleRequired"));
      return;
    }
    const newId = await insertRecipe({
      title_he: title.trim(),
      title_en: title.trim(),
      source_type: draft.source_type ?? "ocr",
      notes_he: [
        draft.ingredients.length ? `מרכיבים:\n${draft.ingredients.join("\n")}` : "",
        draft.steps.length ? `\n\nשלבים:\n${draft.steps.join("\n")}` : "",
      ].join("").trim(),
      notes_en: [
        draft.ingredients.length ? `Ingredients:\n${draft.ingredients.join("\n")}` : "",
        draft.steps.length ? `\n\nSteps:\n${draft.steps.join("\n")}` : "",
      ].join("").trim(),
    });
    await loadRecipes();
    navigation.navigate("RecipeDetail", { id: newId });
  }

  async function handleCookedIt() {
    const next = cookHistory + 1;
    setCookHistory(next);
    await AsyncStorage.setItem(historyKey, String(next));
    // Log the cook date
    if (id && recipe) {
      void logCook({ id, title_he: recipe.title_he ?? '', title_en: recipe.title_en ?? null, category_name_en: (recipe as any).category_name_en ?? null });
      void upsertRecipeUserData(id, { last_cooked_at: new Date().toISOString() });
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(isHe ? "מעולה! סומן שבישלת את זה 👨‍🍳" : "Great! Marked as cooked 👨‍🍳");
  }

  async function handleRating(stars: number) {
    if (!id) return;
    void Haptics.selectionAsync();
    const newRating = userData.rating === stars ? null : stars; // tap same star = clear
    setUserData((prev) => ({ ...prev, rating: newRating }));
    await upsertRecipeUserData(id, { rating: newRating });
  }

  function handleNoteChange(text: string) {
    setNoteText(text);
    if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current);
    noteDebounceRef.current = setTimeout(async () => {
      if (!id) return;
      setNoteSaving(true);
      await upsertRecipeUserData(id, { personal_note: text.trim() || null });
      setNoteSaving(false);
    }, 600);
  }

  function toggleIngredientDone(index: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIngredientDone((prev) => ({ ...prev, [index]: !prev[index] }));
    void Haptics.selectionAsync();
  }

  function toggleStepDone(index: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStepDone((prev) => ({ ...prev, [index]: !prev[index] }));
    void Haptics.selectionAsync();
  }

  function onFavoritePress() {
    if (!recipe || !id) return;
    Animated.sequence([
      Animated.spring(favScale, { toValue: 1.3, useNativeDriver: true, friction: 5 }),
      Animated.spring(favScale, { toValue: 1, useNativeDriver: true, friction: 6 }),
    ]).start();
    toggleFav(id, recipe.is_favorite ?? 0);
    setRecipe((prev) =>
      prev ? { ...prev, is_favorite: prev.is_favorite ? 0 : 1 } : prev,
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleTimerStart(minutes?: number | null) {
    const mins = minutes ?? recipe?.cook_time_min ?? null;
    if (!mins || mins <= 0) {
      Alert.alert(isHe ? "אין זמן זמין" : "No time available");
      return;
    }
    timerWasRunningRef.current = true;
    setTimerLeftSec(mins * 60);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(isHe ? `הטיימר התחיל: ${mins} דקות` : `Timer started: ${mins} min`);
  }

  function handleAddToShopping() {
    if (!recipe) return;
    addFromRecipe(recipe, rawIngredients);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(isHe ? "נוסף לרשימת קניות 🛒" : "Added to shopping list 🛒");
  }

  if (!isDraft && !recipe) return <View style={[s.container, { backgroundColor: C.background }]} />;

  const cookTimeMin = recipe?.cook_time_min ?? 0;
  const prepTimeMin = recipe?.prep_time_min ?? 0;
  const totalMin = (cookTimeMin || 0) + (prepTimeMin || 0);

  const difficultyColor =
    recipe?.difficulty === "hard"
      ? Colors.difficulty.hard
      : recipe?.difficulty === "medium"
        ? Colors.difficulty.medium
        : Colors.difficulty.easy;

  // ── Render ──────────────────────────────────────────────────────────────────

  const stickyHeaderOpacity = scrollY.interpolate({
    inputRange: [heroHeight - 70, heroHeight - 20],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      {/* ── Sticky title header (appears on scroll) ── */}
      <Animated.View
        style={[
          s.stickyHeader,
          { paddingTop: insets.top + 6, opacity: stickyHeaderOpacity, backgroundColor: C.background },
        ]}
        pointerEvents="none"
      >
        <Text style={[s.stickyHeaderTitle, { color: C.text.primary }]} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
      >
        {/* ── Hero ── */}
        {recipe?.image_uri ? (
          /* ── Full photo hero ── */
          <View style={[s.hero, { height: heroHeight }]}>
            <Image
              source={{ uri: recipe.image_uri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0)", "rgba(0,0,0,0.7)"]}
              style={StyleSheet.absoluteFill}
              locations={[0, 0.35, 1]}
            />
            <View
              style={[s.heroTopBar, { paddingTop: insets.top + 8, flexDirection: isHe ? "row-reverse" : "row" }]}
            >
              <TouchableOpacity
                style={s.heroIconBtn}
                onPress={() => { void Haptics.selectionAsync(); navigation.goBack(); }}
                accessibilityRole="button"
                accessibilityLabel={isHe ? "חזור" : "Back"}
              >
                <Ionicons name={isHe ? "chevron-forward" : "chevron-back"} size={22} color="#fff" />
              </TouchableOpacity>
              <View style={[s.heroRightBtns, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                {!isDraft && (
                  <>
                    <TouchableOpacity
                      style={s.heroIconBtn}
                      onPress={() => recipe && void shareRecipe(recipe)}
                      accessibilityRole="button"
                      accessibilityLabel={isHe ? "שתף מתכון" : "Share recipe"}
                    >
                      <Ionicons name="share-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.heroIconBtn}
                      onPress={() => { void Haptics.selectionAsync(); navigation.navigate("EditRecipe", { id }); }}
                      accessibilityRole="button"
                      accessibilityLabel={isHe ? "ערוך מתכון" : "Edit recipe"}
                    >
                      <Ionicons name="create-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ scale: favScale }] }}>
                      <TouchableOpacity
                        style={s.heroIconBtn}
                        onPress={onFavoritePress}
                        accessibilityRole="button"
                        accessibilityLabel={isHe ? (isFav ? "הסר ממועדפים" : "הוסף למועדפים") : (isFav ? "Remove from favorites" : "Add to favorites")}
                        accessibilityState={{ checked: isFav }}
                      >
                        <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? "#FF4757" : "#fff"} />
                      </TouchableOpacity>
                    </Animated.View>
                  </>
                )}
              </View>
            </View>
            <View style={[s.heroBottom, { paddingBottom: 20 }]}>
              {recipe?.source_type && recipe.source_type !== "manual" ? (
                <View style={s.sourceBadge}><Text style={s.sourceBadgeText}>{recipe.source_type.toUpperCase()}</Text></View>
              ) : null}
              <Text style={[s.heroTitle, { textAlign: isHe ? "right" : "left" }]} numberOfLines={2}>{title}</Text>
              {cookHistory > 0 ? (
                <Text style={[s.cookHistoryHero, { textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? `בושל ${cookHistory} פעמים 👨‍🍳` : `Cooked ${cookHistory} times 👨‍🍳`}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          /* ── Compact no-photo header ── */
          <LinearGradient
            colors={["#FF6B6B", "#FF8E53"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.compactHero, { paddingTop: insets.top + 8 }]}
          >
            {/* Decorative emoji watermark */}
            <Text style={s.compactHeroWatermark}>🍽️</Text>

            {/* Top bar */}
            <View style={[s.heroTopBar, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <TouchableOpacity
                style={s.heroIconBtn}
                onPress={() => { void Haptics.selectionAsync(); navigation.goBack(); }}
                accessibilityRole="button"
                accessibilityLabel={isHe ? "חזור" : "Back"}
              >
                <Ionicons name={isHe ? "chevron-forward" : "chevron-back"} size={22} color="#fff" />
              </TouchableOpacity>
              <View style={[s.heroRightBtns, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                {!isDraft && (
                  <>
                    <TouchableOpacity
                      style={s.heroIconBtn}
                      onPress={() => recipe && void shareRecipe(recipe)}
                      accessibilityRole="button"
                      accessibilityLabel={isHe ? "שתף מתכון" : "Share recipe"}
                    >
                      <Ionicons name="share-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.heroIconBtn}
                      onPress={() => { void Haptics.selectionAsync(); navigation.navigate("EditRecipe", { id }); }}
                      accessibilityRole="button"
                      accessibilityLabel={isHe ? "ערוך מתכון" : "Edit recipe"}
                    >
                      <Ionicons name="create-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ scale: favScale }] }}>
                      <TouchableOpacity
                        style={s.heroIconBtn}
                        onPress={onFavoritePress}
                        accessibilityRole="button"
                        accessibilityLabel={isHe ? (isFav ? "הסר ממועדפים" : "הוסף למועדפים") : (isFav ? "Remove from favorites" : "Add to favorites")}
                        accessibilityState={{ checked: isFav }}
                      >
                        <Ionicons name={isFav ? "heart" : "heart-outline"} size={20} color={isFav ? "#FF4757" : "#fff"} />
                      </TouchableOpacity>
                    </Animated.View>
                  </>
                )}
              </View>
            </View>

            {/* Title block */}
            <View style={[s.compactHeroTitle, { alignItems: isHe ? "flex-end" : "flex-start" }]}>
              {recipe?.source_type && recipe.source_type !== "manual" ? (
                <View style={s.sourceBadge}><Text style={s.sourceBadgeText}>{recipe.source_type.toUpperCase()}</Text></View>
              ) : null}
              <Text style={[s.heroTitle, { textAlign: isHe ? "right" : "left" }]} numberOfLines={2}>{title}</Text>
              {cookHistory > 0 ? (
                <Text style={[s.cookHistoryHero, { textAlign: isHe ? "right" : "left" }]}>
                  {isHe ? `בושל ${cookHistory} פעמים 👨‍🍳` : `Cooked ${cookHistory} times 👨‍🍳`}
                </Text>
              ) : null}
            </View>
          </LinearGradient>
        )}

        {/* ── Info chips ── */}
        <View style={[s.infoStrip, { flexDirection: isHe ? "row-reverse" : "row" }]}>
          {totalMin > 0 ? (
            <TouchableOpacity
              style={[s.infoChip, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}
              onPress={() => handleTimerStart(cookTimeMin || totalMin)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isHe ? `הפעל טיימר ${totalMin} דקות` : `Start ${totalMin} minute timer`}
            >
              <Ionicons name="timer-outline" size={15} color={C.primary} />
              <Text style={[s.infoChipText, { color: C.primary }]}>
                {totalMin} {isHe ? "דקות" : "min"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={[s.infoChip, { backgroundColor: C.surfaceElevated, borderColor: C.border }, ratio !== 1 && { borderColor: C.primary + "44", backgroundColor: C.primary + "12" }]}>
            <Ionicons name="people-outline" size={15} color={ratio !== 1 ? C.primary : C.text.secondary} />
            <Text style={[s.infoChipText, { color: C.text.secondary }, ratio !== 1 && { color: C.primary }]}>
              {formatScaled(servings)} {isHe ? "מנות" : "servings"}
              {ratio !== 1 ? ` (×${formatScaled(ratio)})` : ""}
            </Text>
          </View>

          {recipe?.difficulty ? (
            <View style={[s.infoChip, { borderColor: difficultyColor + "44", backgroundColor: difficultyColor + "18" }]}>
              <View style={[s.difficultyDot, { backgroundColor: difficultyColor }]} />
              <Text style={[s.infoChipText, { color: difficultyColor }]}>
                {t(recipe.difficulty as any)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Star rating ── */}
        {!isDraft && (
          <View style={[s.ratingRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <Text style={[s.ratingLabel, { color: C.text.secondary }]}>{isHe ? "דירוג:" : "Rating:"}</Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => void handleRating(star)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  style={s.starBtn}
                  accessibilityRole="button"
                  accessibilityLabel={isHe ? `${star} כוכבים מתוך 5` : `${star} stars out of 5`}
                  accessibilityState={{ selected: (userData.rating ?? 0) >= star }}
                >
                  <Ionicons
                    name={(userData.rating ?? 0) >= star ? "star" : "star-outline"}
                    size={22}
                    color={(userData.rating ?? 0) >= star ? "#FFD700" : C.text.tertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {userData.last_cooked_at && (
              <Text style={[s.lastCookedText, { marginStart: "auto", color: C.text.tertiary }]}>
                {isHe
                  ? `בושל ב-${new Date(userData.last_cooked_at).toLocaleDateString('he-IL')}`
                  : `Cooked ${new Date(userData.last_cooked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </Text>
            )}
          </View>
        )}

        {/* ── Active timer banner ── */}
        {timerLabel ? (
          <View style={s.timerBanner}>
            <Ionicons name="timer" size={18} color="#fff" />
            <Text style={s.timerBannerText}>
              {isHe ? `טיימר: ${timerLabel}` : `Timer: ${timerLabel}`}
            </Text>
            <TouchableOpacity
              onPress={() => setTimerLeftSec(0)}
              style={s.timerCancelBtn}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "בטל טיימר" : "Cancel timer"}
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={s.body}>
          {/* ── Servings stepper + cooked ── */}
          <View style={[s.servingsRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <View style={{ alignItems: isHe ? "flex-end" : "flex-start" }}>
              <Text style={[s.servingsLabel, { color: C.text.secondary }]}>{isHe ? "מנות" : "Servings"}</Text>
              {ratio !== 1 && (
                <TouchableOpacity
                  onPress={() => { void Haptics.selectionAsync(); setServings(baseServings); }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel={isHe ? "איפוס מנות" : "Reset servings"}
                >
                  <Text style={[s.servingsReset, { color: C.primary }]}>
                    {isHe ? "איפוס" : "Reset"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={[s.stepper, { flexDirection: isHe ? "row-reverse" : "row", backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <TouchableOpacity
                style={[s.stepperBtn, { backgroundColor: C.surface }]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setServings((x) => Math.max(0.5, parseFloat((x - 0.5).toFixed(1))));
                }}
                accessibilityRole="button"
                accessibilityLabel={isHe ? "הפחת מנה" : "Decrease servings"}
              >
                <Ionicons name="remove" size={18} color={C.text.primary} />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={[s.stepperValue, { color: C.text.primary }]}>{formatScaled(servings)}</Text>
                {ratio !== 1 && (
                  <Text style={[s.stepperRatio, { color: C.primary }]}>
                    ×{formatScaled(ratio)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={[s.stepperBtn, { backgroundColor: C.surface }]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setServings((x) => parseFloat((x + 0.5).toFixed(1)));
                }}
                accessibilityRole="button"
                accessibilityLabel={isHe ? "הוסף מנה" : "Increase servings"}
              >
                <Ionicons name="add" size={18} color={C.text.primary} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={s.cookedBtn}
              onPress={handleCookedIt}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "סמן כבישלתי" : "Mark as cooked"}
            >
              <Text style={s.cookedBtnText}>
                {isHe ? "בישלתי את זה ✓" : "I cooked this ✓"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Ingredients ── */}
          <View style={[s.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={[s.sectionHeader, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[s.sectionTitle, { color: C.text.primary }]}>{isHe ? "מרכיבים" : "Ingredients"}</Text>
                {shownIngredients.length > 0 && (
                  <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{shownIngredients.length}</Text>
                  </View>
                )}
              </View>
              <View style={[s.sectionHeaderActions, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                <TouchableOpacity
                  style={[s.pill, { borderColor: C.border, backgroundColor: C.surface }, checklistMode && s.pillActive]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setChecklistMode((v) => !v);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={isHe ? (checklistMode ? "בטל מצב סימון" : "הפעל מצב סימון") : (checklistMode ? "Disable checklist" : "Enable checklist")}
                  accessibilityState={{ checked: checklistMode }}
                >
                  <Ionicons
                    name={checklistMode ? "checkmark-circle" : "checkmark-circle-outline"}
                    size={13}
                    color={checklistMode ? "#fff" : C.text.secondary}
                  />
                  <Text style={[s.pillText, { color: C.text.secondary }, checklistMode && s.pillTextActive]}>
                    {isHe ? "סימון" : "Check"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {shownIngredients.length === 0 ? (
              <Text style={[s.emptyHint, { color: C.text.tertiary, textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "אין מרכיבים — ערוך את המתכון להוספה" : "No ingredients — edit recipe to add"}
              </Text>
            ) : (
              shownIngredients.map((ing, i) => {
                const done = !!ingredientDone[i];
                // When scaled, parse the leading qty for side-by-side display
                const leadingQty = ratio !== 1 ? parseLeadingQty(rawIngredients[i]) : null;
                return (
                  <TouchableOpacity
                    key={`ing-${i}`}
                    style={[
                      s.ingredientRow,
                      { borderBottomColor: C.border + "80" },
                      done && s.ingredientRowDone,
                      { flexDirection: isHe ? "row-reverse" : "row" },
                    ]}
                    onPress={() => checklistMode && toggleIngredientDone(i)}
                    activeOpacity={checklistMode ? 0.7 : 1}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={ing}
                  >
                    {checklistMode ? (
                      <View style={[s.checkbox, { borderColor: C.border, backgroundColor: C.surface }, done && s.checkboxDone]}>
                        {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                      </View>
                    ) : (
                      <View style={[s.bullet, { backgroundColor: C.primary }]} />
                    )}
                    <Text
                      style={[
                        s.ingredientText,
                        { color: C.text.primary },
                        done && { color: C.text.tertiary, textDecorationLine: "line-through" },
                        { textAlign: isHe ? "right" : "left" },
                      ]}
                    >
                      {leadingQty ? (
                        <>
                          <Text style={[s.qtyOriginal, { color: C.text.tertiary }, done && { color: C.text.tertiary }]}>
                            {leadingQty.qtyStr}
                          </Text>
                          <Text style={[s.qtyScaled, { color: C.primary }, done && { color: C.text.tertiary }]}>
                            {" "}{formatScaled(leadingQty.value * ratio)}
                          </Text>
                          <Text style={done ? { color: C.text.tertiary, textDecorationLine: "line-through" } : undefined}>
                            {leadingQty.rest}
                          </Text>
                        </>
                      ) : (
                        ing
                      )}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* ── Steps ── */}
          <View style={[s.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
            <View style={[s.sectionHeader, { flexDirection: isHe ? "row-reverse" : "row" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={[s.sectionTitle, { color: C.text.primary }]}>{isHe ? "שלבי הכנה" : "Steps"}</Text>
                {rawSteps.length > 0 && (
                  <View style={s.countBadge}>
                    <Text style={s.countBadgeText}>{rawSteps.length}</Text>
                  </View>
                )}
              </View>
            </View>

            {rawSteps.length === 0 ? (
              <Text style={[s.emptyHint, { color: C.text.tertiary, textAlign: isHe ? "right" : "left" }]}>
                {isHe ? "אין שלבים — ערוך את המתכון להוספה" : "No steps — edit recipe to add"}
              </Text>
            ) : (
              rawSteps.map((step, i) => {
                const done = !!stepDone[i];
                const stepMins = parseMinutesFromStep(step);
                return (
                  <Swipeable
                    key={`step-${i}`}
                    friction={2}
                    rightThreshold={72}
                    overshootRight={false}
                    onSwipeableWillOpen={() =>
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    }
                    onSwipeableOpen={() => toggleStepDone(i)}
                    renderRightActions={() => (
                      <View style={s.swipeDoneAction}>
                        <Ionicons name="checkmark-done" size={20} color="#fff" />
                        <Text style={s.swipeDoneText}>{isHe ? "בוצע" : "Done"}</Text>
                      </View>
                    )}
                  >
                    <TouchableOpacity
                      style={[
                        s.stepCard,
                        { backgroundColor: C.surfaceElevated, borderBottomColor: C.border + "80" },
                        done && s.stepCardDone,
                        { flexDirection: isHe ? "row-reverse" : "row" },
                      ]}
                      onPress={() => toggleStepDone(i)}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={isHe ? `שלב ${i + 1}: ${step}` : `Step ${i + 1}: ${step}`}
                      accessibilityHint={isHe ? "הקש לסימון כבוצע" : "Tap to mark as done"}
                    >
                      <View style={[s.stepNumber, { backgroundColor: C.primary }, done && { backgroundColor: C.secondary }]}>
                        {done ? (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        ) : (
                          <Text style={[s.stepNumberText, { color: "#fff" }]}>{i + 1}</Text>
                        )}
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text
                          style={[
                            s.stepText,
                            { color: C.text.primary },
                            done && { color: C.text.tertiary, textDecorationLine: "line-through" },
                            { textAlign: isHe ? "right" : "left" },
                          ]}
                        >
                          {step}
                        </Text>
                        {stepMins ? (
                          <TouchableOpacity
                            style={[s.stepTimerChip, { alignSelf: isHe ? "flex-end" : "flex-start" }]}
                            onPress={() => handleTimerStart(stepMins)}
                            accessibilityRole="button"
                            accessibilityLabel={isHe ? `הפעל טיימר ${stepMins} דקות` : `Start ${stepMins} minute timer`}
                          >
                            <Ionicons name="timer-outline" size={12} color={C.primary} />
                            <Text style={[s.stepTimerChipText, { color: C.primary }]}>
                              {stepMins} {isHe ? "דקות" : "min"}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
                );
              })
            )}
          </View>

          {/* ── Personal notes ── */}
          {!isDraft && (
            <View style={[s.section, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
              <View style={[s.sectionHeader, { flexDirection: isHe ? "row-reverse" : "row" }]}>
                <Text style={[s.sectionTitle, { color: C.text.primary }]}>{isHe ? "הערות אישיות" : "My notes"}</Text>
                {noteSaving && <Text style={[s.noteSavingText, { color: C.text.tertiary }]}>{isHe ? "שומר..." : "Saving..."}</Text>}
              </View>
              <TextInput
                style={[s.noteInput, { textAlign: isHe ? "right" : "left", backgroundColor: C.surface, borderColor: C.border, color: C.text.primary }]}
                value={noteText}
                onChangeText={handleNoteChange}
                placeholder={isHe ? "הוסף הערות אישיות, שינויים שעשית, ..." : "Add personal notes, changes you made, ..."}
                placeholderTextColor={C.text.tertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* ── Bottom action bar ── */}
      <View style={[s.actionBar, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: C.surfaceElevated, borderTopColor: C.border }]}>
        {isDraft ? (
          <View style={[s.actionRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              style={s.actionBtnPrimary}
              onPress={handleSaveDraft}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "שמור מתכון" : "Save recipe"}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={s.actionBtnPrimaryText}>{isHe ? "שמור מתכון" : "Save recipe"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnSecondary, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "ביטול" : "Cancel"}
            >
              <Text style={[s.actionBtnSecondaryText, { color: C.text.secondary }]}>{isHe ? "ביטול" : "Cancel"}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Start Cooking — hero button */}
            {rawSteps.length > 0 && (
              <TouchableOpacity
                style={s.startCookingBtn}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setCookingMode(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={isHe ? "התחל לבשל" : "Start cooking"}
              >
                <Text style={s.startCookingEmoji}>👨‍🍳</Text>
                <Text style={s.startCookingText}>{isHe ? "התחל לבשל" : "Start Cooking"}</Text>
              </TouchableOpacity>
            )}
          <View style={[s.actionRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            <TouchableOpacity
              style={s.actionBtnPrimary}
              onPress={handleAddToShopping}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "הוסף לרשימת קניות" : "Add to shopping list"}
            >
              <Ionicons name="cart-outline" size={18} color="#fff" />
              <Text style={s.actionBtnPrimaryText}>{isHe ? "הוסף לקניות" : "Add to cart"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnIcon, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => void handleOpenCollectionModal()}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "הוסף לאוסף" : "Add to collection"}
            >
              <Ionicons name="albums-outline" size={20} color={C.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnIcon, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={() => recipe && void shareRecipe(recipe)}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "שתף מתכון" : "Share recipe"}
            >
              <Ionicons name="share-social-outline" size={20} color={C.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnIcon, { backgroundColor: C.surface, borderColor: C.border }]}
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={isHe ? "מחק מתכון" : "Delete recipe"}
            >
              <Ionicons name="trash-outline" size={20} color="#FF4757" />
            </TouchableOpacity>
          </View>
          </>
        )}
      </View>

      {/* ── Cooking mode overlay ── */}
      {cookingMode && rawSteps.length > 0 ? (
        <CookingModeOverlay
          steps={rawSteps}
          ingredients={shownIngredients}
          recipeName={isHe ? (recipe?.title_he ?? draft?.title ?? "") : (recipe?.title_en ?? recipe?.title_he ?? draft?.title ?? "")}
          isHe={isHe}
          onClose={() => setCookingMode(false)}
        />
      ) : null}

      {/* ── Collection picker modal ── */}
      <Modal
        visible={collectionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCollectionModalVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setCollectionModalVisible(false)}
        />
        <View style={[s.collectionSheet, { backgroundColor: C.surfaceElevated }]}>
          <View style={[s.collectionHandle, { backgroundColor: C.border }]} />
          <Text style={[s.collectionTitle, { color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
            {isHe ? "הוסף לאוסף" : "Add to collection"}
          </Text>
          {collections.length === 0 ? (
            <Text style={[s.collectionEmpty, { color: C.text.secondary, textAlign: isHe ? "right" : "left" }]}>
              {isHe ? "אין אוספים — צור אוסף מהתפריט" : "No collections — create one from the menu"}
            </Text>
          ) : (
            collections.map((col) => {
              const inCol = recipeCollectionIds.includes(col.id);
              const colName = isHe ? col.name_he : (col.name_en ?? col.name_he);
              return (
                <TouchableOpacity
                  key={col.id}
                  style={[s.collectionRow, { flexDirection: isHe ? "row-reverse" : "row" }]}
                  onPress={() => void handleToggleCollection(col.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={isHe ? (inCol ? `הסר מ${colName}` : `הוסף ל${colName}`) : (inCol ? `Remove from ${colName}` : `Add to ${colName}`)}
                  accessibilityState={{ checked: inCol }}
                >
                  <View style={[s.collectionIconWrap, { backgroundColor: col.color + "22" }]}>
                    <Text style={{ fontSize: 22 }}>{col.icon}</Text>
                  </View>
                  <Text style={[s.collectionRowName, { flex: 1, color: C.text.primary, textAlign: isHe ? "right" : "left" }]}>
                    {colName}
                  </Text>
                  <Ionicons
                    name={inCol ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={inCol ? col.color : C.text.tertiary}
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </Modal>

      <Toast message={toast} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Sticky header
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: Colors.background,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },
  stickyHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },

  // Hero
  hero: { width: "100%", overflow: "hidden" },
  compactHero: {
    width: "100%",
    paddingHorizontal: 12,
    paddingBottom: 18,
    gap: 12,
    overflow: "hidden",
  },
  compactHeroWatermark: {
    position: "absolute",
    right: 16,
    bottom: 10,
    fontSize: 80,
    opacity: 0.18,
  },
  compactHeroTitle: {
    paddingHorizontal: 4,
    gap: 6,
  },
  heroPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroEmoji: { fontSize: 72 },
  heroTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroRightBtns: { gap: 8 },
  heroBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    gap: 6,
  },
  sourceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 34,
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cookHistoryHero: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
  },

  // Info strip
  infoStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
  },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  difficultyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // Timer banner
  timerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 14,
  },
  timerBannerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  timerCancelBtn: {
    padding: 4,
  },

  // Body
  body: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },

  // Servings stepper
  servingsRow: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 4,
  },
  servingsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  stepper: {
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text.primary,
    minWidth: 28,
    textAlign: "center",
  },
  stepperRatio: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
    textAlign: "center",
    marginTop: -2,
  },
  servingsReset: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
    textDecorationLine: "underline",
    marginTop: 2,
  },
  cookedBtn: {
    marginStart: "auto",
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "#FFF0E8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD3BF",
  },
  cookedBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#C45E2A",
  },

  // Section card
  section: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text.primary,
    letterSpacing: -0.2,
  },
  sectionHeaderActions: { gap: 6, alignItems: "center" },

  // Pills
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: { fontSize: 12, fontWeight: "600", color: Colors.text.secondary },
  pillTextActive: { color: "#fff" },
  pillTeal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C7E9E3",
    backgroundColor: "#EAF7F5",
  },
  pillTealText: { fontSize: 12, fontWeight: "700", color: "#2C756A" },
  pillCoral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  pillCoralText: { fontSize: 12, fontWeight: "700", color: "#fff" },

  // Count badge (ingredient/step count in section header)
  countBadge: {
    backgroundColor: Colors.primary + "20",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Empty hint
  emptyHint: {
    fontSize: 13,
    color: Colors.text.tertiary,
    fontStyle: "italic",
    paddingVertical: 8,
  },

  // Ingredients
  ingredientRow: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + "80",
  },
  ingredientRowDone: { opacity: 0.5 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  checkboxDone: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginHorizontal: 8,
    opacity: 0.7,
  },
  ingredientText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 21,
  },
  ingredientTextDone: {
    textDecorationLine: "line-through",
    color: Colors.text.tertiary,
  },
  // Scaled quantity display: original (struck-out gray) → new (coral)
  qtyOriginal: {
    fontSize: 15,
    color: Colors.text.tertiary,
    textDecorationLine: "line-through",
  },
  qtyScaled: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Steps
  stepCard: {
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + "80",
    backgroundColor: Colors.surfaceElevated,
  },
  stepCardDone: { opacity: 0.5 },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepNumberDone: { backgroundColor: Colors.secondary },
  stepNumberText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  stepText: {
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  stepTextDone: {
    textDecorationLine: "line-through",
    color: Colors.text.tertiary,
  },
  stepTimerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFF0F0",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFCACA",
  },
  stepTimerChipText: { fontSize: 12, fontWeight: "600", color: Colors.primary },

  // Swipe done
  swipeDoneAction: {
    width: 80,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.secondary,
    gap: 3,
  },
  swipeDoneText: { fontSize: 11, color: "#fff", fontWeight: "600" },

  // Action bar
  actionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  actionRow: {
    alignItems: "center",
    gap: 8,
  },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    backgroundColor: Colors.primary,
    borderRadius: 14,
  },
  actionBtnPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  actionBtnSecondary: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  actionBtnSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  actionBtnIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  // Collection picker modal
  collectionSheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  collectionHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 18,
  },
  collectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 16,
  },
  collectionEmpty: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  collectionRow: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  collectionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionRowName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text.primary,
  },

  // Rating & notes
  ratingRow: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text.secondary,
  },
  starBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  lastCookedText: {
    fontSize: 11,
    color: Colors.text.tertiary,
  },
  noteSavingText: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
    minHeight: 80,
  },

  // Start Cooking hero button
  startCookingBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    marginBottom: 10,
    backgroundColor: "#2E9E8F",
    borderRadius: 16,
  },
  startCookingEmoji: {
    fontSize: 20,
  },
  startCookingText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
});

// ─── Cooking Mode Styles ──────────────────────────────────────────────────────

const cm = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  headerEmoji: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text.primary,
    flexShrink: 1,
  },
  speakingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  speakingBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Progress
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
    flexWrap: "wrap",
    paddingHorizontal: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    transform: [{ scale: 1.2 }],
  },
  dotDone: {
    backgroundColor: Colors.secondary,
  },

  // Step card
  stepCard: {
    flex: 1,
    margin: 16,
    padding: 24,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "flex-start",
    gap: 14,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  stepBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary + "18",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary + "40",
  },
  stepBadgeText: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.primary,
  },
  stepText: {
    fontSize: 22,
    fontWeight: "500",
    color: Colors.text.primary,
    lineHeight: 34,
  },
  stepOriginalBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  stepOriginalText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  timerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFF0F0",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFCACA",
  },
  timerChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },

  // Navigation
  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text.primary,
  },
  navBtnTextDisabled: { color: Colors.text.tertiary },
  navBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  navBtnFinish: { backgroundColor: Colors.secondary },
  navBtnPrimaryText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },

  // Chef narration hint (shown below step text)
  narrationHint: {
    fontSize: 14,
    fontStyle: "italic",
    color: Colors.text.secondary,
    lineHeight: 20,
    marginTop: 4,
  },

  // Preparing screen
  preparingEmoji: {
    fontSize: 72,
    marginBottom: 20,
  },
  preparingTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  genderToggle: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    marginBottom: 20,
  },
  genderBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#2E9E8F',
  },
  genderBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: '#2E9E8F',
  },
  preparingMsg: {
    fontSize: 15,
    marginBottom: 28,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  preparingBar: {
    width: 200,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 16,
  },
  preparingBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  preparingSkip: {
    fontSize: 13,
    marginBottom: 32,
  },
  skipBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  skipBtnText: {
    fontSize: 13,
    fontWeight: "500",
  },
  ingredientsPanel: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  ingredientsPanelTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  ingredientsPanelItem: {
    fontSize: 14,
    lineHeight: 20,
  },
});
