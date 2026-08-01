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

/**
 * Foreground service that shows an ongoing call-style notification while
 * the Live AI session is active. On API 31+ it uses the real
 * {@link NotificationCompat.CallStyle} which gives the native round-icon,
 * marquee title, chronometer and action buttons for free (matching
 * Gemini Live's notification exactly). On API 24-30 it falls back to a
 * custom {@link RemoteViews} layout that replicates the same visual.
 *
 * The service communicates back to the Capacitor WebView exclusively via
 * broadcasts — LiveSessionPlugin registers a BroadcastReceiver that
 * converts them into Capacitor listener events.
 */
public class LiveSessionService extends Service {

    public static final String CHANNEL_ID = "live_session_channel";
    private static final int NOTIFICATION_ID = 9001;

    public static final String ACTION_END_CALL = "com.neetmaster.app.ACTION_END_CALL";
    public static final String ACTION_MUTE_TOGGLE = "com.neetmaster.app.ACTION_MUTE_TOGGLE";

    // Tracked so we can swap the mic icon without resetting the chronometer.
    private boolean isMuted = false;
    private long sessionStartTimeMillis;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Allow re-start commands to update mute state without resetting the
        // timer. The plugin sends an explicit "updateMute" extra when only
        // the icon needs to change.
        if (intent != null && intent.hasExtra("updateMute")) {
            isMuted = intent.getBooleanExtra("updateMute", false);
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, buildNotification());
            }
            return START_STICKY;
        }

        sessionStartTimeMillis = System.currentTimeMillis();
        isMuted = false;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startForeground(NOTIFICATION_ID, buildNotification(),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE | ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, buildNotification(),
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIFICATION_ID, buildNotification());
            }
        } catch (Exception e) {
            // On some OEMs startForeground can throw if the notification
            // channel was deleted or permissions were revoked. Don't crash
            // the app — the live session still works, just without the
            // persistent notification.
            e.printStackTrace();
            stopSelf();
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
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
     * Gives the exact Gemini-Live-style appearance for free.
     */
    private Notification buildCallStyleNotification() {
        // Person object — its name becomes the marquee-scrolling title.
        Bitmap iconBitmap = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher_round);
        Person caller = new Person.Builder()
                .setName("NeetMaster Live AI")
                .setIcon(IconCompat.createWithBitmap(iconBitmap))
                .setImportant(true)
                .build();

        // Hang-up PendingIntent → broadcast
        Intent endIntent = new Intent(ACTION_END_CALL);
        endIntent.setPackage(getPackageName());
        PendingIntent hangUpPendingIntent = PendingIntent.getBroadcast(
                this, 0, endIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Mic toggle action
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

        // Content intent — tapping the notification body opens the app
        Intent contentIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                this, 2, contentIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Build with CallStyle
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
     * API 24-30 fallback: custom RemoteViews layout replicating the
     * CallStyle visual. Marquee may or may not animate depending on the
     * OEM — falls back to static ellipsis gracefully.
     */
    private Notification buildFallbackNotification() {
        RemoteViews remoteViews = new RemoteViews(getPackageName(), R.layout.notification_live_session);

        // Set the mic icon based on mute state
        remoteViews.setImageViewResource(R.id.btn_mic_toggle,
                isMuted ? R.drawable.ic_mic_off : R.drawable.ic_mic_on);

        // Set up the Chronometer — it needs a base relative to
        // SystemClock.elapsedRealtime(), not System.currentTimeMillis().
        long elapsedSinceStart = System.currentTimeMillis() - sessionStartTimeMillis;
        long chronometerBase = SystemClock.elapsedRealtime() - elapsedSinceStart;
        remoteViews.setChronometer(R.id.notification_timer, chronometerBase, null, true);

        // Hang-up PendingIntent
        Intent endIntent = new Intent(ACTION_END_CALL);
        endIntent.setPackage(getPackageName());
        PendingIntent hangUpPendingIntent = PendingIntent.getBroadcast(
                this, 0, endIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        remoteViews.setOnClickPendingIntent(R.id.btn_end_call, hangUpPendingIntent);

        // Mic toggle PendingIntent
        Intent muteIntent = new Intent(ACTION_MUTE_TOGGLE);
        muteIntent.setPackage(getPackageName());
        PendingIntent mutePendingIntent = PendingIntent.getBroadcast(
                this, 1, muteIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        remoteViews.setOnClickPendingIntent(R.id.btn_mic_toggle, mutePendingIntent);

        // Content intent — tapping notification body opens the app
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
                    NotificationManager.IMPORTANCE_LOW // Silent — no sound/vibration
            );
            channel.setDescription("Ongoing notification for Live AI voice sessions");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
