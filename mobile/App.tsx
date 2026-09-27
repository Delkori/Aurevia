import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView, type WebViewNavigation } from "react-native-webview";

// Même adresse que le lien envoyé aux prospects et que le manifeste PWA :
// une seule application, un seul déploiement, quel que soit l'écran d'où on y entre.
const SITE_URL = "https://aurevia-smoky.vercel.app";
const BACKGROUND = "#0d0d0f";

// `WebView<P = undefined>` : sous cette version de TypeScript, `WebViewProps & undefined`
// s'effondre en `never` dès qu'on laisse le générique par défaut, ce qui rend le
// composant inutilisable (toutes ses props rejetées). L'instancier explicitement
// avec `{}` évite l'effondrement.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- contournement du bug ci-dessus, pas un vrai type "any valeur"
type TypedWebView = WebView<{}>;

function Aurevia() {
  const webviewRef = useRef<TypedWebView>(null);
  const [loading, setLoading] = useState(true);
  const canGoBack = useRef(false);
  const insets = useSafeAreaInsets();

  // Le bouton retour d'Android doit d'abord reculer dans l'historique du site
  // (galaxie → panneau → paramètres, par exemple) avant de quitter l'app.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack.current) {
        webviewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  const onNavigationStateChange = (nav: WebViewNavigation) => {
    canGoBack.current = nav.canGoBack;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      {/* eslint-disable-next-line @typescript-eslint/no-empty-object-type -- même contournement */}
      <WebView<{}>
        ref={webviewRef}
        source={{ uri: SITE_URL }}
        style={styles.webview}
        onNavigationStateChange={onNavigationStateChange}
        onLoadEnd={() => setLoading(false)}
        pullToRefreshEnabled
        allowsBackForwardNavigationGestures
        sharedCookiesEnabled
        decelerationRate="normal"
        setSupportMultipleWindows={false}
      />
      {loading && (
        <View style={styles.loader} pointerEvents="none">
          <ActivityIndicator size="large" color="#7c6af5" />
        </View>
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Aurevia />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  webview: { flex: 1, backgroundColor: BACKGROUND },
  loader: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", backgroundColor: BACKGROUND },
});
