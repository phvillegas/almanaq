package com.phvillegas.almanaq.ui.datepicker

import android.icu.util.Calendar
import java.time.DayOfWeek
import java.util.Locale

/**
 * The device owner's own weekend, so the grid can grey those columns.
 * See PLAN.md section 7.2.
 *
 * This is the one calendar fact the client resolves for itself, and it is worth saying
 * why it does not break rule 1. It is about the person holding the phone, who is not a
 * team member: they have no row in the document, no country code and no time zone the
 * backend could be asked about. And it decides one thing — which columns are drawn
 * quieter. No availability, no conflict, no status, none of which this value may touch.
 *
 * The answer comes from ICU, the same data the backend reads for everybody else, rather
 * than from a table of our own. On iOS the equivalent is one call to `Calendar.current`.
 * That is a platform lookup written twice, not a rule written twice. See CLAUDE.md
 * rule 2.
 */
internal fun deviceWeekend(locale: Locale = Locale.getDefault()): Set<DayOfWeek> {
    val week = Calendar.getInstance(locale).weekData
    return weekendDays(week.weekendOnset, week.weekendCease)
}

/**
 * The days from `onset` to `cease` inclusive, wrapping around the end of the week.
 *
 * ICU reports the weekend as a pair of boundaries rather than a set, and the pair wraps:
 * most of the world is Saturday to Sunday, which is 7 to 1. It also reports the moment
 * within the boundary day when the weekend starts, which is ignored here on purpose — a
 * column is either quieter or it is not, and half of Friday cannot be greyed.
 *
 * Pure and `internal` so it can be tested without an Android runtime.
 */
internal fun weekendDays(onset: Int, cease: Int): Set<DayOfWeek> {
    val days = mutableSetOf<DayOfWeek>()
    var current = onset

    // Bounded by the length of a week: a malformed pair must not spin forever.
    repeat(DAYS_IN_WEEK) {
        days.add(dayOfWeekOf(current))
        if (current == cease) return days
        current = current % DAYS_IN_WEEK + 1
    }

    return days
}

/**
 * ICU numbers Sunday 1 to Saturday 7; `java.time` numbers Monday 1 to Sunday 7.
 *
 * Separate because it is the part that is easy to get wrong by one, and the part worth
 * a test.
 */
internal fun dayOfWeekOf(icuDay: Int): DayOfWeek = DayOfWeek.of((icuDay + 5) % DAYS_IN_WEEK + 1)

private const val DAYS_IN_WEEK = 7
