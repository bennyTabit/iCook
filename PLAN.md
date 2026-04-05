# iCook — Production Roadmap

> Last updated: 2026-04-05
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

### 1.2 Input Validation ⬜
- [ ] Enforce recipe title non-empty at store/DB level, not just UI
- [ ] Validate URLs before sending to importer (fails silently on malformed URLs)
- [ ] Validate Google Client ID is set at boot — auth silently fails if `.env` missing

### 1.3 Race Conditions & Memory Leaks ⬜
- [ ] Debounce `loadRecipes()` in search store — currently fires on every keystroke to SQLite
- [ ] Clean up animation refs and WebView message listeners on unmount
- [ ] Prevent duplicate recipe inserts on rapid tapping of save button

### 1.4 Web Platform Parity ⬜
- [ ] Fix tag filtering on web (returns empty always — `lib/search.web.ts`)
- [ ] Implement ingredient search on web
- [ ] Match `lib/search.web.ts` behavior to native `lib/search.ts`

---

## PHASE 2 — Backend & Cloud Sync
**Goal:** Users lose everything on reinstall — fix this.

### 2.1 Firebase Setup ⬜
- [ ] Create Firebase project, add `firebase.ts` config
- [ ] Enable: Firestore, Auth, Storage, Analytics
- [ ] Add `@react-native-firebase/app`, `firestore`, `auth`, `storage`

### 2.2 Authentication — Make It Real ⬜
- [ ] Google Sign In → Firebase Auth token → persist UID
- [ ] Apple Sign In → same flow
- [ ] Email/Password as third option
- [ ] Token refresh on app resume
- [ ] Proper sign-out → invalidate Firebase session

### 2.3 Cloud Recipe Sync ⬜
- [ ] On save → write to SQLite (local) + Firestore (cloud)
- [ ] On app open → delta sync from Firestore to local DB
- [ ] Conflict resolution: last-write-wins with timestamp
- [ ] Offline-first: queue mutations offline, flush on reconnect

### 2.4 Cloud Image Storage ⬜
- [ ] Replace local `file://` URIs with Firebase Storage URLs
- [ ] Upload on recipe save, get back permanent HTTPS URL
- [ ] Image compression before upload
- [ ] Fallback: keep local URI if upload fails, retry later

---

## PHASE 3 — Core Missing Features
**Goal:** Features users expect from a cooking app in 2026.

### 3.1 Meal Planner ⬜
- [ ] Weekly calendar view — assign recipes to days/meals
- [ ] Tap day → see planned recipes, navigate to recipe
- [ ] "Add to Shopping" from meal plan (bulk add week's ingredients)
- [ ] Persist meal plans to Firestore

### 3.2 Recipe Collections / Folders ⬜
- [ ] Let users create named collections (e.g., "Shabbat Dinner", "Quick Weeknight")
- [ ] Add/remove recipes from collections
- [ ] Browse by collection on home screen

### 3.3 Advanced Recipe Import ⬜
- [ ] AI-assisted import — if scraping fails, send raw HTML to Claude API
- [ ] Offline OCR fallback (MLKit) — currently 100% dependent on Google Vision API
- [ ] OCR language hint for mixed Hebrew/English recipes

### 3.4 Social Media Import ⬜
- [ ] **Instagram profile browser** — connect Instagram account, browse followed accounts
- [ ] Import recipe from any Instagram post (caption + photo)
- [ ] Import recipe from Instagram Reels (video caption parsing)
- [ ] **TikTok profile browser** — browse following feed, import from video description
- [ ] **YouTube** — import recipe from video description or pinned comment
- [ ] AI extraction layer: raw social caption → structured recipe (title, ingredients, steps)
- [ ] "Save later" queue: bookmark social posts for batch import
- [ ] Rate limit aware: respect platform API quotas
- [ ] Store social account links in user profile (Firestore)

### 3.5 Recipe Scaling — Fix & Expand ⬜
- [ ] Proper ingredient parser: quantity + unit + ingredient name (separate fields)
- [ ] Decimal servings (1.5x, 0.5x)
- [ ] Show original and scaled amounts side by side

### 3.6 Language Switcher in App ⬜
- [ ] Language toggle in Profile screen (He ↔ En) that re-renders UI
- [ ] Store preference in AsyncStorage + Firestore user profile

### 3.7 Notifications & Reminders ⬜
- [ ] Expo Notifications + Firebase Cloud Messaging setup
- [ ] "You haven't cooked in 5 days" nudge
- [ ] Meal plan reminders (e.g., "Shabbat dinner prep tonight")
- [ ] Step timer alerts (currently only works with screen on)

---

## PHASE 4 — UX Polish
**Goal:** Make it feel premium.

### 4.1 Onboarding Flow ⬜
- [ ] 3-screen intro: save recipes, cook step by step, plan your week
- [ ] Ask preferred language + dietary preferences on first launch
- [ ] Optional sign-up prompt (not gated)
- [ ] Empty state on home screen (not just blank)

### 4.2 Home Screen — Personalization ⬜
- [ ] Time-aware greeting ("Good morning" / "בוקר טוב")
- [ ] "Last cooked" carousel
- [ ] "Quick dinners" auto-section (cook time < 30 min)
- [ ] Recipe of the day (curated from Firestore)

### 4.3 Search — Make It Smarter ⬜
- [ ] Semantic search: "chicken no dairy" → parse intent
- [ ] Search history (last 10, clear button)
- [ ] Suggested searches based on DB contents
- [ ] Voice search (Hebrew) via `expo-speech`

### 4.4 Recipe Detail — Improvements ⬜
- [ ] Nutrition info (calories, macros)
- [ ] Ratings + personal notes per recipe
- [ ] "Made this" button → logs cook date
- [ ] Print / PDF export

### 4.5 Shopping List — Power Features ⬜
- [ ] Share shopping list via WhatsApp
- [ ] Estimated cost (user enters price per item)
- [ ] Recurring items ("always buy milk")

### 4.6 Dark Mode ⬜
- [ ] Dark mode variants in `constants/colors.ts`
- [ ] Respect system `Appearance.getColorScheme()`

### 4.7 Accessibility ⬜
- [ ] VoiceOver / TalkBack labels on all interactive elements
- [ ] Minimum 44×44pt touch targets
- [ ] WCAG AA color contrast audit
- [ ] Font scaling support

---

## PHASE 5 — Quality & Testing
**Goal:** No production app ships without tests.

### 5.1 Unit Tests ⬜
- [ ] `lib/search.ts` — all filter combinations
- [ ] `lib/ocr.ts` — text parsing edge cases
- [ ] `lib/importer.ts` — JSON-LD and HTML fallback
- [ ] `store/recipeStore.ts` — all mutations
- [ ] `store/shoppingStore.ts` — categorization logic
- [ ] `store/authStore.ts` — sign-in / sign-out

### 5.2 Integration Tests ⬜
- [ ] Full recipe add flow (manual, OCR, URL)
- [ ] Search with combined filters
- [ ] Shopping list persistence across restarts
- [ ] Firebase sync round-trip

### 5.3 E2E Tests ⬜
- [ ] Onboarding → sign-up → add recipe → find in search → cook
- [ ] Import recipe from URL → edit → save → share
- [ ] Add to shopping → check items → clear

### 5.4 CI/CD Pipeline ⬜
- [ ] GitHub Actions: TypeScript check + unit tests + lint on every PR
- [ ] EAS build (iOS + Android) on merge to main
- [ ] Nightly E2E on simulators
- [ ] Auto-publish to TestFlight / Play Store internal track

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
| 1 — Stability | 🔄 In Progress | 25% (1.1 ✅) |
| 2 — Backend | ⬜ Not Started | 0% |
| 3 — Features | ⬜ Not Started | 0% |
| 4 — UX Polish | ⬜ Not Started | 0% |
| 5 — Testing | ⬜ Not Started | 0% |
| 6 — Launch | ⬜ Not Started | 0% |
| 7 — Growth | ⬜ Not Started | 0% |
