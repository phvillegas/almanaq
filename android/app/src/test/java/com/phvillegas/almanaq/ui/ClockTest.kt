package com.phvillegas.almanaq.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

/**
 * The clock the rows tick with.
 *
 * These are the cases that would go unnoticed on a screenshot taken in one time zone:
 * the fractional offsets, the day boundary, and the zero padding that keeps a ticking
 * row from looking different to a freshly loaded one.
 */
class ClockTest {

    // 2026-08-31T19:15:00Z. Every expectation below is this instant seen from somewhere.
    private val instant = Instant.parse("2026-08-31T19:15:00Z")

    @Test
    fun `formats UTC`() {
        assertEquals("19:15", clockAt(instant, 0))
    }

    @Test
    fun `formats a negative offset`() {
        assertEquals("16:15", clockAt(instant, -180))
    }

    @Test
    fun `keeps the three quarter hour offsets`() {
        // Nepal is +5:45 and India +5:30. Rounding either to a whole hour is exactly the
        // quiet wrongness this product exists to avoid.
        assertEquals("01:00", clockAt(instant, 345))
        assertEquals("00:45", clockAt(instant, 330))
    }

    @Test
    fun `crosses midnight forwards and backwards`() {
        assertEquals("08:15", clockAt(instant, 780)) // +13, the next day in Kiritimati
        assertEquals("08:15", clockAt(Instant.parse("2026-08-31T00:15:00Z"), -960))
    }

    @Test
    fun `pads both fields to two digits`() {
        assertEquals("09:05", clockAt(Instant.parse("2026-08-31T09:05:00Z"), 0))
        assertEquals("00:00", clockAt(Instant.parse("2026-08-31T00:00:00Z"), 0))
    }

    @Test
    fun `labels whole hour offsets without minutes`() {
        assertEquals("UTC+0", utcOffsetLabel(0))
        assertEquals("UTC+3", utcOffsetLabel(180))
        assertEquals("UTC-3", utcOffsetLabel(-180))
    }

    @Test
    fun `labels partial offsets with minutes`() {
        assertEquals("UTC+5:45", utcOffsetLabel(345))
        assertEquals("UTC+5:30", utcOffsetLabel(330))
        assertEquals("UTC-3:30", utcOffsetLabel(-210))
    }
}
