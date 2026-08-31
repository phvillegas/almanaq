package com.phvillegas.almanaq.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

/**
 * What "find a time" lands on.
 *
 * A day is clear when the backend did not return it, because the backend only returns
 * days that have a conflict. The client is not allowed to hold any other definition, so
 * these cases are all about the search, never about what makes a day bad.
 */
class CalendarPlanningTest {

    private val september = LocalDate.of(2026, 9, 1)

    @Test
    fun `picks today when today is clear`() {
        val today = LocalDate.of(2026, 9, 10)
        assertEquals("2026-09-10", firstClearDay(september, emptySet(), today))
    }

    @Test
    fun `skips the days that have conflicts`() {
        val conflicts = setOf("2026-09-10", "2026-09-11", "2026-09-12")
        val today = LocalDate.of(2026, 9, 10)
        assertEquals("2026-09-13", firstClearDay(september, conflicts, today))
    }

    @Test
    fun `never offers a day that has already gone`() {
        // The first of the month is clear and irrelevant: it is behind us.
        val today = LocalDate.of(2026, 9, 20)
        assertEquals("2026-09-20", firstClearDay(september, emptySet(), today))
    }

    @Test
    fun `gives up when every remaining day is taken`() {
        val today = LocalDate.of(2026, 9, 28)
        val conflicts = setOf("2026-09-28", "2026-09-29", "2026-09-30")
        assertNull(firstClearDay(september, conflicts, today))
    }

    @Test
    fun `gives up on a month that is entirely in the past`() {
        assertNull(firstClearDay(september, emptySet(), LocalDate.of(2026, 11, 3)))
    }

    @Test
    fun `searches a whole future month from its first day`() {
        val today = LocalDate.of(2026, 8, 31)
        assertEquals("2026-09-01", firstClearDay(september, emptySet(), today))
    }
}
