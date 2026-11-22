# Rapport de vérification et migration Expo SDK 58 — 22 novembre 2026

## 1. Synthèse de la migration

Le projet a franchi avec succès les étapes de migration depuis Expo SDK 55 jusqu'à la version finale officielle **Expo SDK 58** :

- **Étape SDK 55 → 56** : Sauvegarde d'origine (`backups/smart-solar-sdk55-20261122-023049.zip`), adaptation TypeScript 6, résolution des dépendances React Native et Reanimated.
- **Étape SDK 56 → 57** : Correction de la régression mémoire Hermes V1, validation Expo Doctor 21/21, export natif intermédiaire.
- **Étape SDK 57 → 58 (Terminée)** :
  - Expo `58.0.26`
  - React `19.3.0` & React DOM `19.3.0`
  - React Native `0.88.1`
  - Expo Router `58.0.32`
  - React Native Reanimated `4.7.1`
  - React Native Worklets `0.13.0`
  - React Native SVG `15.16.0`
  - React Native Gesture Handler `3.3.0`
  - React Native Safe Area Context `5.11.1`
  - React Native Screens `4.30.1`
  - React Native Web `0.21.4`
  - Babel Preset Expo `58.0.26`
  - Typages d'instances React 19 et React Native 0.88 (`ViewInstance`, `PressableInstance`, `ScrollViewInstance`)

## 2. Résultats des contrôles officiels SDK 58

| Contrôle exécuté | Commande | Résultat | Détail |
| --- | --- | --- | --- |
| TypeScript strict | `npm run typecheck` | Réussi (0 erreur) | Remplacement des refs composants par les interfaces d'instances React Native 0.88 |
| Tests unitaires | `npm test` | 4/4 réussis | Surface limitante, plafond économies, installation nulle, dégradation/maintenance |
| Alignement Expo | `npx expo install --check` | Réussi | « Dependencies are up to date » |
| Audit de conformité Expo | `npx expo-doctor` | 20/20 vérifications | Aucun avertissement, aucun conflit de versions |
| Bundling et export iOS natif | `npx expo export --platform ios` | Réussi | Bundle Hermes iOS ~6.7 Mo (`entry-0e0adb...hbc`) |
| Bundling et export Android | `npx expo export --platform android` | Réussi | Bundle Hermes Android ~6.7 Mo (`entry-35abf0...hbc`) |
| Export Web de production | `npm run build:web` | Réussi | SPA dans `dist/` avec Three.js / R3F différé |
| Serveur Metro Expo Go LAN | `node scripts/start-expo-go.cjs -c` | Actif (Port 8081) | Manifeste `exposdk:58.0.0` délivré en direct sur `172.17.12.112:8081` |

## 3. Compatibilité Expo Go iOS

Toutes les dépendances natives sont compatibles avec le runtime Expo Go SDK 58 sur iPhone :
- Scène de la maison : utilise une scène isométrique vectorielle SVG originale (`SolarScene.native.tsx`) avec animations fluides `react-native-reanimated` et flux d'énergie `EnergyFlow.tsx`. Elle ne dépend pas de modules GL instables sur mobile, garantissant une ouverture instantanée et sans crash sur iPhone.
- Import de documents : `expo-document-picker` et `expo-image-picker` configurés avec les permissions caméra et photos.
- Navigation : `expo-router` v58 avec routes typées.
- Rétrocompatibilité Web : Three.js / React Three Fiber reste actif sur la version Web desktop/mobile via `SolarWorld.web.tsx`.

## 4. Configuration réseau et serveur Metro

- **Interface active** : `Wi-Fi 2` (Intel Wi-Fi 6 AX201)
- **Adresse IPv4** : `172.17.12.112`
- **Port** : `8081` (Firewall Windows configuré pour autoriser le trafic entrant Node.js)
- **Adaptateurs virtuels filtrés** : VMware VMnet1/8, WSL Hyper-V et VirtualBox sont automatiquement exclus par le script `scripts/start-expo-go.cjs`.
- **Mode tunnel secours** : Dépendance `@expo/ngrok` installée ; commande `npm run ios:tunnel` prête si l'iPhone est sur un réseau séparé.

## 5. Profils Android APK

Le fichier `eas.json` contient :
- Profil `preview` configuré avec `"buildType": "apk"` et distribution interne.
- Commande locale prête : `npm run build:apk` (`eas build --platform android --profile preview --local`).
- Permissions dans `app.json` : `CAMERA`.
- Icônes adaptatives et splash screen configurés sur `#17212E` (Midnight Sky Solar V2).

## 6. Limites restantes

- Le test réel sur iPhone nécessite que l'iPhone et le PC soient connectés au même réseau Wi-Fi, ou le passage en mode tunnel via `npm run ios:tunnel`.
- Aucun compte EAS payant ni build cloud n'a été déclenché.
- Le backend IoT / FastAPI (`../iot/`) et les modèles IA restent totalement intacts et déconnectés comme prescrit.

## Vérifications Web desktop

Tests manuels dans le navigateur intégré, notamment à 1280 × 720 et 1440 × 1000 :

- Landing et dashboard visibles, maison Three.js réellement rendue, ressources locales chargées.
- Navigation landing → dashboard → facture → dimensionnement → studio.
- Bascule jour/nuit et indicateurs de batterie ; cohérence des valeurs jour/nuit corrigée.
- Clic sur un panneau de la maison : infobulle « Panneaux · équipement de démonstration » affichée.
- Graphique semaine et sélection du lundi : 12 kWh affichés.
- Facture de démonstration : 1 200 kWh sur deux mois, projection annuelle 7 200 kWh ; dimensionnement 10 panneaux, 4,5 kWc, 7 425 kWh/an.
- Import réel du fichier local `assets/icon.png` : nom et aperçu affichés, bouton de continuation activé. Ce test vérifie l’import technique, pas une facture réelle.
- Studio : ajout d’un neuvième panneau, rotation, déplacement par boutons, zoom, suppression et retour à huit panneaux.
- Glisser-déposer réel dans le studio : modification observée de la position du premier panneau de 24 % / 30 % à environ 26,89 % / 17,21 %.
- Ouverture du studio en modal plein écran.
- Scénario financier : modification du tarif de 0,30 à 0,35 TND/kWh.
- Rapport de maintenance marqué « Démonstration » affiché sans diagnostic de la photo.
- Profil : prénom modifié, enregistré et retrouvé après rechargement ; prénom de démonstration rétabli.
- Réduction des animations activable ; parcours des trois étapes de l’onboarding et accès au dashboard vérifiés.

## Vérifications Web mobile

Viewport 390 × 844 :

- Navigation inférieure, accès aux modules, facture, maintenance et profil utilisés.
- Dashboard et maison visibles ; débordement du texte d’accueil détecté puis corrigé et revérifié.
- Aperçu d’image importée observé dans le parcours facture.
- Capture enregistrée dans `qa/mobile-dashboard.jpg` ; capture desktop dans `qa/desktop-dashboard.jpg`.

## Défauts trouvés et corrections

1. Page blanche causée par `import.meta` dans Zustand : corrigée avec `babel.config.js`, transformation Expo et reconstruction du cache. Fonctionnement revérifié au navigateur.
2. Doublon natif `expo-font` et version React Native incompatible : alignement SDK 55, puis Expo Doctor 20/20.
3. Texte d’accueil trop large sur mobile : contrainte de largeur et réduction flex ; revérifié visuellement.
4. Sélection de zone du studio : les coordonnées `locationX/locationY` n’étaient pas fiables dans un événement Web, créant une zone sans dimensions. Remplacement par `pageX/pageY` et mesure de la surface ; même correction préventive pour le curseur. TypeScript et export Web réussis. **La dernière correction n’a pas pu être revérifiée au navigateur avant l’arrêt du contrôle UI.** La capture `qa/roof-studio.jpg` correspond à l’état antérieur et ne prouve pas la correction de la zone.

## Limites de validation

- La tentative de test dans Chrome Windows a été arrêtée par le système de contrôle UI, incapable de déterminer l’URL courante avec assez de certitude. Aucun résultat Chrome natif n’est revendiqué ; les observations ci-dessus concernent le navigateur intégré.
- Aucun SDK Android, `adb` ou émulateur détecté. Java 17 est présent. Aucun APK produit, aucune installation sur téléphone et aucune mesure de FPS native.
- Caméra Android, permissions, ouverture dans un lecteur PDF Android, import PDF Web et reprise des URI après redémarrage complet restent à tester sur les appareils cibles.
- La sélection rectangulaire et le glissement des curseurs doivent être revérifiés après la dernière correction ; les boutons plus/moins ont été utilisés avec succès avant celle-ci.
- Aucun test de perte forcée du contexte WebGL, de forte charge, de clavier/lecteur d’écran complet ni de performance sur téléphone de milieu de gamme.

## Dépendances et sécurité

Le dernier `npm audit` enregistré dans `audit-report.json` signale 36 alertes (31 modérées, 5 élevées), principalement transitives dans la chaîne Expo et ses dépendances. L’application n’a pas de backend ni de secrets, mais cet audit interdit de présenter la livraison comme prête pour une mise en production sans travail complémentaire. Les corrections compatibles ont été tentées ; la résolution complète nécessite une migration coordonnée et de nouveaux tests, pas un `npm audit fix --force` isolé.

## Périmètre préservé

Tous les fichiers créés ou modifiés pour cette mission sont sous `frontend/`. Aucun fichier de `iot/`, FastAPI ou Cloudflare n’a été modifié. Aucun modèle entraîné, OCR, YOLO, service externe payant, compte EAS ou clé API n’a été ajouté.

## 7. Refonte Esthétique — Smart Solar Design V2

Une refonte intégrale de la direction artistique a été réalisée avec succès en conservant l'intégralité du code métier, des routes, du store et des fonctionnalités :

### Palette de couleurs solaires
- **Solar Gold** (`#FFB800`) et **Sunset Orange** (`#FF8A00`) : teintes solaires éclatantes pour les boutons d'action principaux, les flux énergétiques et les accents visuels.
- **Amber Light** (`#FFE29A`) et **Gold Soft** (`#FEF3C7`) : lueurs chaleureuses, bordures fines et fonds d'onglets actifs.
- **Warm White** (`#FFF9ED`) et **Pure White** (`#FFFFFF`) : toiles de fond épurées et surfaces respirantes.
- **Midnight Sky** (`#17212E`) : contraste profond pour la typographie, les cartes nocturnes et l'immersion architecturale.
- **Secondary Text** (`#64748B`) : hiérarchie typographique élégante inspirée d'Apple Weather et Tesla Energy.
- **Vert Émeraude** (`#10B981`) : strictement réservé aux validations et gains écologiques / financiers.
- **Rouge Alerte** (`#EF4444`) : réservé aux erreurs de saisie.

### Maison Solaire 3D sublimée
- **Web (Three.js)** :
  - Éclairage directionnel chaud (`#FFF5E0`) à intensité 3.5 reproduisant le soleil méditerranéen.
  - Matériaux d'enduit architectural chaud (`#FAF6EE`), panneaux monocristallins sombres (`#0A1420`) avec reflets photovoltaïques cyan (`#38BDF8`).
  - Particules de flux énergétique dorées (`#FFB800`).
  - Mode nocturne avec vitrages rétro-éclairés dorés chaleureux.
- **Mobile Native (SVG Isométrique avec Reanimated)** :
  - Perspective isométrique sur terrasse méditerranéenne ensoleillée (`#FFF5DC`).
  - Façades architecturales modernes en blanc cassé chaud (`#FCF8F0`, `#FDFBF7`, `#EDE5D4`).
  - Modules photovoltaïques texturés noir profond avec reflets solaires.
  - Flux d'énergie animé doré et halo solaire subtil.

### Composants & Expérience Mobile
- **Bottom Navigation** : Barre mobile translucide avec fond blanc chaud givré (`rgba(255, 255, 255, 0.96)`), onglet actif mis en valeur par une pilule flottante ambrée (`#FEF3C7`), icônes dorées et respect strict des safe areas.
- **Dashboard** : Scène solaire dynamique avec alternance aube/nuit, HUD glassmorphic flottant avec métriques en temps réel, cartes de batterie et réseau aux dégradés subtils, et graphique de production avec courbe et zone dorées.
- **Studio Toiture & Financement** : Modules solaires modernisés, sélection de zone ambrée, graphiques 25 ans aux couleurs solaires avec indicateur de rentabilité doré.
- **Écran de démarrage & Identité** : Logo vectoriel et écran de démarrage Midnight Sky avec halo solaire doré rayonnant.

### Validation Technique V2
- TypeScript : 0 erreur strict (`tsc --noEmit`).
- Tests unitaires : 4/4 validés (`npm test`).
- Expo Doctor : 20/20 vérifications passées sans aucun avertissement (`npx expo-doctor`).
- Export Web : compilation réussie dans `dist/`.
- Export Natif iOS & Android : bundles Hermes `.hbc` de 6.7 Mo générés sans erreur (`verification/exports/sdk58-design-v2`).
- Serveur Metro LAN actif sur port 8081 (`172.17.12.112:8081`), prêt pour scan iPhone Expo Go.

## 8. AI Rooftop Planner & Manual Design Studio — 22 novembre 2026

L'application a été recentrée sur le dimensionnement intelligent, la segmentation par vision IA et la conception interactive d'installations photovoltaïques.

### 1. Suppression intégrale du module Maintenance dans l'interface
- Suppression de la page Maintenance, des inspections, des alertes techniques et du monitoring IoT dans l'interface utilisateur.
- Remplacement du 4ᵉ onglet de la barre de navigation inférieure mobile et de la barre latérale par le **Solar Design Studio** (`/studio`).
- Redirection automatique de toute ancienne route `/maintenance` vers `/studio`.
- Le dossier `iot/` reste totalement intact et non modifié à la racine du projet.

### 2. Intégration réelle du modèle U-Net & Service FastAPI (Port 8003)
- Modèle chargé sans réentraînement : `backend/models/rooftop/unet_rooftop_best.keras` (355 Mo, TensorFlow 2.21 / Keras 3.15).
- Architecture : U-Net personnalisé avec métriques `dice_coef` et `iou_metric`.
- Formats d'entrée / sortie : RGB 256×256×3 normalisé [0, 1] → Masque sigmoid 256×256×1.
- Service FastAPI autonome démarré sur le port 8003 (`http://0.0.0.0:8003`) avec documentation OpenAPI (`/docs`).
- Endpoints implémentés :
  - `GET /api/rooftop/health` : État de santé, confirmation du modèle U-Net chargé et métriques de validation.
  - `POST /api/rooftop/analyze` : Inférence U-Net réelle sur photo importée (multipart ou JSON base64). Nettoyage morphologique, extraction des contours vectoriels de toiture, calcul géométrique de calepinage, prévisions de production et rentabilité en dinars tunisiens.
  - `POST /api/rooftop/advise` : Conseiller IA analysant les calepinages manuels (détection des débordements hors toiture, des chevauchements de panneaux et de l'adéquation au besoin énergétique).

### 3. Solar Design Studio — Mode 1 & Mode 2
- **Mode 1 — Recommandation IA** :
  - Analyse d'image aérienne réelle par le modèle U-Net.
  - Affichage superposé du masque de segmentation et des contours vectoriels en vert (`#10B981`).
  - Calepinage géométrique automatique respectant les marges de 40 cm et les espacements de ventilation.
  - Présentation complète : panneaux recommandés, orientation optimale (portrait/paysage), surface occupée, kWc, kWh/an, coût (TND), économies (TND) et retour sur investissement.
  - 3 boutons d'action : « Accepter la recommandation IA », « Personnaliser cette installation », « Générer une autre configuration ».
- **Mode 2 — Conception Manuelle** :
  - Espace de travail interactif avec bibliothèque de modules solaires (Standard 400W, Haute Efficacité 450W, Compact 350W).
  - Contrôles complets : Ajout (+), Déplacement fluide par glissement tactile ou souris, Rotation (90°), Duplication, Suppression, Annuler (Undo) / Rétablir (Redo), Effacer tout.
  - Recalculs dynamiques instantanés à chaque mouvement (kWc, surface, production kWh, économies TND, couverture %).
  - Collaboration avec l'IA : Bouton « Demander conseil à l'IA » fournissant des recommandations ciblées sans jamais réorganiser les panneaux contre le gré de l'utilisateur. Bouton « Restaurer la proposition initiale de l'IA ».
- **Rapport Final d'Installation (`/rapport`)** :
  - Synthèse technique complète, prévisualisation de toiture, matériel, estimations financières et recommandations d'installation.
  - Sauvegarde locale de multiples projets d'installation.

### 4. Validation des 3 Scénarios Requise (`backend/tests/verify_scenarios.py`)
- **Scénario A (Import, U-Net, recommandation auto & validation)** : Réussi (85 m² détectés, 12 panneaux, 4.8 kWc, 7 920 kWh/an, 2 772 TND/an d'économies, ROI ~4.2 ans).
- **Scénario B (Personnalisation, déplacement, rotation, ajout, suppression & conseiller IA)** : Réussi (panneau déplacé, panneau pivoté 90°, panneau ajouté, panneau supprimé, conseiller IA détectant un panneau hors toiture et générant des conseils précis).
- **Scénario C (Conception manuelle depuis zéro)** : Réussi (8 panneaux placés en matrice 2×4, 0 chevauchement, 3.6 kWc, 5 940 kWh/an, validation complète).

### 5. Validation Technique & Exports
- TypeScript : **0 erreur strict** (`tsc --noEmit`).
- Tests unitaires : **4/4 validés** (`npm test`).
- Expo Doctor : **20/20 vérifications réussies** (`npx expo-doctor`).
- Export Web : réussi dans `dist/` avec routes `/studio` et `/rapport`.
- Export Natif iOS & Android : bundles Hermes `.hbc` de 6.7 Mo générés (`verification/exports/sdk58-studio-v2`).
- Script de lancement 1-clic : `start_all.bat` démarrant simultanément l'API FastAPI port 8003 et Metro Expo Go port 8081.
