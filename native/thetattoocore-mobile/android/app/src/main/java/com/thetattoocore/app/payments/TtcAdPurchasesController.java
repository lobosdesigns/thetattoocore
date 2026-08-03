package com.thetattoocore.app.payments;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

final class TtcAdPurchasesController {

    static final List<String> PRODUCT_IDS = Collections.unmodifiableList(
        List.of(
            "ttc.adcredit.2500",
            "ttc.adcredit.5000",
            "ttc.adcredit.10000"
        )
    );

    private static final Set<String> PRODUCT_ID_SET = Collections.unmodifiableSet(
        new LinkedHashSet<>(PRODUCT_IDS)
    );
    private static final Pattern ACCOUNT_ID_PATTERN = Pattern.compile(
        "^[0-9a-f]{64}$"
    );
    private static final Pattern FLOW_MARKER_PATTERN = Pattern.compile(
        "^[0-9a-f]{64}$"
    );
    private static final Pattern PROFILE_ID_PATTERN = Pattern.compile(
        "^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern PURCHASE_TOKEN_PATTERN = Pattern.compile(
        "^[A-Za-z0-9][A-Za-z0-9._~:+/=\\-]{19,511}$"
    );
    private static final Pattern CURRENCY_PATTERN = Pattern.compile("^[A-Z]{3}$");
    private static final int MAX_PROVIDER_TEXT_LENGTH = 512;

    interface BillingFacade {
        void setListener(BillingListener listener);

        void connect(ConnectionListener listener);

        void queryProducts(
            List<String> productIds,
            ProductQueryCallback callback
        );

        void queryPurchases(PurchaseQueryCallback callback);

        void launchPurchase(
            ProductData product,
            String accountId,
            String flowMarker,
            LaunchCallback callback
        );

        void close();
    }

    interface BillingListener {
        void onPurchasesUpdated(
            BillingResponse response,
            List<PurchaseData> purchases
        );
    }

    interface ConnectionListener {
        void onSetupFinished(BillingResponse response);

        void onDisconnected();
    }

    interface ProductQueryCallback {
        void onResult(ProductQueryResult result);
    }

    interface PurchaseQueryCallback {
        void onResult(PurchaseQueryResult result);
    }

    interface LaunchCallback {
        void onResult(BillingResponse response);
    }

    interface ResultSink {
        void resolve(Response response);

        void reject(Failure failure);
    }

    interface EventSink {
        void emit(Response response);
    }

    interface FlowStateStore {
        PersistedFlow load();

        boolean save(PersistedFlow flow);

        boolean clear();
    }

    interface FlowMarkerFactory {
        String create();
    }

    enum ResultCode {
        OK,
        CANCELED,
        ITEM_ALREADY_OWNED,
        ERROR,
    }

    enum PurchaseState {
        PURCHASED,
        PENDING,
        UNSPECIFIED,
    }

    static final class PersistedFlow {

        private final String productId;
        private final String accountId;
        private final String flowMarker;

        PersistedFlow(
            String productId,
            String accountId,
            String flowMarker
        ) {
            this.productId = productId;
            this.accountId = accountId;
            this.flowMarker = flowMarker;
        }

        String getProductId() {
            return productId;
        }

        String getAccountId() {
            return accountId;
        }

        String getFlowMarker() {
            return flowMarker;
        }
    }

    static final class BillingResponse {

        private final ResultCode code;

        BillingResponse(ResultCode code) {
            this.code = code == null ? ResultCode.ERROR : code;
        }

        ResultCode getCode() {
            return code;
        }

        boolean isOk() {
            return code == ResultCode.OK;
        }
    }

    static final class OfferData {

        private final long priceAmountMicros;
        private final String formattedPrice;
        private final String priceCurrencyCode;
        private final String purchaseOptionId;
        private final String offerId;
        private final String offerToken;
        private final boolean rental;
        private final boolean preorder;

        OfferData(
            long priceAmountMicros,
            String formattedPrice,
            String priceCurrencyCode,
            String purchaseOptionId,
            String offerId,
            String offerToken,
            boolean rental,
            boolean preorder
        ) {
            this.priceAmountMicros = priceAmountMicros;
            this.formattedPrice = formattedPrice;
            this.priceCurrencyCode = priceCurrencyCode;
            this.purchaseOptionId = purchaseOptionId;
            this.offerId = offerId;
            this.offerToken = offerToken;
            this.rental = rental;
            this.preorder = preorder;
        }

        long getPriceAmountMicros() {
            return priceAmountMicros;
        }

        String getFormattedPrice() {
            return formattedPrice;
        }

        String getPriceCurrencyCode() {
            return priceCurrencyCode;
        }

        String getPurchaseOptionId() {
            return purchaseOptionId;
        }

        String getOfferId() {
            return offerId;
        }

        String getOfferToken() {
            return offerToken;
        }

        boolean isRental() {
            return rental;
        }

        boolean isPreorder() {
            return preorder;
        }
    }

    static final class ProductData {

        private final String productId;
        private final String name;
        private final String title;
        private final String description;
        private final String productType;
        private final List<OfferData> offers;
        private final Object platformProduct;
        private final OfferData selectedOffer;

        ProductData(
            String productId,
            String name,
            String title,
            String description,
            String productType,
            List<OfferData> offers,
            Object platformProduct
        ) {
            this(
                productId,
                name,
                title,
                description,
                productType,
                offers,
                platformProduct,
                null
            );
        }

        private ProductData(
            String productId,
            String name,
            String title,
            String description,
            String productType,
            List<OfferData> offers,
            Object platformProduct,
            OfferData selectedOffer
        ) {
            this.productId = productId;
            this.name = name;
            this.title = title;
            this.description = description;
            this.productType = productType;
            this.offers = offers == null
                ? null
                : Collections.unmodifiableList(new ArrayList<>(offers));
            this.platformProduct = platformProduct;
            this.selectedOffer = selectedOffer;
        }

        ProductData select(OfferData offer) {
            return new ProductData(
                productId,
                name,
                title,
                description,
                productType,
                offers,
                platformProduct,
                offer
            );
        }

        String getProductId() {
            return productId;
        }

        String getName() {
            return name;
        }

        String getTitle() {
            return title;
        }

        String getDescription() {
            return description;
        }

        String getProductType() {
            return productType;
        }

        List<OfferData> getOffers() {
            return offers;
        }

        Object getPlatformProduct() {
            return platformProduct;
        }

        OfferData getSelectedOffer() {
            return selectedOffer;
        }
    }

    static final class PurchaseData {

        private final String packageName;
        private final List<String> productIds;
        private final String purchaseToken;
        private final String orderId;
        private final PurchaseState purchaseState;
        private final int purchaseStateCode;
        private final long purchaseTime;
        private final int quantity;
        private final boolean acknowledged;
        private final String accountId;
        private final String flowMarker;

        PurchaseData(
            String packageName,
            List<String> productIds,
            String purchaseToken,
            String orderId,
            PurchaseState purchaseState,
            int purchaseStateCode,
            long purchaseTime,
            int quantity,
            boolean acknowledged,
            String accountId,
            String flowMarker
        ) {
            this.packageName = packageName;
            this.productIds = productIds == null
                ? null
                : Collections.unmodifiableList(new ArrayList<>(productIds));
            this.purchaseToken = purchaseToken;
            this.orderId = orderId;
            this.purchaseState = purchaseState;
            this.purchaseStateCode = purchaseStateCode;
            this.purchaseTime = purchaseTime;
            this.quantity = quantity;
            this.acknowledged = acknowledged;
            this.accountId = accountId;
            this.flowMarker = flowMarker;
        }

        String getPackageName() {
            return packageName;
        }

        List<String> getProductIds() {
            return productIds;
        }

        String getProductId() {
            return productIds == null || productIds.size() != 1
                ? null
                : productIds.get(0);
        }

        String getPurchaseToken() {
            return purchaseToken;
        }

        String getOrderId() {
            return orderId;
        }

        PurchaseState getPurchaseState() {
            return purchaseState;
        }

        int getPurchaseStateCode() {
            return purchaseStateCode;
        }

        long getPurchaseTime() {
            return purchaseTime;
        }

        int getQuantity() {
            return quantity;
        }

        boolean isAcknowledged() {
            return acknowledged;
        }

        String getAccountId() {
            return accountId;
        }

        String getFlowMarker() {
            return flowMarker;
        }
    }

    static final class ProductQueryResult {

        private final BillingResponse response;
        private final List<ProductData> products;
        private final List<String> unfetchedProductIds;

        ProductQueryResult(
            BillingResponse response,
            List<ProductData> products,
            List<String> unfetchedProductIds
        ) {
            this.response = response;
            this.products = products;
            this.unfetchedProductIds = unfetchedProductIds;
        }
    }

    static final class PurchaseQueryResult {

        private final BillingResponse response;
        private final List<PurchaseData> purchases;

        PurchaseQueryResult(
            BillingResponse response,
            List<PurchaseData> purchases
        ) {
            this.response = response;
            this.purchases = purchases;
        }
    }

    static final class Response {

        private final boolean success;
        private final String status;
        private final String source;
        private final List<ProductData> products;
        private final List<PurchaseData> purchases;

        private Response(
            boolean success,
            String status,
            String source,
            List<ProductData> products,
            List<PurchaseData> purchases
        ) {
            this.success = success;
            this.status = status;
            this.source = source;
            this.products = Collections.unmodifiableList(
                new ArrayList<>(products)
            );
            this.purchases = Collections.unmodifiableList(
                new ArrayList<>(purchases)
            );
        }

        boolean isSuccess() {
            return success;
        }

        String getStatus() {
            return status;
        }

        String getSource() {
            return source;
        }

        List<ProductData> getProducts() {
            return products;
        }

        List<PurchaseData> getPurchases() {
            return purchases;
        }
    }

    static final class Failure {

        private final String code;
        private final String message;

        private Failure(String code, String message) {
            this.code = code;
            this.message = message;
        }

        String getCode() {
            return code;
        }

        String getMessage() {
            return message;
        }
    }

    private enum ConnectionState {
        NEW,
        CONNECTING,
        READY,
        DISCONNECTED,
        DESTROYED,
    }

    private enum FlowPhase {
        PREPARING,
        LAUNCHING,
        LAUNCHED,
    }

    private final BillingFacade facade;
    private final String packageName;
    private final EventSink eventSink;
    private final FlowStateStore flowStateStore;
    private final FlowMarkerFactory flowMarkerFactory;
    private final Set<Settlement> settlements = new HashSet<>();
    private final Set<AsyncTicket> inFlight = new HashSet<>();
    private final List<ReadyOperation> readyOperations = new ArrayList<>();

    private ConnectionState connectionState = ConnectionState.NEW;
    private ConnectionHandle connectionHandle;
    private ActiveFlow activeFlow;
    private long generation = 1L;
    private long nextId = 1L;
    private boolean everReady;
    private boolean recoveryInFlight;
    private boolean recoveryRequested;
    private boolean resumeAfterSetup;
    private String requestedRecoverySource;
    private PersistedFlow persistedFlow;

    TtcAdPurchasesController(
        BillingFacade facade,
        String packageName,
        EventSink eventSink,
        FlowStateStore flowStateStore,
        FlowMarkerFactory flowMarkerFactory
    ) {
        if (
            facade == null ||
            packageName == null ||
            eventSink == null ||
            flowStateStore == null ||
            flowMarkerFactory == null
        ) {
            throw new IllegalArgumentException("Billing controller dependencies are required.");
        }
        this.facade = facade;
        this.packageName = packageName;
        this.eventSink = eventSink;
        this.flowStateStore = flowStateStore;
        this.flowMarkerFactory = flowMarkerFactory;
        persistedFlow = loadPersistedFlow();
        facade.setListener(this::onPurchasesUpdated);
    }

    static String accountIdForProfile(String profileId) {
        if (
            profileId == null ||
            !PROFILE_ID_PATTERN.matcher(profileId).matches()
        ) {
            return null;
        }
        try {
            byte[] digest = MessageDigest
                .getInstance("SHA-256")
                .digest(
                    profileId
                        .toLowerCase(Locale.ROOT)
                        .getBytes(StandardCharsets.UTF_8)
                );
            StringBuilder encoded = new StringBuilder(digest.length * 2);
            for (byte value : digest) {
                encoded.append(String.format(Locale.ROOT, "%02x", value & 0xff));
            }
            return encoded.toString();
        } catch (NoSuchAlgorithmException ignored) {
            return null;
        }
    }

    void start() {
        startConnectionIfNeeded();
    }

    void getProducts(ResultSink sink) {
        Settlement settlement = begin(sink);
        if (settlement == null) return;
        runWhenReady(
            settlement,
            () -> submitProductQuery(PRODUCT_IDS, settlement, null)
        );
    }

    void purchase(String productId, String accountId, ResultSink sink) {
        Settlement settlement = begin(sink);
        if (settlement == null) return;

        if (!PRODUCT_ID_SET.contains(productId)) {
            reject(settlement, failure("INVALID_PRODUCT", "The selected product is unavailable."));
            return;
        }
        if (accountId == null || !ACCOUNT_ID_PATTERN.matcher(accountId).matches()) {
            reject(settlement, failure("INVALID_ACCOUNT", "The signed-in account is invalid."));
            return;
        }

        synchronized (this) {
            if (!isPendingLocked(settlement)) return;
            if (activeFlow != null) {
                rejectLocked(
                    settlement,
                    failure("PURCHASE_IN_PROGRESS", "Another purchase is already in progress.")
                );
                return;
            }
            if (persistedFlow != null) {
                rejectLocked(
                    settlement,
                    failure(
                        "PURCHASE_RECOVERY_PENDING",
                        "An earlier purchase is still being recovered."
                    )
                );
                return;
            }
            PersistedFlow flowState = createAndPersistFlowLocked(
                productId,
                accountId
            );
            if (flowState == null) {
                rejectLocked(
                    settlement,
                    failure(
                        "PURCHASE_STATE_UNAVAILABLE",
                        "The purchase could not be prepared securely."
                    )
                );
                return;
            }
            activeFlow = new ActiveFlow(
                productId,
                accountId,
                flowState.getFlowMarker(),
                settlement,
                FlowPhase.PREPARING
            );
        }

        runWhenReady(
            settlement,
            () -> submitProductQuery(
                Collections.singletonList(productId),
                settlement,
                activeFlowFor(settlement)
            )
        );
    }

    void queryPurchases(ResultSink sink) {
        Settlement settlement = begin(sink);
        if (settlement == null) return;
        runWhenReady(
            settlement,
            () -> submitOwnedPurchaseQuery("manual", settlement)
        );
    }

    void resume() {
        boolean startConnection;
        boolean recover;
        synchronized (this) {
            if (connectionState == ConnectionState.DESTROYED) return;
            if (everReady) {
                startConnection = false;
                recover = true;
            } else {
                resumeAfterSetup = true;
                startConnection = true;
                recover = false;
            }
        }

        if (recover) {
            requestRecovery("resume");
        } else if (startConnection) {
            startConnectionIfNeeded();
        }
    }

    void destroy() {
        synchronized (this) {
            if (connectionState == ConnectionState.DESTROYED) return;
            List<Settlement> outstanding = new ArrayList<>(settlements);
            for (Settlement settlement : outstanding) {
                if (settlement.settled || !settlements.remove(settlement)) continue;
                settlement.settled = true;
                settlement.sink.reject(
                    failure("BILLING_CLOSED", "Play Billing is closed.")
                );
            }

            connectionState = ConnectionState.DESTROYED;
            generation += 1L;
            connectionHandle = null;
            activeFlow = null;
            readyOperations.clear();
            inFlight.clear();
            recoveryInFlight = false;
            recoveryRequested = false;
        }

        try {
            facade.close();
        } catch (RuntimeException ignored) {
            // The bridge is already closed; runtime diagnostics stay native.
        }
    }

    private void startConnectionIfNeeded() {
        final ConnectionHandle handle;
        synchronized (this) {
            if (
                connectionState == ConnectionState.DESTROYED ||
                connectionState == ConnectionState.CONNECTING ||
                connectionState == ConnectionState.READY ||
                everReady
            ) {
                return;
            }
            connectionState = ConnectionState.CONNECTING;
            handle = new ConnectionHandle(generation, nextId++);
            connectionHandle = handle;
        }

        try {
            facade.connect(
                new ConnectionListener() {
                    @Override
                    public void onSetupFinished(BillingResponse response) {
                        finishSetup(handle, response);
                    }

                    @Override
                    public void onDisconnected() {
                        handleDisconnect(handle);
                    }
                }
            );
        } catch (RuntimeException ignored) {
            failConnectionSubmission(handle);
        }
    }

    private void finishSetup(
        ConnectionHandle handle,
        BillingResponse response
    ) {
        final List<ReadyOperation> queued;
        final boolean setupSucceeded;
        final boolean shouldResume;

        synchronized (this) {
            if (!ownsConnectionLocked(handle) || handle.setupDelivered) return;
            handle.setupDelivered = true;
            setupSucceeded = response != null && response.isOk();
            handle.setupSucceeded = setupSucceeded;

            if (setupSucceeded) {
                everReady = true;
                connectionState = ConnectionState.READY;
                queued = drainReadyLocked();
                shouldResume = resumeAfterSetup;
                resumeAfterSetup = false;
            } else {
                connectionHandle = null;
                connectionState = ConnectionState.NEW;
                queued = drainReadyLocked();
                shouldResume = false;
            }
        }

        if (!setupSucceeded) {
            failReadyOperations(
                queued,
                failure("BILLING_SETUP_FAILED", "Play Billing setup failed.")
            );
            return;
        }

        requestRecovery("connection");
        runReadyOperations(queued);
        if (shouldResume) requestRecovery("resume");
    }

    private void handleDisconnect(ConnectionHandle handle) {
        final List<ReadyOperation> queued;
        final boolean disconnectedAfterSetup;

        synchronized (this) {
            if (!ownsConnectionLocked(handle)) return;
            disconnectedAfterSetup = handle.setupSucceeded && everReady;
            connectionState = disconnectedAfterSetup
                ? ConnectionState.DISCONNECTED
                : ConnectionState.NEW;
            if (!disconnectedAfterSetup) connectionHandle = null;
            queued = disconnectedAfterSetup
                ? Collections.emptyList()
                : drainReadyLocked();
        }

        if (disconnectedAfterSetup) {
            // This API call lets Billing 9.1 perform its automatic reconnect.
            requestRecovery("reconnect");
        } else {
            failReadyOperations(
                queued,
                failure(
                    "BILLING_SETUP_FAILED",
                    "Play Billing disconnected during setup."
                )
            );
        }
    }

    private void failConnectionSubmission(ConnectionHandle handle) {
        final List<ReadyOperation> queued;
        synchronized (this) {
            if (!ownsConnectionLocked(handle) || handle.setupDelivered) return;
            connectionHandle = null;
            connectionState = ConnectionState.NEW;
            queued = drainReadyLocked();
        }
        failReadyOperations(
            queued,
            failure("BILLING_SETUP_FAILED", "Play Billing setup failed.")
        );
    }

    private void runWhenReady(Settlement settlement, Runnable operation) {
        boolean runNow = false;
        boolean connect = false;
        boolean recover = false;

        synchronized (this) {
            if (!isPendingLocked(settlement)) return;
            switch (connectionState) {
                case READY:
                    runNow = true;
                    break;
                case DISCONNECTED:
                    readyOperations.add(new ReadyOperation(settlement, operation));
                    recover = !recoveryInFlight;
                    break;
                case NEW:
                    readyOperations.add(new ReadyOperation(settlement, operation));
                    connect = true;
                    break;
                case CONNECTING:
                    readyOperations.add(new ReadyOperation(settlement, operation));
                    break;
                case DESTROYED:
                    rejectLocked(
                        settlement,
                        failure("BILLING_CLOSED", "Play Billing is closed.")
                    );
                    break;
            }
        }

        if (runNow) runReadyOperation(new ReadyOperation(settlement, operation));
        if (connect) startConnectionIfNeeded();
        if (recover) requestRecovery("reconnect");
    }

    private void submitProductQuery(
        List<String> productIds,
        Settlement settlement,
        ActiveFlow expectedFlow
    ) {
        AsyncTicket ticket = beginAsync();
        if (ticket == null) return;

        try {
            facade.queryProducts(
                Collections.unmodifiableList(new ArrayList<>(productIds)),
                result -> finishProductQuery(
                    ticket,
                    productIds,
                    settlement,
                    expectedFlow,
                    result
                )
            );
        } catch (RuntimeException ignored) {
            if (claim(ticket)) {
                reject(
                    settlement,
                    failure("PRODUCT_QUERY_FAILED", "Play products are unavailable.")
                );
            }
        }
    }

    private void finishProductQuery(
        AsyncTicket ticket,
        List<String> requestedIds,
        Settlement settlement,
        ActiveFlow expectedFlow,
        ProductQueryResult result
    ) {
        if (!claim(ticket)) return;
        CatalogValidation validation = validateCatalog(result, requestedIds);
        if (validation.failure != null) {
            reject(settlement, validation.failure);
            return;
        }

        if (expectedFlow == null) {
            resolve(
                settlement,
                response(true, "ok", "catalog", validation.products, Collections.emptyList())
            );
            return;
        }

        if (!ownsActiveFlow(expectedFlow)) return;
        ProductData product = validation.products.get(0);
        submitLaunch(expectedFlow, product);
    }

    private void submitLaunch(ActiveFlow flow, ProductData product) {
        AsyncTicket ticket = beginAsync();
        if (ticket == null) return;

        synchronized (this) {
            if (!ownsActiveFlowLocked(flow)) {
                claim(ticket);
                return;
            }
            flow.phase = FlowPhase.LAUNCHING;
        }

        try {
            facade.launchPurchase(
                product,
                flow.accountId,
                flow.flowMarker,
                response -> finishLaunch(ticket, flow, response)
            );
        } catch (RuntimeException ignored) {
            if (claim(ticket)) {
                reject(
                    flow.settlement,
                    failure("PURCHASE_LAUNCH_FAILED", "The purchase screen is unavailable.")
                );
            }
        }
    }

    private void finishLaunch(
        AsyncTicket ticket,
        ActiveFlow flow,
        BillingResponse response
    ) {
        if (!claim(ticket) || !ownsActiveFlow(flow)) return;
        ResultCode code = response == null ? ResultCode.ERROR : response.getCode();

        if (code == ResultCode.OK) {
            synchronized (this) {
                if (activeFlow == flow && isPendingLocked(flow.settlement)) {
                    flow.phase = FlowPhase.LAUNCHED;
                }
            }
            return;
        }
        if (code == ResultCode.CANCELED) {
            resolve(
                flow.settlement,
                response(
                    false,
                    "canceled",
                    "purchase",
                    Collections.emptyList(),
                    Collections.emptyList()
                )
            );
            return;
        }
        if (code == ResultCode.ITEM_ALREADY_OWNED) {
            reject(
                flow.settlement,
                failure(
                    "PURCHASE_ALREADY_OWNED",
                    "This product already has an unfinished purchase."
                )
            );
            requestRecovery("already_owned");
            return;
        }
        reject(
            flow.settlement,
            failure("PURCHASE_LAUNCH_FAILED", "The purchase screen is unavailable.")
        );
    }

    private void submitOwnedPurchaseQuery(
        String source,
        Settlement settlement
    ) {
        AsyncTicket ticket = beginAsync();
        if (ticket == null) return;
        try {
            facade.queryPurchases(result -> {
                if (!claim(ticket)) return;
                PurchaseValidation validation = validatePurchases(result);
                if (validation.failure != null) {
                    reject(settlement, validation.failure);
                    return;
                }
                resolve(
                    settlement,
                    response(
                        true,
                        "ok",
                        source,
                        Collections.emptyList(),
                        validation.purchases
                    )
                );
            });
        } catch (RuntimeException ignored) {
            if (claim(ticket)) {
                reject(
                    settlement,
                    failure("PURCHASE_QUERY_FAILED", "Owned purchases are unavailable.")
                );
            }
        }
    }

    private void requestRecovery(String source) {
        final AsyncTicket ticket;
        synchronized (this) {
            if (
                connectionState == ConnectionState.DESTROYED ||
                !everReady
            ) {
                return;
            }
            if (recoveryInFlight) {
                recoveryRequested = true;
                requestedRecoverySource = source;
                return;
            }
            recoveryInFlight = true;
            ticket = beginAsyncLocked();
        }

        try {
            facade.queryPurchases(result -> finishRecovery(ticket, source, result));
        } catch (RuntimeException ignored) {
            finishRecovery(
                ticket,
                source,
                new PurchaseQueryResult(
                    new BillingResponse(ResultCode.ERROR),
                    Collections.emptyList()
                )
            );
        }
    }

    private void finishRecovery(
        AsyncTicket ticket,
        String source,
        PurchaseQueryResult result
    ) {
        if (!claim(ticket)) return;
        PurchaseValidation validation = validatePurchases(result);
        final List<ReadyOperation> queued;
        final boolean repeat;
        final String repeatSource;
        final Response event;

        synchronized (this) {
            if (connectionState == ConnectionState.DESTROYED) return;
            recoveryInFlight = false;
            if (validation.failure == null) {
                connectionState = ConnectionState.READY;
                queued = drainReadyLocked();
                event = response(
                    true,
                    "ok",
                    source,
                    Collections.emptyList(),
                    validation.purchases
                );
            } else {
                connectionState = ConnectionState.DISCONNECTED;
                queued = drainReadyLocked();
                event = response(
                    false,
                    validation.invalidData ? "invalid_purchase" : "error",
                    source,
                    Collections.emptyList(),
                    Collections.emptyList()
                );
            }
            repeat = recoveryRequested;
            repeatSource = requestedRecoverySource;
            recoveryRequested = false;
            requestedRecoverySource = null;
        }

        if (validation.failure == null) {
            settleActiveFlowFromRecovery(validation.purchases);
        } else {
            rejectActiveFlowAfterRecoveryFailure();
        }
        emit(event);
        if (validation.failure == null) {
            runReadyOperations(queued);
        } else {
            failReadyOperations(
                queued,
                failure("BILLING_RECOVERY_FAILED", "Purchase recovery failed.")
            );
        }
        if (repeat) requestRecovery(repeatSource == null ? source : repeatSource);
    }

    private void settleActiveFlowFromRecovery(List<PurchaseData> purchases) {
        final ActiveFlow flow;
        synchronized (this) {
            if (activeFlow != null && activeFlow.phase == FlowPhase.PREPARING) {
                return;
            }
            flow = activeFlow;
        }

        if (flow == null) {
            clearPersistedFlow();
            return;
        }

        List<PurchaseData> matches = matchingPurchases(flow, purchases);
        if (matches.size() != 1) {
            reject(
                flow.settlement,
                failure(
                    "PURCHASE_RECOVERY_MISMATCH",
                    "The interrupted purchase could not be matched securely."
                )
            );
            return;
        }

        PurchaseData match = matches.get(0);
        boolean purchased = match.getPurchaseState() == PurchaseState.PURCHASED;
        resolve(
            flow.settlement,
            response(
                purchased,
                purchased ? "purchased" : "pending",
                "purchase_recovery",
                Collections.emptyList(),
                Collections.singletonList(match)
            )
        );
    }

    private void rejectActiveFlowAfterRecoveryFailure() {
        final ActiveFlow flow;
        synchronized (this) {
            flow = activeFlow != null && activeFlow.phase != FlowPhase.PREPARING
                ? activeFlow
                : null;
        }
        if (flow != null) {
            reject(
                flow.settlement,
                failure(
                    "PURCHASE_RECOVERY_FAILED",
                    "The interrupted purchase could not be recovered."
                )
            );
        }
    }

    private List<PurchaseData> matchingPurchases(
        ActiveFlow flow,
        List<PurchaseData> purchases
    ) {
        List<PurchaseData> matches = new ArrayList<>();
        for (PurchaseData purchase : purchases) {
            if (
                flow.productId.equals(purchase.getProductId()) &&
                flow.accountId.equals(purchase.getAccountId()) &&
                flow.flowMarker.equals(purchase.getFlowMarker())
            ) {
                matches.add(purchase);
            }
        }
        return matches;
    }

    private void onPurchasesUpdated(
        BillingResponse billingResponse,
        List<PurchaseData> purchases
    ) {
        final ActiveFlow flow;
        synchronized (this) {
            if (connectionState == ConnectionState.DESTROYED) return;
            flow = activeFlow != null && activeFlow.phase != FlowPhase.PREPARING
                ? activeFlow
                : null;
        }

        ResultCode code = billingResponse == null
            ? ResultCode.ERROR
            : billingResponse.getCode();
        if (code == ResultCode.CANCELED && flow != null) {
            resolve(
                flow.settlement,
                response(
                    false,
                    "canceled",
                    "purchase",
                    Collections.emptyList(),
                    Collections.emptyList()
                )
            );
            return;
        }
        if (code == ResultCode.ITEM_ALREADY_OWNED && flow != null) {
            reject(
                flow.settlement,
                failure(
                    "PURCHASE_ALREADY_OWNED",
                    "This product already has an unfinished purchase."
                )
            );
            requestRecovery("already_owned");
            return;
        }
        if (code != ResultCode.OK) {
            if (flow != null) {
                reject(
                    flow.settlement,
                    failure("PURCHASE_FAILED", "The Play purchase failed.")
                );
            } else {
                emit(
                    response(
                        false,
                        code == ResultCode.CANCELED ? "canceled" : "error",
                        "listener_recovery",
                        Collections.emptyList(),
                        Collections.emptyList()
                    )
                );
            }
            return;
        }

        PurchaseValidation validation = validatePurchases(
            new PurchaseQueryResult(billingResponse, purchases)
        );
        if (validation.failure != null) {
            emit(
                response(
                    false,
                    "invalid_purchase",
                    "listener_recovery",
                    Collections.emptyList(),
                    Collections.emptyList()
                )
            );
            return;
        }

        if (flow == null) {
            emit(recoveryEvent(validation.purchases));
            return;
        }

        List<PurchaseData> matches = new ArrayList<>();
        List<PurchaseData> recovery = new ArrayList<>();
        for (PurchaseData purchase : validation.purchases) {
            if (
                flow.productId.equals(purchase.getProductId()) &&
                flow.accountId.equals(purchase.getAccountId()) &&
                flow.flowMarker.equals(purchase.getFlowMarker())
            ) {
                matches.add(purchase);
            } else {
                recovery.add(purchase);
            }
        }

        if (matches.isEmpty()) {
            emit(recoveryEvent(validation.purchases));
            return;
        }
        if (matches.size() > 1) {
            reject(
                flow.settlement,
                failure(
                    "PURCHASE_CORRELATION_FAILED",
                    "The Play purchase could not be matched securely."
                )
            );
            emit(recoveryEvent(validation.purchases));
            return;
        }

        PurchaseData match = matches.get(0);
        boolean purchased = match.getPurchaseState() == PurchaseState.PURCHASED;
        resolve(
            flow.settlement,
            response(
                purchased,
                purchased ? "purchased" : "pending",
                "purchase",
                Collections.emptyList(),
                Collections.singletonList(match)
            )
        );
        if (!recovery.isEmpty()) emit(recoveryEvent(recovery));
    }

    private Response recoveryEvent(List<PurchaseData> purchases) {
        String status = "ok";
        for (PurchaseData purchase : purchases) {
            if (purchase.getPurchaseState() == PurchaseState.PURCHASED) {
                status = "purchased";
                break;
            }
            if (purchase.getPurchaseState() == PurchaseState.PENDING) {
                status = "pending";
            }
        }
        return response(
            !"pending".equals(status),
            status,
            "listener_recovery",
            Collections.emptyList(),
            purchases
        );
    }

    private CatalogValidation validateCatalog(
        ProductQueryResult result,
        List<String> requestedIds
    ) {
        if (
            result == null ||
            result.response == null ||
            !result.response.isOk()
        ) {
            return CatalogValidation.failure(
                failure("PRODUCT_QUERY_FAILED", "Play products are unavailable.")
            );
        }
        if (result.products == null || result.unfetchedProductIds == null) {
            return CatalogValidation.failure(
                failure("PRODUCT_DATA_INVALID", "Play returned invalid product data.")
            );
        }

        Set<String> requested = new LinkedHashSet<>(requestedIds);
        Set<String> unfetched = new LinkedHashSet<>();
        for (String productId : result.unfetchedProductIds) {
            if (productId == null || !requested.contains(productId) || !unfetched.add(productId)) {
                return CatalogValidation.failure(
                    failure("PRODUCT_DATA_INVALID", "Play returned invalid product data.")
                );
            }
        }
        if (!unfetched.isEmpty()) {
            return CatalogValidation.failure(
                failure("PRODUCT_UNFETCHED", "One or more Play products were not fetched.")
            );
        }

        Map<String, ProductData> indexed = new LinkedHashMap<>();
        for (ProductData product : result.products) {
            if (
                product == null ||
                !requested.contains(product.getProductId()) ||
                indexed.containsKey(product.getProductId()) ||
                !"inapp".equals(product.getProductType()) ||
                !validDisplayText(product.getName()) ||
                !validDisplayText(product.getTitle()) ||
                !validDisplayText(product.getDescription()) ||
                product.getPlatformProduct() == null
            ) {
                return CatalogValidation.failure(
                    failure("PRODUCT_DATA_INVALID", "Play returned invalid product data.")
                );
            }

            OfferData offer = selectImmediateOffer(product.getOffers());
            if (offer == null) {
                return CatalogValidation.failure(
                    failure(
                        "PRODUCT_OFFER_INVALID",
                        "A deterministic immediate purchase option is unavailable."
                    )
                );
            }
            indexed.put(product.getProductId(), product.select(offer));
        }

        if (!indexed.keySet().equals(requested)) {
            return CatalogValidation.failure(
                failure("PRODUCT_CATALOG_INCOMPLETE", "The Play product catalog is incomplete.")
            );
        }

        List<ProductData> ordered = new ArrayList<>();
        for (String productId : requestedIds) ordered.add(indexed.get(productId));
        return CatalogValidation.success(ordered);
    }

    private OfferData selectImmediateOffer(List<OfferData> offers) {
        if (offers == null || offers.isEmpty()) return null;

        List<OfferData> eligible = new ArrayList<>();
        Set<String> stableIdentities = new HashSet<>();
        for (OfferData offer : offers) {
            if (offer == null) return null;
            if (offer.isRental() || offer.isPreorder()) continue;
            if (!isValidImmediateOffer(offer)) return null;
            String identity = nullable(offer.getPurchaseOptionId()) + "\u0000" + nullable(offer.getOfferId());
            if (!stableIdentities.add(identity)) return null;
            eligible.add(offer);
        }
        if (eligible.isEmpty()) return null;

        // TTC prefers the base immediate option, then stable Play identifiers.
        eligible.sort(
            Comparator
                .comparingInt((OfferData offer) -> isBlank(offer.getOfferId()) ? 0 : 1)
                .thenComparing(offer -> nullable(offer.getPurchaseOptionId()))
                .thenComparing(offer -> nullable(offer.getOfferId()))
                .thenComparing(OfferData::getOfferToken)
        );
        return eligible.get(0);
    }

    private boolean isValidImmediateOffer(OfferData offer) {
        return (
            offer.getPriceAmountMicros() > 0L &&
            validDisplayText(offer.getFormattedPrice()) &&
            offer.getPriceCurrencyCode() != null &&
            CURRENCY_PATTERN.matcher(offer.getPriceCurrencyCode()).matches() &&
            !isBlank(offer.getOfferToken()) &&
            offer.getOfferToken().length() <= MAX_PROVIDER_TEXT_LENGTH &&
            validOptionalProviderId(offer.getPurchaseOptionId()) &&
            validOptionalProviderId(offer.getOfferId())
        );
    }

    private PurchaseValidation validatePurchases(PurchaseQueryResult result) {
        if (
            result == null ||
            result.response == null ||
            !result.response.isOk()
        ) {
            return PurchaseValidation.failure(
                failure("PURCHASE_QUERY_FAILED", "Owned purchases are unavailable."),
                false
            );
        }
        if (result.purchases == null) {
            return PurchaseValidation.failure(
                failure("PURCHASE_DATA_INVALID", "Play returned invalid purchase data."),
                true
            );
        }

        List<PurchaseData> valid = new ArrayList<>();
        Set<String> tokens = new HashSet<>();
        for (PurchaseData purchase : result.purchases) {
            if (!isValidPurchase(purchase) || !tokens.add(purchase.getPurchaseToken())) {
                return PurchaseValidation.failure(
                    failure("PURCHASE_DATA_INVALID", "Play returned invalid purchase data."),
                    true
                );
            }
            valid.add(purchase);
        }
        return PurchaseValidation.success(valid);
    }

    private boolean isValidPurchase(PurchaseData purchase) {
        if (
            purchase == null ||
            !packageName.equals(purchase.getPackageName()) ||
            purchase.getProductIds() == null ||
            purchase.getProductIds().size() != 1 ||
            !PRODUCT_ID_SET.contains(purchase.getProductId()) ||
            purchase.getQuantity() != 1 ||
            purchase.getPurchaseTime() < 0L ||
            purchase.getPurchaseState() == null ||
            purchase.getPurchaseState() == PurchaseState.UNSPECIFIED ||
            purchase.getPurchaseToken() == null ||
            !PURCHASE_TOKEN_PATTERN.matcher(purchase.getPurchaseToken()).matches() ||
            purchase.getAccountId() == null ||
            !ACCOUNT_ID_PATTERN.matcher(purchase.getAccountId()).matches() ||
            (
                purchase.getFlowMarker() != null &&
                !FLOW_MARKER_PATTERN.matcher(purchase.getFlowMarker()).matches()
            )
        ) {
            return false;
        }
        return validOrderId(purchase.getOrderId());
    }

    private boolean validOrderId(String orderId) {
        if (orderId == null) return true;
        if (orderId.isEmpty() || orderId.length() > 256) return false;
        for (int index = 0; index < orderId.length(); index += 1) {
            char value = orderId.charAt(index);
            if (value < 0x20 || value > 0x7e) return false;
        }
        return true;
    }

    private boolean validDisplayText(String value) {
        if (isBlank(value) || value.length() > MAX_PROVIDER_TEXT_LENGTH) return false;
        for (int index = 0; index < value.length(); index += 1) {
            char character = value.charAt(index);
            if (Character.isISOControl(character) && !Character.isWhitespace(character)) {
                return false;
            }
        }
        return true;
    }

    private boolean validOptionalProviderId(String value) {
        if (value == null) return true;
        return !value.isEmpty() && value.length() <= MAX_PROVIDER_TEXT_LENGTH;
    }

    private Settlement begin(ResultSink sink) {
        if (sink == null) throw new IllegalArgumentException("A result sink is required.");
        synchronized (this) {
            if (connectionState == ConnectionState.DESTROYED) {
                sink.reject(failure("BILLING_CLOSED", "Play Billing is closed."));
                return null;
            }
            Settlement settlement = new Settlement(generation, nextId++, sink);
            settlements.add(settlement);
            return settlement;
        }
    }

    private AsyncTicket beginAsync() {
        synchronized (this) {
            return beginAsyncLocked();
        }
    }

    private AsyncTicket beginAsyncLocked() {
        if (connectionState == ConnectionState.DESTROYED) return null;
        AsyncTicket ticket = new AsyncTicket(generation, nextId++);
        inFlight.add(ticket);
        return ticket;
    }

    private boolean claim(AsyncTicket ticket) {
        synchronized (this) {
            return (
                ticket != null &&
                ticket.generation == generation &&
                connectionState != ConnectionState.DESTROYED &&
                inFlight.remove(ticket)
            );
        }
    }

    private boolean resolve(Settlement settlement, Response response) {
        synchronized (this) {
            if (!isPendingLocked(settlement)) return false;
            settlements.remove(settlement);
            settlement.settled = true;
            clearActiveFlowLocked(settlement);
            settlement.sink.resolve(response);
            return true;
        }
    }

    private boolean reject(Settlement settlement, Failure failure) {
        synchronized (this) {
            return rejectLocked(settlement, failure);
        }
    }

    private boolean rejectLocked(Settlement settlement, Failure failure) {
        if (!isPendingLocked(settlement)) return false;
        settlements.remove(settlement);
        settlement.settled = true;
        clearActiveFlowLocked(settlement);
        settlement.sink.reject(failure);
        return true;
    }

    private boolean isPendingLocked(Settlement settlement) {
        return (
            settlement != null &&
            !settlement.settled &&
            settlement.generation == generation &&
            connectionState != ConnectionState.DESTROYED &&
            settlements.contains(settlement)
        );
    }

    private void clearActiveFlowLocked(Settlement settlement) {
        if (activeFlow != null && activeFlow.settlement == settlement) {
            activeFlow = null;
            clearPersistedFlowLocked();
        }
    }

    private PersistedFlow createAndPersistFlowLocked(
        String productId,
        String accountId
    ) {
        final String flowMarker;
        try {
            flowMarker = flowMarkerFactory.create();
        } catch (RuntimeException ignored) {
            return null;
        }
        if (
            flowMarker == null ||
            !FLOW_MARKER_PATTERN.matcher(flowMarker).matches()
        ) {
            return null;
        }

        PersistedFlow flow = new PersistedFlow(
            productId,
            accountId,
            flowMarker
        );
        try {
            if (!flowStateStore.save(flow)) return null;
        } catch (RuntimeException ignored) {
            return null;
        }
        persistedFlow = flow;
        return flow;
    }

    private PersistedFlow loadPersistedFlow() {
        final PersistedFlow flow;
        try {
            flow = flowStateStore.load();
        } catch (RuntimeException ignored) {
            return null;
        }
        if (flow == null) return null;
        if (
            PRODUCT_ID_SET.contains(flow.getProductId()) &&
            flow.getAccountId() != null &&
            ACCOUNT_ID_PATTERN.matcher(flow.getAccountId()).matches() &&
            flow.getFlowMarker() != null &&
            FLOW_MARKER_PATTERN.matcher(flow.getFlowMarker()).matches()
        ) {
            return flow;
        }
        try {
            flowStateStore.clear();
        } catch (RuntimeException ignored) {
            // Invalid app-private state cannot be used for correlation.
        }
        return null;
    }

    private void clearPersistedFlow() {
        synchronized (this) {
            clearPersistedFlowLocked();
        }
    }

    private void clearPersistedFlowLocked() {
        persistedFlow = null;
        try {
            flowStateStore.clear();
        } catch (RuntimeException ignored) {
            // A stale marker is revalidated and cleared on the next startup.
        }
    }

    private ActiveFlow activeFlowFor(Settlement settlement) {
        synchronized (this) {
            return activeFlow != null && activeFlow.settlement == settlement
                ? activeFlow
                : null;
        }
    }

    private boolean ownsActiveFlow(ActiveFlow flow) {
        synchronized (this) {
            return ownsActiveFlowLocked(flow);
        }
    }

    private boolean ownsActiveFlowLocked(ActiveFlow flow) {
        return (
            flow != null &&
            activeFlow == flow &&
            isPendingLocked(flow.settlement)
        );
    }

    private boolean ownsConnectionLocked(ConnectionHandle handle) {
        return (
            handle != null &&
            handle.generation == generation &&
            connectionState != ConnectionState.DESTROYED &&
            connectionHandle == handle
        );
    }

    private void runReadyOperations(List<ReadyOperation> operations) {
        for (ReadyOperation operation : operations) runReadyOperation(operation);
    }

    private void runReadyOperation(ReadyOperation operation) {
        synchronized (this) {
            if (!isPendingLocked(operation.settlement)) return;
        }
        try {
            operation.operation.run();
        } catch (RuntimeException ignored) {
            reject(
                operation.settlement,
                failure("BILLING_RUNTIME_FAILURE", "Play Billing is unavailable.")
            );
        }
    }

    private List<ReadyOperation> drainReadyLocked() {
        List<ReadyOperation> queued = new ArrayList<>(readyOperations);
        readyOperations.clear();
        return queued;
    }

    private void failReadyOperations(
        List<ReadyOperation> operations,
        Failure failure
    ) {
        for (ReadyOperation operation : operations) {
            reject(operation.settlement, failure);
        }
    }

    private void emit(Response response) {
        synchronized (this) {
            if (connectionState == ConnectionState.DESTROYED) return;
            eventSink.emit(response);
        }
    }

    private static Response response(
        boolean success,
        String status,
        String source,
        List<ProductData> products,
        List<PurchaseData> purchases
    ) {
        return new Response(success, status, source, products, purchases);
    }

    private static Failure failure(String code, String message) {
        return new Failure(code, message);
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String nullable(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private static final class Settlement {

        private final long generation;
        private final long id;
        private final ResultSink sink;
        private boolean settled;

        private Settlement(long generation, long id, ResultSink sink) {
            this.generation = generation;
            this.id = id;
            this.sink = sink;
        }
    }

    private static final class AsyncTicket {

        private final long generation;
        private final long id;

        private AsyncTicket(long generation, long id) {
            this.generation = generation;
            this.id = id;
        }
    }

    private static final class ConnectionHandle {

        private final long generation;
        private final long id;
        private boolean setupDelivered;
        private boolean setupSucceeded;

        private ConnectionHandle(long generation, long id) {
            this.generation = generation;
            this.id = id;
        }
    }

    private static final class ReadyOperation {

        private final Settlement settlement;
        private final Runnable operation;

        private ReadyOperation(Settlement settlement, Runnable operation) {
            this.settlement = settlement;
            this.operation = operation;
        }
    }

    private static final class ActiveFlow {

        private final String productId;
        private final String accountId;
        private final String flowMarker;
        private final Settlement settlement;
        private FlowPhase phase;

        private ActiveFlow(
            String productId,
            String accountId,
            String flowMarker,
            Settlement settlement,
            FlowPhase phase
        ) {
            this.productId = productId;
            this.accountId = accountId;
            this.flowMarker = flowMarker;
            this.settlement = settlement;
            this.phase = phase;
        }
    }

    private static final class CatalogValidation {

        private final List<ProductData> products;
        private final Failure failure;

        private CatalogValidation(List<ProductData> products, Failure failure) {
            this.products = products;
            this.failure = failure;
        }

        private static CatalogValidation success(List<ProductData> products) {
            return new CatalogValidation(products, null);
        }

        private static CatalogValidation failure(Failure failure) {
            return new CatalogValidation(Collections.emptyList(), failure);
        }
    }

    private static final class PurchaseValidation {

        private final List<PurchaseData> purchases;
        private final Failure failure;
        private final boolean invalidData;

        private PurchaseValidation(
            List<PurchaseData> purchases,
            Failure failure,
            boolean invalidData
        ) {
            this.purchases = purchases;
            this.failure = failure;
            this.invalidData = invalidData;
        }

        private static PurchaseValidation success(List<PurchaseData> purchases) {
            return new PurchaseValidation(purchases, null, false);
        }

        private static PurchaseValidation failure(
            Failure failure,
            boolean invalidData
        ) {
            return new PurchaseValidation(
                Collections.emptyList(),
                failure,
                invalidData
            );
        }
    }
}
