import UIKit
import WebKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var privacyCover: UIView?
    private var enteredBackground = false
    private var privacyGeneration = 0

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        privacyGeneration += 1
        showPrivacyCover()
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        enteredBackground = true
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        guard enteredBackground else {
            hidePrivacyCover()
            return
        }

        enteredBackground = false
        privacyGeneration += 1
        handOffPrivacyCover(generation: privacyGeneration)
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    private func showPrivacyCover() {
        guard let window else { return }

        if privacyCover == nil {
            let cover = UIView(frame: window.bounds)
            cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            cover.backgroundColor = UIColor(
                red: 23.0 / 255.0,
                green: 20.0 / 255.0,
                blue: 18.0 / 255.0,
                alpha: 1
            )
            cover.accessibilityElementsHidden = true
            privacyCover = cover
        }

        guard let privacyCover else { return }
        privacyCover.frame = window.bounds
        privacyCover.isHidden = false
        if privacyCover.superview == nil {
            window.addSubview(privacyCover)
        }
        window.bringSubviewToFront(privacyCover)
    }

    private func hidePrivacyCover() {
        privacyCover?.isHidden = true
    }

    private func handOffPrivacyCover(generation: Int) {
        guard
            let bridgeViewController = window?.rootViewController as? CAPBridgeViewController,
            let webView = bridgeViewController.bridge?.webView
        else {
            return
        }

        let showWebGuard = """
        (() => {
          const guard = document.querySelector('[data-native-session-guard]');
          if (!guard) return false;
          guard.hidden = false;
          guard.setAttribute('aria-hidden', 'false');
          return true;
        })()
        """

        webView.evaluateJavaScript(showWebGuard) { [weak self, weak webView] result, error in
            guard
                let self,
                let webView,
                error == nil,
                result as? Bool == true,
                !self.enteredBackground,
                generation == self.privacyGeneration
            else {
                return
            }

            webView.takeSnapshot(with: nil) { [weak self, weak webView] _, snapshotError in
                guard
                    let self,
                    let webView,
                    snapshotError == nil,
                    !self.enteredBackground,
                    generation == self.privacyGeneration
                else {
                    return
                }

                self.hidePrivacyCover()
                webView.evaluateJavaScript(
                    "window.dispatchEvent(new Event('ttc:native-resume'))"
                )
            }
        }
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        NotificationCenter.default.post(name: Notification.Name("didReceiveRemoteNotification"), object: completionHandler, userInfo: userInfo)
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
