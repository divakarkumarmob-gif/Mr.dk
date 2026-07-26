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
        } catch (e: Exception) {
            android.util.Log.e("FCM", "Failed to show notification", e)
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

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)

        val notificationId = System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, builder.build())
    }
}
