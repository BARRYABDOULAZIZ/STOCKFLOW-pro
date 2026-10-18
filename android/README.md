# BoromBoutik — application Android

L'application Android est une **Trusted Web Activity (TWA)** : elle ouvre `https://boromboutik.com`
en plein écran, sans barre d'adresse, avec l'icône et l'écran de démarrage BoromBoutik.

- **Mêmes écrans, mêmes fonctions, même base de données** que le site : tout le code de l'appli est dans `src/` (site web).
- **Pas de nouvelle version à publier pour chaque nouveauté** : une mise en ligne du site met aussi l'appli à jour.
- On republie sur le Play Store seulement si l'on change l'icône, le nom, les couleurs ou ce dossier `android/`
  (penser alors à augmenter `versionCode` dans `app/build.gradle`).

## Comment c'est fabriqué

GitHub fabrique tout seul l'application à chaque modification de ce dossier (`.github/workflows/android.yml`) :

1. `BoromBoutik.apk` : à installer directement sur un téléphone (test) ;
2. `BoromBoutik.aab` : le fichier à envoyer sur le Play Store ;
3. un test sur un téléphone Android virtuel, avec des captures d'écran.

Les fichiers sont rangés dans la branche `android-builds`, et dans **Releases** (« android-test ») quand l'appli est signée.

## La clé de signature

La clé (`borom-upload.jks`) n'est **jamais** dans ce dépôt. GitHub la reçoit par deux secrets
(Settings → Secrets and variables → Actions) :

- `ANDROID_KEYSTORE_BASE64` : le fichier `.jks` encodé en base64 ;
- `ANDROID_KEYSTORE_PASSWORD` : son mot de passe (alias de la clé : `borom`).

Sans ces secrets, l'appli est signée avec une clé de test : installable, mais refusée par le Play Store.

## Le lien avec le site

`/.well-known/assetlinks.json` (à la racine du site) doit contenir l'empreinte SHA-256 :

- de la clé d'envoi (upload) : pour les APK installés à la main ;
- de la clé de signature Google Play (Play Console → Intégrité de l'application) : pour les installations depuis le Play Store.

Si une empreinte manque, l'appli s'ouvre quand même, mais avec une barre d'adresse en haut.
