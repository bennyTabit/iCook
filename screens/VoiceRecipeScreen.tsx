import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import * as Haptics from "expo-haptics";

import { Colors } from "../constants/colors";
import { useThemeColors } from "../hooks/useThemeColors";
import { isHebrew } from "../lib/i18n";
import ScreenHeader from "../components/ScreenHeader";
import { transcribeAudio, structureRecipe, isVoiceConfigured, type VoiceRecipeResult } from "../lib/voiceRecipe";
import { insertRecipe } from "../lib/db";
import { useRecipeStore } from "../store/recipeStore";

// ── Max recording duration (3 min) ───────────────────────────────────────────
const MAX_RECORDING_SECONDS = 180;

type Phase = "idle" | "recording" | "transcribing" | "structuring" | "result" | "error";

export default function VoiceRecipeScreen({ navigation }: any) {
  const C = useThemeColors();
  const isHe = isHebrew();
  const { loadRecipes, syncToCloud } = useRecipeStore();

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recipe, setRecipe] = useState<VoiceRecipeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // ── expo-audio recorder ───────────────────────────────────────────────────
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);

  // keep elapsed seconds in sync
  useEffect(() => {
    if (recorderState.isRecording) {
      setElapsedSec(Math.round(recorderState.durationMillis / 1000));
    }
  }, [recorderState.durationMillis, recorderState.isRecording]);

  // auto-stop at MAX_RECORDING_SECONDS
  useEffect(() => {
    if (phase === "recording" && elapsedSec >= MAX_RECORDING_SECONDS) {
      void handleStopRecording();
    }
  }, [elapsedSec, phase]);

  // ── Pulse animation (recording state) ─────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (phase === "recording") {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      pulseLoop.current?.stop();
    };
  }, [phase, pulseAnim]);

  // ── Spin animation (transcribing / structuring) ────────────────────────────
  const spinAnim = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (phase === "transcribing" || phase === "structuring") {
      spinLoop.current = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spinAnim.setValue(0);
    }
    return () => spinLoop.current?.stop();
  }, [phase, spinAnim]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  // ── Start recording ────────────────────────────────────────────────────────
  async function handleStartRecording() {
    if (!isVoiceConfigured()) {
      Alert.alert(
        isHe ? "הגדרות חסרות" : "Configuration missing",
        isHe
          ? "יש להגדיר EXPO_PUBLIC_OPENAI_API_KEY ו-EXPO_PUBLIC_ANTHROPIC_API_KEY בקובץ .env"
          : "Please set EXPO_PUBLIC_OPENAI_API_KEY and EXPO_PUBLIC_ANTHROPIC_API_KEY in your .env file",
      );
      return;
    }

    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        isHe ? "נדרשת גישה למיקרופון" : "Microphone permission required",
        isHe
          ? "אפשר גישה למיקרופון בהגדרות המכשיר כדי להקליט מתכון"
          : "Allow microphone access in device settings to record a recipe",
      );
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setElapsedSec(0);
      setTranscript("");
      setRecipe(null);
      setErrorMsg("");
      setPhase("recording");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.warn("[VoiceRecipe] start error:", err);
      setErrorMsg(isHe ? "לא ניתן להפעיל הקלטה" : "Could not start recording");
      setPhase("error");
    }
  }

  // ── Stop recording & pipeline ──────────────────────────────────────────────
  async function handleStopRecording() {
    if (phase !== "recording") return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording URI");

      // Step 1 — Whisper transcription
      setPhase("transcribing");
      const text = await transcribeAudio(uri, isHe ? "he" : "en");
      setTranscript(text);

      if (!text.trim()) {
        setErrorMsg(
          isHe
            ? "לא זיהינו דיבור בהקלטה. נסה שוב בסביבה שקטה יותר."
            : "No speech detected. Please try again in a quieter environment.",
        );
        setPhase("error");
        return;
      }

      // Step 2 — Claude structuring
      setPhase("structuring");
      const structured = await structureRecipe(text, isHe);
      setRecipe(structured);
      setPhase("result");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      console.warn("[VoiceRecipe] pipeline error:", err);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isHe
            ? "אירעה שגיאה. נסה שוב."
            : "An error occurred. Please try again.",
      );
      setPhase("error");
    }
  }

  // ── Save recipe ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!recipe || saving) return;
    setSaving(true);

    try {
      const notesHe = [
        recipe.ingredients.length ? `מרכיבים:\n${recipe.ingredients.join("\n")}` : "",
        recipe.steps.length ? `\n\nשלבים:\n${recipe.steps.join("\n")}` : "",
      ]
        .join("")
        .trim();

      const notesEn = [
        recipe.ingredients.length ? `Ingredients:\n${recipe.ingredients.join("\n")}` : "",
        recipe.steps.length ? `\n\nSteps:\n${recipe.steps.join("\n")}` : "",
      ]
        .join("")
        .trim();

      const id = await insertRecipe({
        title_he: recipe.title,
        title_en: recipe.title,
        description_he: recipe.description || undefined,
        description_en: recipe.description || undefined,
        source_type: "ai",
        source_name: "Voice",
        prep_time_min: recipe.prep_time_min,
        cook_time_min: recipe.cook_time_min,
        servings: recipe.servings,
        notes_he: notesHe || undefined,
        notes_en: notesEn || undefined,
      });

      syncToCloud(id).catch(() => {});
      await loadRecipes();

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        isHe ? "🎉 המתכון נוסף בהצלחה!" : "🎉 Recipe added successfully!",
        undefined,
        [
          {
            text: isHe ? "לצפייה במתכון" : "View recipe",
            onPress: () => navigation.navigate("RecipeDetail", { id }),
          },
          {
            text: isHe ? "הוסף עוד מתכון" : "Add another",
            onPress: () => {
              setPhase("idle");
              setRecipe(null);
              setTranscript("");
            },
          },
        ],
      );
    } catch (err) {
      console.warn("[VoiceRecipe] save error:", err);
      Alert.alert(isHe ? "שגיאה בשמירה" : "Save error", String(err));
    } finally {
      setSaving(false);
    }
  }

  // ── Format seconds as MM:SS ───────────────────────────────────────────────
  function formatTime(sec: number) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, { backgroundColor: C.background }]}>
      <ScreenHeader
        title={isHe ? "הקלטת מתכון" : "Voice Recipe"}
        subtitle={isHe ? "ספר את המתכון בקול — אנחנו נבנה אותו בשבילך" : "Speak your recipe aloud — we'll structure it for you"}
        leftAction={
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={isHe ? "chevron-forward" : "chevron-back"} size={26} color={C.text.primary} />
          </TouchableOpacity>
        }
      />
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >

      {/* ── Mic area ── */}
      <View style={s.micArea}>

        {/* Pulse ring (only visible when recording) */}
        {phase === "recording" && (
          <Animated.View
            style={[
              s.pulseRing,
              { transform: [{ scale: pulseAnim }], borderColor: Colors.primary + "55" },
            ]}
          />
        )}

        {/* Spinner ring (transcribing / structuring) */}
        {(phase === "transcribing" || phase === "structuring") && (
          <Animated.View
            style={[s.spinnerRing, { transform: [{ rotate: spin }], borderTopColor: Colors.primary }]}
          />
        )}

        {/* Mic button */}
        <TouchableOpacity
          style={[
            s.micBtn,
            phase === "recording" && s.micBtnRecording,
            (phase === "transcribing" || phase === "structuring") && s.micBtnProcessing,
            phase === "result" && s.micBtnDone,
            { opacity: phase === "error" ? 0.5 : 1 },
          ]}
          onPress={
            phase === "idle" || phase === "error" || phase === "result"
              ? handleStartRecording
              : phase === "recording"
                ? handleStopRecording
                : undefined
          }
          disabled={phase === "transcribing" || phase === "structuring"}
          activeOpacity={0.82}
        >
          {phase === "transcribing" || phase === "structuring" ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : phase === "recording" ? (
            <Ionicons name="stop" size={34} color="#fff" />
          ) : phase === "result" ? (
            <Ionicons name="mic" size={34} color="#fff" />
          ) : (
            <Ionicons name="mic" size={34} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Phase label ── */}
      <Text style={[s.phaseLabel, { color: C.text.secondary }]}>
        {phase === "idle" &&
          (isHe ? "לחץ לתחילת ההקלטה" : "Tap to start recording")}
        {phase === "recording" &&
          `${isHe ? "מקליט" : "Recording"} ${formatTime(elapsedSec)} / ${formatTime(MAX_RECORDING_SECONDS)} — ${isHe ? "לחץ לעצירה" : "tap to stop"}`}
        {phase === "transcribing" &&
          (isHe ? "ממיר קול לטקסט..." : "Transcribing audio...")}
        {phase === "structuring" &&
          (isHe ? "בונה את המתכון..." : "Structuring recipe...")}
        {phase === "result" &&
          (isHe ? "המתכון מוכן! לחץ שוב להקלטה חדשה" : "Recipe ready! Tap to record again")}
        {phase === "error" &&
          (isHe ? "לחץ לנסות שוב" : "Tap to try again")}
      </Text>

      {/* ── Error ── */}
      {phase === "error" && errorMsg ? (
        <View style={[s.errorBox, { borderColor: Colors.errorBorder }]}>
          <Text style={[s.errorText, { textAlign: isHe ? "right" : "left" }]}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* ── Transcript (shown during structuring and after) ── */}
      {transcript ? (
        <View style={[s.transcriptBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.transcriptLabel, { textAlign: isHe ? "right" : "left", color: C.text.tertiary }]}>
            {isHe ? "תמליל" : "Transcript"}
          </Text>
          <Text style={[s.transcriptText, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}>
            {transcript}
          </Text>
        </View>
      ) : null}

      {/* ── Result card ── */}
      {phase === "result" && recipe ? (
        <View style={[s.card, { backgroundColor: C.surfaceElevated, borderColor: C.border }]}>
          <Text style={[s.cardLabel, { textAlign: isHe ? "right" : "left", color: C.text.tertiary }]}>
            {isHe ? "תצוגה לפני שמירה" : "Preview before save"}
          </Text>

          {/* Recipe emoji placeholder */}
          <View style={[s.cardImagePlaceholder, { backgroundColor: C.surface }]}>
            <Text style={s.cardEmoji}>🎙️</Text>
          </View>

          <Text style={[s.cardTitle, { textAlign: isHe ? "right" : "left", color: C.text.primary }]}>
            {recipe.title}
          </Text>

          {recipe.description ? (
            <Text style={[s.cardDescription, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}>
              {recipe.description}
            </Text>
          ) : null}

          {/* Meta row */}
          <View style={[s.metaRow, { flexDirection: isHe ? "row-reverse" : "row" }]}>
            {recipe.prep_time_min != null && (
              <View style={s.metaChip}>
                <Text style={s.metaChipText}>⏱ {recipe.prep_time_min} {isHe ? "דק׳ הכנה" : "min prep"}</Text>
              </View>
            )}
            {recipe.cook_time_min != null && (
              <View style={s.metaChip}>
                <Text style={s.metaChipText}>🔥 {recipe.cook_time_min} {isHe ? "דק׳ בישול" : "min cook"}</Text>
              </View>
            )}
            {recipe.servings != null && (
              <View style={s.metaChip}>
                <Text style={s.metaChipText}>🍽 {recipe.servings} {isHe ? "מנות" : "servings"}</Text>
              </View>
            )}
          </View>

          {/* Ingredients summary */}
          {recipe.ingredients.length > 0 && (
            <View style={[s.sectionBox, { borderColor: C.border }]}>
              <Text style={[s.sectionHeader, { textAlign: isHe ? "right" : "left", color: C.text.primary }]}>
                {isHe ? "מרכיבים" : "Ingredients"}
                <Text style={{ color: C.text.tertiary, fontWeight: "400" }}>
                  {" "}({recipe.ingredients.length})
                </Text>
              </Text>
              {recipe.ingredients.map((ing, i) => (
                <Text
                  key={i}
                  style={[s.listItem, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}
                >
                  {isHe ? "• " : "• "}{ing}
                </Text>
              ))}
            </View>
          )}

          {/* Steps summary */}
          {recipe.steps.length > 0 && (
            <View style={[s.sectionBox, { borderColor: C.border }]}>
              <Text style={[s.sectionHeader, { textAlign: isHe ? "right" : "left", color: C.text.primary }]}>
                {isHe ? "שלבים" : "Steps"}
                <Text style={{ color: C.text.tertiary, fontWeight: "400" }}>
                  {" "}({recipe.steps.length})
                </Text>
              </Text>
              {recipe.steps.map((step, i) => (
                <Text
                  key={i}
                  style={[s.listItem, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}
                >
                  {i + 1}. {step}
                </Text>
              ))}
            </View>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.82}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.saveBtnText}>
                {isHe ? "💾 שמור מתכון" : "💾 Save recipe"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ── Tips ── */}
      {phase === "idle" && (
        <View style={[s.tipsBox, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Text style={[s.tipsTitle, { textAlign: isHe ? "right" : "left", color: C.text.primary }]}>
            {isHe ? "💡 טיפים להקלטה טובה" : "💡 Tips for a great recording"}
          </Text>
          {(isHe
            ? [
                "ספר את שם המתכון, המרכיבים עם הכמויות, ושלבי ההכנה",
                "דבר בבירור ובקצב נוח — אין צורך למהר",
                "נסה לנמנע מרעשי רקע חזקים",
                "אפשר להקליט בעברית או באנגלית",
              ]
            : [
                "Say the recipe name, ingredients with quantities, and preparation steps",
                "Speak clearly and at a comfortable pace",
                "Try to minimize background noise",
                "You can record in Hebrew or English",
              ]
          ).map((tip, i) => (
            <Text
              key={i}
              style={[s.tipText, { textAlign: isHe ? "right" : "left", color: C.text.secondary }]}
            >
              {i + 1}. {tip}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MIC_SIZE = 88;
const PULSE_SIZE = MIC_SIZE + 40;
const SPINNER_SIZE = MIC_SIZE + 24;

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 32,
  },

  // ── Mic area ──
  micArea: {
    alignItems: "center",
    justifyContent: "center",
    height: PULSE_SIZE + 20,
    marginBottom: 16,
  },
  pulseRing: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: 3,
  },
  spinnerRing: {
    position: "absolute",
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    borderRadius: SPINNER_SIZE / 2,
    borderWidth: 3,
    borderColor: "transparent",
  },
  micBtn: {
    width: MIC_SIZE,
    height: MIC_SIZE,
    borderRadius: MIC_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  micBtnRecording: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  micBtnProcessing: {
    backgroundColor: Colors.secondary,
    shadowColor: Colors.secondary,
  },
  micBtnDone: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
  },

  phaseLabel: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },

  // ── Error ──
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: Colors.errorSurface,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: Colors.text.error,
    lineHeight: 20,
  },

  // ── Transcript ──
  transcriptBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 22,
  },

  // ── Result card ──
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  cardImagePlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardEmoji: { fontSize: 44 },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  metaChip: {
    borderRadius: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metaChipText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: "500",
  },
  sectionBox: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 10,
    gap: 4,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  listItem: {
    fontSize: 13,
    lineHeight: 20,
  },
  saveBtn: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Tips ──
  tipsBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
  },
});
