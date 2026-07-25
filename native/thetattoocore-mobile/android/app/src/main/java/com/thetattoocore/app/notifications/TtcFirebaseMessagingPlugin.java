package com.thetattoocore.app.notifications;

import android.Manifest;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import io.capawesome.capacitorjs.plugins.firebase.messaging.FirebaseMessagingPlugin;
import java.util.concurrent.CancellationException;

@CapacitorPlugin(
    name = "FirebaseMessaging",
    permissions = @Permission(
        strings = { Manifest.permission.POST_NOTIFICATIONS },
        alias = FirebaseMessagingPlugin.PUSH_NOTIFICATIONS
    )
)
public final class TtcFirebaseMessagingPlugin extends FirebaseMessagingPlugin {

    private final TtcMessagingOptOutController controller =
        new TtcMessagingOptOutController(new FirebaseMessagingClient());

    @Override
    @PluginMethod
    public void getToken(PluginCall call) {
        controller.getToken(
            new TtcMessagingOptOutController.TokenResult() {
                @Override
                public void success(String token) {
                    JSObject result = new JSObject();
                    result.put("token", token);
                    call.resolve(result);
                }

                @Override
                public void failure(Exception error) {
                    call.reject(error.getMessage(), error);
                }
            }
        );
    }

    @Override
    @PluginMethod
    public void deleteToken(PluginCall call) {
        controller.disable(error -> {
            if (error == null) {
                call.resolve();
            } else {
                call.reject(error.getMessage(), error);
            }
        });
    }

    @Override
    protected void notifyListeners(
        String eventName,
        JSObject data,
        boolean retainUntilConsumed
    ) {
        if (
            TOKEN_RECEIVED_EVENT.equals(eventName) &&
            !controller.allowsTokenEvent()
        ) {
            return;
        }

        super.notifyListeners(eventName, data, retainUntilConsumed);
    }

    private static final class FirebaseMessagingClient
        implements TtcMessagingOptOutController.MessagingClient {

        @Override
        public void setAutoInitEnabled(boolean enabled) {
            messaging().setAutoInitEnabled(enabled);
        }

        @Override
        public void getToken(
            TtcMessagingOptOutController.TokenCompletion completion
        ) {
            messaging()
                .getToken()
                .addOnCompleteListener(task -> {
                    if (task.isSuccessful()) {
                        completion.complete(task.getResult(), null);
                    } else {
                        completion.complete(
                            null,
                            task.getException() != null
                                ? task.getException()
                                : new CancellationException(
                                    "App alert token request was cancelled."
                                )
                        );
                    }
                });
        }

        @Override
        public void deleteToken(
            TtcMessagingOptOutController.VoidCompletion completion
        ) {
            messaging()
                .deleteToken()
                .addOnCompleteListener(task ->
                    completion.complete(
                        task.isSuccessful()
                            ? null
                            : task.getException() != null
                                ? task.getException()
                                : new CancellationException(
                                    "App alert token deletion was cancelled."
                                )
                    )
                );
        }

        private com.google.firebase.messaging.FirebaseMessaging messaging() {
            return com.google.firebase.messaging.FirebaseMessaging.getInstance();
        }
    }
}
