package com.thetattoocore.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String SHOW_WEB_GUARD =
        "(() => {" +
        "const guard = document.querySelector('[data-native-session-guard]');" +
        "if (!guard) return false;" +
        "guard.hidden = false;" +
        "guard.setAttribute('aria-hidden', 'false');" +
        "return true;" +
        "})()";
    private static final String DISPATCH_RESUME =
        "window.dispatchEvent(new Event('ttc:native-resume'))";

    private View privacyCover;
    private boolean enteredBackground = false;
    private int privacyGeneration = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        privacyCover = new View(this);
        privacyCover.setBackgroundColor(Color.rgb(23, 20, 18));
        privacyCover.setImportantForAccessibility(
            View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        );
        privacyCover.setVisibility(View.GONE);
        addContentView(
            privacyCover,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
    }

    @Override
    public void onPause() {
        privacyGeneration += 1;
        showPrivacyCover();
        super.onPause();
    }

    @Override
    public void onStop() {
        enteredBackground = true;
        super.onStop();
    }

    @Override
    public void onResume() {
        super.onResume();

        if (!enteredBackground) {
            hidePrivacyCover();
            return;
        }

        enteredBackground = false;
        handOffPrivacyCover(++privacyGeneration);
    }

    private void showPrivacyCover() {
        if (privacyCover != null) {
            privacyCover.setVisibility(View.VISIBLE);
            privacyCover.bringToFront();
        }
    }

    private void hidePrivacyCover() {
        if (privacyCover != null) {
            privacyCover.setVisibility(View.GONE);
        }
    }

    private void handOffPrivacyCover(int generation) {
        if (getBridge() == null) return;

        WebView webView = getBridge().getWebView();
        webView.post(() ->
            webView.evaluateJavascript(SHOW_WEB_GUARD, result -> {
                if (!"true".equals(result) || generation != privacyGeneration) {
                    return;
                }

                webView.postVisualStateCallback(
                    generation,
                    new WebView.VisualStateCallback() {
                        @Override
                        public void onComplete(long requestId) {
                            if (
                                enteredBackground ||
                                generation != privacyGeneration
                            ) {
                                return;
                            }

                            hidePrivacyCover();
                            webView.evaluateJavascript(DISPATCH_RESUME, null);
                        }
                    }
                );
            })
        );
    }
}
