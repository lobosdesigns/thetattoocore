package com.thetattoocore.app.notifications;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.JSObject;
import org.junit.Assume;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class TtcForegroundNotificationPresenterTest {

    @Test
    public void postsForegroundAlertThroughAudibleVibratingChannel()
        throws Exception {
        Assume.assumeTrue(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O);

        Context context = InstrumentationRegistry
            .getInstrumentation()
            .getTargetContext();
        NotificationManager manager = context.getSystemService(
            NotificationManager.class
        );
        manager.cancelAll();
        manager.deleteNotificationChannel(
            TtcForegroundNotificationPresenter.CHANNEL_ID
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            InstrumentationRegistry
                .getInstrumentation()
                .getUiAutomation()
                .grantRuntimePermission(
                    context.getPackageName(),
                    Manifest.permission.POST_NOTIFICATIONS
                );
        }

        JSObject data = new JSObject();
        data.put(
            "notificationId",
            "55555555-5555-4555-8555-555555555555"
        );
        data.put("type", "test");
        data.put("url", "/notifications");
        JSObject notification = new JSObject();
        notification.put("id", "foreground-fcm-id");
        notification.put("title", "Foreground device alert");
        notification.put("body", "Tap to verify sound and vibration.");
        notification.put("data", data);
        JSObject event = new JSObject();
        event.put("notification", notification);

        TtcForegroundNotificationPresenter presenter =
            new TtcForegroundNotificationPresenter(context);

        assertTrue(
            TtcFirebaseMessagingPlugin.presentForegroundNotification(
                event,
                presenter
            )
        );
        assertTrue(
            event
                .getJSObject("notification")
                .getBoolean("systemPresented", false)
        );

        NotificationChannel channel = manager.getNotificationChannel(
            TtcForegroundNotificationPresenter.CHANNEL_ID
        );
        assertNotNull(channel);
        assertEquals(NotificationManager.IMPORTANCE_HIGH, channel.getImportance());
        assertTrue(channel.shouldVibrate());
        assertNotNull(channel.getSound());

        StatusBarNotification delivered = findDeliveredNotification(manager);
        assertNotNull(delivered);
        Notification systemNotification = delivered.getNotification();
        assertEquals(
            TtcForegroundNotificationPresenter.CHANNEL_ID,
            systemNotification.getChannelId()
        );
        assertEquals(
            "Foreground device alert",
            systemNotification.extras.getString(Notification.EXTRA_TITLE)
        );
        assertEquals(
            "Tap to verify sound and vibration.",
            systemNotification.extras.getString(Notification.EXTRA_TEXT)
        );
        assertNotNull(systemNotification.contentIntent);

        manager.cancelAll();
    }

    private StatusBarNotification findDeliveredNotification(
        NotificationManager manager
    ) throws InterruptedException {
        for (int attempt = 0; attempt < 20; attempt += 1) {
            for (StatusBarNotification notification : manager.getActiveNotifications()) {
                if (
                    TtcForegroundNotificationPresenter.CHANNEL_ID.equals(
                        notification.getNotification().getChannelId()
                    )
                ) {
                    return notification;
                }
            }
            Thread.sleep(100);
        }

        return null;
    }
}
