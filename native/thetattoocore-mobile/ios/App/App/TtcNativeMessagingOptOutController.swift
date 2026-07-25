import Foundation

protocol TtcNativeMessagingClient: AnyObject {
    func setAutoInitEnabled(_ enabled: Bool)
    func getToken(completion: @escaping (String?, Error?) -> Void)
    func deleteToken(completion: @escaping (Error?) -> Void)
}

enum TtcNativeMessagingOptOutError: LocalizedError {
    case deletionInProgress
    case emptyToken
    case requestCancelled

    var errorDescription: String? {
        switch self {
        case .deletionInProgress:
            return "App alert token deletion is still in progress."
        case .emptyToken:
            return "Messaging returned an empty app alert token."
        case .requestCancelled:
            return "App alert token request was cancelled by opt-out."
        }
    }
}

final class TtcNativeMessagingOptOutController: @unchecked Sendable {
    private let client: TtcNativeMessagingClient
    private let lock = NSLock()
    private var generation = 0
    private var autoInitDisabledForOptOut = false
    private var deletionQueued = false
    private var deletionStarted = false
    private var optOutInProgress = false
    private var tokenEventsEnabled = false
    private var optOutError: Error?
    private var pendingOptOutCompletions: [(Error?) -> Void] = []

    init(client: TtcNativeMessagingClient) {
        self.client = client
    }

    func getToken(completion: @escaping (String?, Error?) -> Void) {
        lock.lock()
        if optOutInProgress {
            lock.unlock()
            completion(nil, TtcNativeMessagingOptOutError.deletionInProgress)
            return
        }

        tokenEventsEnabled = true
        let requestGeneration = generation
        client.setAutoInitEnabled(true)
        lock.unlock()

        client.getToken { [weak self] token, error in
            self?.completeTokenRequest(
                generation: requestGeneration,
                token: token,
                error: error,
                completion: completion
            )
        }
    }

    func disable(completion: @escaping (Error?) -> Void) {
        lock.lock()
        if !optOutInProgress {
            optOutInProgress = true
            autoInitDisabledForOptOut = false
            generation += 1
        }
        tokenEventsEnabled = false
        pendingOptOutCompletions.append(completion)
        lock.unlock()

        client.setAutoInitEnabled(false)

        lock.lock()
        autoInitDisabledForOptOut = true
        let shouldStartDeletion = prepareDeletionIfReadyLocked()
        lock.unlock()

        if shouldStartDeletion {
            startDeletion()
        }
    }

    func allowsTokenEvent() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return tokenEventsEnabled && !optOutInProgress
    }

    private func completeTokenRequest(
        generation requestGeneration: Int,
        token: String?,
        error: Error?,
        completion: @escaping (String?, Error?) -> Void
    ) {
        lock.lock()
        let requestStillAllowed =
            error == nil &&
            token != nil &&
            tokenEventsEnabled &&
            !optOutInProgress &&
            requestGeneration == generation
        if
            !requestStillAllowed,
            error == nil,
            token != nil,
            !tokenEventsEnabled
        {
            if !optOutInProgress {
                optOutInProgress = true
                autoInitDisabledForOptOut = true
            }
        }
        if
            optOutInProgress,
            deletionStarted,
            !requestStillAllowed,
            token != nil
        {
            deletionQueued = true
        }
        let shouldStartDeletion = prepareDeletionIfReadyLocked()
        lock.unlock()

        if requestStillAllowed {
            completion(token, nil)
        } else if let error {
            completion(nil, error)
        } else if token == nil {
            completion(nil, TtcNativeMessagingOptOutError.emptyToken)
        } else {
            completion(nil, TtcNativeMessagingOptOutError.requestCancelled)
        }

        if shouldStartDeletion {
            startDeletion()
        }
    }

    private func prepareDeletionIfReadyLocked() -> Bool {
        guard
            optOutInProgress,
            autoInitDisabledForOptOut,
            !deletionStarted
        else {
            return false
        }

        deletionStarted = true
        return true
    }

    private func startDeletion() {
        client.deleteToken { [weak self] error in
            self?.finishDeletion(error: error)
        }
    }

    private func finishDeletion(error deletionError: Error?) {
        lock.lock()
        if optOutError == nil {
            optOutError = deletionError
        }
        deletionStarted = false
        let shouldStartDeletion: Bool
        if deletionQueued {
            deletionQueued = false
            shouldStartDeletion = prepareDeletionIfReadyLocked()
        } else {
            shouldStartDeletion = false
        }
        let completionError: Error?
        let completions: [(Error?) -> Void]
        if shouldStartDeletion {
            completionError = nil
            completions = []
        } else {
            completionError = optOutError
            completions = pendingOptOutCompletions
            pendingOptOutCompletions.removeAll()
            optOutError = nil
            optOutInProgress = false
            autoInitDisabledForOptOut = false
        }
        lock.unlock()

        for completion in completions {
            completion(completionError)
        }

        if shouldStartDeletion {
            startDeletion()
        }
    }
}
