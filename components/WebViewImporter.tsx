import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import { Colors } from "../constants/colors";
import type { ImportedRecipe } from "../lib/importer";

// Injected after the real recipe page settles.
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
        if (s['@type'] === 'HowToSection') return (s.itemListElement||[]).map(function(i){return i.text||'';}).join(' ');
        return s.text || '';
      }).filter(Boolean);
    }
    if (typeof val === 'string') return val.split('\\n').filter(Boolean);
    return [];
  }
  function normalizeArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(function(v){return typeof v==='string'?v:(v.text||v.name||'');});
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

  // 1. JSON-LD
  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (var i=0;i<scripts.length;i++) {
    try {
      var data=JSON.parse(scripts[i].textContent);
      var nodes=Array.isArray(data)?data:[data];
      var flat=[];
      nodes.forEach(function(n){if(n&&n['@graph'])flat=flat.concat(n['@graph']);else flat.push(n);});
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
          })); return;
        }
      }
    } catch(e){}
  }

  // 2. DOM scrape — broad selectors covering many recipe plugins/themes
  function textOf(el){return el?el.innerText.trim():'';}
  function scrapeList(sels) {
    for (var s=0;s<sels.length;s++) {
      var items=document.querySelectorAll(sels[s]);
      if (items.length>0){
        var r=[];
        items.forEach(function(el){var t=textOf(el);if(t)r.push(t);});
        if(r.length>0)return r;
      }
    }
    return [];
  }

  var ingredients = scrapeList([
    '[class*="ingredient"] li',
    '[class*="ingredient-item"]',
    '[itemprop="recipeIngredient"]',
    '.wprm-recipe-ingredient',
    '.tasty-recipes-ingredients li',
    '.easyrecipe .ingredient',
    '[class*="Ingredient"] li',
    '[class*="ingredient"]',
    '[class*="recipe"] li',
  ]);
  var steps = scrapeList([
    '[class*="instruction"] li',
    '[class*="step"] li',
    '[itemprop="recipeInstructions"] li',
    '.wprm-recipe-instruction-text',
    '.tasty-recipes-instructions li',
    '.easyrecipe .instruction',
    '[class*="Step"] li',
    '[class*="direction"] li',
    '[class*="instruction"]',
    '[class*="preparation"] li',
    '[class*="method"] li',
  ]);

  // Hebrew heading proximity fallback — scan for מרכיבים / אופן הכנה headings
  // then collect the nearest <ul>/<ol> or <p> siblings
  function hebrewProximitySearch(headingTexts) {
    var headings = document.querySelectorAll('h1,h2,h3,h4,h5,strong,b,span,p');
    for (var i=0;i<headings.length;i++) {
      var el = headings[i];
      var txt = el.innerText || '';
      var matched = headingTexts.some(function(h){ return txt.indexOf(h) !== -1; });
      if (!matched) continue;
      // Walk next siblings to find a list
      var sib = el.parentElement ? el.parentElement.nextElementSibling : el.nextElementSibling;
      for (var attempt=0; attempt<5 && sib; attempt++) {
        var lis = sib.querySelectorAll('li');
        if (lis.length > 1) {
          var items = [];
          lis.forEach(function(li){ var t=li.innerText.trim(); if(t) items.push(t); });
          if (items.length > 1) return items;
        }
        // Try <p> tags as items
        var ps = sib.querySelectorAll('p');
        if (ps.length > 1) {
          var items2 = [];
          ps.forEach(function(p){ var t=p.innerText.trim(); if(t&&t.length>2) items2.push(t); });
          if (items2.length > 1) return items2;
        }
        sib = sib.nextElementSibling;
      }
    }
    return [];
  }

  if (ingredients.length === 0) {
    ingredients = hebrewProximitySearch(['מרכיבים','רכיבים','ingredients']);
  }
  if (steps.length === 0) {
    steps = hebrewProximitySearch(['אופן הכנה','הכנה','הוראות','שלבים','instructions','directions']);
  }

  var h1 = document.querySelector('h1');
  var title = h1 ? h1.innerText.trim() : document.title.split('|')[0].trim();
  var ogImage = document.querySelector('meta[property="og:image"]');
  var imageUrl = ogImage ? ogImage.getAttribute('content') : undefined;

  // Debug: dump all classes + all li text so we can tune selectors
  var allLi = Array.from(document.querySelectorAll('li')).slice(0,60)
    .map(function(el){ return el.className+'::'+el.innerText.trim().slice(0,60); }).join(' | ');
  var allClasses = Array.from(document.querySelectorAll('[class]')).slice(0,60)
    .map(function(el){ return el.className; }).join(' ');

  window.ReactNativeWebView.postMessage(JSON.stringify({
    parseMethod:'scrape',
    title:title,
    ingredients:ingredients,
    steps:steps,
    imageUrl:imageUrl,
    _debug_classes: allClasses.slice(0,800),
    _debug_li: allLi.slice(0,800),
  }));
})();
true;
`;

type Props = {
  url: string;
  sourceName: string;
  onResult: (recipe: Omit<ImportedRecipe, "sourceUrl" | "sourceName">) => void;
  onCancel: () => void;
  isHe: boolean;
};

// URLs that indicate we're still on a bot-challenge page, not the real recipe
function isChallengePage(pageUrl: string, targetUrl: string): boolean {
  if (!pageUrl) return true;
  try {
    const page = new URL(pageUrl);
    const target = new URL(targetUrl);
    // Same hostname = probably real page (or challenge on same domain which we accept)
    // Different hostname = definitely a challenge redirect
    if (page.hostname !== target.hostname) return true;
    // Verification endpoint pattern
    if (/\/z0[a-f0-9]{10,}/.test(page.pathname)) return true;
  } catch { /* ignore */ }
  return false;
}

export default function WebViewImporter({ url, sourceName, onResult, onCancel, isHe }: Props) {
  const webviewRef = useRef<WebView>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "extracting">("loading");
  const [pageTitle, setPageTitle] = useState("");
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasExtracted = useRef(false);
  const currentUrl = useRef(url);

  function scheduleExtract() {
    if (hasExtracted.current) return;
    if (loadTimer.current) clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      runExtract();
    }, 3000); // 3s after last onLoadEnd on real page
  }

  function runExtract() {
    if (hasExtracted.current) return;
    hasExtracted.current = true;
    setPhase("extracting");
    webviewRef.current?.injectJavaScript(EXTRACTOR_JS);
  }

  const onNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    currentUrl.current = navState.url || url;
    if (navState.title) setPageTitle(navState.title);
  }, [url]);

  const onLoadEnd = useCallback((e: any) => {
    const loadedUrl: string = e?.nativeEvent?.url ?? currentUrl.current;
    // Ignore challenge/redirect pages — wait for the real page
    if (isChallengePage(loadedUrl, url)) return;
    setPhase("ready");
    scheduleExtract();
  }, [url]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log("[WebViewImporter] extracted:", JSON.stringify(data).slice(0, 300));
      onResult(data);
    } catch { /* ignore */ }
  }, [onResult]);

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <View style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
            <Text style={s.cancelText}>{isHe ? "ביטול" : "Cancel"}</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            {phase === "loading"
              ? (isHe ? "טוען דף..." : "Loading page...")
              : phase === "ready"
              ? (isHe ? "מחכה לתוכן..." : "Waiting for content...")
              : (isHe ? "מחלץ מתכון..." : "Extracting recipe...")}
          </Text>
          {/* Manual extract button — visible once page is ready */}
          {phase === "ready" && (
            <TouchableOpacity style={s.extractBtn} onPress={runExtract}>
              <Text style={s.extractBtnText}>{isHe ? "חלץ" : "Extract"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Extraction spinner overlay */}
        {phase === "extracting" && (
          <View style={s.overlay} pointerEvents="none">
            <View style={s.extractingBadge}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={s.extractingText}>
                {isHe ? "מחלץ מתכון..." : "Extracting recipe..."}
              </Text>
            </View>
          </View>
        )}

        <WebView
          ref={webviewRef}
          source={{ uri: url }}
          style={s.webview}
          onLoadEnd={onLoadEnd}
          onNavigationStateChange={onNavigationStateChange}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
          onError={() => onCancel()}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surfaceElevated,
  },
  cancelBtn: { paddingVertical: 6, paddingRight: 12 },
  cancelText: { fontSize: 15, color: Colors.primary },
  headerTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text.secondary,
    textAlign: "center",
  },
  extractBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  extractBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  webview: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 40,
  },
  extractingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  extractingText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
