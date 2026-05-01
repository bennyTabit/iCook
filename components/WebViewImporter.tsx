import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../constants/colors";
import type { ImportedRecipe } from "../lib/importer";

/** Default start page when opened in browse mode (no URL given). */
const BROWSE_START = "https://www.google.com/search?q=recipes";

// ─── Recipe extractor injected into the live page ────────────────────────────
const EXTRACTOR_JS = `
(function() {
  function extractImage(img) {
    if (!img) return undefined;
    if (typeof img === 'string') return img;
    if (Array.isArray(img)) return extractImage(img[0]);
    return img.url || img['@id'];
  }
  function normalizeSteps(val) {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val.map(function(s) {
        if (typeof s === 'string') return s;
        if (s['@type'] === 'HowToStep') return s.text || '';
        if (s['@type'] === 'HowToSection')
          return (s.itemListElement||[]).map(function(i){return i.text||'';}).join(' ');
        return s.text || '';
      }).filter(Boolean);
    }
    if (typeof val === 'string') return val.split('\\n').filter(Boolean);
    return [];
  }
  function normalizeArray(val) {
    if (!val) return [];
    if (Array.isArray(val))
      return val.map(function(v){return typeof v==='string'?v:(v.text||v.name||'');});
    if (typeof val === 'string') return val.split('\\n').filter(Boolean);
    return [];
  }
  function parseDuration(iso) {
    if (!iso) return undefined;
    var d=parseInt((iso.match(/(\\d+)D/)||[])[1]||'0');
    var h=parseInt((iso.match(/(\\d+)H/)||[])[1]||'0');
    var m=parseInt((iso.match(/(\\d+)M/)||[])[1]||'0');
    var t=d*1440+h*60+m; return t>0?t:undefined;
  }

  // 1. JSON-LD — most reliable
  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (var i=0;i<scripts.length;i++) {
    try {
      var data=JSON.parse(scripts[i].textContent);
      var nodes=Array.isArray(data)?data:[data];
      var flat=[];
      nodes.forEach(function(n){
        if(n&&n['@graph'])flat=flat.concat(n['@graph']);else flat.push(n);
      });
      for (var j=0;j<flat.length;j++) {
        var node=flat[j];
        if (node&&node['@type']==='Recipe') {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            parseMethod:'json-ld',
            title:node.name||'',
            description:node.description||'',
            ingredients:normalizeArray(node.recipeIngredient),
            steps:normalizeSteps(node.recipeInstructions),
            imageUrl:extractImage(node.image),
            prepTime:parseDuration(node.prepTime),
            cookTime:parseDuration(node.cookTime),
            servings:parseInt(Array.isArray(node.recipeYield)?node.recipeYield[0]:node.recipeYield)||undefined,
          }));
          return;
        }
      }
    } catch(e){}
  }

  // 2. DOM scrape — broad selectors covering many recipe plugins
  function textOf(el){return el?el.innerText.trim():'';}
  function scrapeList(sels) {
    for (var s=0;s<sels.length;s++) {
      var items=document.querySelectorAll(sels[s]);
      if (items.length>1){
        var r=[];
        items.forEach(function(el){var t=textOf(el);if(t)r.push(t);});
        if(r.length>1)return r;
      }
    }
    return [];
  }
  var ingredients = scrapeList([
    '[class*="ingredient"] li','[class*="ingredient-item"]',
    '[itemprop="recipeIngredient"]','.wprm-recipe-ingredient',
    '.tasty-recipes-ingredients li','.easyrecipe .ingredient',
    '[class*="Ingredient"] li','[class*="ingredient"]','[class*="recipe"] li',
  ]);
  var steps = scrapeList([
    '[class*="instruction"] li','[class*="step"] li',
    '[itemprop="recipeInstructions"] li','.wprm-recipe-instruction-text',
    '.tasty-recipes-instructions li','.easyrecipe .instruction',
    '[class*="Step"] li','[class*="direction"] li',
    '[class*="instruction"]','[class*="preparation"] li','[class*="method"] li',
  ]);

  // 3. Hebrew proximity fallback
  function hebrewProximitySearch(headingTexts) {
    var headings = document.querySelectorAll('h1,h2,h3,h4,h5,strong,b,span,p');
    for (var i=0;i<headings.length;i++) {
      var el=headings[i], txt=el.innerText||'';
      if (!headingTexts.some(function(h){return txt.indexOf(h)!==-1;})) continue;
      var sib=el.parentElement?el.parentElement.nextElementSibling:el.nextElementSibling;
      for (var a=0;a<5&&sib;a++) {
        var lis=sib.querySelectorAll('li');
        if (lis.length>1){
          var items=[];
          lis.forEach(function(li){var t=li.innerText.trim();if(t)items.push(t);});
          if(items.length>1)return items;
        }
        sib=sib.nextElementSibling;
      }
    }
    return [];
  }
  if (ingredients.length===0)
    ingredients=hebrewProximitySearch(['מרכיבים','רכיבים','ingredients']);
  if (steps.length===0)
    steps=hebrewProximitySearch(['אופן הכנה','הכנה','הוראות','שלבים','instructions','directions']);

  var h1=document.querySelector('h1');
  var title=h1?h1.innerText.trim():document.title.split('|')[0].trim();
  var ogImage=document.querySelector('meta[property="og:image"]');
  var imageUrl=ogImage?ogImage.getAttribute('content'):undefined;

  window.ReactNativeWebView.postMessage(JSON.stringify({
    parseMethod:'scrape', title:title,
    ingredients:ingredients, steps:steps, imageUrl:imageUrl,
  }));
})();
true;
`;

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  /** Pre-load this URL. If omitted the browser opens a recipe search page. */
  initialUrl?: string;
  /** Called with the full extracted recipe including sourceUrl / sourceName. */
  onResult: (recipe: ImportedRecipe) => void;
  onCancel: () => void;
  isHe: boolean;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function WebViewImporter({ initialUrl, onResult, onCancel, isHe }: Props) {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);

  type Phase = "loading" | "browsing" | "extracting";
  const [phase, setPhase] = useState<Phase>("loading");
  const [currentUrl, setCurrentUrl] = useState(initialUrl ?? BROWSE_START);
  const [addressText, setAddressText] = useState(initialUrl ?? BROWSE_START);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Subtle pulse on the import button to draw attention
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase !== "browsing") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.035, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulseAnim]);

  // ── Navigation helpers ────────────────────────────────────────────────────

  function navigateTo(raw: string) {
    let url = raw.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      // looks like a bare domain?
      if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(url)) {
        url = "https://" + url;
      } else {
        url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }
    setCurrentUrl(url);
    setAddressText(url);
    setPhase("loading");
    // Use injectJavaScript to navigate (more reliable than changing source prop)
    webviewRef.current?.injectJavaScript(
      `window.location.href = '${url.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'; true;`,
    );
  }

  const onNavigationStateChange = useCallback(
    (nav: WebViewNavigation) => {
      if (nav.url && nav.url !== "about:blank") {
        setCurrentUrl(nav.url);
        if (!isEditingAddress) setAddressText(nav.url);
      }
      setCanGoBack(nav.canGoBack ?? false);
      setCanGoForward(nav.canGoForward ?? false);
      if (nav.loading) setPhase("loading");
    },
    [isEditingAddress],
  );

  const onLoadEnd = useCallback(() => {
    setPhase("browsing");
  }, []);

  // ── Extraction ────────────────────────────────────────────────────────────

  function handleImport() {
    if (phase === "extracting") return;
    setPhase("extracting");
    webviewRef.current?.injectJavaScript(EXTRACTOR_JS);
  }

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        let domain = currentUrl;
        try { domain = new URL(currentUrl).hostname.replace("www.", ""); } catch {}
        onResult({ ...data, sourceUrl: currentUrl, sourceName: domain } as ImportedRecipe);
      } catch {}
    },
    [currentUrl, onResult],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={[s.root, { paddingTop: insets.top }]}>

        {/* ── Header ── */}
        <View style={s.header}>
          {/* Close */}
          <TouchableOpacity
            onPress={onCancel}
            style={s.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={Colors.text.primary} />
          </TouchableOpacity>

          {/* Address bar */}
          <View style={s.addressBar}>
            <Ionicons
              name={phase === "loading" ? "reload-outline" : "globe-outline"}
              size={13}
              color={Colors.text.tertiary}
              style={{ marginRight: 5 }}
            />
            <TextInput
              style={s.addressInput}
              value={addressText}
              onChangeText={setAddressText}
              onFocus={() => setIsEditingAddress(true)}
              onBlur={() => {
                setIsEditingAddress(false);
                setAddressText(currentUrl);
              }}
              onSubmitEditing={() => {
                setIsEditingAddress(false);
                navigateTo(addressText);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
              placeholder={isHe ? "חיפוש או כתובת אתר..." : "Search or enter URL..."}
              placeholderTextColor={Colors.text.tertiary}
              numberOfLines={1}
            />
            {phase === "loading" && (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 4 }} />
            )}
          </View>

          {/* Back */}
          <TouchableOpacity
            onPress={() => webviewRef.current?.goBack()}
            disabled={!canGoBack}
            style={[s.iconBtn, { opacity: canGoBack ? 1 : 0.25 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={Colors.text.primary} />
          </TouchableOpacity>

          {/* Forward */}
          <TouchableOpacity
            onPress={() => webviewRef.current?.goForward()}
            disabled={!canGoForward}
            style={[s.iconBtn, { opacity: canGoForward ? 1 : 0.25 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-forward" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* ── WebView ── */}
        <WebView
          ref={webviewRef}
          source={{ uri: initialUrl ?? BROWSE_START }}
          style={s.webview}
          onLoadEnd={onLoadEnd}
          onNavigationStateChange={onNavigationStateChange}
          onMessage={onMessage}
          onError={() => setPhase("browsing")}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
        />

        {/* ── Floating Import Button ── */}
        <View style={[s.importWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Animated.View
            style={phase === "browsing" ? { transform: [{ scale: pulseAnim }] } : undefined}
          >
            <TouchableOpacity
              style={[s.importBtn, phase === "loading" && s.importBtnDim]}
              onPress={handleImport}
              disabled={phase !== "browsing"}
              activeOpacity={0.82}
            >
              {phase === "extracting" ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={s.importBtnText}>
                    {isHe ? "מחלץ מתכון..." : "Extracting recipe..."}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={s.importIcon}>📥</Text>
                  <Text style={s.importBtnText}>
                    {isHe ? "ייבא מתכון מדף זה" : "Import recipe from this page"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  // Header
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  addressBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    paddingHorizontal: 8,
  },
  addressInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    padding: 0,
    height: 36,
  },
  webview: {
    flex: 1,
  },
  // Floating import button
  importWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 20,
    pointerEvents: "box-none",
  },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  importBtnDim: {
    opacity: 0.5,
  },
  importIcon: {
    fontSize: 18,
  },
  importBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
});
