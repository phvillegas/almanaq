package com.phvillegas.almanaq.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import kotlinx.coroutines.delay
import java.time.Instant
import java.time.ZoneOffset

/**
 * The ticking clock in a member row.
 *
 * Section 7.1 of the plan asks for the local time to refresh every minute and, in the
 * same breath, forbids re-querying availability that often. So the text has to advance
 * on the device between refreshes.
 *
 * This is not the client doing time zone work, and it is deliberately not allowed to
 * become that. It adds the `utcOffsetMinutes` the backend already resolved to the
 * current instant — no time zone database is opened here, no daylight saving transition
 * is decided here, and no country rule is read here. The one thing it can get wrong is
 * showing a stale offset in the minutes between a transition and the next refresh, and
 * the next refresh corrects it. Anything more than this belongs in the backend.
 * See CLAUDE.md rule 1.
 *
 * The format matches what the backend sends for `localTime`: `h23`, zero padded, so a
 * ticking row and a freshly loaded one are indistinguishable.
 */
fun clockAt(now: Instant, utcOffsetMinutes: Int): String {
    val local = now.atOffset(ZoneOffset.ofTotalSeconds(utcOffsetMinutes * 60))
    return "%02d:%02d".format(local.hour, local.minute)
}

/**
 * An instant that advances on the minute for as long as it is composed.
 *
 * It sleeps to the top of the next minute instead of a flat sixty seconds. A flat period
 * drifts, and a clock whose digits change at 14:07:23 looks broken next to the phone's
 * own status bar.
 */
@Composable
fun rememberMinuteTicker(): State<Instant> {
    val instant = remember { mutableStateOf(Instant.now()) }

    LaunchedEffect(Unit) {
        while (true) {
            val now = Instant.now()
            instant.value = now
            delay(MILLIS_PER_MINUTE - now.toEpochMilli() % MILLIS_PER_MINUTE)
        }
    }

    return instant
}

/**
 * `UTC+3`, `UTC+5:45`, `UTC-3`.
 *
 * Formatting an integer the backend already resolved. The minutes matter: Nepal is
 * +5:45 and India +5:30, and rounding either to whole hours is exactly the kind of
 * quiet wrongness this product exists to avoid.
 */
fun utcOffsetLabel(utcOffsetMinutes: Int): String {
    val sign = if (utcOffsetMinutes < 0) "-" else "+"
    val total = kotlin.math.abs(utcOffsetMinutes)
    val hours = total / 60
    val minutes = total % 60

    if (minutes == 0) return "UTC$sign$hours"
    return "UTC$sign$hours:%02d".format(minutes)
}

private const val MILLIS_PER_MINUTE = 60_000L
