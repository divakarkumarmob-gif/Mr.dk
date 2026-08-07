package com.neetmaster.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class GoogleSearchWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_google_search);

            // Intent for Main Search Bar Click
            Intent searchIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.neetmaster.app://open?target=ai_search"), context, MainActivity.class);
            PendingIntent searchPendingIntent = PendingIntent.getActivity(
                    context, 0, searchIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_search_container, searchPendingIntent);
            views.setOnClickPendingIntent(R.id.widget_search_text, searchPendingIntent);

            // Intent for Camera Button Click
            Intent cameraIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.neetmaster.app://open?target=neural_solver"), context, MainActivity.class);
            PendingIntent cameraPendingIntent = PendingIntent.getActivity(
                    context, 1, cameraIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_camera_btn, cameraPendingIntent);

            // Intent for Voice Button Click
            Intent voiceIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.neetmaster.app://open?target=liveAI"), context, MainActivity.class);
            PendingIntent voicePendingIntent = PendingIntent.getActivity(
                    context, 2, voiceIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_voice_btn, voicePendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
