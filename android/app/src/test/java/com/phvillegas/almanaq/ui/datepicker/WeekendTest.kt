package com.phvillegas.almanaq.ui.datepicker

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.DayOfWeek

/**
 * The ICU boundary pair, turned into a set of days.
 *
 * `deviceWeekend` itself needs an Android runtime, so what is tested here is the part
 * that does not: the off-by-one between two day numbering schemes, and the wrap around
 * the end of the week that the common Saturday-to-Sunday case depends on.
 */
class WeekendTest {

    @Test
    fun `maps ICU day numbers to java time`() {
        assertEquals(DayOfWeek.SUNDAY, dayOfWeekOf(1))
        assertEquals(DayOfWeek.MONDAY, dayOfWeekOf(2))
        assertEquals(DayOfWeek.FRIDAY, dayOfWeekOf(6))
        assertEquals(DayOfWeek.SATURDAY, dayOfWeekOf(7))
    }

    @Test
    fun `wraps around the end of the week`() {
        // Saturday to Sunday is 7 to 1, and most of the world reports it that way.
        assertEquals(setOf(DayOfWeek.SATURDAY, DayOfWeek.SUNDAY), weekendDays(7, 1))
    }

    @Test
    fun `handles a weekend that does not wrap`() {
        // Israel and much of the Gulf: Friday to Saturday.
        assertEquals(setOf(DayOfWeek.FRIDAY, DayOfWeek.SATURDAY), weekendDays(6, 7))
    }

    @Test
    fun `handles a single day weekend`() {
        assertEquals(setOf(DayOfWeek.SUNDAY), weekendDays(1, 1))
    }

    @Test
    fun `stops after a week when the pair never closes`() {
        // A malformed pair must give up rather than spin. The value is nonsense either
        // way; hanging the composition is the part that would matter.
        assertEquals(7, weekendDays(3, 99).size)
    }
}
