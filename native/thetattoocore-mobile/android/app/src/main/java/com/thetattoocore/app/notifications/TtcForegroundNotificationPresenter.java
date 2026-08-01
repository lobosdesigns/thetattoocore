package com.thetattoocore.app.notifications;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.thetattoocore.app.R;

final class TtcForegroundNotificationPresenter {

    static final String CHANNEL_ID = "ttc_alerts_v1";

    private static final String TAG = "TtcForegroundAlerts";
    private static final long[] VIBRATION_PATTERN = { 0, 250, 200, 250 };
    private final Context context;

    TtcForegroundNotificationPresenter(Context context) {
        this.context = context.getApplicationContext();
    }

    void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = context.getSystemService(
            NotificationManager.class
        );
        if (manager == null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "TheTattooCore alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription(
            "Messages, account activity, and important app updates."
        );
        channel.enableLights(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(VIBRATION_PATTERN);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        channel.setShowBadge(true);
        channel.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build()
        );
        manager.createNotificationChannel(channel);
    }

    boolean present(JSObject notification) {
        if (notification == null) return false;
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return false;
        }

        NotificationManagerCompat notificationManager =
            NotificationManagerCompat.from(context);
        if (!notificationManager.areNotificationsEnabled()) return false;

        JSObject data = notification.getJSObject("data");
        if (data == null) data = new JSObject();

        TtcForegroundNotificationContent content =
            TtcForegroundNotificationContent.create(
                notification.getString("id"),
                notification.getString("title"),
                notification.getString("body"),
                data.getString("notificationId"),
                data.getString("type"),
                data.getString("url")
            );

        ensureChannel();
        if (!channelAllowed()) return false;

        Intent launchIntent = context
            .getPackageManager()
            .getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) return false;

        launchIntent.addFlags(
            Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        launchIntent.putExtra("google.message_id", content.messageId());
        launchIntent.putExtra("notificationId", content.notificationId());
        launchIntent.putExtra("type", content.type());
        launchIntent.putExtra("url", content.url());

        int notificationNumber = notificationNumber(content.notificationId());
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            notificationNumber,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification systemNotification = new NotificationCompat.Builder(
            context,
            CHANNEL_ID
        )
            .setSmallIcon(R.drawable.ic_stat_ttc)
            .setContentTitle(content.title())
            .setContentText(content.body())
            .setStyle(new NotificationCompat.BigTextStyle().bigText(content.body()))
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(pendingIntent)
            .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .build();

        try {
            notificationManager.notify(
                content.notificationId(),
                notificationNumber,
                systemNotification
            );
            return true;
        } catch (RuntimeException error) {
            Log.e(TAG, "Foreground app alert could not be posted.", error);
            return false;
        }
    }

    private boolean channelAllowed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;

        NotificationManager manager = context.getSystemService(
            NotificationManager.class
        );
        NotificationChannel channel = manager == null
            ? null
            : manager.getNotificationChannel(CHANNEL_ID);
        return (
            channel != null &&
            channel.getImportance() != NotificationManager.IMPORTANCE_NONE
        );
    }

    private int notificationNumber(String notificationId) {
        int number = notificationId.hashCode() & Integer.MAX_VALUE;
        return number == 0 ? 1 : number;
    }
}
