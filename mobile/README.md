# Aurevia — coquille mobile (Expo)

Une coquille native autour du site existant (`https://aurevia-smoky.vercel.app`),
via `react-native-webview` : même code, même déploiement Vercel, juste empaquetée
par Expo/EAS pour produire un vrai fichier installable sur Android et iOS.

## Développement

```bash
npm install
npx expo start
```

Scanner le QR code avec l'app **Expo Go** (Android/iOS) pour prévisualiser sans
build. `App.tsx` est le seul écran : une WebView plein écran pointant vers
`SITE_URL`, avec gestion du bouton retour Android et un indicateur de
chargement.

## Obtenir un lien de téléchargement (EAS Build)

Nécessite un compte Expo (gratuit) et, pour iOS, un compte **Apple Developer
Program** (99 $/an) — sans lui, aucun moyen d'installer sur un iPhone physique,
store ou pas.

```bash
npx eas-cli@latest login          # ou EXPO_TOKEN en variable d'environnement
npx eas-cli@latest build --platform android --profile preview   # → lien .apk direct
npx eas-cli@latest build --platform ios --profile preview        # → build interne, lié au compte Apple
```

- **Android (`preview`)** : produit un `.apk` téléchargeable directement depuis
  la page du build sur expo.dev — aucun store, aucune review.
- **iOS (`preview`)** : distribution interne (ad hoc). La première fois, EAS
  demande d'enregistrer l'UDID de chaque iPhone visé (un lien à ouvrir depuis le
  téléphone) et gère la signature via le compte Apple Developer connecté.
- **`production`** : AAB (Android) / build store (iOS), destinés à Play Store
  et App Store — soumission via `eas submit`.

## Identifiants de l'app

- Bundle iOS / package Android : `com.aurevia.app` (à changer si ce nom est déjà pris)
- Icônes et splash : `assets/`, générées à partir du même glyphe que la PWA
  (`aurevia-smoky.vercel.app/manifest.webmanifest`)

## Contrainte connue de cet environnement

Cette session tourne dans un conteneur dont la politique réseau bloque
`api.expo.dev`, `expo.dev` et `reactnative.directory` par défaut. Sans ces
hôtes autorisés, `eas login`/`eas build` ne peuvent pas être lancés depuis
cette session — les commandes ci-dessus sont alors à exécuter depuis une
machine qui y a accès (la tienne, par exemple).
