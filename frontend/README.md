# Smart Solar

Application photovoltaïque interactive, en français, pour iOS, Android et le Web, migrée sous **Expo SDK 58**. Frontend autonome : aucun backend, équipement IoT, modèle IA, clé API ou service payant n’est requis. Le dossier `../iot/` n’a pas été modifié.

## Démarrage et utilisation

Node.js 22.13+ recommandé (développement vérifié sous Node 24.13). Depuis PowerShell :

```powershell
cd D:\downloads\Kizuna_Hackaton\frontend
npm install
```

### 1. Démarrage complet (IA Backend U-Net + Expo Go)

Depuis la racine du projet `D:\downloads\Kizuna_Hackaton` :

```powershell
.\start_all.bat
```

Ou manuellement dans deux terminaux :

```powershell
# Terminal 1 — Backend FastAPI IA U-Net (Port 8003) :
cd D:\downloads\Kizuna_Hackaton\backend
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8003

# Terminal 2 — Frontend Expo Go SDK 58 (Port 8081) :
cd D:\downloads\Kizuna_Hackaton\frontend
npm run ios:go
```

### 2. Lancement natif sur iPhone (Expo Go SDK 58)

Le script dédié détecte automatiquement l'interface Wi-Fi réelle (`Wi-Fi 2`, `172.17.12.112`) en ignorant les cartes virtuelles (VMware, WSL, VirtualBox) :

```powershell
npm run ios:go
```

Pour vider le cache Metro au démarrage :
```powershell
npm run ios:go -- -c
```

- **Sur iPhone** : Ouvrez l'application **Appareil photo** d'iOS et scannez le QR code affiché dans le terminal ou dans `assets/expo-qr.html`, puis touchez « Ouvrir dans Expo Go ».
- **Ouverture directe** : Si le QR code n'apparaît pas ou si vous préférez le lien direct, entrez l'URL suivante dans Safari sur votre iPhone : `exp://172.17.12.112:8081`.
- **Solution de secours (Tunnel)** : Si votre Wi-Fi isole les appareils (AP Isolation) ou en cas de restriction de pare-feu :
  ```powershell
  npm run ios:tunnel
  ```

### 2. Version Web

```powershell
npm run web
```

### 3. Emulateur ou appareil Android

```powershell
npm run android
```

## Stack technique migrée (Expo SDK 58)

- **Expo** : ~58.0.26
- **React** : 19.3.0
- **React Native** : 0.88.1
- **Expo Router** : ~58.0.32
- **React Native Reanimated** : 4.7.1
- **React Native Worklets** : 0.13.0
- **React Native SVG** : 15.16.0
- **React Native Gesture Handler** : ~3.3.0
- **React Native Safe Area Context** : ~5.11.1
- **React Native Screens** : ~4.30.1
- **TypeScript** : ~6.0.3 (mode strict, avec typages d'instances React Native `ViewInstance`, `PressableInstance`, `ScrollViewInstance`)
- **Three.js / React Three Fiber** : rendu 3D WebGL fluide sur Web, avec scène isométrique vectorielle SVG animée Reanimated native (`SolarScene.native.tsx`) sur iOS et Android pour une fluidité absolue dans Expo Go sans dépendance GL lourde.

## Export Web et aperçu de production

```powershell
npm run build:web
node scripts/preview.cjs
```

Ouvrir `http://127.0.0.1:8081`. L’hébergement statique redirige les routes inconnues vers `index.html` (Expo Router SPA).

## APK Android

`eas.json` contient les profils de build nécessaires pour Android :

```powershell
# Génération locale d'un APK sans frais EAS cloud (nécessite Android SDK localement) :
npm run build:apk

# Ou via le cloud EAS (selon vos identifiants Expo) :
npx eas-cli build --platform android --profile preview
```

Configuration Android :
- Package : `tn.smartsolar.demo`
- Permissions : `CAMERA` (définie dans `app.json`)
- Icône adaptative et écran de démarrage configurés sur fond Midnight Sky `#17212E`.

## Identité Visuelle — Solar Design V2

L'application a été entièrement sublimée avec une direction artistique haut de gamme inspirée de l'énergie solaire, d'Apple Home, de Tesla Energy et des rendus architecturaux contemporains :

- **Palette Solaire Premium** :
  - *Solar Gold* (`#FFB800`) & *Sunset Orange* (`#FF8A00`) en accents énergétiques et dégradés lumineux
  - *Amber Light* (`#FFE29A`) en bordures subtiles et lueurs chaleureuses
  - *Warm White* (`#FFF9ED`) & *Pure White* (`#FFFFFF`) pour les surfaces claires et respirantes
  - *Midnight Sky* (`#17212E`) pour les cartes d'immersion nocturne et la typographie principale
  - *Secondary Text* (`#64748B`) pour une hiérarchie typographique élégante
  - *Emerald Green* (`#10B981`) réservé exclusivement aux gains écologiques et aux validations
- **Maison Solaire 3D (Signature visuelle)** :
  - *Web (Three.js)* : Lumière solaire dorée rasante, ombres douces, enduits architecturaux chauds (`#FAF6EE`), panneaux monocristallins bleu nuit/noirs aux reflets solaires, particules énergétiques dorées.
  - *Mobile Native (SVG Isométrique animé)* : Perspective isométrique sur dalle méditerranéenne ensoleillée (`#FFF5DC`), façades épurées, panneaux photovoltaïques texturés avec contacts cyan et reflets dorés, flux d'énergie Reanimated.
- **Dashboard & Bottom Navigation** :
  - Scène solaire immersive avec alternance jour/nuit (lever de soleil doré / ciel de minuit étoilé).
  - Barre de navigation mobile translucide façon verre dépoli avec indicateur flottant doré pour l'onglet actif.
  - Graphiques de production aux courbes dorées et zones dégradées solaires.
  - Zéro régression : 100 % de la logique métier, du store Zustand et des calculs préservés.

## Validation et tests

Toutes les vérifications officielles ont été exécutées et validées :

```powershell
# Script officiel de validation SDK 58 :
node scripts/verify-sdk.cjs sdk58

# Contrôles individuels :
npm run typecheck      # 0 erreur TypeScript strict
npm test               # 4/4 tests unitaires validés
npx expo-doctor        # 20/20 vérifications réussies
npm run build:web      # Export Web réussi dans dist/
```

## Parcours disponibles

| Route | Fonctionnalités |
| --- | --- |
| `/` | Landing responsive, maison 3D, parcours, présentation mobile, FAQ |
| `/onboarding` | Trois étapes, retour et accès direct à la démo |
| `/dashboard` | Digital Twin, jour/nuit, sélection des équipements, flux, métriques, graphiques jour/semaine |
| `/analyse` | Import local PDF/image, caméra native, aperçu, préparation du document, saisie/validation manuelle, facture démo |
| `/dimensionnement` | Consommation, localisation, surface, puissance des modules, toiture, résultat local |
| `/studio` | Solar Design Studio : Recommandation IA U-Net, contours vectoriels, calepinage géométrique, conception manuelle interactive, bibliothèque de modules, conseiller IA |
| `/rapport` | Rapport officiel d'installation photovoltaïque : récapitulatif énergétique, toiture, spécifications matériel, rentabilité en Dinars Tunisiens et recommandations techniques |
| `/rentabilite` | Investissement, économies, retour simple, projection 25 ans, comparaison, curseurs d’hypothèses |
| `/profil`, `/parametres` | Prénom, projet, préférences persistées, réduction des animations |

Sur grand écran : sidebar. Sur mobile : cinq onglets et accès aux sous-modules d’installation. Chaque action possède un comportement défini. Les boutons plus/moins permettent aussi de régler les valeurs sans glisser les curseurs.

## Digital Twin et assets

- Web : Three.js / React Three Fiber, géométries procédurales, ombres, matériaux, flux particulaires, rotation et zoom bornés.
- Chargement différé du renderer ; pause hors écran/onglet et en arrière-plan ; préférences de réduction des animations.
- Android : maison isométrique SVG originale, flux animé Reanimated et sélection par boutons. Pas de dépendance à Expo GL ni de modèle lourd pour la scène native.
- Repli SVG en cas d’échec WebGL ou de perte de contexte.
- Logo et icône originaux dans `assets/`, reproductibles avec `node scripts/create-assets.cjs`. Maison, panneaux, végétation et toiture sont construits localement par le code. Aucune image distante ou ressource commerciale.
- Les polices/icônes éventuellement embarquées par Expo restent sous leurs licences de dépendances ; le code visuel du projet utilise Lucide.

## Hypothèses et limites

Les mesures du dashboard et la météo sont des exemples fixes. Le jour/nuit simule un scénario, pas l’état d’une installation. La maison montre 12 panneaux illustratifs ; elle n’est pas une maquette géométrique générée à partir du dimensionnement ou du studio.

Le dimensionnement calcule `ceil(consommation annuelle / 1650 / puissance kWc)`, plafonné par `floor(surface / 2,2)`. Localisation et type de toiture sont conservés mais n’influencent pas encore l’irradiation, l’ombrage ou l’orientation. Les panneaux du studio sont un plan indépendant, sans échelle réelle, collisions ou contraintes structurelles ; la zone est un repère visuel, pas un masque automatique.

La rentabilité utilise 1 650 kWh/kWc/an, un tarif modifiable fictif, un coût au kWc modifiable, 0,5 %/an de dégradation et 1 %/an de maintenance. L’économie est plafonnée à la consommation annuelle. Pas d’aides, de financement, de taxes, de revenus de surplus ou de remplacement de batterie. Le résultat n’est pas un devis ni un tarif STEG officiel. Le CO₂ repose sur une hypothèse pédagogique de 0,45 kg/kWh.

Les PDF sont intégrés dans un aperçu Web ; Android les ouvre dans un lecteur local avec permission temporaire de lecture. Un lecteur PDF doit être installé. L’aperçu d’image est intégré aux deux plateformes. Les fichiers sélectionnés restent locaux et temporaires : certaines URI peuvent expirer après fermeture/nettoyage du cache. L’import d’une photo ne déclenche aucune détection ou diagnostic. Le mode démo de facture préremplit des valeurs, sans prétendre extraire un document.

La réduction des animations respecte la préférence système et le réglage de l’app. La performance sur téléphone de milieu de gamme et la caméra native doivent encore être mesurées sur appareil. Le changement d’ambiance ne constitue pas une simulation solaire physique ; l’onboarding réemploie la maison procédurale avec une ambiance nocturne à la dernière étape.

## Architecture

```text
app/          Routes Expo Router
components/   Design system, graphiques, imports, layout, studio
features/     Écrans métier
scenes/       Renderer Web différé et repli isométrique natif
assets/       Logo et icône originaux
theme/        Couleurs, espacements, rayons, ombres, durées
hooks/        Accessibilité, animation et hydratation locale
store/        Zustand + persistance AsyncStorage
services/     Contrats futurs, sans implémentation réseau
mocks/        Séries énergétiques de démonstration
types/        Contrats de données du frontend
utils/        Calculs locaux testables
tests/        Tests unitaires des hypothèses de calcul
scripts/      Génération d’assets et aperçu statique local
```

## Contrôles et intégrations futures

```powershell
npm run typecheck
npm test
npx expo-doctor
npm run build:web
npx expo export --platform android --output-dir dist-android
```

Voir `TEST-REPORT.md` pour les résultats réellement observés et les limites. Voir `audit-report.json` pour les alertes de dépendances ; une migration coordonnée du SDK et un nouvel audit sont nécessaires avant une mise en production. Ne pas appliquer `npm audit fix --force` aveuglément : il remplace des composants Expo par une autre génération.

À connecter ultérieurement via `services/contracts.ts` : OCR avec validation humaine, calcul d’irradiation et dimensionnement professionnel, segmentation de toiture et calibration d’échelle, télémétrie IoT, historique réel, diagnostic d’images avec revue humaine, authentification et stockage sécurisé. Aucune de ces intégrations n’est activée dans cette livraison.
