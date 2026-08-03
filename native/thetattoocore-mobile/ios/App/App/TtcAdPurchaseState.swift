import Foundation

enum TtcRFC4122UUID {
    static func parse(_ value: String) -> UUID? {
        let bytes = Array(value.utf8)
        guard bytes.count == 36 else { return nil }
        let hyphenIndexes = Set([8, 13, 18, 23])

        for (index, byte) in bytes.enumerated() {
            if hyphenIndexes.contains(index) {
                guard byte == 45 else { return nil }
            } else {
                guard
                    (byte >= 48 && byte <= 57)
                        || (byte >= 97 && byte <= 102)
                else {
                    return nil
                }
            }
        }
        guard bytes[14] >= 49 && bytes[14] <= 53 else { return nil }
        guard [56, 57, 97, 98].contains(bytes[19]) else { return nil }
        guard
            let uuid = UUID(uuidString: value),
            uuid.uuidString.lowercased() == value
        else {
            return nil
        }
        return uuid
    }
}

struct TtcAdPurchaseState {
    struct Account: Equatable {
        let profileID: String
        let token: UUID
        let revision: UInt64
    }

    struct ConfigurationResult {
        let account: Account
        let changed: Bool
        let replacedAccount: Bool
    }

    enum DeliveryMode {
        case passive
        case explicitRecovery
    }

    private enum FinishPhase: Equatable {
        case confirming(revision: UInt64)
        case storeKitFinishing(revision: UInt64)

        var revision: UInt64 {
            switch self {
            case .confirming(let revision), .storeKitFinishing(let revision):
                return revision
            }
        }
    }

    private(set) var currentAccount: Account?
    private(set) var purchaseRevision: UInt64?
    private(set) var recoveryRevision: UInt64?

    private var nextAccountRevision: UInt64 = 0
    private var deliveredTransactionIDs = Set<UInt64>()
    private var finishPhases = [UInt64: FinishPhase]()
    private var finishedTransactionIDs = Set<UInt64>()

    var shouldBufferTransactionUpdates: Bool {
        currentAccount == nil || purchaseRevision != nil || recoveryRevision != nil
    }

    mutating func configure(profileID: String, token: UUID) -> ConfigurationResult {
        if
            let account = currentAccount,
            account.profileID == profileID,
            account.token == token
        {
            return ConfigurationResult(
                account: account,
                changed: false,
                replacedAccount: false
            )
        }

        let replacedAccount = currentAccount != nil
        let account = Account(
            profileID: profileID,
            token: token,
            revision: advanceAccountRevision()
        )
        currentAccount = account
        deliveredTransactionIDs.removeAll()
        return ConfigurationResult(
            account: account,
            changed: true,
            replacedAccount: replacedAccount
        )
    }

    mutating func clear(profileID: String) -> Bool {
        guard currentAccount?.profileID == profileID else { return false }

        _ = advanceAccountRevision()
        currentAccount = nil
        deliveredTransactionIDs.removeAll()
        return true
    }

    mutating func beginPurchase() -> Account? {
        guard
            let account = currentAccount,
            purchaseRevision == nil,
            recoveryRevision == nil
        else {
            return nil
        }

        purchaseRevision = account.revision
        return account
    }

    @discardableResult
    mutating func completePurchase(for account: Account) -> Bool {
        guard purchaseRevision == account.revision else { return false }
        purchaseRevision = nil
        return currentAccount == account
    }

    mutating func beginRecovery() -> Account? {
        guard
            let account = currentAccount,
            purchaseRevision == nil,
            recoveryRevision == nil
        else {
            return nil
        }

        recoveryRevision = account.revision
        return account
    }

    @discardableResult
    mutating func completeRecovery(for account: Account) -> Bool {
        guard recoveryRevision == account.revision else { return false }
        recoveryRevision = nil
        return currentAccount == account
    }

    mutating func recordDelivery(
        transactionID: UInt64,
        mode: DeliveryMode
    ) -> Bool {
        guard
            finishPhases[transactionID] == nil,
            !finishedTransactionIDs.contains(transactionID)
        else {
            return false
        }

        switch mode {
        case .passive:
            return deliveredTransactionIDs.insert(transactionID).inserted
        case .explicitRecovery:
            deliveredTransactionIDs.insert(transactionID)
            return true
        }
    }

    mutating func beginFinish(transactionID: UInt64, account: Account) -> Bool {
        guard
            currentAccount == account,
            finishPhases[transactionID] == nil,
            !finishedTransactionIDs.contains(transactionID)
        else {
            return false
        }

        finishPhases[transactionID] = .confirming(revision: account.revision)
        return true
    }

    mutating func beginStoreKitFinish(
        transactionID: UInt64,
        account: Account
    ) -> Bool {
        guard
            currentAccount == account,
            finishPhases[transactionID] == .confirming(revision: account.revision)
        else {
            return false
        }

        finishPhases[transactionID] = .storeKitFinishing(
            revision: account.revision
        )
        return true
    }

    @discardableResult
    mutating func failFinish(transactionID: UInt64, revision: UInt64) -> Bool {
        guard finishPhases[transactionID]?.revision == revision else { return false }
        finishPhases.removeValue(forKey: transactionID)
        return true
    }

    @discardableResult
    mutating func completeFinish(transactionID: UInt64, revision: UInt64) -> Bool {
        guard
            finishPhases[transactionID] == .storeKitFinishing(revision: revision)
        else {
            return false
        }

        finishPhases.removeValue(forKey: transactionID)
        finishedTransactionIDs.insert(transactionID)
        deliveredTransactionIDs.insert(transactionID)
        return true
    }

    private mutating func advanceAccountRevision() -> UInt64 {
        nextAccountRevision = nextAccountRevision == UInt64.max
            ? 1
            : nextAccountRevision + 1
        return nextAccountRevision
    }
}

struct TtcGrantConfirmation: Decodable, Equatable {
    let authenticated: Bool
    let confirmed: Bool
    let grantId: String
    let ok: Bool
    let productId: String
    let profileId: String
    let transactionId: String
}

enum TtcGrantConfirmationValidator {
    static func matches(
        _ confirmation: TtcGrantConfirmation,
        grantID: String,
        transactionID: UInt64,
        productID: String,
        account: TtcAdPurchaseState.Account
    ) -> Bool {
        confirmation.ok
            && confirmation.authenticated
            && confirmation.confirmed
            && confirmation.grantId == grantID
            && confirmation.transactionId == String(transactionID)
            && confirmation.productId == productID
            && confirmation.profileId == account.profileID
            && TtcRFC4122UUID.parse(account.profileID) == account.token
    }
}
