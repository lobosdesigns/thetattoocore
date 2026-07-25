package com.thetattoocore.app.notifications;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.Test;

public class TtcMessagingOptOutControllerTest {

    @Test
    public void tokenRequestEnablesAutoInitBeforeFetchingToken() {
        FakeMessagingClient client = new FakeMessagingClient();
        TtcMessagingOptOutController controller = new TtcMessagingOptOutController(client);
        RecordingTokenResult result = new RecordingTokenResult();

        controller.getToken(result);

        assertEquals(List.of("auto-init:true", "get-token"), client.operations);
        assertTrue(controller.allowsTokenEvent());

        client.completeToken("token-1", null);

        assertEquals("token-1", result.token);
        assertNull(result.error);
    }

    @Test
    public void optOutDeletesImmediatelyThenRetiresLateToken() {
        FakeMessagingClient client = new FakeMessagingClient();
        TtcMessagingOptOutController controller = new TtcMessagingOptOutController(client);
        RecordingTokenResult tokenResult = new RecordingTokenResult();
        RecordingVoidResult deleteResult = new RecordingVoidResult();

        controller.getToken(tokenResult);
        controller.disable(deleteResult);

        assertEquals(
            List.of(
                "auto-init:true",
                "get-token",
                "auto-init:false",
                "delete-token"
            ),
            client.operations
        );
        assertFalse(controller.allowsTokenEvent());
        assertFalse(deleteResult.completed);

        client.completeDeletion(null);

        assertTrue(deleteResult.completed);
        assertNull(deleteResult.error);
        assertFalse(controller.allowsTokenEvent());

        client.completeToken("late-token", null);

        assertNotNull(tokenResult.error);
        assertNull(tokenResult.token);
        assertEquals(
            List.of(
                "auto-init:true",
                "get-token",
                "auto-init:false",
                "delete-token",
                "delete-token"
            ),
            client.operations
        );

        client.completeDeletion(null);

        RecordingTokenResult enabledResult = new RecordingTokenResult();
        controller.getToken(enabledResult);
        assertTrue(controller.allowsTokenEvent());
    }

    @Test
    public void stalledTokenDoesNotBlockLaterOptIn() {
        FakeMessagingClient client = new FakeMessagingClient();
        TtcMessagingOptOutController controller = new TtcMessagingOptOutController(client);
        RecordingTokenResult stalledResult = new RecordingTokenResult();
        RecordingVoidResult deleteResult = new RecordingVoidResult();

        controller.getToken(stalledResult);
        controller.disable(deleteResult);
        client.completeDeletion(null);

        assertTrue(deleteResult.completed);
        RecordingTokenResult enabledResult = new RecordingTokenResult();
        controller.getToken(enabledResult);
        assertTrue(controller.allowsTokenEvent());
    }

    @Test
    public void lateTokenDuringDeletionQueuesFollowUpDelete() {
        FakeMessagingClient client = new FakeMessagingClient();
        TtcMessagingOptOutController controller = new TtcMessagingOptOutController(client);
        RecordingTokenResult tokenResult = new RecordingTokenResult();
        RecordingVoidResult deleteResult = new RecordingVoidResult();

        controller.getToken(tokenResult);
        controller.disable(deleteResult);
        client.completeToken("late-token", null);

        assertNotNull(tokenResult.error);
        assertEquals(
            List.of(
                "auto-init:true",
                "get-token",
                "auto-init:false",
                "delete-token"
            ),
            client.operations
        );

        client.completeDeletion(null);

        assertFalse(deleteResult.completed);
        assertEquals(
            List.of(
                "auto-init:true",
                "get-token",
                "auto-init:false",
                "delete-token",
                "delete-token"
            ),
            client.operations
        );
        RecordingTokenResult blockedResult = new RecordingTokenResult();
        controller.getToken(blockedResult);
        assertNotNull(blockedResult.error);

        client.completeDeletion(new IllegalStateException("delete failed"));

        assertTrue(deleteResult.completed);
        assertNotNull(deleteResult.error);
    }

    @Test
    public void optInIsBlockedUntilDeletionFinishesThenRestoresTokenEvents() {
        FakeMessagingClient client = new FakeMessagingClient();
        TtcMessagingOptOutController controller = new TtcMessagingOptOutController(client);
        RecordingVoidResult deleteResult = new RecordingVoidResult();

        controller.disable(deleteResult);

        RecordingTokenResult blockedResult = new RecordingTokenResult();
        controller.getToken(blockedResult);

        assertNotNull(blockedResult.error);
        assertFalse(controller.allowsTokenEvent());

        client.completeDeletion(null);

        RecordingTokenResult enabledResult = new RecordingTokenResult();
        controller.getToken(enabledResult);

        assertTrue(controller.allowsTokenEvent());
        client.completeToken("token-2", null);
        assertEquals("token-2", enabledResult.token);
    }

    @Test
    public void optOutCannotBeOvertakenByConcurrentAutoInitEnable() throws Exception {
        FakeMessagingClient client = new FakeMessagingClient();
        client.blockAutoInitEnable = true;
        TtcMessagingOptOutController controller = new TtcMessagingOptOutController(client);
        RecordingTokenResult tokenResult = new RecordingTokenResult();
        RecordingVoidResult deleteResult = new RecordingVoidResult();
        CountDownLatch disableInvoked = new CountDownLatch(1);

        Thread tokenThread = new Thread(() -> controller.getToken(tokenResult));
        tokenThread.start();
        assertTrue(client.autoInitEnableStarted.await(2, TimeUnit.SECONDS));

        Thread disableThread = new Thread(() -> {
            disableInvoked.countDown();
            controller.disable(deleteResult);
        });
        disableThread.start();
        assertTrue(disableInvoked.await(2, TimeUnit.SECONDS));

        boolean disableOvertookEnable;
        try {
            disableOvertookEnable = client.autoInitDisableApplied.await(
                200,
                TimeUnit.MILLISECONDS
            );
        } finally {
            client.releaseAutoInitEnable.countDown();
        }

        tokenThread.join(2_000);
        disableThread.join(2_000);

        assertFalse(tokenThread.isAlive());
        assertFalse(disableThread.isAlive());
        assertFalse(disableOvertookEnable);
        assertFalse(client.autoInitEnabled);
        assertFalse(controller.allowsTokenEvent());
    }

    private static final class FakeMessagingClient
        implements TtcMessagingOptOutController.MessagingClient {

        private final List<String> operations = new CopyOnWriteArrayList<>();
        private final CountDownLatch autoInitDisableApplied = new CountDownLatch(1);
        private final CountDownLatch autoInitEnableStarted = new CountDownLatch(1);
        private final CountDownLatch releaseAutoInitEnable = new CountDownLatch(1);
        private volatile boolean autoInitEnabled;
        private volatile boolean blockAutoInitEnable;
        private TtcMessagingOptOutController.TokenCompletion tokenCompletion;
        private TtcMessagingOptOutController.VoidCompletion deletionCompletion;

        @Override
        public void setAutoInitEnabled(boolean enabled) {
            if (enabled && blockAutoInitEnable) {
                autoInitEnableStarted.countDown();
                try {
                    if (!releaseAutoInitEnable.await(2, TimeUnit.SECONDS)) {
                        throw new IllegalStateException(
                            "Timed out waiting to release app alert auto-init."
                        );
                    }
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(error);
                }
            }

            autoInitEnabled = enabled;
            operations.add("auto-init:" + enabled);
            if (!enabled) {
                autoInitDisableApplied.countDown();
            }
        }

        @Override
        public void getToken(TtcMessagingOptOutController.TokenCompletion completion) {
            operations.add("get-token");
            tokenCompletion = completion;
        }

        @Override
        public void deleteToken(TtcMessagingOptOutController.VoidCompletion completion) {
            operations.add("delete-token");
            deletionCompletion = completion;
        }

        private void completeToken(String token, Exception error) {
            TtcMessagingOptOutController.TokenCompletion completion = tokenCompletion;
            tokenCompletion = null;
            completion.complete(token, error);
        }

        private void completeDeletion(Exception error) {
            TtcMessagingOptOutController.VoidCompletion completion = deletionCompletion;
            deletionCompletion = null;
            completion.complete(error);
        }
    }

    private static final class RecordingTokenResult
        implements TtcMessagingOptOutController.TokenResult {

        private String token;
        private Exception error;

        @Override
        public void success(String token) {
            this.token = token;
        }

        @Override
        public void failure(Exception error) {
            this.error = error;
        }
    }

    private static final class RecordingVoidResult
        implements TtcMessagingOptOutController.VoidResult {

        private boolean completed;
        private Exception error;

        @Override
        public void complete(Exception error) {
            completed = true;
            this.error = error;
        }
    }
}
