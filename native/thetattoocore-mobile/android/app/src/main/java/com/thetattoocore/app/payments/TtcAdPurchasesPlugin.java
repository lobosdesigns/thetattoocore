package com.thetattoocore.app.payments;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import com.android.billingclient.api.AccountIdentifiers;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.UnfetchedProduct;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONObject;

@CapacitorPlugin(name = "TtcAdPurchases")
public final class TtcAdPurchasesPlugin extends Plugin {

    private static final String PURCHASES_UPDATED_EVENT = "purchasesUpdated";
    private static final String FLOW_STATE_PREFERENCES =
        "ttc_ad_purchase_flow_v1";
    private static final String FLOW_PRODUCT_KEY = "product_id";
    private static final String FLOW_ACCOUNT_KEY = "account_id";
    private static final String FLOW_MARKER_KEY = "flow_marker";
    private final Object lifecycleLock = new Object();

    private TtcAdPurchasesController controller;

    @Override
    public void load() {
        final TtcAdPurchasesController loadedController;
        synchronized (lifecycleLock) {
            if (controller != null) return;

            GooglePlayBillingFacade facade = new GooglePlayBillingFacade(
                getContext(),
                this::getActivity
            );
            loadedController = new TtcAdPurchasesController(
                facade,
                getContext().getPackageName(),
                response ->
                    notifyListeners(
                        PURCHASES_UPDATED_EVENT,
                        responseToJS(response),
                        true
                    ),
                new SharedPreferencesFlowStateStore(
                    getContext().getSharedPreferences(
                        FLOW_STATE_PREFERENCES,
                        Context.MODE_PRIVATE
                    )
                ),
                new SecureFlowMarkerFactory()
            );
            controller = loadedController;
        }
        loadedController.start();
    }

    @PluginMethod
    public void getProducts(PluginCall call) {
        TtcAdPurchasesController current = controllerOrReject(call);
        if (current == null) return;
        current.getProducts(new CapacitorResult(call));
    }

    @PluginMethod
    public void purchase(PluginCall call) {
        String accountId = TtcAdPurchasesController.accountIdForProfile(
            call.getString("profileId")
        );
        if (accountId == null) {
            call.reject(
                "A valid signed-in account is required.",
                "INVALID_ACCOUNT"
            );
            return;
        }

        TtcAdPurchasesController current = controllerOrReject(call);
        if (current == null) return;
        current.purchase(
            call.getString("productId"),
            accountId,
            new CapacitorResult(call)
        );
    }

    @PluginMethod
    public void queryPurchases(PluginCall call) {
        TtcAdPurchasesController current = controllerOrReject(call);
        if (current == null) return;
        current.queryPurchases(new CapacitorResult(call));
    }

    @Override
    protected void handleOnResume() {
        TtcAdPurchasesController current;
        synchronized (lifecycleLock) {
            current = controller;
        }
        if (current != null) current.resume();
        super.handleOnResume();
    }

    @Override
    protected void handleOnDestroy() {
        TtcAdPurchasesController current;
        synchronized (lifecycleLock) {
            current = controller;
            controller = null;
        }
        if (current != null) current.destroy();
        super.handleOnDestroy();
    }

    private TtcAdPurchasesController controllerOrReject(PluginCall call) {
        synchronized (lifecycleLock) {
            if (controller != null) return controller;
        }
        call.reject("Play Billing is unavailable.", "BILLING_UNAVAILABLE");
        return null;
    }

    private static JSObject responseToJS(
        TtcAdPurchasesController.Response response
    ) {
        JSArray products = new JSArray();
        for (TtcAdPurchasesController.ProductData product : response.getProducts()) {
            products.put(productToJS(product));
        }

        JSArray purchases = new JSArray();
        for (TtcAdPurchasesController.PurchaseData purchase : response.getPurchases()) {
            purchases.put(purchaseToJS(purchase));
        }

        JSObject result = new JSObject();
        result.put("success", response.isSuccess());
        result.put("status", response.getStatus());
        result.put("source", response.getSource());
        result.put("products", products);
        result.put("purchases", purchases);
        return result;
    }

    private static JSObject productToJS(
        TtcAdPurchasesController.ProductData product
    ) {
        TtcAdPurchasesController.OfferData offer = product.getSelectedOffer();
        JSObject result = new JSObject();
        result.put("productId", product.getProductId());
        result.put("name", product.getName());
        result.put("title", product.getTitle());
        result.put("description", product.getDescription());
        result.put("productType", product.getProductType());
        result.put("formattedPrice", offer.getFormattedPrice());
        result.put("priceAmountMicros", offer.getPriceAmountMicros());
        result.put("priceCurrencyCode", offer.getPriceCurrencyCode());
        putNullable(result, "purchaseOptionId", offer.getPurchaseOptionId());
        putNullable(result, "offerId", offer.getOfferId());
        return result;
    }

    private static JSObject purchaseToJS(
        TtcAdPurchasesController.PurchaseData purchase
    ) {
        JSObject result = new JSObject();
        result.put("productId", purchase.getProductId());
        result.put("purchaseToken", purchase.getPurchaseToken());
        putNullable(result, "orderId", purchase.getOrderId());
        result.put(
            "purchaseState",
            purchase.getPurchaseState() ==
                TtcAdPurchasesController.PurchaseState.PURCHASED
                ? "purchased"
                : "pending"
        );
        result.put("purchaseStateCode", purchase.getPurchaseStateCode());
        result.put("purchaseTime", purchase.getPurchaseTime());
        result.put("quantity", purchase.getQuantity());
        result.put("acknowledged", purchase.isAcknowledged());
        return result;
    }

    private static void putNullable(
        JSObject object,
        String key,
        String value
    ) {
        object.put(key, value == null ? JSONObject.NULL : value);
    }

    static <T> List<T> collectOneTimeOffers(
        List<T> multipleOffers,
        T singleOffer
    ) {
        if (multipleOffers != null && !multipleOffers.isEmpty()) {
            return new ArrayList<>(multipleOffers);
        }
        if (singleOffer == null) return Collections.emptyList();
        return Collections.singletonList(singleOffer);
    }

    private static final class CapacitorResult
        implements TtcAdPurchasesController.ResultSink {

        private final PluginCall call;

        private CapacitorResult(PluginCall call) {
            this.call = call;
        }

        @Override
        public void resolve(TtcAdPurchasesController.Response response) {
            call.resolve(responseToJS(response));
        }

        @Override
        public void reject(TtcAdPurchasesController.Failure failure) {
            call.reject(failure.getMessage(), failure.getCode());
        }
    }

    private interface ActivityProvider {
        Activity get();
    }

    private static final class SharedPreferencesFlowStateStore
        implements TtcAdPurchasesController.FlowStateStore {

        private final SharedPreferences preferences;

        private SharedPreferencesFlowStateStore(SharedPreferences preferences) {
            this.preferences = preferences;
        }

        @Override
        public TtcAdPurchasesController.PersistedFlow load() {
            String productId = preferences.getString(FLOW_PRODUCT_KEY, null);
            String accountId = preferences.getString(FLOW_ACCOUNT_KEY, null);
            String flowMarker = preferences.getString(FLOW_MARKER_KEY, null);
            if (productId == null && accountId == null && flowMarker == null) {
                return null;
            }
            return new TtcAdPurchasesController.PersistedFlow(
                productId,
                accountId,
                flowMarker
            );
        }

        @Override
        public boolean save(TtcAdPurchasesController.PersistedFlow flow) {
            return preferences
                .edit()
                .clear()
                .putString(FLOW_PRODUCT_KEY, flow.getProductId())
                .putString(FLOW_ACCOUNT_KEY, flow.getAccountId())
                .putString(FLOW_MARKER_KEY, flow.getFlowMarker())
                .commit();
        }

        @Override
        public boolean clear() {
            return preferences.edit().clear().commit();
        }
    }

    private static final class SecureFlowMarkerFactory
        implements TtcAdPurchasesController.FlowMarkerFactory {

        private final SecureRandom random = new SecureRandom();

        @Override
        public String create() {
            byte[] value = new byte[32];
            random.nextBytes(value);
            char[] encoded = new char[value.length * 2];
            char[] alphabet = "0123456789abcdef".toCharArray();
            for (int index = 0; index < value.length; index += 1) {
                int unsigned = value[index] & 0xff;
                encoded[index * 2] = alphabet[unsigned >>> 4];
                encoded[index * 2 + 1] = alphabet[unsigned & 0x0f];
            }
            return new String(encoded);
        }
    }

    private static final class GooglePlayBillingFacade
        implements
            TtcAdPurchasesController.BillingFacade,
            PurchasesUpdatedListener {

        private final Object stateLock = new Object();
        private final BillingClient billingClient;
        private final ActivityProvider activityProvider;
        private TtcAdPurchasesController.BillingListener listener;
        private boolean closed;

        private GooglePlayBillingFacade(
            Context context,
            ActivityProvider activityProvider
        ) {
            this.activityProvider = activityProvider;
            PendingPurchasesParams pendingPurchases = PendingPurchasesParams
                .newBuilder()
                .enableOneTimeProducts()
                .build();
            billingClient = BillingClient
                .newBuilder(context.getApplicationContext())
                .setListener(this)
                .enablePendingPurchases(pendingPurchases)
                .enableAutoServiceReconnection()
                .build();
        }

        @Override
        public void setListener(
            TtcAdPurchasesController.BillingListener listener
        ) {
            synchronized (stateLock) {
                if (this.listener != null) {
                    throw new IllegalStateException("Billing listener is already set.");
                }
                this.listener = listener;
            }
        }

        @Override
        public void connect(
            TtcAdPurchasesController.ConnectionListener connectionListener
        ) {
            if (isClosed()) {
                connectionListener.onSetupFinished(errorResponse());
                return;
            }
            billingClient.startConnection(
                new BillingClientStateListener() {
                    @Override
                    public void onBillingSetupFinished(BillingResult result) {
                        if (isClosed()) return;
                        connectionListener.onSetupFinished(toResponse(result));
                    }

                    @Override
                    public void onBillingServiceDisconnected() {
                        if (isClosed()) return;
                        connectionListener.onDisconnected();
                    }
                }
            );
        }

        @Override
        public void queryProducts(
            List<String> productIds,
            TtcAdPurchasesController.ProductQueryCallback callback
        ) {
            if (isClosed()) {
                callback.onResult(productQueryError());
                return;
            }

            List<QueryProductDetailsParams.Product> products = new ArrayList<>();
            for (String productId : productIds) {
                products.add(
                    QueryProductDetailsParams.Product
                        .newBuilder()
                        .setProductId(productId)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()
                );
            }
            QueryProductDetailsParams params = QueryProductDetailsParams
                .newBuilder()
                .setProductList(products)
                .build();

            billingClient.queryProductDetailsAsync(params, (result, queryResult) -> {
                if (isClosed()) return;
                TtcAdPurchasesController.ProductQueryResult mapped;
                try {
                    mapped = mapProductQuery(result, queryResult);
                } catch (RuntimeException ignored) {
                    mapped = new TtcAdPurchasesController.ProductQueryResult(
                        toResponse(result),
                        null,
                        null
                    );
                }
                callback.onResult(mapped);
            });
        }

        @Override
        public void queryPurchases(
            TtcAdPurchasesController.PurchaseQueryCallback callback
        ) {
            if (isClosed()) {
                callback.onResult(purchaseQueryError());
                return;
            }
            QueryPurchasesParams params = QueryPurchasesParams
                .newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();
            billingClient.queryPurchasesAsync(params, (result, purchases) -> {
                if (isClosed()) return;
                TtcAdPurchasesController.PurchaseQueryResult mapped;
                try {
                    mapped = new TtcAdPurchasesController.PurchaseQueryResult(
                        toResponse(result),
                        mapPurchases(purchases)
                    );
                } catch (RuntimeException ignored) {
                    mapped = new TtcAdPurchasesController.PurchaseQueryResult(
                        toResponse(result),
                        null
                    );
                }
                callback.onResult(mapped);
            });
        }

        @Override
        public void launchPurchase(
            TtcAdPurchasesController.ProductData product,
            String accountId,
            String flowMarker,
            TtcAdPurchasesController.LaunchCallback callback
        ) {
            Object platformProduct = product.getPlatformProduct();
            TtcAdPurchasesController.OfferData offer = product.getSelectedOffer();
            Activity activity = activityProvider.get();
            if (
                isClosed() ||
                !(platformProduct instanceof ProductDetails) ||
                offer == null ||
                activity == null
            ) {
                callback.onResult(errorResponse());
                return;
            }

            ProductDetails details = (ProductDetails) platformProduct;
            BillingFlowParams.ProductDetailsParams productParams =
                BillingFlowParams.ProductDetailsParams
                    .newBuilder()
                    .setProductDetails(details)
                    .setOfferToken(offer.getOfferToken())
                    .build();
            BillingFlowParams flowParams = BillingFlowParams
                .newBuilder()
                .setProductDetailsParamsList(
                    Collections.singletonList(productParams)
                )
                .setObfuscatedAccountId(accountId)
                .setObfuscatedProfileId(flowMarker)
                .build();

            activity.runOnUiThread(() -> {
                if (isClosed()) return;
                TtcAdPurchasesController.BillingResponse response;
                try {
                    response = toResponse(
                        billingClient.launchBillingFlow(activity, flowParams)
                    );
                } catch (RuntimeException ignored) {
                    response = errorResponse();
                }
                callback.onResult(response);
            });
        }

        @Override
        public void close() {
            synchronized (stateLock) {
                if (closed) return;
                closed = true;
            }
            billingClient.endConnection();
        }

        @Override
        public void onPurchasesUpdated(
            BillingResult result,
            List<Purchase> purchases
        ) {
            TtcAdPurchasesController.BillingListener current;
            synchronized (stateLock) {
                if (closed) return;
                current = listener;
            }
            if (current == null) return;
            TtcAdPurchasesController.BillingResponse response = toResponse(result);
            List<TtcAdPurchasesController.PurchaseData> mapped;
            try {
                mapped = mapPurchases(purchases);
            } catch (RuntimeException ignored) {
                mapped = null;
            }
            current.onPurchasesUpdated(response, mapped);
        }

        private TtcAdPurchasesController.ProductQueryResult mapProductQuery(
            BillingResult result,
            QueryProductDetailsResult queryResult
        ) {
            TtcAdPurchasesController.BillingResponse response = toResponse(result);
            if (!response.isOk()) {
                return new TtcAdPurchasesController.ProductQueryResult(
                    response,
                    Collections.emptyList(),
                    Collections.emptyList()
                );
            }
            if (queryResult == null) return productQueryError();

            List<TtcAdPurchasesController.ProductData> products = new ArrayList<>();
            List<ProductDetails> detailsList = queryResult.getProductDetailsList();
            if (detailsList == null) return productQueryError();
            for (ProductDetails details : detailsList) {
                products.add(mapProduct(details));
            }

            List<String> unfetchedIds = new ArrayList<>();
            List<UnfetchedProduct> unfetched = queryResult.getUnfetchedProductList();
            if (unfetched == null) return productQueryError();
            for (UnfetchedProduct product : unfetched) {
                unfetchedIds.add(product == null ? null : product.getProductId());
            }
            return new TtcAdPurchasesController.ProductQueryResult(
                response,
                products,
                unfetchedIds
            );
        }

        private TtcAdPurchasesController.ProductData mapProduct(
            ProductDetails details
        ) {
            if (details == null) return null;
            List<TtcAdPurchasesController.OfferData> offers = new ArrayList<>();
            List<ProductDetails.OneTimePurchaseOfferDetails> detailsOffers =
                collectOneTimeOffers(
                    details.getOneTimePurchaseOfferDetailsList(),
                    details.getOneTimePurchaseOfferDetails()
                );
            for (ProductDetails.OneTimePurchaseOfferDetails offer : detailsOffers) {
                if (offer == null) {
                    offers.add(null);
                } else {
                    offers.add(
                        new TtcAdPurchasesController.OfferData(
                            offer.getPriceAmountMicros(),
                            offer.getFormattedPrice(),
                            offer.getPriceCurrencyCode(),
                            offer.getPurchaseOptionId(),
                            offer.getOfferId(),
                            offer.getOfferToken(),
                            offer.getRentalDetails() != null,
                            offer.getPreorderDetails() != null
                        )
                    );
                }
            }
            return new TtcAdPurchasesController.ProductData(
                details.getProductId(),
                details.getName(),
                details.getTitle(),
                details.getDescription(),
                details.getProductType(),
                offers,
                details
            );
        }

        private List<TtcAdPurchasesController.PurchaseData> mapPurchases(
            List<Purchase> purchases
        ) {
            if (purchases == null) return null;
            List<TtcAdPurchasesController.PurchaseData> mapped = new ArrayList<>();
            for (Purchase purchase : purchases) mapped.add(mapPurchase(purchase));
            return mapped;
        }

        private TtcAdPurchasesController.PurchaseData mapPurchase(
            Purchase purchase
        ) {
            if (purchase == null) return null;
            AccountIdentifiers identifiers = purchase.getAccountIdentifiers();
            return new TtcAdPurchasesController.PurchaseData(
                purchase.getPackageName(),
                purchase.getProducts(),
                purchase.getPurchaseToken(),
                purchase.getOrderId(),
                purchaseState(purchase.getPurchaseState()),
                purchase.getPurchaseState(),
                purchase.getPurchaseTime(),
                purchase.getQuantity(),
                purchase.isAcknowledged(),
                identifiers == null
                    ? null
                    : identifiers.getObfuscatedAccountId(),
                identifiers == null
                    ? null
                    : identifiers.getObfuscatedProfileId()
            );
        }

        private boolean isClosed() {
            synchronized (stateLock) {
                return closed;
            }
        }

        private static TtcAdPurchasesController.BillingResponse toResponse(
            BillingResult result
        ) {
            if (result == null) return errorResponse();
            switch (result.getResponseCode()) {
                case BillingClient.BillingResponseCode.OK:
                    return new TtcAdPurchasesController.BillingResponse(
                        TtcAdPurchasesController.ResultCode.OK
                    );
                case BillingClient.BillingResponseCode.USER_CANCELED:
                    return new TtcAdPurchasesController.BillingResponse(
                        TtcAdPurchasesController.ResultCode.CANCELED
                    );
                case BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED:
                    return new TtcAdPurchasesController.BillingResponse(
                        TtcAdPurchasesController.ResultCode.ITEM_ALREADY_OWNED
                    );
                default:
                    return errorResponse();
            }
        }

        private static TtcAdPurchasesController.BillingResponse errorResponse() {
            return new TtcAdPurchasesController.BillingResponse(
                TtcAdPurchasesController.ResultCode.ERROR
            );
        }

        private static TtcAdPurchasesController.ProductQueryResult productQueryError() {
            return new TtcAdPurchasesController.ProductQueryResult(
                errorResponse(),
                Collections.emptyList(),
                Collections.emptyList()
            );
        }

        private static TtcAdPurchasesController.PurchaseQueryResult purchaseQueryError() {
            return new TtcAdPurchasesController.PurchaseQueryResult(
                errorResponse(),
                Collections.emptyList()
            );
        }

        private static TtcAdPurchasesController.PurchaseState purchaseState(
            int state
        ) {
            switch (state) {
                case Purchase.PurchaseState.PURCHASED:
                    return TtcAdPurchasesController.PurchaseState.PURCHASED;
                case Purchase.PurchaseState.PENDING:
                    return TtcAdPurchasesController.PurchaseState.PENDING;
                default:
                    return TtcAdPurchasesController.PurchaseState.UNSPECIFIED;
            }
        }
    }
}
