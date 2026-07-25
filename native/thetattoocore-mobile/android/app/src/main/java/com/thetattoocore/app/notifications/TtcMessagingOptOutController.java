package com.thetattoocore.app.notifications;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CancellationException;

public final class TtcMessagingOptOutController {

    public interface MessagingClient {
        void setAutoInitEnabled(boolean enabled);

        void getToken(TokenCompletion completion);

        void deleteToken(VoidCompletion completion);
    }

    public interface TokenCompletion {
        void complete(String token, Exception error);
    }

    public interface VoidCompletion {
        void complete(Exception error);
    }

    public interface TokenResult {
        void success(String token);

        void failure(Exception error);
    }

    public interface VoidResult {
        void complete(Exception error);
    }

    private final MessagingClient client;
    private final List<VoidResult> pendingOptOutResults = new ArrayList<>();
    private long generation;
    private int activeTokenRequests;
    private boolean autoInitDisabledForOptOut;
    private boolean deletionStarted;
    private boolean optOutInProgress;
    private boolean tokenEventsEnabled;
    private Exception optOutError;

    public TtcMessagingOptOutController(MessagingClient client) {
        this.client = client;
    }

    public void getToken(TokenResult result) {
        final long requestGeneration;
        Exception autoInitError = null;

        synchronized (this) {
            if (optOutInProgress) {
                result.failure(
                    new IllegalStateException(
                        "App alert token deletion is still in progress."
                    )
                );
                return;
            }

            tokenEventsEnabled = true;
            activeTokenRequests += 1;
            requestGeneration = generation;

            try {
                client.setAutoInitEnabled(true);
            } catch (Exception error) {
                autoInitError = error;
            }
        }

        if (autoInitError != null) {
            completeTokenRequest(
                requestGeneration,
                null,
                autoInitError,
                result
            );
            return;
        }

        try {
            client.getToken((token, error) ->
                completeTokenRequest(requestGeneration, token, error, result)
            );
        } catch (Exception error) {
            completeTokenRequest(requestGeneration, null, error, result);
        }
    }

    public void disable(VoidResult result) {
        synchronized (this) {
            if (!optOutInProgress) {
                optOutInProgress = true;
                autoInitDisabledForOptOut = false;
                generation += 1;
            }

            tokenEventsEnabled = false;
            pendingOptOutResults.add(result);
        }

        Exception autoInitError = null;
        try {
            client.setAutoInitEnabled(false);
        } catch (Exception error) {
            autoInitError = error;
        }

        boolean shouldStartDeletion;
        synchronized (this) {
            autoInitDisabledForOptOut = true;
            if (autoInitError != null && optOutError == null) {
                optOutError = autoInitError;
            }
            shouldStartDeletion = prepareDeletionIfReady();
        }

        if (shouldStartDeletion) {
            startDeletion();
        }
    }

    public synchronized boolean allowsTokenEvent() {
        return tokenEventsEnabled && !optOutInProgress;
    }

    private void completeTokenRequest(
        long requestGeneration,
        String token,
        Exception error,
        TokenResult result
    ) {
        final boolean requestStillAllowed;
        final boolean shouldStartDeletion;

        synchronized (this) {
            activeTokenRequests -= 1;
            requestStillAllowed =
                error == null &&
                token != null &&
                tokenEventsEnabled &&
                !optOutInProgress &&
                requestGeneration == generation;
            shouldStartDeletion = prepareDeletionIfReady();
        }

        if (requestStillAllowed) {
            result.success(token);
        } else if (error != null) {
            result.failure(error);
        } else if (token == null) {
            result.failure(
                new IllegalStateException("Messaging returned an empty app alert token.")
            );
        } else {
            result.failure(
                new CancellationException(
                    "App alert token request was cancelled by opt-out."
                )
            );
        }

        if (shouldStartDeletion) {
            startDeletion();
        }
    }

    private synchronized boolean prepareDeletionIfReady() {
        if (
            !optOutInProgress ||
            !autoInitDisabledForOptOut ||
            deletionStarted ||
            activeTokenRequests > 0
        ) {
            return false;
        }

        deletionStarted = true;
        return true;
    }

    private void startDeletion() {
        try {
            client.deleteToken(this::finishDeletion);
        } catch (Exception error) {
            finishDeletion(error);
        }
    }

    private void finishDeletion(Exception deletionError) {
        final List<VoidResult> results;
        final Exception completionError;

        synchronized (this) {
            completionError = optOutError != null ? optOutError : deletionError;
            results = new ArrayList<>(pendingOptOutResults);
            pendingOptOutResults.clear();
            optOutError = null;
            autoInitDisabledForOptOut = false;
            deletionStarted = false;
            optOutInProgress = false;
        }

        for (VoidResult result : results) {
            result.complete(completionError);
        }
    }
}
