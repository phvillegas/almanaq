package com.phvillegas.almanaq.model

import kotlinx.serialization.Serializable

/** `POST /v1/calendar`. Only days with conflicts come back. See PLAN.md section 4. */
@Serializable
data class CalendarRequest(
    val from: String,
    val to: String,
    val members: List<MemberRef>,
)

@Serializable
data class CalendarResponse(
    val days: List<CalendarDay> = emptyList(),
)

@Serializable
data class CalendarDay(
    val date: String,
    val conflictCount: Int,
    val conflicts: List<Conflict> = emptyList(),
)

@Serializable
data class Conflict(
    val memberId: String,
    val reason: String,
    /** Written and localized by the backend. */
    val detail: String,
)

/** `POST /v1/member/detail`. */
@Serializable
data class MemberDetailRequest(
    val member: MemberRef,
    val at: String,
)

@Serializable
data class MemberDetailResponse(
    val localTime: String,
    val localDateFormatted: String,
    val utcOffsetMinutes: Int,
    val status: String,
    val statusLabel: String,
    /**
     * Localized country name, or `null` when the backend has no usable country code.
     *
     * Defaulted so an older backend that predates the field still parses. The client
     * must never turn a country code into a name itself: that table would have to be
     * written again in Swift.
     */
    val country: String? = null,
    val workWeek: WorkWeekLabels,
    val localCalendar: LocalCalendar? = null,
    val upcomingHolidays: List<UpcomingHoliday> = emptyList(),
)

@Serializable
data class WorkWeekLabels(
    val daysLabel: String,
    val weekendLabel: String,
    val hoursLabel: String,
)

@Serializable
data class LocalCalendar(
    val system: String,
    val label: String,
    val currentYear: String,
    val note: String? = null,
)

@Serializable
data class UpcomingHoliday(
    val name: String,
    val dateLabel: String,
    val startDate: String,
)
