package com.phvillegas.almanaq.ui

import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.model.CalendarDay
import com.phvillegas.almanaq.model.Conflict
import com.phvillegas.almanaq.model.Member
import com.phvillegas.almanaq.model.MemberAvailability
import com.phvillegas.almanaq.ui.datepicker.DatePickerScreen
import com.phvillegas.almanaq.ui.team.TeamScreen
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme
import org.junit.Rule
import org.junit.Test
import java.time.LocalDate

/**
 * What a screen reader is handed.
 *
 * These exist because the alternative was listening to a phone and taking somebody's
 * word for it. A screenshot shows that TalkBack draws a focus box around the whole row;
 * only an assertion on the semantics tree shows what it will read out of it.
 *
 * They need a device, so CI does not run them. `./gradlew connectedDebugAndroidTest`
 * with an emulator attached does.
 */
class AccessibilityTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun aMemberRowIsOneStop() {
        compose.setContent {
            AlmanaqTheme {
                TeamScreen(state = state(), onAdd = {}, onOpen = {}, onFindTime = {}, onRefresh = {})
            }
        }

        // If the row did not merge, no single node would hold all four values and this
        // would fail — which is exactly the failure worth catching: six people become
        // twenty-four swipes.
        // The clock is deliberately not asserted: it ticks from the current instant, so
        // its value depends on when the test runs. `ClockTest` pins the formatting.
        compose
            .onNode(hasText("Ana Ruiz") and hasText("Buenos Aires") and hasText("Available"))
            .assertExists()
    }

    @Test
    fun theAvatarSaysNothing() {
        compose.setContent {
            AlmanaqTheme {
                TeamScreen(state = state(), onAdd = {}, onOpen = {}, onFindTime = {}, onRefresh = {})
            }
        }

        // "A R" before the person's actual name helps nobody.
        //
        // Asserted against the merged tree, which is the one a screen reader is handed.
        // The unmerged tree still holds the initials — `clearAndSetSemantics` takes them
        // out of what the row reads, not out of what is drawn — so asserting there would
        // fail for the wrong reason. Without the clear, "AR" joins the row's merged text
        // and this fails.
        compose.onNodeWithText("AR").assertDoesNotExist()
    }

    @Test
    fun aDayWithConflictsSaysSo() {
        compose.setContent {
            AlmanaqTheme {
                DatePickerScreen(
                    state = calendarState(),
                    onMonth = {},
                    onSelect = {},
                    onConflictFreeOnly = {},
                    onRetry = {},
                    onAdd = {},
                )
            }
        }

        // The count comes from the backend's own conflict list. A bare "21" would leave
        // a screen reader user to tap every day in the month to find out.
        compose
            .onNodeWithContentDescription("September 21, 2026, 1 unavailable")
            .assertExists()
            .assertHeightIsAtLeast(48.dp)
    }

    @Test
    fun theMonthArrowsAreNamed() {
        compose.setContent {
            AlmanaqTheme {
                DatePickerScreen(
                    state = calendarState(),
                    onMonth = {},
                    onSelect = {},
                    onConflictFreeOnly = {},
                    onRetry = {},
                    onAdd = {},
                )
            }
        }

        // The glyphs are "‹" and "›", which a screen reader reads as punctuation or
        // skips entirely.
        compose.onNodeWithContentDescription("Previous month").assertExists()
        compose.onNodeWithContentDescription("Next month").assertExists()
    }

    private fun state() = TeamUiState(
        rows = listOf(
            TeamRow(
                member = Member(
                    name = "Ana Ruiz",
                    city = "Buenos Aires",
                    countryCode = "AR",
                    timezone = "America/Argentina/Buenos_Aires",
                ),
                availability = MemberAvailability(
                    id = "a1",
                    // The row shows a ticking clock, not this value, so the offset is
                    // what has to line up with the expectation, not the string.
                    localTime = "16:15",
                    localDate = "2026-08-31",
                    localWeekday = "monday",
                    utcOffsetMinutes = -180,
                    status = "AVAILABLE",
                    statusLabel = "Available",
                    statusDetail = "Working hours in Argentina",
                ),
            ),
        ),
        availableCount = 1,
        totalCount = 1,
        isLoading = false,
    )

    private fun calendarState() = CalendarUiState(
        month = LocalDate.of(2026, 9, 1),
        days = mapOf(
            "2026-09-21" to CalendarDay(
                date = "2026-09-21",
                conflictCount = 1,
                conflicts = listOf(
                    Conflict("a1", "LOCAL_HOLIDAY", "Holiday in Israel: Yom Kippur"),
                ),
            ),
        ),
        isLoading = false,
        hasMembers = true,
    )
}
