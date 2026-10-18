#!/bin/bash
# Test de l'application sur le téléphone virtuel : installation, ouverture, captures d'écran.
set -x
OUT=build-out
APK=$OUT/BoromBoutik.apk
mkdir -p $OUT/ecrans
shot() { adb exec-out screencap -p > "$OUT/ecrans/$1.png"; }
adb shell getprop ro.build.version.release > $OUT/android-version.txt
adb shell pm list packages | sort > $OUT/applis-installees.txt
adb shell dumpsys package com.android.chrome | grep -m1 versionName > $OUT/chrome-version.txt
# Chrome sans écran de bienvenue (pour que le test voie directement BoromBoutik)
adb root || true
sleep 5
adb wait-for-device
adb shell "echo 'chrome --disable-fre --no-default-browser-check --no-first-run' > /data/local/tmp/chrome-command-line"
adb shell chmod 644 /data/local/tmp/chrome-command-line || true
adb shell am set-debug-app --persistent com.android.chrome || true
adb logcat -c
adb install -r "$APK"
adb shell am start -n com.boromboutik.app/.LauncherActivity
for s in 03 06 10 15 20 30 45; do
  sleep 4; shot "app-${s}s"
done
adb shell dumpsys activity activities | grep -E "ResumedActivity" > $OUT/activite-affichee.txt
adb shell pm get-app-links com.boromboutik.app > $OUT/liens-verifies.txt 2>&1 || true
adb logcat -d > $OUT/journal-complet.txt
# Retour arrière Android
adb shell input keyevent KEYCODE_BACK
sleep 3; shot "app-retour"
# Contrôle : le site ouvert directement dans Chrome
adb shell am start -a android.intent.action.VIEW -d "https://boromboutik.com/?app=android" com.android.chrome
sleep 20; shot "chrome-direct"
exit 0
