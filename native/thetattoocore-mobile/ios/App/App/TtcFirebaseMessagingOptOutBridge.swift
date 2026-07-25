import Capacitor
import CapacitorFirebaseMessaging
import FirebaseMessaging
import Foundation
import ObjectiveC.runtime

private final class TtcFirebaseMessagingClient: TtcNativeMessagingClient {
    func setAutoInitEnabled(_ enabled: Bool) {
        Messaging.messaging().isAutoInitEnabled = enabled
    }

    func getToken(completion: @escaping (String?, Error?) -> Void) {
        Messaging.messaging().token(completion: completion)
    }

    func deleteToken(completion: @escaping (Error?) -> Void) {
        Messaging.messaging().deleteToken(completion: completion)
    }
}

enum TtcFirebaseMessagingOptOutBridge {
    private static let controller = TtcNativeMessagingOptOutController(
        client: TtcFirebaseMessagingClient()
    )
    private static let installLock = NSLock()
    private static var installed = false

    static func install() {
        installLock.lock()
        defer { installLock.unlock() }

        guard !installed else { return }

        let pluginClass: AnyClass = FirebaseMessagingPlugin.self
        let getTokenSelector = NSSelectorFromString("getToken:")
        let deleteTokenSelector = NSSelectorFromString("deleteToken:")
        let tokenEventSelector = NSSelectorFromString(
            "notifyListeners:data:retainUntilConsumed:"
        )
        guard
            let getTokenMethod = class_getInstanceMethod(
                pluginClass,
                getTokenSelector
            ),
            let deleteTokenMethod = class_getInstanceMethod(
                pluginClass,
                deleteTokenSelector
            ),
            let tokenEventMethod = class_getInstanceMethod(
                CAPPlugin.self,
                tokenEventSelector
            ),
            installTokenEventFilter(
                on: pluginClass,
                selector: tokenEventSelector,
                method: tokenEventMethod
            )
        else {
            NSLog("TheTattooCore native app alert opt-out bridge could not be installed.")
            return
        }

        replacePluginMethod(
            on: pluginClass,
            selector: getTokenSelector,
            method: getTokenMethod,
            with: getTokenImplementation()
        )
        replacePluginMethod(
            on: pluginClass,
            selector: deleteTokenSelector,
            method: deleteTokenMethod,
            with: deleteTokenImplementation()
        )
        installed = true
    }

    private static func getTokenImplementation() -> IMP {
        typealias Implementation = @convention(block) (AnyObject, CAPPluginCall) -> Void
        let block: Implementation = { _, call in
            controller.getToken { token, error in
                if let error {
                    call.reject(error.localizedDescription)
                    return
                }

                var result = JSObject()
                result["token"] = token
                call.resolve(result)
            }
        }
        return imp_implementationWithBlock(block)
    }

    private static func deleteTokenImplementation() -> IMP {
        typealias Implementation = @convention(block) (AnyObject, CAPPluginCall) -> Void
        let block: Implementation = { _, call in
            controller.disable { error in
                if let error {
                    call.reject(error.localizedDescription)
                } else {
                    call.resolve()
                }
            }
        }
        return imp_implementationWithBlock(block)
    }

    private static func replacePluginMethod(
        on pluginClass: AnyClass,
        selector: Selector,
        method: Method,
        with implementation: IMP
    ) {
        class_replaceMethod(
            pluginClass,
            selector,
            implementation,
            method_getTypeEncoding(method)
        )
    }

    private static func installTokenEventFilter(
        on pluginClass: AnyClass,
        selector: Selector,
        method: Method
    ) -> Bool {
        let originalImplementation = method_getImplementation(method)
        typealias OriginalImplementation = @convention(c) (
            AnyObject,
            Selector,
            NSString,
            NSDictionary?,
            Bool
        ) -> Void
        let callOriginal = unsafeBitCast(
            originalImplementation,
            to: OriginalImplementation.self
        )

        typealias FilterImplementation = @convention(block) (
            AnyObject,
            NSString,
            NSDictionary?,
            Bool
        ) -> Void
        let filter: FilterImplementation = {
            plugin,
            eventName,
            data,
            retainUntilConsumed in
            if eventName == "tokenReceived" && !controller.allowsTokenEvent() {
                return
            }

            callOriginal(
                plugin,
                selector,
                eventName,
                data,
                retainUntilConsumed
            )
        }

        return class_addMethod(
            pluginClass,
            selector,
            imp_implementationWithBlock(filter),
            method_getTypeEncoding(method)
        )
    }
}
