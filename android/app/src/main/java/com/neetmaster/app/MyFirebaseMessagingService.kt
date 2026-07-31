package com.neetmaster.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.neetmaster.app.R
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Handles FCM messages ourselves so they still arrive when the app is
 * backgrounded or killed (Android only auto-shows notifications for
 * "notification" payloads while the app is in foreground; data-only
 * payloads always route here, regardless of app state, as long as the
 * OS hasn't fully force-stopped the app via battery restrictions).
 */
class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val CHANNEL_ID = "fcm_default_channel"
        private const val CHANNEL_NAME = "General Notifications"
        private const val BACKEND_BASE = "https://mrdk.onrender.com"
        private val ackExecutor = Executors.newSingleThreadExecutor()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        try {
            // Our server sends everything under "data", so read from there.
            val title = remoteMessage.data["title"]
                ?: remoteMessage.notification?.title
                ?: "NeetMaster"
            val body = remoteMessage.data["body"]
                ?: remoteMessage.notification?.body
                ?: ""

            showNotification(title, body)

            // Proves this exact device actually received the message — the
            // server's "success" from admin.messaging().send() only means
            // FCM accepted it, not that it reached here. Only ack if the
            // server tagged this message with a notificationId (i.e. it
            // came from the trackable admin-panel send flow).
            val notificationId = remoteMessage.data["notificationId"]
            val token = remoteMessage.data["token"]
            if (!notificationId.isNullOrEmpty() && !token.isNullOrEmpty()) {
                ackDelivery(notificationId, token)
            }
        } catch (e: Exception) {
            android.util.Log.e("FCM", "Failed to show notification", e)
        }
    }

    private fun ackDelivery(notificationId: String, token: String) {
        ackExecutor.execute {
            try {
                val url = URL("$BACKEND_BASE/api/ack-delivery")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.connectTimeout = 10_000
                conn.readTimeout = 10_000

                val body = JSONObject()
                    .put("notificationId", notificationId)
                    .put("token", token)
                    .toString()

                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                android.util.Log.d("FCM", "ack-delivery response: $code")
                conn.disconnect()
            } catch (e: Exception) {
                // Best-effort — if this fails (e.g. no network at the exact
                // moment the push arrived), the admin UI just shows "sent,
                // not confirmed" for this device instead of a hard error.
                android.util.Log.w("FCM", "ack-delivery failed", e)
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Token refresh: the app's JS side re-registers via
        // PushNotifications 'registration' listener on next launch, but
        // logging here helps confirm refreshes are happening.
        android.util.Log.d("FCM", "New token generated: $token")
    }

    private fun showNotification(title: String, body: String) {
        try {
            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    enableLights(true)
                    enableVibration(true)
                }
                notificationManager.createNotificationChannel(channel)
            }

            val intent = packageManager.getLaunchIntentForPackage(packageName)
                ?: Intent(Intent.ACTION_MAIN).apply {
                    setPackage(packageName)
                    addCategory(Intent.CATEGORY_LAUNCHER)
                }
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            val pendingIntent = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

            // Safe icon selection: R.mipmap.ic_launcher is an adaptive icon XML on API 26+,
            // which causes IllegalArgumentException: Invalid notification (no valid small icon).
            val smallIconId = try {
                val id = resources.getIdentifier("ic_notification", "drawable", packageName)
                if (id != 0) id else R.mipmap.ic_launcher_foreground
            } catch (e: Exception) {
                R.mipmap.ic_launcher_foreground
            }

            val builder = NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(smallIconId)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)

            val notificationId = System.currentTimeMillis().toInt()
            notificationManager.notify(notificationId, builder.build())
        } catch (e: Exception) {
            android.util.Log.e("FCM", "Failed to post notification in showNotification", e)
        }
    }
}
