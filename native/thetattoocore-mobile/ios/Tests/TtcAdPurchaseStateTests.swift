import Foundation

private enum TestFailure: Error {
    case failed(String)
}

private func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() {
        throw TestFailure.failed(message)
    }
}

private let profileA = "123e4567-e89b-42d3-a456-426614174000"
private let profileB = "123e4567-e89b-42d3-a456-426614174001"
private let tokenA = UUID(uuidString: profileA)!
private let tokenB = UUID(uuidString: profileB)!

private func testCanonicalRFC4122Validation() throws {
    try require(
        TtcRFC4122UUID.parse(profileA) == tokenA,
        "canonical RFC4122 UUID was rejected"
    )

    for invalid in [
        "123E4567-E89B-42D3-A456-426614174000",
        "123e4567-e89b-02d3-a456-426614174000",
        "123e4567-e89b-62d3-a456-426614174000",
        "123e4567-e89b-42d3-c456-426614174000",
        "00000000-0000-0000-0000-000000000000",
        " 123e4567-e89b-42d3-a456-426614174000",
    ] {
        try require(
            TtcRFC4122UUID.parse(invalid) == nil,
            "invalid profile UUID was accepted: \(invalid)"
        )
    }
}

private func testAccountRevisionSwitching() throws {
    var state = TtcAdPurchaseState()

    let first = state.configure(profileID: profileA, token: tokenA)
    try require(first.changed, "first configuration must change state")
    try require(!first.replacedAccount, "first configuration cannot replace an account")

    let unchanged = state.configure(profileID: profileA, token: tokenA)
    try require(!unchanged.changed, "exact reconfiguration must be idempotent")
    try require(
        unchanged.account.revision == first.account.revision,
        "exact reconfiguration must preserve the account revision"
    )

    guard let oldRecoveryAccount = state.beginRecovery() else {
        throw TestFailure.failed("old-account recovery did not begin")
    }
    let switched = state.configure(profileID: profileB, token: tokenB)
    try require(switched.changed, "account switch must change state")
    try require(switched.replacedAccount, "account switch must report replacement")
    try require(
        switched.account.revision != first.account.revision,
        "account switch must advance the account revision"
    )
    try require(state.currentAccount == switched.account, "new account was not bound")
    try require(
        !state.completeRecovery(for: oldRecoveryAccount),
        "old-account recovery completion was accepted after the switch"
    )
    try require(
        state.currentAccount == switched.account,
        "old-account recovery completion disturbed the new binding"
    )
}

private func testConditionalClearRejectsStaleCleanup() throws {
    var state = TtcAdPurchaseState()
    _ = state.configure(profileID: profileA, token: tokenA)
    let current = state.configure(profileID: profileB, token: tokenB).account

    try require(
        !state.clear(profileID: profileA),
        "stale cleanup must not clear a newer account"
    )
    try require(
        state.currentAccount == current,
        "stale cleanup changed the current account or revision"
    )
    try require(state.clear(profileID: profileB), "matching cleanup must clear")
    try require(state.currentAccount == nil, "matching cleanup left an account configured")
}

private func testBufferingAndPassiveDeliveryDedupe() throws {
    var state = TtcAdPurchaseState()
    _ = state.configure(profileID: profileA, token: tokenA)
    guard let account = state.beginRecovery() else {
        throw TestFailure.failed("recovery did not begin")
    }

    try require(
        state.shouldBufferTransactionUpdates,
        "updates must be buffered while recovery owns delivery"
    )
    try require(
        state.completeRecovery(for: account),
        "recovery did not complete for its account revision"
    )
    try require(
        state.recordDelivery(transactionID: 100, mode: .passive),
        "first passive delivery must be accepted"
    )
    try require(
        !state.recordDelivery(transactionID: 100, mode: .passive),
        "duplicate passive delivery must be suppressed"
    )
}

private func testExplicitRecoveryRedeliversAfterFailure() throws {
    var state = TtcAdPurchaseState()
    let account = state.configure(profileID: profileA, token: tokenA).account

    try require(
        state.recordDelivery(transactionID: 200, mode: .passive),
        "initial delivery was rejected"
    )
    try require(
        state.beginFinish(transactionID: 200, account: account),
        "finish did not begin"
    )
    try require(
        state.failFinish(transactionID: 200, revision: account.revision),
        "transient finish failure did not release the transaction"
    )
    try require(
        state.recordDelivery(transactionID: 200, mode: .explicitRecovery),
        "explicit recovery must redeliver a still-unfinished transaction"
    )
    try require(
        state.beginFinish(transactionID: 200, account: account),
        "redelivered transaction was not retryable"
    )
}

private func testConcurrentFinishSuppression() throws {
    var state = TtcAdPurchaseState()
    let account = state.configure(profileID: profileA, token: tokenA).account

    try require(
        state.beginFinish(transactionID: 300, account: account),
        "first finish did not begin"
    )
    try require(
        !state.beginFinish(transactionID: 300, account: account),
        "concurrent finish was not suppressed"
    )
    try require(
        !state.recordDelivery(transactionID: 300, mode: .explicitRecovery),
        "recovery redelivered while finish was in flight"
    )
}

private func testConfirmationMismatchFailsClosed() throws {
    let account = TtcAdPurchaseState.Account(
        profileID: profileA,
        token: tokenA,
        revision: 1
    )
    let valid = TtcGrantConfirmation(
        authenticated: true,
        confirmed: true,
        grantId: "grant-a",
        ok: true,
        productId: "ttc.adcredit.2500",
        profileId: profileA,
        transactionId: "400"
    )

    try require(
        TtcGrantConfirmationValidator.matches(
            valid,
            grantID: "grant-a",
            transactionID: 400,
            productID: "ttc.adcredit.2500",
            account: account
        ),
        "matching authenticated confirmation was rejected"
    )

    let mismatches = [
        TtcGrantConfirmation(
            authenticated: false,
            confirmed: true,
            grantId: "grant-a",
            ok: true,
            productId: "ttc.adcredit.2500",
            profileId: profileA,
            transactionId: "400"
        ),
        TtcGrantConfirmation(
            authenticated: true,
            confirmed: true,
            grantId: "grant-b",
            ok: true,
            productId: "ttc.adcredit.2500",
            profileId: profileA,
            transactionId: "400"
        ),
        TtcGrantConfirmation(
            authenticated: true,
            confirmed: true,
            grantId: "grant-a",
            ok: true,
            productId: "ttc.adcredit.5000",
            profileId: profileA,
            transactionId: "400"
        ),
        TtcGrantConfirmation(
            authenticated: true,
            confirmed: true,
            grantId: "grant-a",
            ok: true,
            productId: "ttc.adcredit.2500",
            profileId: profileB,
            transactionId: "400"
        ),
        TtcGrantConfirmation(
            authenticated: true,
            confirmed: true,
            grantId: "grant-a",
            ok: true,
            productId: "ttc.adcredit.2500",
            profileId: profileA,
            transactionId: "401"
        ),
    ]

    for mismatch in mismatches {
        try require(
            !TtcGrantConfirmationValidator.matches(
                mismatch,
                grantID: "grant-a",
                transactionID: 400,
                productID: "ttc.adcredit.2500",
                account: account
            ),
            "mismatched confirmation was accepted"
        )
    }
}

private func testSuccessfulFinishTransitionsExactlyOnce() throws {
    var state = TtcAdPurchaseState()
    let account = state.configure(profileID: profileA, token: tokenA).account

    try require(
        state.beginFinish(transactionID: 500, account: account),
        "finish did not begin"
    )
    try require(
        state.beginStoreKitFinish(transactionID: 500, account: account),
        "verified finish was not authorized"
    )
    try require(
        !state.beginStoreKitFinish(transactionID: 500, account: account),
        "StoreKit finish was authorized more than once"
    )
    try require(
        state.completeFinish(transactionID: 500, revision: account.revision),
        "authorized StoreKit finish did not complete"
    )
    try require(
        !state.completeFinish(transactionID: 500, revision: account.revision),
        "successful finish completed more than once"
    )
    try require(
        !state.beginFinish(transactionID: 500, account: account),
        "finished transaction became finalizable again"
    )
    try require(
        !state.recordDelivery(transactionID: 500, mode: .explicitRecovery),
        "finished transaction was returned by recovery"
    )
}

@main
private struct TtcAdPurchaseStateTests {
    static func main() throws {
        try testCanonicalRFC4122Validation()
        try testAccountRevisionSwitching()
        try testConditionalClearRejectsStaleCleanup()
        try testBufferingAndPassiveDeliveryDedupe()
        try testExplicitRecoveryRedeliversAfterFailure()
        try testConcurrentFinishSuppression()
        try testConfirmationMismatchFailsClosed()
        try testSuccessfulFinishTransitionsExactlyOnce()
        print("iOS ad-purchase state and security tests passed.")
    }
}
