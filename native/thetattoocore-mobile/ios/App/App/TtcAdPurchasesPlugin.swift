import Capacitor
import Foundation
import StoreKit
import WebKit

@objc(TtcAdPurchases)
public final class TtcAdPurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TtcAdPurchases"
    public let jsName = "TtcAdPurchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configureAccount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearAccount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recoverTransactions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishTransaction", returnType: CAPPluginReturnPromise),
    ]

    private static let productIdentifiers = [
        "ttc.adcredit.2500",
        "ttc.adcredit.5000",
        "ttc.adcredit.10000",
    ]
    private static let allowedProductIdentifiers = Set(productIdentifiers)
    private static let confirmationEndpoint = URL(
        string: "https://thetattoocore.com/api/ads/purchases/apple/confirm"
    )!
    private static let maximumBufferedUpdates = 64
    private static let maximumJWSBytes = 16_384
    private static let maximumRejectionSummaries = 8
    private static let maximumResponseBytes = 16_384

    private let executor = DispatchQueue(
        label: "com.thetattoocore.app.ad-purchases"
    )
    private let executorKey = DispatchSpecificKey<Void>()
    private var transactionUpdatesTask: Task<Void, Never>?

    private var state = TtcAdPurchaseState()
    private var bufferedUpdates: [TransactionCandidate] = []
    private var finishLookups = Set<String>()

    private typealias AccountBinding = TtcAdPurchaseState.Account

    private struct VerifiedTransactionData {
        let appAccountToken: UUID
        let originalTransactionID: UInt64
        let productID: String
        let purchaseDate: Date
        let quantity: Int
        let signedTransactionJWS: String
        let transactionID: UInt64
    }

    private enum TransactionCandidate {
        case ignored
        case accepted(VerifiedTransactionData)
        case rejected(code: String)
    }

    private enum PurchaseOutcome {
        case transaction(TransactionCandidate)
        case rejected(message: String, code: String)
    }

    private struct RecoveryScan {
        let rejectionCounts: [String: Int]
        let rejectedCount: Int
        let transactions: [VerifiedTransactionData]
    }

    private struct LocalUnfinishedTransaction {
        let data: VerifiedTransactionData
        let transaction: Transaction
    }

    private enum UnfinishedLookup {
        case found(LocalUnfinishedTransaction)
        case rejected(code: String)
        case notFound
    }

    private struct GrantConfirmationRequest: Encodable {
        let grantId: String
        let signedTransactionJWS: String
    }

    private enum ConfirmationResult {
        case confirmed
        case rejected(code: String)
    }

    private final class RejectRedirectDelegate: NSObject, URLSessionTaskDelegate {
        func urlSession(
            _ session: URLSession,
            task: URLSessionTask,
            willPerformHTTPRedirection response: HTTPURLResponse,
            newRequest request: URLRequest,
            completionHandler: @escaping (URLRequest?) -> Void
        ) {
            completionHandler(nil)
        }
    }

    public override init() {
        super.init()
        executor.setSpecific(key: executorKey, value: ())
    }

    override public func load() {
        transactionUpdatesTask = Task { [weak self] in
            for await verificationResult in Transaction.updates {
                guard !Task.isCancelled else { return }
                let candidate = Self.inspect(verificationResult)
                guard let self else { return }
                self.executor.async { [weak self] in
                    self?.handleTransactionUpdate(candidate)
                }
            }
        }
    }

    deinit {
        transactionUpdatesTask?.cancel()
    }

    // Capacitor mutates listener dictionaries on its bridge queue. These
    // overrides move listener mutation and notification onto this one executor.
    @objc override public func addListener(_ call: CAPPluginCall) {
        syncOnExecutor {
            addListenerIsolated(call)
        }
    }

    @objc override public func removeListener(_ call: CAPPluginCall) {
        syncOnExecutor {
            removeListenerIsolated(call)
        }
    }

    @objc override public func removeAllListeners(_ call: CAPPluginCall) {
        syncOnExecutor {
            removeAllListenersIsolated(call)
        }
    }

    @objc func configureAccount(_ call: CAPPluginCall) {
        guard
            let profileID = call.getString("profileId"),
            let token = TtcRFC4122UUID.parse(profileID)
        else {
            call.reject("A valid account is required.", "INVALID_PROFILE_ID")
            return
        }

        executor.async { [weak self] in
            guard let self else {
                call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                return
            }

            let configuration = self.state.configure(
                profileID: profileID,
                token: token
            )
            if !configuration.changed {
                call.resolve(["configured": true])
                self.flushBufferedUpdatesIfIdle()
                return
            }

            self.purgeRetainedTransactionEvents()
            if configuration.replacedAccount {
                self.bufferedUpdates.removeAll()
            }

            call.resolve(["configured": true])
            self.flushBufferedUpdatesIfIdle()
        }
    }

    @objc func clearAccount(_ call: CAPPluginCall) {
        guard
            let profileID = call.getString("profileId"),
            TtcRFC4122UUID.parse(profileID) != nil
        else {
            call.reject("A valid account is required.", "INVALID_PROFILE_ID")
            return
        }

        executor.async { [weak self] in
            guard let self else {
                call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                return
            }

            let cleared = self.state.clear(profileID: profileID)
            if cleared {
                self.bufferedUpdates.removeAll()
                self.purgeRetainedTransactionEvents()
            }
            call.resolve(["cleared": cleared])
        }
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(
                    for: Self.productIdentifiers
                )
                guard let products = Self.validatedProducts(products) else {
                    call.reject(
                        "The ad-credit products are unavailable.",
                        "PRODUCTS_UNAVAILABLE"
                    )
                    return
                }

                var result = JSObject()
                result["products"] = products.map(Self.productPayload)
                call.resolve(result)
            } catch {
                call.reject(
                    "The ad-credit products are unavailable.",
                    "PRODUCTS_UNAVAILABLE"
                )
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard
            let productID = call.getString("productId"),
            Self.allowedProductIdentifiers.contains(productID)
        else {
            call.reject("Unsupported product.", "INVALID_PRODUCT_ID")
            return
        }

        executor.async { [weak self] in
            guard let self else {
                call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                return
            }
            guard self.state.currentAccount != nil else {
                call.reject("Sign in again before purchasing.", "ACCOUNT_NOT_CONFIGURED")
                return
            }
            guard self.state.purchaseRevision == nil else {
                call.reject(
                    "Another purchase is already in progress.",
                    "PURCHASE_IN_PROGRESS"
                )
                return
            }
            guard self.state.recoveryRevision == nil else {
                call.reject(
                    "Wait for purchase recovery to complete.",
                    "RECOVERY_IN_PROGRESS"
                )
                return
            }
            guard let account = self.state.beginPurchase() else {
                call.reject("The purchase could not be started.", "PURCHASE_FAILED")
                return
            }

            Task { [weak self] in
                guard let self else {
                    call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                    return
                }
                await self.performPurchase(
                    call: call,
                    productID: productID,
                    account: account
                )
            }
        }
    }

    @objc func recoverTransactions(_ call: CAPPluginCall) {
        executor.async { [weak self] in
            guard let self else {
                call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                return
            }
            guard self.state.currentAccount != nil else {
                call.reject("Sign in again before recovering purchases.", "ACCOUNT_NOT_CONFIGURED")
                return
            }
            guard self.state.purchaseRevision == nil else {
                call.reject(
                    "Wait for the current purchase to complete.",
                    "PURCHASE_IN_PROGRESS"
                )
                return
            }
            guard self.state.recoveryRevision == nil else {
                call.reject(
                    "Purchase recovery is already in progress.",
                    "RECOVERY_IN_PROGRESS"
                )
                return
            }
            guard let account = self.state.beginRecovery() else {
                call.reject("Purchase recovery could not be started.", "RECOVERY_FAILED")
                return
            }

            Task { [weak self] in
                let scan = await Self.scanUnfinishedTransactions(for: account.token)
                guard let self else {
                    call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                    return
                }
                self.executor.async { [weak self] in
                    self?.completeRecovery(call: call, account: account, scan: scan)
                }
            }
        }
    }

    @objc func finishTransaction(_ call: CAPPluginCall) {
        guard
            let grantID = call.getString("grantId"),
            TtcRFC4122UUID.parse(grantID) != nil
        else {
            call.reject("The purchase grant is invalid.", "INVALID_GRANT_ID")
            return
        }
        guard
            let signedTransactionJWS = call.getString("signedTransactionJWS"),
            Self.isPlausibleSignedJWS(signedTransactionJWS)
        else {
            call.reject("The purchase data is invalid.", "INVALID_SIGNED_TRANSACTION")
            return
        }

        executor.async { [weak self] in
            guard let self else {
                call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                return
            }
            guard let account = self.state.currentAccount else {
                call.reject("Sign in again before finalizing.", "ACCOUNT_NOT_CONFIGURED")
                return
            }
            guard !self.finishLookups.contains(signedTransactionJWS) else {
                call.reject(
                    "This purchase is already being finalized.",
                    "FINISH_IN_PROGRESS"
                )
                return
            }

            self.finishLookups.insert(signedTransactionJWS)
            Task { [weak self] in
                let lookup = await Self.findUnfinishedTransaction(
                    matching: signedTransactionJWS,
                    accountToken: account.token
                )
                guard let self else {
                    call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                    return
                }
                self.executor.async { [weak self] in
                    self?.beginGrantConfirmation(
                        call: call,
                        account: account,
                        grantID: grantID,
                        signedTransactionJWS: signedTransactionJWS,
                        lookup: lookup
                    )
                }
            }
        }
    }

    private func performPurchase(
        call: CAPPluginCall,
        productID: String,
        account: AccountBinding
    ) async {
        let outcome: PurchaseOutcome

        do {
            let products = try await Product.products(for: [productID])
            guard
                products.count == 1,
                let product = products.first,
                product.id == productID,
                product.type == .consumable
            else {
                outcome = .rejected(
                    message: "The selected product is unavailable.",
                    code: "PRODUCT_UNAVAILABLE"
                )
                completePurchase(
                    call: call,
                    productID: productID,
                    account: account,
                    outcome: outcome
                )
                return
            }

            let purchaseResult = try await product.purchase(
                options: [.appAccountToken(account.token)]
            )
            switch purchaseResult {
            case .success(let verificationResult):
                outcome = .transaction(Self.inspect(verificationResult))
            case .pending:
                outcome = .rejected(
                    message: "The purchase is pending approval.",
                    code: "PURCHASE_PENDING"
                )
            case .userCancelled:
                outcome = .rejected(
                    message: "The purchase was cancelled.",
                    code: "PURCHASE_CANCELLED"
                )
            @unknown default:
                outcome = .rejected(
                    message: "The purchase could not be completed.",
                    code: "PURCHASE_FAILED"
                )
            }
        } catch {
            outcome = .rejected(
                message: "The purchase could not be completed.",
                code: "PURCHASE_FAILED"
            )
        }

        completePurchase(
            call: call,
            productID: productID,
            account: account,
            outcome: outcome
        )
    }

    private func completePurchase(
        call: CAPPluginCall,
        productID: String,
        account: AccountBinding,
        outcome: PurchaseOutcome
    ) {
        executor.async { [weak self] in
            guard let self else {
                call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                return
            }

            guard self.state.purchaseRevision == account.revision else {
                call.reject("The purchase could not be completed.", "PURCHASE_FAILED")
                return
            }
            let accountStillCurrent = self.state.completePurchase(for: account)
            defer { self.flushBufferedUpdatesIfIdle() }

            guard accountStillCurrent else {
                call.reject("Sign in again before continuing.", "ACCOUNT_CHANGED")
                return
            }

            switch outcome {
            case .rejected(let message, let code):
                call.reject(message, code)
            case .transaction(let candidate):
                switch Self.accountBoundCandidate(candidate, token: account.token) {
                case .accepted(let transaction):
                    guard transaction.productID == productID else {
                        call.reject(
                            "The transaction did not match the selected product.",
                            "TRANSACTION_MISMATCH"
                        )
                        return
                    }
                    guard self.state.recordDelivery(
                        transactionID: transaction.transactionID,
                        mode: .passive
                    ) else {
                        call.reject(
                            "The transaction was already delivered.",
                            "TRANSACTION_ALREADY_DELIVERED"
                        )
                        return
                    }
                    call.resolve(Self.transactionPayload(transaction, source: "purchase"))
                case .ignored:
                    call.reject(
                        "The transaction did not match the selected product.",
                        "TRANSACTION_MISMATCH"
                    )
                case .rejected(let code):
                    call.reject("The transaction could not be verified.", code)
                }
            }
        }
    }

    private static func scanUnfinishedTransactions(
        for accountToken: UUID
    ) async -> RecoveryScan {
        var recoveredByID = [UInt64: VerifiedTransactionData]()
        var rejectionCounts = [String: Int]()
        var rejectedCount = 0

        for await verificationResult in Transaction.unfinished {
            let candidate = accountBoundCandidate(
                inspect(verificationResult),
                token: accountToken
            )
            switch candidate {
            case .accepted(let transaction):
                recoveredByID[transaction.transactionID] = transaction
            case .ignored:
                continue
            case .rejected(let code):
                rejectedCount += 1
                rejectionCounts[code, default: 0] += 1
            }
        }

        return RecoveryScan(
            rejectionCounts: rejectionCounts,
            rejectedCount: rejectedCount,
            transactions: recoveredByID.values.sorted {
                if $0.purchaseDate == $1.purchaseDate {
                    return $0.transactionID < $1.transactionID
                }
                return $0.purchaseDate < $1.purchaseDate
            }
        )
    }

    private func completeRecovery(
        call: CAPPluginCall,
        account: AccountBinding,
        scan: RecoveryScan
    ) {
        guard state.recoveryRevision == account.revision else {
            call.reject("Purchase recovery could not be completed.", "RECOVERY_FAILED")
            return
        }
        let accountStillCurrent = state.completeRecovery(for: account)
        defer { flushBufferedUpdatesIfIdle() }

        guard accountStillCurrent else {
            call.reject("Sign in again before continuing.", "ACCOUNT_CHANGED")
            return
        }

        var payloads: [JSObject] = []
        for transaction in scan.transactions {
            guard state.recordDelivery(
                transactionID: transaction.transactionID,
                mode: .explicitRecovery
            ) else {
                continue
            }
            payloads.append(Self.transactionPayload(transaction, source: "unfinished"))
        }

        let summaryCodes = scan.rejectionCounts.keys.sorted()
        let includedCodes = summaryCodes.prefix(Self.maximumRejectionSummaries)
        let includedCount = includedCodes.reduce(0) {
            $0 + (scan.rejectionCounts[$1] ?? 0)
        }
        let rejectionSummaries: [JSObject] = includedCodes.map { code in
            var summary = JSObject()
            summary["code"] = code
            summary["count"] = scan.rejectionCounts[code] ?? 0
            return summary
        }

        var result = JSObject()
        result["rejectedCount"] = scan.rejectedCount
        result["rejections"] = rejectionSummaries
        result["rejectionsTruncated"] = max(0, scan.rejectedCount - includedCount)
        result["transactions"] = payloads
        call.resolve(result)
    }

    private func beginGrantConfirmation(
        call: CAPPluginCall,
        account: AccountBinding,
        grantID: String,
        signedTransactionJWS: String,
        lookup: UnfinishedLookup
    ) {
        guard state.currentAccount == account else {
            finishLookups.remove(signedTransactionJWS)
            call.reject("Sign in again before continuing.", "ACCOUNT_CHANGED")
            return
        }

        switch lookup {
        case .notFound:
            finishLookups.remove(signedTransactionJWS)
            call.reject(
                "The transaction is not awaiting completion.",
                "TRANSACTION_NOT_UNFINISHED"
            )
        case .rejected(let code):
            finishLookups.remove(signedTransactionJWS)
            call.reject("The transaction could not be verified.", code)
        case .found(let localTransaction):
            let transactionID = localTransaction.data.transactionID
            guard state.beginFinish(
                transactionID: transactionID,
                account: account
            ) else {
                finishLookups.remove(signedTransactionJWS)
                call.reject(
                    "This purchase is already being finalized.",
                    "FINISH_IN_PROGRESS"
                )
                return
            }

            Task { [weak self] in
                guard let self else {
                    call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                    return
                }
                let confirmation = await self.confirmGrant(
                    account: account,
                    grantID: grantID,
                    transaction: localTransaction.data
                )
                await self.recheckAndFinish(
                    call: call,
                    account: account,
                    grantID: grantID,
                    signedTransactionJWS: signedTransactionJWS,
                    transaction: localTransaction.data,
                    confirmation: confirmation
                )
            }
        }
    }

    private func recheckAndFinish(
        call: CAPPluginCall,
        account: AccountBinding,
        grantID: String,
        signedTransactionJWS: String,
        transaction: VerifiedTransactionData,
        confirmation: ConfirmationResult
    ) async {
        guard case .confirmed = confirmation else {
            let code: String
            if case .rejected(let rejectionCode) = confirmation {
                code = rejectionCode
            } else {
                code = "GRANT_CONFIRMATION_FAILED"
            }
            executor.async { [weak self] in
                self?.failFinish(
                    call: call,
                    revision: account.revision,
                    signedTransactionJWS: signedTransactionJWS,
                    transactionID: transaction.transactionID,
                    code: code
                )
            }
            return
        }

        let rechecked = await Self.findUnfinishedTransaction(
            matching: signedTransactionJWS,
            accountToken: account.token
        )
        executor.async { [weak self] in
            guard let self else {
                call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                return
            }
            guard
                self.state.currentAccount == account,
                case .found(let localTransaction) = rechecked,
                localTransaction.data.transactionID == transaction.transactionID,
                localTransaction.data.productID == transaction.productID,
                localTransaction.data.appAccountToken == account.token,
                Self.securelyEqual(
                    localTransaction.data.signedTransactionJWS,
                    signedTransactionJWS
                ),
                self.state.beginStoreKitFinish(
                    transactionID: transaction.transactionID,
                    account: account
                )
            else {
                self.failFinish(
                    call: call,
                    revision: account.revision,
                    signedTransactionJWS: signedTransactionJWS,
                    transactionID: transaction.transactionID,
                    code: "TRANSACTION_RECHECK_FAILED"
                )
                return
            }

            Task { [weak self] in
                await localTransaction.transaction.finish()
                guard let self else {
                    call.reject("The purchase service is unavailable.", "PURCHASES_UNAVAILABLE")
                    return
                }
                self.executor.async { [weak self] in
                    self?.completeFinish(
                        call: call,
                        account: account,
                        grantID: grantID,
                        signedTransactionJWS: signedTransactionJWS,
                        transaction: transaction
                    )
                }
            }
        }
    }

    private func failFinish(
        call: CAPPluginCall,
        revision: UInt64,
        signedTransactionJWS: String,
        transactionID: UInt64,
        code: String
    ) {
        state.failFinish(transactionID: transactionID, revision: revision)
        finishLookups.remove(signedTransactionJWS)
        call.reject("The purchase could not be finalized.", code)
        flushBufferedUpdatesIfIdle()
    }

    private func completeFinish(
        call: CAPPluginCall,
        account: AccountBinding,
        grantID: String,
        signedTransactionJWS: String,
        transaction: VerifiedTransactionData
    ) {
        guard state.completeFinish(
            transactionID: transaction.transactionID,
            revision: account.revision
        ) else {
            finishLookups.remove(signedTransactionJWS)
            call.reject("The purchase could not be finalized.", "FINISH_FAILED")
            return
        }

        finishLookups.remove(signedTransactionJWS)
        bufferedUpdates.removeAll { candidate in
            guard case .accepted(let buffered) = candidate else { return false }
            return buffered.transactionID == transaction.transactionID
        }

        var result = JSObject()
        result["finished"] = true
        result["grantId"] = grantID
        result["productId"] = transaction.productID
        result["transactionId"] = String(transaction.transactionID)
        call.resolve(result)
        flushBufferedUpdatesIfIdle()
    }

    private func confirmGrant(
        account: AccountBinding,
        grantID: String,
        transaction: VerifiedTransactionData
    ) async -> ConfirmationResult {
        let cookies = await confirmationCookies()
        guard
            let cookieHeader = Self.authenticatedCookieHeader(
                cookies: cookies,
                url: Self.confirmationEndpoint
            )
        else {
            return .rejected(code: "AUTHENTICATION_REQUIRED")
        }

        do {
            var request = URLRequest(
                url: Self.confirmationEndpoint,
                cachePolicy: .reloadIgnoringLocalCacheData,
                timeoutInterval: 20
            )
            request.httpMethod = "POST"
            request.httpBody = try JSONEncoder().encode(
                GrantConfirmationRequest(
                    grantId: grantID,
                    signedTransactionJWS: transaction.signedTransactionJWS
                )
            )
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(cookieHeader, forHTTPHeaderField: "Cookie")
            request.setValue("https://thetattoocore.com", forHTTPHeaderField: "Origin")
            request.setValue(
                "https://thetattoocore.com/account",
                forHTTPHeaderField: "Referer"
            )

            let configuration = URLSessionConfiguration.ephemeral
            configuration.httpCookieStorage = nil
            configuration.httpShouldSetCookies = false
            configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
            configuration.urlCache = nil
            let delegate = RejectRedirectDelegate()
            let session = URLSession(
                configuration: configuration,
                delegate: delegate,
                delegateQueue: nil
            )
            defer { session.finishTasksAndInvalidate() }

            let (data, response) = try await session.data(for: request)
            guard
                let httpResponse = response as? HTTPURLResponse,
                httpResponse.url == Self.confirmationEndpoint,
                httpResponse.statusCode == 200,
                data.count <= Self.maximumResponseBytes,
                let contentType = httpResponse.value(
                    forHTTPHeaderField: "Content-Type"
                )?.lowercased(),
                contentType.hasPrefix("application/json")
            else {
                return .rejected(code: "GRANT_CONFIRMATION_FAILED")
            }

            let confirmation = try JSONDecoder().decode(
                TtcGrantConfirmation.self,
                from: data
            )
            guard TtcGrantConfirmationValidator.matches(
                confirmation,
                grantID: grantID,
                transactionID: transaction.transactionID,
                productID: transaction.productID,
                account: account
            ) else {
                return .rejected(code: "GRANT_CONFIRMATION_MISMATCH")
            }

            return .confirmed
        } catch {
            return .rejected(code: "GRANT_CONFIRMATION_FAILED")
        }
    }

    private func confirmationCookies() async -> [HTTPCookie] {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                guard
                    let cookieStore = self?.bridge?.webView?.configuration
                        .websiteDataStore.httpCookieStore
                else {
                    continuation.resume(returning: [])
                    return
                }
                cookieStore.getAllCookies { cookies in
                    continuation.resume(returning: cookies)
                }
            }
        }
    }

    private static func authenticatedCookieHeader(
        cookies: [HTTPCookie],
        url: URL
    ) -> String? {
        guard
            url.scheme == "https",
            let host = url.host?.lowercased()
        else {
            return nil
        }

        let requestPath = url.path.isEmpty ? "/" : url.path
        let eligibleCookies = cookies.filter { cookie in
            let rawDomain = cookie.domain.lowercased()
            let domain = rawDomain.hasPrefix(".")
                ? String(rawDomain.dropFirst())
                : rawDomain
            let cookiePath = cookie.path.isEmpty ? "/" : cookie.path
            let pathMatches = cookiePath == "/"
                || requestPath == cookiePath
                || requestPath.hasPrefix(
                    cookiePath.hasSuffix("/") ? cookiePath : cookiePath + "/"
                )
            let notExpired = cookie.expiresDate.map { $0 > Date() } ?? true
            return cookie.isSecure
                && notExpired
                && pathMatches
                && (host == domain || host.hasSuffix("." + domain))
        }
        guard eligibleCookies.contains(where: { cookie in
            let name = cookie.name.lowercased()
            return name.hasPrefix("sb-") && name.contains("-auth-token")
        }) else {
            return nil
        }

        return HTTPCookie.requestHeaderFields(
            with: eligibleCookies.sorted { $0.name < $1.name }
        )["Cookie"]
    }

    private static func findUnfinishedTransaction(
        matching signedTransactionJWS: String,
        accountToken: UUID
    ) async -> UnfinishedLookup {
        for await verificationResult in Transaction.unfinished {
            switch verificationResult {
            case .verified(let transaction):
                guard allowedProductIdentifiers.contains(transaction.productID) else {
                    continue
                }
                guard securelyEqual(
                    verificationResult.jwsRepresentation,
                    signedTransactionJWS
                ) else {
                    continue
                }

                switch accountBoundCandidate(
                    inspect(verificationResult),
                    token: accountToken
                ) {
                case .accepted(let data):
                    return .found(
                        LocalUnfinishedTransaction(
                            data: data,
                            transaction: transaction
                        )
                    )
                case .ignored:
                    return .notFound
                case .rejected(let code):
                    return .rejected(code: code)
                }
            case .unverified(let transaction, _):
                guard
                    allowedProductIdentifiers.contains(transaction.productID),
                    securelyEqual(
                        verificationResult.jwsRepresentation,
                        signedTransactionJWS
                    )
                else {
                    continue
                }
                return .rejected(code: "TRANSACTION_UNVERIFIED")
            }
        }

        return .notFound
    }

    private func handleTransactionUpdate(_ candidate: TransactionCandidate) {
        if case .ignored = candidate {
            return
        }
        guard
            !state.shouldBufferTransactionUpdates,
            let account = state.currentAccount
        else {
            bufferTransactionUpdate(candidate)
            return
        }
        deliverTransactionUpdate(candidate, account: account)
    }

    private func bufferTransactionUpdate(_ candidate: TransactionCandidate) {
        if bufferedUpdates.count == Self.maximumBufferedUpdates {
            bufferedUpdates.removeFirst()
        }
        bufferedUpdates.append(candidate)
    }

    private func flushBufferedUpdatesIfIdle() {
        guard
            !state.shouldBufferTransactionUpdates,
            let account = state.currentAccount,
            !bufferedUpdates.isEmpty
        else {
            return
        }

        let updates = bufferedUpdates
        bufferedUpdates.removeAll()
        for candidate in updates {
            deliverTransactionUpdate(candidate, account: account)
        }
    }

    private func deliverTransactionUpdate(
        _ candidate: TransactionCandidate,
        account: AccountBinding
    ) {
        guard state.currentAccount == account else { return }
        guard case .accepted(let transaction) = Self.accountBoundCandidate(
            candidate,
            token: account.token
        ) else {
            return
        }
        guard state.recordDelivery(
            transactionID: transaction.transactionID,
            mode: .passive
        ) else {
            return
        }

        notifyListeners(
            "transactionUpdated",
            data: Self.transactionPayload(transaction, source: "update"),
            retainUntilConsumed: true
        )
    }

    private static func inspect(
        _ verificationResult: VerificationResult<Transaction>
    ) -> TransactionCandidate {
        switch verificationResult {
        case .verified(let transaction):
            guard allowedProductIdentifiers.contains(transaction.productID) else {
                return .ignored
            }
            guard transaction.productType == .consumable else {
                return .rejected(code: "INVALID_PRODUCT_TYPE")
            }
            guard transaction.purchasedQuantity == 1 else {
                return .rejected(code: "INVALID_PURCHASE_QUANTITY")
            }
            guard let appAccountToken = transaction.appAccountToken else {
                return .rejected(code: "APP_ACCOUNT_TOKEN_MISSING")
            }
            guard transaction.revocationDate == nil else {
                return .rejected(code: "TRANSACTION_REVOKED")
            }

            let signedTransactionJWS = verificationResult.jwsRepresentation
            guard isPlausibleSignedJWS(signedTransactionJWS) else {
                return .rejected(code: "INVALID_SIGNED_TRANSACTION")
            }

            return .accepted(
                VerifiedTransactionData(
                    appAccountToken: appAccountToken,
                    originalTransactionID: transaction.originalID,
                    productID: transaction.productID,
                    purchaseDate: transaction.purchaseDate,
                    quantity: transaction.purchasedQuantity,
                    signedTransactionJWS: signedTransactionJWS,
                    transactionID: transaction.id
                )
            )
        case .unverified(let transaction, _):
            guard allowedProductIdentifiers.contains(transaction.productID) else {
                return .ignored
            }
            return .rejected(code: "TRANSACTION_UNVERIFIED")
        }
    }

    private static func accountBoundCandidate(
        _ candidate: TransactionCandidate,
        token: UUID
    ) -> TransactionCandidate {
        guard case .accepted(let transaction) = candidate else {
            return candidate
        }
        guard transaction.appAccountToken == token else {
            return .rejected(code: "ACCOUNT_MISMATCH")
        }
        return .accepted(transaction)
    }

    private static func validatedProducts(_ products: [Product]) -> [Product]? {
        guard products.count == productIdentifiers.count else { return nil }

        var productsByID = [String: Product]()
        for product in products {
            guard
                allowedProductIdentifiers.contains(product.id),
                product.type == .consumable,
                productsByID[product.id] == nil
            else {
                return nil
            }
            productsByID[product.id] = product
        }

        let orderedProducts = productIdentifiers.compactMap {
            productsByID[$0]
        }
        return orderedProducts.count == productIdentifiers.count
            ? orderedProducts
            : nil
    }

    private static func productPayload(_ product: Product) -> JSObject {
        var result = JSObject()
        result["description"] = product.description
        result["displayName"] = product.displayName
        result["displayPrice"] = product.displayPrice
        result["productId"] = product.id
        result["type"] = "consumable"
        return result
    }

    private static func transactionPayload(
        _ transaction: VerifiedTransactionData,
        source: String
    ) -> JSObject {
        let dateFormatter = ISO8601DateFormatter()
        var result = JSObject()
        result["originalTransactionId"] = String(
            transaction.originalTransactionID
        )
        result["productId"] = transaction.productID
        result["purchaseDate"] = dateFormatter.string(
            from: transaction.purchaseDate
        )
        result["quantity"] = transaction.quantity
        result["signedTransactionJWS"] = transaction.signedTransactionJWS
        result["source"] = source
        result["state"] = "verified"
        result["transactionId"] = String(transaction.transactionID)
        return result
    }

    private static func isPlausibleSignedJWS(_ value: String) -> Bool {
        let bytes = Array(value.utf8)
        guard bytes.count >= 32 && bytes.count <= maximumJWSBytes else {
            return false
        }

        let segments = bytes.split(
            separator: 46,
            maxSplits: 3,
            omittingEmptySubsequences: false
        )
        guard segments.count == 3 else { return false }
        return segments.allSatisfy { segment in
            !segment.isEmpty && segment.allSatisfy { byte in
                (byte >= 48 && byte <= 57)
                    || (byte >= 65 && byte <= 90)
                    || (byte >= 97 && byte <= 122)
                    || byte == 45
                    || byte == 95
            }
        }
    }

    private static func securelyEqual(_ lhs: String, _ rhs: String) -> Bool {
        let left = Array(lhs.utf8)
        let right = Array(rhs.utf8)
        guard left.count == right.count else { return false }

        var difference: UInt8 = 0
        for index in left.indices {
            difference |= left[index] ^ right[index]
        }
        return difference == 0
    }

    private func purgeRetainedTransactionEvents() {
        retainedEventArguments?["transactionUpdated"] = nil
    }

    private func syncOnExecutor(_ work: () -> Void) {
        if DispatchQueue.getSpecific(key: executorKey) != nil {
            work()
        } else {
            executor.sync(execute: work)
        }
    }

    private func addListenerIsolated(_ call: CAPPluginCall) {
        super.addListener(call)
    }

    private func removeListenerIsolated(_ call: CAPPluginCall) {
        super.removeListener(call)
    }

    private func removeAllListenersIsolated(_ call: CAPPluginCall) {
        super.removeAllListeners(call)
    }
}
