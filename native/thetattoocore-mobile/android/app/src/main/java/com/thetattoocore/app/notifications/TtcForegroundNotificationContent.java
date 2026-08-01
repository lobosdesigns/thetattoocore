package com.thetattoocore.app.notifications;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;

final class TtcForegroundNotificationContent {

    private static final String FALLBACK_BODY =
        "Open Notifications to view it.";
    private static final String FALLBACK_ID = "ttc-foreground-alert";
    private static final String FALLBACK_TITLE = "New alert";
    private static final String FALLBACK_TYPE = "notification";
    private static final String FALLBACK_URL = "/notifications";
    private static final List<String> ALLOWED_PATHS = List.of(
        "/",
        "/account",
        "/messages",
        "/notifications",
        "/saved",
        "/search"
    );
    private static final List<String> ALLOWED_PREFIXES = List.of(
        "/p/",
        "/t/",
        "/u/",
        "/merch/",
        "/stuff/",
        "/gigs/"
    );

    private final String body;
    private final String messageId;
    private final String notificationId;
    private final String title;
    private final String type;
    private final String url;

    private TtcForegroundNotificationContent(
        String messageId,
        String title,
        String body,
        String notificationId,
        String type,
        String url
    ) {
        this.messageId = messageId;
        this.title = title;
        this.body = body;
        this.notificationId = notificationId;
        this.type = type;
        this.url = url;
    }

    static TtcForegroundNotificationContent create(
        String messageId,
        String title,
        String body,
        String notificationId,
        String type,
        String url
    ) {
        String safeMessageId = safeIdentifier(messageId);
        String safeNotificationId = safeIdentifier(notificationId);

        if (safeMessageId == null && safeNotificationId == null) {
            safeMessageId = FALLBACK_ID;
            safeNotificationId = FALLBACK_ID;
        } else if (safeMessageId == null) {
            safeMessageId = safeNotificationId;
        } else if (safeNotificationId == null) {
            safeNotificationId = safeMessageId;
        }

        return new TtcForegroundNotificationContent(
            safeMessageId,
            cleanText(title, FALLBACK_TITLE, 80),
            cleanText(body, FALLBACK_BODY, 180),
            safeNotificationId,
            cleanText(type, FALLBACK_TYPE, 64),
            safeRoute(url)
        );
    }

    String body() {
        return body;
    }

    String messageId() {
        return messageId;
    }

    String notificationId() {
        return notificationId;
    }

    String title() {
        return title;
    }

    String type() {
        return type;
    }

    String url() {
        return url;
    }

    private static String cleanText(
        String value,
        String fallback,
        int maxLength
    ) {
        if (value == null) return fallback;

        StringBuilder cleaned = new StringBuilder();
        boolean pendingSpace = false;

        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);

            if (
                Character.isWhitespace(character) ||
                Character.isISOControl(character)
            ) {
                pendingSpace = cleaned.length() > 0;
                continue;
            }

            if (pendingSpace && cleaned.length() < maxLength) {
                cleaned.append(' ');
            }
            pendingSpace = false;

            if (cleaned.length() >= maxLength) break;
            if (
                Character.isHighSurrogate(character) &&
                index + 1 < value.length() &&
                Character.isLowSurrogate(value.charAt(index + 1))
            ) {
                if (cleaned.length() + 2 > maxLength) break;
                cleaned.append(character);
                cleaned.append(value.charAt(index + 1));
                index += 1;
                continue;
            }

            cleaned.append(character);
        }

        String result = cleaned.toString().trim();
        return result.isEmpty() ? fallback : result;
    }

    private static String safeIdentifier(String value) {
        if (value == null) return null;

        String identifier = value.trim();
        if (identifier.isEmpty() || identifier.length() > 160) return null;

        for (int index = 0; index < identifier.length(); index += 1) {
            char character = identifier.charAt(index);
            if (
                !Character.isLetterOrDigit(character) &&
                character != '-' &&
                character != '_' &&
                character != '.' &&
                character != ':'
            ) {
                return null;
            }
        }

        return identifier;
    }

    private static String safeRoute(String value) {
        if (value == null) return FALLBACK_URL;

        String route = value.trim();
        if (
            route.isEmpty() ||
            route.length() > 512 ||
            !route.startsWith("/") ||
            route.startsWith("//") ||
            route.contains("\\")
        ) {
            return FALLBACK_URL;
        }

        for (int index = 0; index < route.length(); index += 1) {
            if (Character.isISOControl(route.charAt(index))) {
                return FALLBACK_URL;
            }
        }

        try {
            URI normalized = new URI(route).normalize();
            if (normalized.isAbsolute() || normalized.getRawAuthority() != null) {
                return FALLBACK_URL;
            }

            String path = normalized.getPath();
            boolean allowed = ALLOWED_PATHS.contains(path);
            if (!allowed) {
                for (String prefix : ALLOWED_PREFIXES) {
                    if (path != null && path.startsWith(prefix)) {
                        allowed = true;
                        break;
                    }
                }
            }

            return allowed ? normalized.toString() : FALLBACK_URL;
        } catch (URISyntaxException error) {
            return FALLBACK_URL;
        }
    }
}
