#!/bin/bash
# Test de l'application sur le téléphone virtuel : installation, ouverture, captures d'écran.
set -x
OUT=build-out
APK=$OUT/BoromBoutik.apk
mkdir -p $OUT
adb shell getprop ro.build.version.release > $OUT/android-version.txt
adb shell pm list packages | sort > $OUT/applis-installees.txt
# Chrome sans écran de bienvenue (pour que le test voie directement BoromBoutik)
adb root || true
sleep 3
adb shell "echo 'chrome --disable-fre --no-default-browser-check --no-first-run' > /data/local/tmp/chrome-command-line"
adb shell chmod 644 /data/local/tmp/chrome-command-line || true
adb shell am set-debug-app --persistent com.android.chrome || true
adb install -r "$APK"
adb shell dumpsys package com.boromboutik.app | grep -E "versionName|versionCode|targetSdk" > $OUT/appli-installee.txt
adb shell am start -W -n com.boromboutik.app/.LauncherActivity
sleep 3
adb exec-out screencap -p > $OUT/ecran-1-demarrage.png
sleep 30
adb exec-out screencap -p > $OUT/ecran-2-ouverte.png
sleep 20
adb exec-out screencap -p > $OUT/ecran-3-apres-50s.png
adb shell dumpsys activity activities | grep -E "ResumedActivity" > $OUT/activite-affichee.txt
adb shell pm get-app-links com.boromboutik.app > $OUT/liens-verifies.txt 2>&1 || true
# Retour arrière Android, puis retour dans l'appli : ne doit pas planter
adb shell input keyevent KEYCODE_BACK
sleep 3
adb exec-out screencap -p > $OUT/ecran-4-retour.png
adb logcat -d | grep -iE "boromboutik|androidbrowserhelper|TrustedWebActivity|FATAL" | tail -200 > $OUT/journal.txt
exit 0
