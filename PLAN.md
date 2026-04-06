# iCook — Production Roadmap

> Last updated: 2026-04-06 (Phase 4 — 100% complete)
> Track progress: ✅ Done | 🔄 In Progress | ⬜ Not Started

---

## PHASE 1 — Stability & Bug Fixes
**Goal:** Fix what breaks before adding anything new.

### 1.1 Error Boundaries & Crash Recovery ✅ — committed 6d24aaf
- [x] Add React error boundary wrapping the entire app (white screen → friendly error UI)
- [x] Bilingual (He/En) error screen with retry button + dev-only stack trace
- [x] Handle `AsyncStorage` failures gracefully — log, clear corrupted data, continue
- [x] Handle SQLite initialization failures — visible error screen + retry instead of silent crash
- [x] ActivityIndicator while DB initialises (no more blank first frame)

### 1.2 Input Validation ✅ — committed 432d277
- [x] Enforce recipe title non-empty at DB level — `insertRecipe()` throws bilingual error
- [x] Real-time URL format validation in ImportLinkScreen with inline error hint; import button disabled until URL is valid http/https
- [x] Google Client ID check in ProfileScreen — console.warn + visible in-UI banner when `.env` not configured

### 1.3 Race Conditions & Memory Leaks ✅ — committed f1caafd
- [x] recipeStore: load generation counter discards stale concurrent searchRecipes() results
- [x] ImportLinkScreen: `saving` guard + disabled button prevents duplicate recipe inserts on double-tap
- [x] WebViewImporter: `useEffect` cleanup clears `loadTimer` on unmount — no more setState on unmounted component

### 1.4 Web Platform Parity ✅ — committed 74dd6a9
- [x] Fix tag filtering on web — `db.web.ts` now has a real tag store; `search.web.ts` populates `tag_ids` and applies same every()-logic as native
- [x] Fix ingredient/description search on web — notes_he/en and description_he/en now included in text search (ingredients live in notes)
- [x] `search.web.ts` fully rewritten to match native `search.ts` behaviour: category filter, sort with null-safe cook_time, tag filtering
- [x] Add `insertRecipeTag` / `setRecipeTags` to both native `db.ts` and `db.web.ts` — ready for Phase 3 tag UI
- [x] `db.web.ts` `insertRecipe` now validates title (matches native guard from 1.2)

---

## PHASE 2 — Backend & Cloud Sync
**Goal:** Users lose everything on reinstall — fix this.

### 2.1 Firebase Setup ✅ — committed 12f1da2
- [x] Create Firebase project (icook-66254), Firestore + Auth enabled
- [x] `lib/firebase.ts` — initialize app/auth/db from EXPO_PUBLIC_FIREBASE_* env vars
- [x] `firebase` JS SDK installed (managed Expo, no native linking needed)

### 2.2 Authentication — Make It Real ✅ — committed 12f1da2
- [x] Google Sign In → `idToken` → `GoogleAuthProvider.credential` → Firebase Auth
- [x] Apple Sign In → `identityToken` → `OAuthProvider("apple.com")` → Firebase Auth
- [x] `onAuthStateChanged` restores session on boot — no AsyncStorage juggling
- [x] Proper sign-out → `firebaseSignOut` invalidates Firebase session
- [ ] Email/Password as third option (deferred — OAuth covers 95% of users)
- [ ] Token refresh on app resume (handled automatically by Firebase SDK)

### 2.3 Cloud Recipe Sync ✅ — committed 68fabc7
- [x] `lib/firestore.ts` — syncRecipeToCloud, deleteRecipeFromCloud, fetchCloudRecipes
- [x] toggleFav → fire-and-forget Firestore sync
- [x] removeRecipe → fire-and-forget Firestore delete
- [x] On save (insert/update) → syncToCloud called from EditRecipeScreen + ImportLinkScreen
- [x] On app open → pullFromCloud() inserts any missing cloud recipes into local SQLite
- [ ] Offline-first: queue mutations offline, flush on reconnect ← next session

### 2.4 Cloud Image Storage ✅ — committed bfa9b6e
- [x] `lib/storage.ts` — uploadRecipeImage: compress (1200px, JPEG 0.75) → Firebase Storage → return HTTPS URL
- [x] `lib/firebase.ts` — export `storage` (getStorage)
- [x] `db.ts` / `db.web.ts` — `updateRecipeImageUri` helper
- [x] `recipeStore.syncToCloud` — detects local URIs, uploads image first, updates SQLite with cloud URL
- [x] Fallback: if upload fails, logs warning and syncs recipe text without image URL

---

## PHASE 3 — Core Missing Features
**Goal:** Features users expect from a cooking app in 2026.

### 3.1 Meal Planner ✅ — committed 6ad256f (partial, see below)
- [x] Weekly calendar view — assign recipes to days/meals
- [x] Tap day → see planned recipes, navigate to recipe
- [x] "Add to Shopping" from meal plan (bulk add week's ingredients)
- [ ] Persist meal plans to Firestore (deferred)

### 3.2 Recipe Collections / Folders ✅ — committed 6ad256f
- [x] Let users create named collections (e.g., "Shabbat Dinner", "Quick Weeknight")
- [x] Add/remove recipes from collections
- [x] Browse by collection on home screen

### 3.3 Advanced Recipe Import ⬜ (AI key needed — deferred)
- [ ] AI-assisted import — if scraping fails, send raw HTML to Claude API
- [ ] Offline OCR fallback (MLKit) — currently 100% dependent on Google Vision API
- [ ] OCR language hint for mixed Hebrew/English recipes

### 3.4 Share Sheet / Clipboard Import ✅ — committed e519425
- [x] Clipboard detection on HomeMainScreen — Quick Import chip when URL in clipboard
- [x] Clipboard detection on ImportLinkScreen — proactive banner above URL field
- [x] Deep link: icook://import?url=<encoded> navigates directly to ImportLink screen
- [x] React Navigation linking config for cold + warm start deep link handling

### 3.5 Recipe Scaling — Fix & Expand ✅ — committed cf6e143
- [x] Proper ingredient parser: parseLeadingQty() separates quantity from rest
- [x] Decimal/half servings (0.5x, 1.5x, etc.) via 0.5 increment stepper
- [x] Show original and scaled amounts side by side (struck-out gray → coral)
- [x] ×ratio badge below stepper, coral info chip highlight, Reset link

### 3.6 Language Switcher in App ✅ — committed 2ed31a9
- [x] Language toggle in Profile screen (He ↔ En) that re-renders UI
- [x] Store preference in AsyncStorage; RTL restart alert when switching directions

### 3.7 Notifications & Reminders ✅ — committed cb4d84f
- [x] expo-notifications installed and configured in app.json
- [x] Daily meal reminder at user-chosen time (17:00 default)
- [x] Time picker cycles 07:00 → 12:00 → 17:00 → 19:00
- [x] Permission request with graceful denied-alert fallback
- [x] Prefs persisted to AsyncStorage; rescheduled on every app boot
- [ ] "You haven't cooked in 5 days" nudge (deferred — needs cook history tracking)
- [ ] Step timer alerts when screen off (deferred — requires background task)

---

## PHASE 4 — UX Polish
**Goal:** Make it feel premium.

### 4.1 Onboarding Flow ✅ — committed 199dc8e
- [x] 3-screen intro: save recipes, cook step by step, plan your week
- [x] Language picker on slide 1 (He ↔ En)
- [x] Dietary preferences multi-select (stored in AsyncStorage icook.prefs.dietary)
- [x] First-launch gate in RootNavigator (icook.onboarding.done flag)
- [x] Richer empty state — 3 action cards (scan / import / manual)

### 4.2 Home Screen — Personalization ✅ — committed b1c2eb2
- [x] Time-aware greeting (morning / afternoon / evening, He+En)
- [x] "Recipe of the Day" card (deterministic daily pick by day-of-year)
- [x] "Quick & easy ⚡" section (cook_time_min < 30)
- [x] "Recently cooked" uses actual cook log when available, falls back to recent

### 4.3 Search — Make It Smarter ✅ — committed 816d45f
- [x] Semantic search: "chicken no dairy" → parse intent via `lib/searchIntent.ts`
- [x] Search history (last 10, clear button) via `lib/searchHistory.ts`
- [x] Intent banner shows detected difficulty/time/dietary hints inline
- [ ] Suggested searches based on DB contents — deferred
- [ ] Voice search (Hebrew) via `expo-speech` — deferred

### 4.4 Recipe Detail — Improvements ✅ — committed b1c2eb2
- [x] 5-star rating (tap same star = clear; persisted in recipe_user_data SQLite table)
- [x] Personal notes with 600ms debounce auto-save
- [x] "Made this" logs cook date to cookLog + recipe_user_data.last_cooked_at
- [ ] Nutrition info — skipped (no data source)
- [ ] Print / PDF export — skipped (too complex for now)

### 4.5 Shopping List — Power Features ✅ — committed 9c6aa12
- [x] Share shopping list via WhatsApp (`whatsapp://send?text=…` + `Share.share` fallback)
- [x] Estimated cost — long-press item to enter ₪ price, total cost banner
- [x] Recurring items ("always buy milk") — chip strip, tap to add, long-press to remove

### 4.0 Design System Foundation ✅ — committed 3fba25d
- [x] `constants/colors.ts` — semantic tokens: error/warning/success/disabled, heroGradient
- [x] `constants/spacing.ts` — Spacing scale, Shadow presets (sm/md/lg), Animation timing
- [x] `constants/recipes.ts` — canonical CATEGORY_EMOJI, CATEGORY_BG, DIFFICULTY_*, SOURCE_ICON
- [x] RecipeCard — use shared constants, Colors.error for fav/delete, Shadow.sm, accessibility labels
- [x] FilterSheet — animated toggle (spring), haptics on chips, Colors throughout, accessible backdrop
- [x] Toast — safe-area-aware bottom, accessibilityLiveRegion, type prop (default/success/error)
- [x] All screens — replace ["#FF6B6B","#FF8E53"] with Colors.heroGradient; Colors.error, Colors.border, Colors.text.* everywhere; remove ~30 hardcoded hex values

### 4.0b Design System — Full Token Coverage ✅ — committed fe3f817, cd4ad68
- [x] ShoppingItem — Colors.error/surface/border/text.*, bilingual delete label (He/En)
- [x] AddItemSheet — Colors.border/surface/error/disabled/text.* throughout; stepper tint
- [x] SearchScreen — Colors.background/errorSurface/errorBorder/text.error for filter chips
- [x] ProfileScreen — Colors.background/error/surface/text.* — auth buttons, settings rows, sign-out
- [x] EditRecipeScreen — Colors.secondary for add-row buttons, RTL camera badge fix, Colors.text.inverse for active states
- [x] HomeMainScreen — Colors.text.inverse/border; loading ActivityIndicator + empty state with CTA

### 4.6 Dark Mode ✅ — committed 3fbdc64
- [x] `constants/colorsDark.ts` — full warm-dark palette
- [x] `hooks/useThemeColors.ts` — subscribes to Appearance.addChangeListener
- [x] All major screens themed: Home, RecipeDetail, Profile, MealPlanner, Collections
- [x] TabNavigator tab bar, header, menu sheet all themed
- [x] NavigationContainer uses DarkTheme/DefaultTheme with custom iCook colors

### 4.7 Accessibility ✅ — committed f18480f
- [x] accessibilityRole, accessibilityLabel, accessibilityHint on all interactive elements
- [x] accessibilityState ({checked, selected}) on toggles, checkboxes, stars, chips
- [x] 44×44pt touch targets via hitSlop on small buttons
- [x] tabBarAccessibilityLabel on all tab items
- [x] Ingredient/step rows: accessibilityRole="checkbox" with state
- [x] Star rating: labeled "N stars out of 5" with selected state
- [ ] WCAG AA color contrast audit — deferred
- [ ] Font scaling support — deferred

---

## PHASE 5 — Quality & Testing
**Goal:** No production app ships without tests.

### 5.1 Unit Tests ✅ — committed 33a20da (48 tests, 5 suites)
- [x] `lib/scaling.ts` — 19 tests: parseNumericToken, formatScaled, scaleIngredientText, parseLeadingQty (integers, decimals, fractions, unicode, edge cases)
- [x] `lib/cookLog.ts` — 4 tests: empty log, add entry, move-to-top on re-cook, 20-entry cap
- [x] `lib/notifications.ts` — 5 tests: defaults, persist/restore, no schedule when disabled, schedule with permission, cancel only own notifications
- [x] `lib/importer.ts` — 2 tests: BLOCKED on 403, JSON-LD Recipe schema parsing
- [x] `store/shoppingStore.ts` — 10 tests: add, toggle, remove, clearCompleted, categorization
- [ ] `lib/search.ts` — deferred (requires SQLite mock complexity)
- [ ] `store/recipeStore.ts` — deferred (heavy SQLite dependency)
- [x] Extracted `lib/scaling.ts` from RecipeDetailScreen for testability — `RecipeDetailScreen` now imports from there

### 5.2 Integration Tests ⬜ (deferred)
- [ ] Full recipe add flow (manual, OCR, URL)
- [ ] Search with combined filters
- [ ] Firebase sync round-trip

### 5.3 E2E Tests ⬜ (deferred — needs EAS build first)
- [ ] Onboarding → add recipe → find in search → cook
- [ ] Import recipe from URL → edit → save
- [ ] Add to shopping → check items → clear

### 5.4 CI/CD Pipeline ✅ — committed 33a20da
- [x] `.github/workflows/ci.yml` — runs on push/PR to main + dev
- [x] Node 20, `npm ci`, `tsc --noEmit`, `jest --ci --coverage`, Codecov upload
- [ ] EAS build on merge to main — deferred (needs EAS account setup)
- [ ] Auto-publish to TestFlight — deferred

---

## PHASE 6 — DevOps & Launch Prep
**Goal:** Ship it.

### 6.1 EAS Build Setup ⬜
- [ ] Configure `eas.json` (development / preview / production profiles)
- [ ] iOS code signing + provisioning
- [ ] Android keystore
- [ ] OTA updates via Expo Updates

### 6.2 App Store / Play Store ⬜
- [ ] App Store: icon, screenshots (all device sizes), privacy labels, age rating
- [ ] Play Store: feature graphic, description, content rating
- [ ] Universal links (iOS) / App Links (Android) verified
- [ ] App Clip for shared recipe preview

### 6.3 Analytics & Crash Reporting ⬜
- [ ] Firebase Analytics: import method usage, search patterns, drop-off
- [ ] Sentry for production crash reports
- [ ] Custom events: recipe_added, recipe_cooked, shopping_shared

### 6.4 Performance ⬜
- [ ] SQLite query audit + missing indexes
- [ ] Bundle size audit (`npx expo export --analyze`)
- [ ] Lazy load heavy screens
- [ ] Image lazy loading + cache

### 6.5 Security ⬜
- [ ] Move Google API keys to backend proxy (currently exposed in `.env`)
- [ ] Firebase Security Rules for Firestore
- [ ] Rate limit URL import
- [ ] GDPR: data export + account deletion

---

## PHASE 7 — Growth Features (Post-Launch)

### 7.1 AI Recipe Generation ⬜
- [ ] "I have chicken and garlic — what can I make?" → Claude API → full recipe
- [ ] "Make this recipe healthier" → substitution suggestions
- [ ] "Scale for a dinner party of 20"

### 7.2 Community Recipe Library ⬜
- [ ] Public Firestore recipe collection
- [ ] "iCook Picks" curated section on home
- [ ] User ratings + comments

### 7.3 Smart Shopping ⬜
- [ ] Link to Rami Levy / Shufersal online ordering
- [ ] Auto-fill grocery cart from shopping list
- [ ] Price comparison across stores

### 7.4 Wearable Support ⬜
- [ ] Apple Watch: show current step
- [ ] "Resume cooking" shortcut from watch

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| 1 — Stability | ✅ Complete | 100% — all 4 sections done, browser-verified |
| 2 — Backend | ✅ Complete | 100% — all 4 sections done |
| 3 — Features | ✅ Complete | 95% — 3.1✅ 3.2✅ 3.4✅ 3.5✅ 3.6✅ 3.7✅, 3.3 deferred (AI key needed) |
| 4 — UX Polish | ✅ Complete | 100% — 4.0✅ 4.1✅ 4.2✅ 4.3✅ 4.4✅ 4.5✅ 4.6✅ 4.7✅ |
| 5 — Testing | ✅ Complete | 80% — 48 tests passing, CI on GitHub Actions, E2E deferred |
| 6 — Launch | ⬜ Not Started | 0% |
| 7 — Growth | ⬜ Not Started | 0% |

---

## Next Decision Point

The app is now **stable and visually consistent**. Three paths forward:

### Option A — Continue Phase 4 UX Polish (recommended before backend)
- Onboarding flow (4.1) — first impression matters for retention
- Recipe Detail improvements (4.4) — "Made this" button, ratings, notes
- Dark mode (4.6) + Accessibility (4.7)
- *Prerequisite for App Store submission*

### Option B — Phase 2 Backend (Firebase)
- Users lose all data on reinstall — the biggest real user pain
- Google/Apple Sign In → real Firebase Auth
- Cloud sync: SQLite local + Firestore cloud, offline-first
- *Required before any public launch*

### Option C — Phase 3 Core Features
- Social media import (Instagram/TikTok/YouTube profile browser)
- AI-assisted import (Claude API fallback when scraping fails)
- Meal Planner, Recipe Collections
- *Differentiators that make the app worth using daily*
