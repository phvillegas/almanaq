package com.phvillegas.almanaq.ui

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.model.Member
import com.phvillegas.almanaq.model.MemberAvailability
import com.phvillegas.almanaq.ui.team.TeamScreen
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Getting to "add a teammate".
 *
 * This file exists because of a real defect, not a hypothetical one: the only route into
 * the add screen used to be the empty state's button, so adding the first person removed
 * the only way to add a second. The app held exactly one teammate and nothing in the
 * build said so — it compiled, it had previews, and the screen looked finished.
 *
 * The rule these pin down is simple: whatever the team looks like, there is always
 * exactly one way to add somebody, and it works.
 */
class TeamScreenTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun aTeamWithPeopleCanStillGrow() {
        var added = false

        compose.setContent {
            AlmanaqTheme {
                TeamScreen(
                    state = populated(),
                    onAdd = { added = true },
                    onOpen = {},
                    onFindTime = {},
                    onRefresh = {},
                )
            }
        }

        compose
            .onNodeWithContentDescription("Add teammate")
            .assertHeightIsAtLeast(48.dp)
            .assertHasClickAction()
            .performClick()

        assertTrue("the add control did not reach the caller", added)
    }

    @Test
    fun anEmptyTeamOffersItOnce() {
        compose.setContent {
            AlmanaqTheme {
                TeamScreen(
                    state = TeamUiState(isLoading = false),
                    onAdd = {},
                    onOpen = {},
                    onFindTime = {},
                    onRefresh = {},
                )
            }
        }

        // The empty state's own button already says it in words. Two ways to do one
        // thing, side by side, is worse than one.
        compose.onNodeWithText("Add teammate").assertHasClickAction()
        compose.onNodeWithContentDescription("Add teammate").assertDoesNotExist()
    }

    @Test
    fun aLoadingTeamCanStillGrow() {
        // The skeleton is not an empty team. Hiding the control while the first request
        // is in flight would make it flicker on every cold start.
        compose.setContent {
            AlmanaqTheme {
                TeamScreen(
                    state = TeamUiState(isLoading = true),
                    onAdd = {},
                    onOpen = {},
                    onFindTime = {},
                    onRefresh = {},
                )
            }
        }

        compose.onNodeWithContentDescription("Add teammate").assertHasClickAction()
    }

    private fun populated() = TeamUiState(
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
}
