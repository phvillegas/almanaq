package com.almanaq.app.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.util.UUID

/**
 * A team member, as stored on the device and sent to the backend.
 *
 * `id` is a UUID v4 and never an auto-incrementing number. That is what allows a
 * future migration to a shared database to be a plain INSERT instead of a key
 * reassignment. See PLAN.md sections 4 and 12 — this is not negotiable.
 */
@Serializable
data class Member(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val city: String,
    val countryCode: String?,
    val timezone: String,
    val overrides: Overrides? = null,
    /** Unused in v1, stored from day one for the same reason as the UUID. */
    val updatedAt: String? = null,
)

/** A manual correction. `null` in a field means "use the value inferred per country". */
@Serializable
data class Overrides(
    val workDays: List<String>? = null,
    val workStartLocal: String? = null,
    val workEndLocal: String? = null,
)

/**
 * The team, stored as a versioned document rather than as loose keys.
 *
 * Saving the whole document is what makes a future sync a matter of copying JSON.
 * See PLAN.md section 11.
 */
@Serializable
data class TeamDocument(
    val schemaVersion: Int = 1,
    val updatedAt: String? = null,
    val members: List<Member> = emptyList(),
)

/** Availability status. The backend resolves it; the client only paints it. */
enum class Status {
    AVAILABLE,
    OFF_HOURS,
    LOCAL_WEEKEND,
    LOCAL_HOLIDAY,
    UNKNOWN,
}

/**
 * One member's resolved availability.
 *
 * `statusLabel` and `statusDetail` arrive already written and localized. The client
 * never composes them. See CLAUDE.md rule 1.
 */
@Serializable
data class MemberAvailability(
    val id: String,
    val localTime: String,
    val localDate: String,
    val localWeekday: String,
    val utcOffsetMinutes: Int,
    val status: String,
    val statusLabel: String,
    val statusDetail: String,
) {
    /** Unknown values from a newer backend degrade to UNKNOWN rather than crashing. */
    val statusEnum: Status
        get() = runCatching { Status.valueOf(status) }.getOrDefault(Status.UNKNOWN)
}

@Serializable
data class AvailabilityResponse(
    val at: String,
    val availableCount: Int,
    val totalCount: Int,
    val members: List<MemberAvailability>,
)

@Serializable
data class AvailabilityRequest(
    val at: String,
    val members: List<MemberRef>,
)

/** The subset of a member the backend needs. It never receives names. */
@Serializable
data class MemberRef(
    val id: String,
    val countryCode: String?,
    val timezone: String,
    val overrides: Overrides? = null,
)

fun Member.toRef(): MemberRef = MemberRef(id, countryCode, timezone, overrides)

@Serializable
data class Location(
    val city: String,
    val region: String,
    val country: String,
    val countryCode: String,
    val timezone: String,
)

@Serializable
data class LocationSearchResponse(
    @SerialName("results") val results: List<Location>,
)
