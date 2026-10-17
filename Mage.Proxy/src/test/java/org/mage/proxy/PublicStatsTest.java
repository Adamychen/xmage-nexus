package org.mage.proxy;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class PublicStatsTest {

    @Test
    void tierBoundariesMatchHistoricalCuts() {
        assertEquals("BRONZE", PublicStats.tier(1135));
        assertEquals("SILVER", PublicStats.tier(1136));
        assertEquals("GOLD", PublicStats.tier(1360));
        assertEquals("PLATINUM", PublicStats.tier(1520));
        assertEquals("DIAMOND", PublicStats.tier(1611));
        assertEquals("MYTHIC", PublicStats.tier(1688));
    }

    @Test
    void divisionsSplitEachTierAtHistoricalQuartiles() {
        assertEquals("II", PublicStats.division(1000));
        assertEquals("IV", PublicStats.division(1136));
        assertEquals("I", PublicStats.division(1358));
        assertEquals("IV", PublicStats.division(1360));
        assertEquals("II", PublicStats.division(1450));
        assertEquals("I", PublicStats.division(1600));
        assertNull(PublicStats.division(1688));
    }
}
