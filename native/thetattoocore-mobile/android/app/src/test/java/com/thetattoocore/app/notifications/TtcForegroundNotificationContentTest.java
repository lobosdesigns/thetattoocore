package com.thetattoocore.app.notifications;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class TtcForegroundNotificationContentTest {

    @Test
    public void preservesGenericAlertContentAndSafeDestination() {
        TtcForegroundNotificationContent content =
            TtcForegroundNotificationContent.create(
                "fcm-message-id",
                "Test app alert",
                "Tap to verify app alerts.",
                "33333333-3333-4333-8333-333333333333",
                "test",
                "/messages?c=44444444-4444-4444-8444-444444444444"
            );

        assertEquals("fcm-message-id", content.messageId());
        assertEquals(
            "33333333-3333-4333-8333-333333333333",
            content.notificationId()
        );
        assertEquals("Test app alert", content.title());
        assertEquals("Tap to verify app alerts.", content.body());
        assertEquals("test", content.type());
        assertEquals(
            "/messages?c=44444444-4444-4444-8444-444444444444",
            content.url()
        );
    }

    @Test
    public void boundsTextAndRejectsUntrustedDestinations() {
        StringBuilder oversizedBody = new StringBuilder();
        for (int index = 0; index < 400; index += 1) {
            oversizedBody.append('x');
        }

        TtcForegroundNotificationContent content =
            TtcForegroundNotificationContent.create(
                "message id with spaces",
                " \u0000New\r\nalert ",
                oversizedBody.toString(),
                "../../unsafe",
                " \r\nmessage ",
                "https://example.invalid/phishing"
            );

        assertEquals("ttc-foreground-alert", content.messageId());
        assertEquals("ttc-foreground-alert", content.notificationId());
        assertEquals("New alert", content.title());
        assertEquals(180, content.body().length());
        assertEquals("message", content.type());
        assertEquals("/notifications", content.url());

        assertEquals(
            "/notifications",
            TtcForegroundNotificationContent.create(
                "message-id",
                null,
                null,
                "notification-id",
                null,
                "//example.invalid/phishing"
            ).url()
        );
        assertEquals(
            "/notifications",
            TtcForegroundNotificationContent.create(
                "message-id",
                null,
                null,
                "notification-id",
                null,
                "/u/member/../../admin"
            ).url()
        );
    }

    @Test
    public void suppliesGenericFallbacksForMissingPayloadFields() {
        TtcForegroundNotificationContent content =
            TtcForegroundNotificationContent.create(
                null,
                " ",
                null,
                "44444444-4444-4444-8444-444444444444",
                " ",
                null
            );

        assertEquals(
            "44444444-4444-4444-8444-444444444444",
            content.messageId()
        );
        assertEquals("New alert", content.title());
        assertEquals("Open Notifications to view it.", content.body());
        assertEquals("notification", content.type());
        assertEquals("/notifications", content.url());
    }
}
