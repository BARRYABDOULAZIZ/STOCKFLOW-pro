package com.boromboutik.app;

import android.content.pm.ActivityInfo;
import android.os.Build;
import android.os.Bundle;

/** Écran de lancement : affiche le logo, puis ouvre boromboutik.com en plein écran. */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Sur Android 8.0 et moins, imposer une orientation avec un fond transparent fait planter l'appli.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }
}
