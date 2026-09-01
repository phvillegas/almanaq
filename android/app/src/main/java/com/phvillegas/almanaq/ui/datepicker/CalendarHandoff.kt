package com.phvillegas.almanaq.ui.datepicker

import android.content.Intent
import android.provider.CalendarContract
import java.time.LocalDate
import java.time.ZoneOffset

/**
 * The intent that hands a chosen day to the phone's calendar.
 *
 * This is deliberately not calendar *integration*, which section 2 of the plan rules
 * out. Nothing is read back, no account is touched and no permission is requested. A
 * date leaves the app through a platform intent, the user's own calendar app opens with
 * it filled in, and whatever happens next is none of this app's business.
 *
 * **All day, and no time.** The product finds a *day* nobody is away on; it has never
 * claimed to know which hour suits six people in five time zones. Guessing one and
 * pre-filling it would be inventing an answer the backend never gave.
 *
 * The millisecond conversion is the part worth watching. `CalendarContract` wants an
 * all-day event anchored at **UTC** midnight, not local midnight — the same trap the
 * backend documents in `calendars.ts`, where formatting without an explicit zone slides
 * the date a day in negative offsets. `ZoneOffset.UTC` here is not a shortcut.
 */
internal fun calendarIntent(isoDate: String): Intent {
    val day = LocalDate.parse(isoDate)
    val start = day.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
    val end = day.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

    return Intent(Intent.ACTION_INSERT).apply {
        data = CalendarContract.Events.CONTENT_URI
        putExtra(CalendarContract.EXTRA_EVENT_ALL_DAY, true)
        putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
        putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end)
    }
}

/**
 * Start of the chosen day in UTC milliseconds.
 *
 * Split out and `internal` because it is the half that can be tested without an Android
 * runtime, and it is the half that would be wrong by a day if anyone "fixed" the zone to
 * the device's own.
 */
internal fun allDayStartMillis(isoDate: String): Long =
    LocalDate.parse(isoDate).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
