package com.neetmaster.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;

/**
 * Foreground service that shows an ongoing call-style notification while
 * the Live AI session is active.
 */
public class LiveSessionService extends Service {

    public static final String CHANNEL_ID = "live_session_channel";
    private static final int NOTIFICATION_ID = 9001;

    public static final String ACTION_END_CALL = "com.neetmaster.app.ACTION_END_CALL";
    public static final String ACTION_MUTE_TOGGLE = "com.neetmaster.app.ACTION_MUTE_TOGGLE";

    private boolean isMuted = false;
    private long sessionStartTimeMillis;
    private boolean isForegroundStarted = false;

    @Override
    public void onCreate() {
        super.onCreate();
        sessionStartTimeMillis = System.currentTimeMillis();
        createNotificationChannel();
        startForegroundSafely();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isForegroundStarted) {
            startForegroundSafely();
        }

        if (intent != null && intent.hasExtra("updateMute")) {
            isMuted = intent.getBooleanExtra("updateMute", false);
        } else {
            isMuted = false;
        }

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(NOTIFICATION_ID, buildNotification());
        }

        return START_STICKY;
    }

    private void startForegroundSafely() {
        Notification notification = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    try {
                        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
                        isForegroundStarted = true;
                        return;
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
            startForeground(NOTIFICATION_ID, notification);
            isForegroundStarted = true;
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        isForegroundStarted = false;
        super.onDestroy();
    }

    // ------------------------------------------------------------------
    //  Notification building
    // ------------------------------------------------------------------

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // API 31+
            return buildCallStyleNotification();
        } else {
            return buildFallbackNotification();
        }
    }

    /**
     * API 31+ (Android 12+): Native CallStyle notification.
     */
    private Notification buildCallStyleNotification() {
        Bitmap iconBitmap = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher_round);
        Person caller = new Person.Builder()
                .setName("NeetMaster Live AI")
                .setIcon(IconCompat.createWithBitmap(iconBitmap))
                .setImportant(true)
                .build();

        Intent endIntent = new Intent(ACTION_END_CALL);
        endIntent.setPackage(getPackageName());
        PendingIntent hangUpPendingIntent = PendingIntent.getBroadcast(
                this, 0, endIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent muteIntent = new Intent(ACTION_MUTE_TOGGLE);
        muteIntent.setPackage(getPackageName());
        PendingIntent mutePendingIntent = PendingIntent.getBroadcast(
                this, 1, muteIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int micIcon = isMuted ? R.drawable.ic_mic_off : R.drawable.ic_mic_on;
        String micLabel = isMuted ? "Unmute" : "Mute";
        NotificationCompat.Action muteAction = new NotificationCompat.Action.Builder(
                IconCompat.createWithResource(this, micIcon),
                micLabel,
                mutePendingIntent
        ).build();

        Intent contentIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                this, 2, contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.CallStyle callStyle =
                NotificationCompat.CallStyle.forOngoingCall(caller, hangUpPendingIntent);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentIntent(contentPendingIntent)
                .setStyle(callStyle)
                .addAction(muteAction)
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setUsesChronometer(true)
                .setWhen(sessionStartTimeMillis)
                .build();
    }

    /**
     * API 24-30 fallback: custom RemoteViews layout.
     */
    private Notification buildFallbackNotification() {
        RemoteViews remoteViews = new RemoteViews(getPackageName(), R.layout.notification_live_session);

        remoteViews.setImageViewResource(R.id.btn_mic_toggle,
                isMuted ? R.drawable.ic_mic_off : R.drawable.ic_mic_on);

        long elapsedSinceStart = System.currentTimeMillis() - sessionStartTimeMillis;
        long chronometerBase = SystemClock.elapsedRealtime() - elapsedSinceStart;
        remoteViews.setChronometer(R.id.notification_timer, chronometerBase, null, true);

        Intent endIntent = new Intent(ACTION_END_CALL);
        endIntent.setPackage(getPackageName());
        PendingIntent hangUpPendingIntent = PendingIntent.getBroadcast(
                this, 0, endIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        remoteViews.setOnClickPendingIntent(R.id.btn_end_call, hangUpPendingIntent);

        Intent muteIntent = new Intent(ACTION_MUTE_TOGGLE);
        muteIntent.setPackage(getPackageName());
        PendingIntent mutePendingIntent = PendingIntent.getBroadcast(
                this, 1, muteIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        remoteViews.setOnClickPendingIntent(R.id.btn_mic_toggle, mutePendingIntent);

        Intent contentIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                this, 2, contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setCustomContentView(remoteViews)
                .setCustomBigContentView(remoteViews)
                .setContentIntent(contentPendingIntent)
                .setOngoing(true)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setUsesChronometer(true)
                .setWhen(sessionStartTimeMillis)
                .build();
    }

    // ------------------------------------------------------------------
    //  Notification channel
    // ------------------------------------------------------------------

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Live AI Session",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Ongoing notification for Live AI voice sessions");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
