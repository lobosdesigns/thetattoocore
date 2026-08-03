package com.thetattoocore.app.payments;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;

public class TtcAdPurchasesControllerTest {

    private static final String PACKAGE_NAME = "com.thetattoocore.app";
    private static final String PRODUCT_25 = "ttc.adcredit.2500";
    private static final String PRODUCT_50 = "ttc.adcredit.5000";
    private static final String PRODUCT_100 = "ttc.adcredit.10000";
    private static final String ACCOUNT_A = repeat('a', 64);
    private static final String ACCOUNT_B = repeat('b', 64);
    private static final String FLOW_MARKER_A = repeat('1', 64);
    private static final String FLOW_MARKER_B = repeat('2', 64);

    @Test
    public void profileHashIsCanonicalAndMalformedProfilesAreRejected() {
        assertEquals(
            "986c0dc956dc822b5d8f698661b9eb1ef880786ff9043c16744d2a420e99e9bb",
            TtcAdPurchasesController.accountIdForProfile(
                "123E4567-E89B-12D3-A456-426614174000"
            )
        );
        assertNull(TtcAdPurchasesController.accountIdForProfile("not-a-profile"));
    }

    @Test
    public void setupFailureRejectsQueuedCallExactlyOnce() {
        Harness harness = new Harness();
        RecordingResult result = new RecordingResult();

        harness.controller.getProducts(result);

        assertEquals(1, harness.facade.connectCalls);
        harness.facade.completeSetup(error());
        harness.facade.completeSetup(ok());

        assertEquals(1, result.rejectionCount);
        assertEquals(0, result.resolutionCount);
        assertEquals("BILLING_SETUP_FAILED", result.failure.getCode());
        assertEquals(0, harness.facade.purchaseQueries.size());
    }

    @Test
    public void disconnectUsesAutomaticReconnectQueryWithoutManualConnect() {
        Harness harness = readyHarness();
        int connectCalls = harness.facade.connectCalls;

        harness.facade.disconnect();

        assertEquals(connectCalls, harness.facade.connectCalls);
        assertEquals(2, harness.facade.purchaseQueries.size());

        harness.facade.completePurchaseQuery(1, purchaseQuery(ok()));

        assertEquals(1, harness.events.size());
        assertEquals("reconnect", harness.events.get(0).getSource());
        assertEquals("ok", harness.events.get(0).getStatus());
    }

    @Test
    public void resumeAlwaysSubmitsARecoveryQuery() {
        Harness harness = readyHarness();

        harness.controller.resume();

        assertEquals(2, harness.facade.purchaseQueries.size());
        harness.facade.completePurchaseQuery(1, purchaseQuery(ok()));
        assertEquals("resume", harness.events.get(0).getSource());
    }

    @Test
    public void outOfBandUpdateCannotCompletePreparingFlow() {
        Harness harness = readyHarness();
        RecordingResult result = new RecordingResult();

        harness.controller.purchase(PRODUCT_25, ACCOUNT_A, result);
        harness.facade.emitUpdate(ok(), List.of(purchased(PRODUCT_25, ACCOUNT_A)));

        assertEquals(0, result.completionCount());
        assertEquals(1, harness.events.size());
        assertEquals("listener_recovery", harness.events.get(0).getSource());
        assertEquals("purchased", harness.events.get(0).getStatus());
    }

    @Test
    public void pendingIsTerminalAndLaterPurchaseBecomesRecovery() {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);

        harness.facade.emitUpdate(ok(), List.of(pending(PRODUCT_25, ACCOUNT_A)));

        assertEquals(1, result.resolutionCount);
        assertFalse(result.response.isSuccess());
        assertEquals("pending", result.response.getStatus());
        assertEquals(0, harness.events.size());

        harness.facade.emitUpdate(ok(), List.of(purchased(PRODUCT_25, ACCOUNT_A)));

        assertEquals(1, result.completionCount());
        assertEquals(1, harness.events.size());
        assertEquals("purchased", harness.events.get(0).getStatus());
    }

    @Test
    public void cancellationIsAnExplicitNonSuccessTerminalState() {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);

        harness.facade.emitUpdate(canceled(), Collections.emptyList());

        assertEquals(1, result.resolutionCount);
        assertFalse(result.response.isSuccess());
        assertEquals("canceled", result.response.getStatus());
        assertTrue(result.response.getPurchases().isEmpty());
    }

    @Test
    public void wrongAccountRemainsRecoveryAndCannotSettleLaunchedFlow() {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);

        harness.facade.emitUpdate(ok(), List.of(purchased(PRODUCT_25, ACCOUNT_B)));

        assertEquals(0, result.completionCount());
        assertEquals(1, harness.events.size());
        assertEquals("listener_recovery", harness.events.get(0).getSource());

        harness.facade.emitUpdate(ok(), List.of(purchased(PRODUCT_25, ACCOUNT_A)));

        assertEquals(1, result.resolutionCount);
        assertTrue(result.response.isSuccess());
    }

    @Test
    public void unrelatedSameAccountAndProductCannotSettleActiveFlow() {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);

        harness.facade.emitUpdate(
            ok(),
            List.of(purchased(PRODUCT_25, ACCOUNT_A, FLOW_MARKER_B))
        );

        assertEquals(0, result.completionCount());
        assertEquals(1, harness.events.size());
        assertEquals("listener_recovery", harness.events.get(0).getSource());

        harness.facade.emitUpdate(
            ok(),
            List.of(purchased(PRODUCT_25, ACCOUNT_A, FLOW_MARKER_A))
        );

        assertEquals(1, result.resolutionCount);
        assertTrue(result.response.isSuccess());
    }

    @Test
    public void resumeRecoverySettlesActiveFlowAndStillEmitsPurchase() {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);

        harness.controller.resume();
        harness.facade.completePurchaseQuery(
            1,
            purchaseQuery(
                ok(),
                List.of(purchased(PRODUCT_25, ACCOUNT_A, FLOW_MARKER_A))
            )
        );

        assertEquals(1, result.resolutionCount);
        assertEquals(0, result.rejectionCount);
        assertTrue(result.response.isSuccess());
        assertEquals(1, harness.events.size());
        assertEquals("resume", harness.events.get(0).getSource());
        assertEquals(1, harness.events.get(0).getPurchases().size());
        assertNull(harness.flowStore.current);
    }

    @Test
    public void resumeRecoveryRejectsAndClearsFlowWhenMarkerDoesNotMatch() {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);

        harness.controller.resume();
        harness.facade.completePurchaseQuery(
            1,
            purchaseQuery(
                ok(),
                List.of(purchased(PRODUCT_25, ACCOUNT_A, FLOW_MARKER_B))
            )
        );

        assertEquals(0, result.resolutionCount);
        assertEquals(1, result.rejectionCount);
        assertEquals("PURCHASE_RECOVERY_MISMATCH", result.failure.getCode());
        assertNull(harness.flowStore.current);

        RecordingResult retry = new RecordingResult();
        harness.controller.purchase(PRODUCT_25, ACCOUNT_A, retry);
        assertEquals(0, retry.completionCount());
        assertEquals(2, harness.facade.productQueries.size());
    }

    @Test
    public void concurrentListenerAndRecoveryCallbacksSettleCallExactlyOnce()
        throws Exception {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);
        List<TtcAdPurchasesController.PurchaseData> purchases = List.of(
            purchased(PRODUCT_25, ACCOUNT_A, FLOW_MARKER_A)
        );
        harness.controller.resume();

        CountDownLatch start = new CountDownLatch(1);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        Thread listener = callbackThread(
            start,
            failure,
            () -> harness.facade.emitUpdate(ok(), purchases)
        );
        Thread recovery = callbackThread(
            start,
            failure,
            () -> harness.facade.completePurchaseQuery(
                1,
                purchaseQuery(ok(), purchases)
            )
        );

        listener.start();
        recovery.start();
        start.countDown();
        listener.join(5_000L);
        recovery.join(5_000L);

        assertFalse(listener.isAlive());
        assertFalse(recovery.isAlive());
        if (failure.get() != null) throw new AssertionError(failure.get());
        assertEquals(1, result.completionCount());
        assertEquals(1, result.resolutionCount);
        assertTrue(
            harness.events.stream().anyMatch(event ->
                "resume".equals(event.getSource()) &&
                event.getPurchases().size() == 1
            )
        );
    }

    @Test
    public void persistedFlowSurvivesControllerRestartAndRecoversPurchase() {
        FakeFlowStateStore store = new FakeFlowStateStore();
        Harness first = readyHarness(store, FLOW_MARKER_A);
        RecordingResult interrupted = launchPurchase(first, ACCOUNT_A);

        assertNotNull(store.current);
        assertEquals(FLOW_MARKER_A, store.current.getFlowMarker());
        first.controller.destroy();
        assertEquals(1, interrupted.rejectionCount);
        assertNotNull(store.current);

        Harness restarted = new Harness(store, FLOW_MARKER_B);
        restarted.controller.start();
        restarted.facade.completeSetup(ok());
        restarted.facade.completePurchaseQuery(
            0,
            purchaseQuery(
                ok(),
                List.of(purchased(PRODUCT_25, ACCOUNT_A, FLOW_MARKER_A))
            )
        );

        assertEquals(1, restarted.events.size());
        assertEquals(1, restarted.events.get(0).getPurchases().size());
        assertNull(store.current);
    }

    @Test
    public void malformedPurchaseIsRedactedAndCannotSettleLaunchedFlow() {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);
        TtcAdPurchasesController.PurchaseData malformed = new TtcAdPurchasesController.PurchaseData(
            "other.package",
            List.of(PRODUCT_25),
            "short",
            "private-order",
            TtcAdPurchasesController.PurchaseState.PURCHASED,
            1,
            1L,
            1,
            false,
            ACCOUNT_A,
            FLOW_MARKER_A
        );

        harness.facade.emitUpdate(ok(), List.of(malformed));

        assertEquals(0, result.completionCount());
        assertEquals(1, harness.events.size());
        assertEquals("invalid_purchase", harness.events.get(0).getStatus());
        assertTrue(harness.events.get(0).getPurchases().isEmpty());
    }

    @Test
    public void duplicatePurchaseCallbacksSettleTheCallOnce() {
        Harness harness = readyHarness();
        RecordingResult result = launchPurchase(harness, ACCOUNT_A);
        List<TtcAdPurchasesController.PurchaseData> purchases = List.of(
            purchased(PRODUCT_25, ACCOUNT_A)
        );

        harness.facade.emitUpdate(ok(), purchases);
        harness.facade.emitUpdate(ok(), purchases);

        assertEquals(1, result.resolutionCount);
        assertEquals(0, result.rejectionCount);
        assertEquals(1, harness.events.size());
    }

    @Test
    public void destroyRejectsOnceAndSuppressesLateCallbacksAndEvents() {
        Harness harness = readyHarness();
        RecordingResult result = new RecordingResult();

        harness.controller.purchase(PRODUCT_25, ACCOUNT_A, result);
        assertEquals(1, harness.facade.productQueries.size());

        harness.controller.destroy();
        harness.facade.completeProductQuery(
            0,
            productQuery(ok(), List.of(product(PRODUCT_25)), Collections.emptyList())
        );
        harness.facade.emitUpdate(ok(), List.of(purchased(PRODUCT_25, ACCOUNT_A)));

        assertEquals(1, result.rejectionCount);
        assertEquals("BILLING_CLOSED", result.failure.getCode());
        assertEquals(0, result.resolutionCount);
        assertEquals(0, harness.facade.launches.size());
        assertEquals(0, harness.events.size());
        assertEquals(1, harness.facade.closeCalls);
    }

    @Test
    public void duplicateAsyncCallbackSettlesCatalogCallOnce() {
        Harness harness = readyHarness();
        RecordingResult result = new RecordingResult();
        TtcAdPurchasesController.ProductQueryResult query = productQuery(
            ok(),
            List.of(product(PRODUCT_25), product(PRODUCT_50), product(PRODUCT_100)),
            Collections.emptyList()
        );

        harness.controller.getProducts(result);
        harness.facade.completeProductQuery(0, query);
        harness.facade.completeProductQuery(0, query);

        assertEquals(1, result.resolutionCount);
        assertEquals(0, result.rejectionCount);
    }

    @Test
    public void multipleImmediateOffersUseDeterministicBaseOptionForDisplayAndLaunch() {
        Harness harness = readyHarness();
        RecordingResult result = new RecordingResult();
        TtcAdPurchasesController.ProductData product = product(
            PRODUCT_25,
            List.of(
                offer("promo-option", "promo", "promo-token", "$20.00", 20_000_000L),
                offer("standard-option", null, "base-token", "$25.00", 25_000_000L)
            )
        );

        harness.controller.purchase(PRODUCT_25, ACCOUNT_A, result);
        harness.facade.completeProductQuery(
            0,
            productQuery(ok(), List.of(product), Collections.emptyList())
        );

        assertEquals(1, harness.facade.launches.size());
        assertEquals(
            "base-token",
            harness.facade.launches.get(0).product.getSelectedOffer().getOfferToken()
        );
        assertEquals(
            "$25.00",
            harness.facade.launches.get(0).product.getSelectedOffer().getFormattedPrice()
        );
        assertEquals(ACCOUNT_A, harness.facade.launches.get(0).accountId);
        assertEquals(FLOW_MARKER_A, harness.facade.launches.get(0).flowMarker);
        assertNotNull(harness.flowStore.current);
        assertEquals(FLOW_MARKER_A, harness.flowStore.current.getFlowMarker());
    }

    @Test
    public void unfetchedProductHasExplicitFailure() {
        Harness harness = readyHarness();
        RecordingResult result = new RecordingResult();

        harness.controller.getProducts(result);
        harness.facade.completeProductQuery(
            0,
            productQuery(
                ok(),
                List.of(product(PRODUCT_25), product(PRODUCT_50)),
                List.of(PRODUCT_100)
            )
        );

        assertEquals(1, result.rejectionCount);
        assertEquals("PRODUCT_UNFETCHED", result.failure.getCode());
    }

    @Test
    public void duplicateImmediateOfferIdentityFailsClosed() {
        Harness harness = readyHarness();
        RecordingResult result = new RecordingResult();
        TtcAdPurchasesController.ProductData product = product(
            PRODUCT_25,
            List.of(
                offer("standard-option", null, "base-token-a", "$25.00", 25_000_000L),
                offer("standard-option", null, "base-token-b", "$25.00", 25_000_000L)
            )
        );

        harness.controller.purchase(PRODUCT_25, ACCOUNT_A, result);
        harness.facade.completeProductQuery(
            0,
            productQuery(ok(), List.of(product), Collections.emptyList())
        );

        assertEquals(1, result.rejectionCount);
        assertEquals("PRODUCT_OFFER_INVALID", result.failure.getCode());
        assertTrue(harness.facade.launches.isEmpty());
    }

    private static RecordingResult launchPurchase(Harness harness, String accountId) {
        RecordingResult result = new RecordingResult();
        harness.controller.purchase(PRODUCT_25, accountId, result);
        harness.facade.completeProductQuery(
            0,
            productQuery(ok(), List.of(product(PRODUCT_25)), Collections.emptyList())
        );
        harness.facade.completeLaunch(0, ok());
        return result;
    }

    private static Harness readyHarness() {
        Harness harness = new Harness();
        harness.controller.start();
        harness.facade.completeSetup(ok());
        assertEquals(1, harness.facade.purchaseQueries.size());
        harness.facade.completePurchaseQuery(0, purchaseQuery(ok()));
        harness.events.clear();
        return harness;
    }

    private static TtcAdPurchasesController.BillingResponse ok() {
        return new TtcAdPurchasesController.BillingResponse(
            TtcAdPurchasesController.ResultCode.OK
        );
    }

    private static TtcAdPurchasesController.BillingResponse canceled() {
        return new TtcAdPurchasesController.BillingResponse(
            TtcAdPurchasesController.ResultCode.CANCELED
        );
    }

    private static TtcAdPurchasesController.BillingResponse error() {
        return new TtcAdPurchasesController.BillingResponse(
            TtcAdPurchasesController.ResultCode.ERROR
        );
    }

    private static TtcAdPurchasesController.ProductQueryResult productQuery(
        TtcAdPurchasesController.BillingResponse response,
        List<TtcAdPurchasesController.ProductData> products,
        List<String> unfetchedProductIds
    ) {
        return new TtcAdPurchasesController.ProductQueryResult(
            response,
            products,
            unfetchedProductIds
        );
    }

    private static TtcAdPurchasesController.PurchaseQueryResult purchaseQuery(
        TtcAdPurchasesController.BillingResponse response
    ) {
        return purchaseQuery(response, Collections.emptyList());
    }

    private static TtcAdPurchasesController.PurchaseQueryResult purchaseQuery(
        TtcAdPurchasesController.BillingResponse response,
        List<TtcAdPurchasesController.PurchaseData> purchases
    ) {
        return new TtcAdPurchasesController.PurchaseQueryResult(
            response,
            purchases
        );
    }

    private static TtcAdPurchasesController.ProductData product(String productId) {
        return product(
            productId,
            List.of(offer("standard-option", null, productId + "-token", "$25.00", 25_000_000L))
        );
    }

    private static TtcAdPurchasesController.ProductData product(
        String productId,
        List<TtcAdPurchasesController.OfferData> offers
    ) {
        return new TtcAdPurchasesController.ProductData(
            productId,
            "Ad credit",
            "TTC ad credit",
            "Purchased ad credit",
            "inapp",
            offers,
            productId
        );
    }

    private static TtcAdPurchasesController.OfferData offer(
        String purchaseOptionId,
        String offerId,
        String offerToken,
        String formattedPrice,
        long micros
    ) {
        return new TtcAdPurchasesController.OfferData(
            micros,
            formattedPrice,
            "USD",
            purchaseOptionId,
            offerId,
            offerToken,
            false,
            false
        );
    }

    private static TtcAdPurchasesController.PurchaseData purchased(
        String productId,
        String accountId
    ) {
        return purchased(productId, accountId, FLOW_MARKER_A);
    }

    private static TtcAdPurchasesController.PurchaseData purchased(
        String productId,
        String accountId,
        String flowMarker
    ) {
        return purchase(
            productId,
            accountId,
            flowMarker,
            TtcAdPurchasesController.PurchaseState.PURCHASED,
            1
        );
    }

    private static TtcAdPurchasesController.PurchaseData pending(
        String productId,
        String accountId
    ) {
        return purchase(
            productId,
            accountId,
            FLOW_MARKER_A,
            TtcAdPurchasesController.PurchaseState.PENDING,
            2
        );
    }

    private static TtcAdPurchasesController.PurchaseData purchase(
        String productId,
        String accountId,
        String flowMarker,
        TtcAdPurchasesController.PurchaseState state,
        int stateCode
    ) {
        return new TtcAdPurchasesController.PurchaseData(
            PACKAGE_NAME,
            List.of(productId),
            "valid-purchase-token-1234567890",
            "order-123",
            state,
            stateCode,
            1L,
            1,
            false,
            accountId,
            flowMarker
        );
    }

    private static Thread callbackThread(
        CountDownLatch start,
        AtomicReference<Throwable> failure,
        Runnable callback
    ) {
        return new Thread(() -> {
            try {
                start.await();
                callback.run();
            } catch (Throwable error) {
                failure.compareAndSet(null, error);
            }
        });
    }

    private static String repeat(char value, int count) {
        return String.join("", Collections.nCopies(count, String.valueOf(value)));
    }

    private static Harness readyHarness(
        FakeFlowStateStore store,
        String marker
    ) {
        Harness harness = new Harness(store, marker);
        harness.controller.start();
        harness.facade.completeSetup(ok());
        assertEquals(1, harness.facade.purchaseQueries.size());
        harness.facade.completePurchaseQuery(0, purchaseQuery(ok()));
        harness.events.clear();
        return harness;
    }

    private static final class Harness {

        private final FakeBillingFacade facade = new FakeBillingFacade();
        private final List<TtcAdPurchasesController.Response> events = new ArrayList<>();
        private final FakeFlowStateStore flowStore;
        private final TtcAdPurchasesController controller;

        private Harness() {
            this(new FakeFlowStateStore(), FLOW_MARKER_A);
        }

        private Harness(FakeFlowStateStore flowStore, String marker) {
            this.flowStore = flowStore;
            controller = new TtcAdPurchasesController(
                facade,
                PACKAGE_NAME,
                events::add,
                flowStore,
                () -> marker
            );
        }
    }

    private static final class RecordingResult
        implements TtcAdPurchasesController.ResultSink {

        private int resolutionCount;
        private int rejectionCount;
        private TtcAdPurchasesController.Response response;
        private TtcAdPurchasesController.Failure failure;

        @Override
        public void resolve(TtcAdPurchasesController.Response response) {
            resolutionCount += 1;
            this.response = response;
        }

        @Override
        public void reject(TtcAdPurchasesController.Failure failure) {
            rejectionCount += 1;
            this.failure = failure;
        }

        private int completionCount() {
            return resolutionCount + rejectionCount;
        }
    }

    private static final class FakeBillingFacade
        implements TtcAdPurchasesController.BillingFacade {

        private int connectCalls;
        private int closeCalls;
        private TtcAdPurchasesController.BillingListener billingListener;
        private TtcAdPurchasesController.ConnectionListener connectionListener;
        private final List<TtcAdPurchasesController.ProductQueryCallback> productQueries =
            new ArrayList<>();
        private final List<TtcAdPurchasesController.PurchaseQueryCallback> purchaseQueries =
            new ArrayList<>();
        private final List<Launch> launches = new ArrayList<>();

        @Override
        public void setListener(TtcAdPurchasesController.BillingListener listener) {
            billingListener = listener;
        }

        @Override
        public void connect(TtcAdPurchasesController.ConnectionListener listener) {
            connectCalls += 1;
            connectionListener = listener;
        }

        @Override
        public void queryProducts(
            List<String> productIds,
            TtcAdPurchasesController.ProductQueryCallback callback
        ) {
            productQueries.add(callback);
        }

        @Override
        public void queryPurchases(
            TtcAdPurchasesController.PurchaseQueryCallback callback
        ) {
            purchaseQueries.add(callback);
        }

        @Override
        public void launchPurchase(
            TtcAdPurchasesController.ProductData product,
            String accountId,
            String flowMarker,
            TtcAdPurchasesController.LaunchCallback callback
        ) {
            launches.add(new Launch(product, accountId, flowMarker, callback));
        }

        @Override
        public void close() {
            closeCalls += 1;
        }

        private void completeSetup(TtcAdPurchasesController.BillingResponse response) {
            assertNotNull(connectionListener);
            connectionListener.onSetupFinished(response);
        }

        private void disconnect() {
            assertNotNull(connectionListener);
            connectionListener.onDisconnected();
        }

        private void completeProductQuery(
            int index,
            TtcAdPurchasesController.ProductQueryResult result
        ) {
            productQueries.get(index).onResult(result);
        }

        private void completePurchaseQuery(
            int index,
            TtcAdPurchasesController.PurchaseQueryResult result
        ) {
            purchaseQueries.get(index).onResult(result);
        }

        private void completeLaunch(
            int index,
            TtcAdPurchasesController.BillingResponse response
        ) {
            launches.get(index).callback.onResult(response);
        }

        private void emitUpdate(
            TtcAdPurchasesController.BillingResponse response,
            List<TtcAdPurchasesController.PurchaseData> purchases
        ) {
            assertNotNull(billingListener);
            billingListener.onPurchasesUpdated(response, purchases);
        }
    }

    private static final class Launch {

        private final TtcAdPurchasesController.ProductData product;
        private final String accountId;
        private final String flowMarker;
        private final TtcAdPurchasesController.LaunchCallback callback;

        private Launch(
            TtcAdPurchasesController.ProductData product,
            String accountId,
            String flowMarker,
            TtcAdPurchasesController.LaunchCallback callback
        ) {
            this.product = product;
            this.accountId = accountId;
            this.flowMarker = flowMarker;
            this.callback = callback;
        }
    }

    private static final class FakeFlowStateStore
        implements TtcAdPurchasesController.FlowStateStore {

        private TtcAdPurchasesController.PersistedFlow current;

        @Override
        public TtcAdPurchasesController.PersistedFlow load() {
            return current;
        }

        @Override
        public boolean save(TtcAdPurchasesController.PersistedFlow flow) {
            current = flow;
            return true;
        }

        @Override
        public boolean clear() {
            current = null;
            return true;
        }
    }
}
