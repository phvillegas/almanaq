package com.phvillegas.almanaq.ui.datepicker

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.TimeZone

/**
 * The date that leaves the app for the phone's calendar.
 *
 * There is exactly one way to get this wrong and it is the same trap the backend
 * documents in `calendars.ts`: anchoring an all-day event at *local* midnight instead of
 * UTC, which slides the date a day in a negative offset. The test forces the JVM into
 * Buenos Aires and Auckland to catch it, because in UTC the bug is invisible.
 */
class CalendarHandoffTest {

    @Test
    fun `anchors the day at UTC midnight`() {
        assertEquals(expectedUtcMillis(2026, 9, 21), allDayStartMillis("2026-09-21"))
    }

    @Test
    fun `does not shift a day west of Greenwich`() {
        withTimeZone("America/Argentina/Buenos_Aires") {
            assertEquals(expectedUtcMillis(2026, 9, 21), allDayStartMillis("2026-09-21"))
        }
    }

    @Test
    fun `does not shift a day east of Greenwich`() {
        withTimeZone("Pacific/Auckland") {
            assertEquals(expectedUtcMillis(2026, 9, 21), allDayStartMillis("2026-09-21"))
        }
    }

    @Test
    fun `handles the turn of the year`() {
        withTimeZone("America/Argentina/Buenos_Aires") {
            assertEquals(expectedUtcMillis(2027, 1, 1), allDayStartMillis("2027-01-01"))
        }
    }

    private fun expectedUtcMillis(year: Int, month: Int, day: Int): Long =
        java.time.LocalDate.of(year, month, day)
            .atStartOfDay(java.time.ZoneOffset.UTC)
            .toInstant()
            .toEpochMilli()

    private fun withTimeZone(id: String, body: () -> Unit) {
        val original = TimeZone.getDefault()
        TimeZone.setDefault(TimeZone.getTimeZone(id))
        try {
            body()
        } finally {
            TimeZone.setDefault(original)
        }
    }
}
