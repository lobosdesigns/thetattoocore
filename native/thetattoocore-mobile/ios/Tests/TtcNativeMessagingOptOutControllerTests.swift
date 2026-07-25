import Dispatch
import Foundation

private enum TestFailure: Error {
    case failed(String)
}

private func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() {
        throw TestFailure.failed(message)
    }
}

private final class FakeMessagingClient: TtcNativeMessagingClient, @unchecked Sendable {
    private let stateLock = NSLock()
    private var storedAutoInitEnabled = false
    private var storedOperations: [String] = []
    let autoInitDisableApplied = DispatchSemaphore(value: 0)
    let autoInitEnableStarted = DispatchSemaphore(value: 0)
    let releaseAutoInitEnable = DispatchSemaphore(value: 0)
    var blockAutoInitEnable = false
    var tokenCompletion: ((String?, Error?) -> Void)?
    var deletionCompletion: ((Error?) -> Void)?

    var autoInitEnabled: Bool {
        stateLock.lock()
        defer { stateLock.unlock() }
        return storedAutoInitEnabled
    }

    var operations: [String] {
        stateLock.lock()
        defer { stateLock.unlock() }
        return storedOperations
    }

    func setAutoInitEnabled(_ enabled: Bool) {
        if enabled && blockAutoInitEnable {
            autoInitEnableStarted.signal()
            guard releaseAutoInitEnable.wait(timeout: .now() + 2) == .success else {
                return
            }
        }

        stateLock.lock()
        storedAutoInitEnabled = enabled
        storedOperations.append("auto-init:\(enabled)")
        stateLock.unlock()

        if !enabled {
            autoInitDisableApplied.signal()
        }
    }

    func getToken(completion: @escaping (String?, Error?) -> Void) {
        stateLock.lock()
        storedOperations.append("get-token")
        tokenCompletion = completion
        stateLock.unlock()
    }

    func deleteToken(completion: @escaping (Error?) -> Void) {
        stateLock.lock()
        storedOperations.append("delete-token")
        deletionCompletion = completion
        stateLock.unlock()
    }
}

private func testTokenRequestOrder() throws {
    let client = FakeMessagingClient()
    let controller = TtcNativeMessagingOptOutController(client: client)
    var receivedToken: String?
    var receivedError: Error?

    controller.getToken { token, error in
        receivedToken = token
        receivedError = error
    }

    try require(
        client.operations == ["auto-init:true", "get-token"],
        "opt-in must enable auto-init before requesting a token"
    )
    try require(controller.allowsTokenEvent(), "opt-in must allow token events")

    client.tokenCompletion?("token-1", nil)

    try require(receivedToken == "token-1", "token request did not resolve")
    try require(receivedError == nil, "token request unexpectedly failed")
}

private func testOptOutOrderingAndAwaiting() throws {
    let client = FakeMessagingClient()
    let controller = TtcNativeMessagingOptOutController(client: client)
    var tokenError: Error?
    var deletionCompleted = false
    var deletionError: Error?

    controller.getToken { _, error in
        tokenError = error
    }
    controller.disable { error in
        deletionCompleted = true
        deletionError = error
    }

    try require(
        client.operations == ["auto-init:true", "get-token", "auto-init:false"],
        "opt-out must disable auto-init before waiting for an in-flight token"
    )
    try require(!controller.allowsTokenEvent(), "opt-out must suppress token events")
    try require(!deletionCompleted, "opt-out resolved before token deletion")

    client.tokenCompletion?("late-token", nil)

    try require(tokenError != nil, "late token request was not invalidated")
    try require(
        client.operations == [
            "auto-init:true",
            "get-token",
            "auto-init:false",
            "delete-token",
        ],
        "token deletion did not follow the in-flight token completion"
    )
    try require(!deletionCompleted, "opt-out resolved before deletion callback")

    client.deletionCompletion?(nil)

    try require(deletionCompleted, "opt-out did not resolve after deletion callback")
    try require(deletionError == nil, "opt-out unexpectedly failed")
}

private func testOptInBlockedDuringDeletion() throws {
    let client = FakeMessagingClient()
    let controller = TtcNativeMessagingOptOutController(client: client)
    var blockedError: Error?

    controller.disable { _ in }
    controller.getToken { _, error in
        blockedError = error
    }

    try require(blockedError != nil, "opt-in was not blocked during token deletion")
    try require(!controller.allowsTokenEvent(), "token events resumed during deletion")

    client.deletionCompletion?(nil)

    var enabledToken: String?
    controller.getToken { token, _ in
        enabledToken = token
    }
    client.tokenCompletion?("token-2", nil)

    try require(controller.allowsTokenEvent(), "clean opt-in did not restore token events")
    try require(enabledToken == "token-2", "clean opt-in did not resolve")
}

private func testOptOutCannotBeOvertakenByConcurrentAutoInitEnable() throws {
    let client = FakeMessagingClient()
    client.blockAutoInitEnable = true
    let controller = TtcNativeMessagingOptOutController(client: client)
    let tokenCallReturned = DispatchSemaphore(value: 0)
    let disableInvoked = DispatchSemaphore(value: 0)
    let disableCallReturned = DispatchSemaphore(value: 0)

    DispatchQueue.global().async {
        controller.getToken { _, _ in }
        tokenCallReturned.signal()
    }

    try require(
        client.autoInitEnableStarted.wait(timeout: .now() + 2) == .success,
        "token setup did not reach the blocked auto-init enable"
    )

    DispatchQueue.global().async {
        disableInvoked.signal()
        controller.disable { _ in }
        disableCallReturned.signal()
    }

    try require(
        disableInvoked.wait(timeout: .now() + 2) == .success,
        "concurrent opt-out did not start"
    )

    let disableOvertookEnable =
        client.autoInitDisableApplied.wait(
            timeout: .now() + .milliseconds(200)
        ) == .success
    client.releaseAutoInitEnable.signal()

    try require(
        tokenCallReturned.wait(timeout: .now() + 2) == .success,
        "token request setup did not finish"
    )
    try require(
        disableCallReturned.wait(timeout: .now() + 2) == .success,
        "concurrent opt-out did not finish"
    )
    try require(
        !disableOvertookEnable,
        "opt-out overtook auto-init enable and could be reversed"
    )
    try require(
        !client.autoInitEnabled,
        "concurrent opt-out did not leave auto-init disabled"
    )
    try require(
        !controller.allowsTokenEvent(),
        "concurrent opt-out did not suppress token events"
    )
}

@main
private struct TtcNativeMessagingOptOutControllerTests {
    static func main() throws {
        try testTokenRequestOrder()
        try testOptOutOrderingAndAwaiting()
        try testOptInBlockedDuringDeletion()
        try testOptOutCannotBeOvertakenByConcurrentAutoInitEnable()
        print("iOS native messaging opt-out controller tests passed.")
    }
}
