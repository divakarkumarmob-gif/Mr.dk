package com.neetmaster.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import org.json.JSONObject;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Handles FCM messages natively in Java so it is guaranteed to compile via
 * javac into classes.dex without needing extra Kotlin Gradle plugins.
 */
public class MyFirebaseMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "fcm_default_channel";
    private static final String CHANNEL_NAME = "General Notifications";
    private static final String BACKEND_BASE = "https://mrdk.onrender.com";
    private static final ExecutorService ackExecutor = Executors.newSingleThreadExecutor();

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        try {
            Map<String, String> data = remoteMessage.getData();
            String title = data != null ? data.get("title") : null;
            if (title == null && remoteMessage.getNotification() != null) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (title == null || title.isEmpty()) {
                title = "NeetMaster";
            }

            String body = data != null ? data.get("body") : null;
            if (body == null && remoteMessage.getNotification() != null) {
                body = remoteMessage.getNotification().getBody();
            }
            if (body == null) {
                body = "";
            }

            showNotification(this, title, body);

            String notificationId = data != null ? data.get("notificationId") : null;
            String token = data != null ? data.get("token") : null;
            if (notificationId != null && !notificationId.isEmpty() && token != null && !token.isEmpty()) {
                ackDelivery(notificationId, token);
            }
        } catch (Exception e) {
            Log.e("FCM", "Failed to show notification", e);
        }
    }

    private void ackDelivery(final String notificationId, final String token) {
        try {
            ackExecutor.execute(new Runnable() {
                @Override
                public void run() {
                    HttpURLConnection conn = null;
                    try {
                        URL url = new URL(BACKEND_BASE + "/api/ack-delivery");
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestMethod("POST");
                        conn.setRequestProperty("Content-Type", "application/json");
                        conn.setDoOutput(true);
                        conn.setConnectTimeout(5000);
                        conn.setReadTimeout(5000);

                        JSONObject body = new JSONObject();
                        body.put("notificationId", notificationId);
                        body.put("token", token);

                        byte[] jsonBytes = body.toString().getBytes(StandardCharsets.UTF_8);
                        try (OutputStream os = conn.getOutputStream()) {
                            os.write(jsonBytes);
                        }

                        int code = conn.getResponseCode();
                        Log.d("FCM", "ack-delivery response: " + code);
                    } catch (Exception e) {
                        Log.w("FCM", "ack-delivery failed", e);
                    } finally {
                        if (conn != null) {
                            conn.disconnect();
                        }
                    }
                }
            });
        } catch (Exception e) {
            Log.w("FCM", "Failed to schedule ack-delivery", e);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d("FCM", "New token generated: " + token);
    }

    private void showNotification(Context context, String title, String body) {
        try {
            NotificationManager notificationManager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.enableLights(true);
                channel.enableVibration(true);
                if (notificationManager != null) {
                    notificationManager.createNotificationChannel(channel);
                }
            }

            Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (intent == null) {
                intent = new Intent(Intent.ACTION_MAIN);
                intent.setPackage(context.getPackageName());
                intent.addCategory(Intent.CATEGORY_LAUNCHER);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            int smallIconId = 0;
            try {
                smallIconId = context.getResources().getIdentifier("ic_notification", "drawable", context.getPackageName());
                if (smallIconId == 0) {
                    smallIconId = context.getResources().getIdentifier("ic_launcher", "mipmap", context.getPackageName());
                }
                if (smallIconId == 0) {
                    smallIconId = R.mipmap.ic_launcher;
                }
            } catch (Exception e) {
                smallIconId = R.mipmap.ic_launcher;
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(smallIconId)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setAutoCancel(true)
                    .setSound(soundUri)
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setContentIntent(pendingIntent);

            try {
                int notificationId = (int) System.currentTimeMillis();
                if (notificationManager != null) {
                    notificationManager.notify(notificationId, builder.build());
                }
            } catch (Exception e) {
                Log.e("FCM", "notificationManager.notify failed", e);
            }
        } catch (Exception e) {
            Log.e("FCM", "Failed to post notification in showNotification", e);
        }
    }
}
