package com.phvillegas.almanaq.ui.member

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The address line on the member detail.
 *
 * Nothing here decides what a country is called — the name arrives localized from the
 * backend, because a code-to-name table would have to be written again in Swift. What
 * these pin down is the joining, and especially the case where there is no country: the
 * line gets shorter rather than gaining the word "Unknown".
 */
class WhereaboutsTest {

    @Test
    fun `joins the city, the country and the offset`() {
        assertEquals("Tel Aviv, Israel · UTC+3", whereabouts("Tel Aviv", "Israel", 180))
    }

    @Test
    fun `drops the country when there is none`() {
        assertEquals("Tel Aviv · UTC+3", whereabouts("Tel Aviv", null, 180))
    }

    @Test
    fun `keeps the fractional offsets`() {
        assertEquals("Kathmandu, Nepal · UTC+5:45", whereabouts("Kathmandu", "Nepal", 345))
    }

    @Test
    fun `keeps a negative offset negative`() {
        assertEquals(
            "Buenos Aires, Argentina · UTC-3",
            whereabouts("Buenos Aires", "Argentina", -180),
        )
    }
}
