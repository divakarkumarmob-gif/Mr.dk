package com.neetmaster.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class LiveAiWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_live_ai);

            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("com.neetmaster.app://open?target=liveAI"), context, MainActivity.class);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context, 20, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_live_container, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
