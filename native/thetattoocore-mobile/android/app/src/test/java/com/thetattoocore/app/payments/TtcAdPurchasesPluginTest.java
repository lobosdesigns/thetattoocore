package com.thetattoocore.app.payments;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;

import java.util.Collections;
import java.util.List;
import org.junit.Test;

public class TtcAdPurchasesPluginTest {

    @Test
    public void ordinarySingleOptionIsUsedWhenMultiOfferListIsMissing() {
        Object single = new Object();

        List<Object> offers = TtcAdPurchasesPlugin.collectOneTimeOffers(
            null,
            single
        );

        assertEquals(1, offers.size());
        assertSame(single, offers.get(0));
    }

    @Test
    public void ordinarySingleOptionIsUsedWhenMultiOfferListIsEmpty() {
        Object single = new Object();

        List<Object> offers = TtcAdPurchasesPlugin.collectOneTimeOffers(
            Collections.emptyList(),
            single
        );

        assertEquals(1, offers.size());
        assertSame(single, offers.get(0));
    }

    @Test
    public void multiOfferListTakesPrecedenceWithoutDuplicatingSingleOption() {
        Object first = new Object();
        Object second = new Object();

        List<Object> offers = TtcAdPurchasesPlugin.collectOneTimeOffers(
            List.of(first, second),
            first
        );

        assertEquals(2, offers.size());
        assertSame(first, offers.get(0));
        assertSame(second, offers.get(1));
    }
}
