package com.phvillegas.almanaq.ui

import com.phvillegas.almanaq.model.Member
import com.phvillegas.almanaq.model.MemberAvailability
import com.phvillegas.almanaq.model.Status
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Row order.
 *
 * The point of these is the thing that must *not* happen: the client re-deciding that
 * available outranks off hours. That call is the backend's, and all the client may do
 * is settle ties by name. See CLAUDE.md rule 1.
 */
class TeamOrderTest {

    @Test
    fun `leaves the status groups where the backend put them`() {
        val rows = listOf(
            row("Zoe", "LOCAL_HOLIDAY"),
            row("Ana", "AVAILABLE"),
            row("Bruno", "LOCAL_HOLIDAY"),
        )

        // Holiday first because that is the order it arrived in, not because the client
        // thinks holiday comes first.
        assertEquals(
            listOf("Bruno", "Zoe", "Ana"),
            sortByNameWithinStatus(rows).map { it.member.name },
        )
    }

    @Test
    fun `sorts by name inside a group, ignoring case`() {
        val rows = listOf(
            row("selam", "AVAILABLE"),
            row("Ana", "AVAILABLE"),
            row("bikash", "AVAILABLE"),
        )

        assertEquals(
            listOf("Ana", "bikash", "selam"),
            sortByNameWithinStatus(rows).map { it.member.name },
        )
    }

    @Test
    fun `keeps rows whose availability never arrived`() {
        val rows = listOf(TeamRow(member("Nadia"), null), row("Ana", "AVAILABLE"))

        assertEquals(2, sortByNameWithinStatus(rows).size)
    }

    @Test
    fun `degrades a status it does not know to unknown`() {
        // A newer backend must not crash an older client. It gets painted grey instead.
        assertEquals(Status.UNKNOWN, availability("ON_PARENTAL_LEAVE").statusEnum)
        assertEquals(Status.AVAILABLE, availability("AVAILABLE").statusEnum)
    }

    private fun row(name: String, status: String) = TeamRow(member(name), availability(status))

    private fun member(name: String) =
        Member(name = name, city = "Somewhere", countryCode = null, timezone = "UTC")

    private fun availability(status: String) = MemberAvailability(
        id = "id",
        localTime = "19:15",
        localDate = "2026-08-31",
        localWeekday = "monday",
        utcOffsetMinutes = 0,
        status = status,
        statusLabel = "label",
        statusDetail = "detail",
    )
}
