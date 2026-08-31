package com.phvillegas.almanaq.ui

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHeightIsAtLeast
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.model.Member
import com.phvillegas.almanaq.ui.member.AddMemberScreen
import com.phvillegas.almanaq.ui.member.MemberDetailScreen
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

/**
 * Getting out of a screen that sits on top of the tabs.
 *
 * Both of these hide the navigation bar, so a missing back control leaves the screen
 * with no visible exit at all. The system back gesture always worked, which is precisely
 * why the gap survived a full round of manual testing: whoever is testing already knows
 * the gesture is there.
 *
 * The size assertion is not decoration either. The control this replaced was a small
 * text link that fell short of the 48dp minimum.
 */
class PushedScreensTest {

    @get:Rule
    val compose = createComposeRule()

    @Test
    fun addingAMemberCanBeAbandoned() {
        var back = false

        compose.setContent {
            AlmanaqTheme {
                AddMemberScreen(
                    state = SearchUiState(),
                    onQuery = {},
                    onPick = { _, _ -> },
                    onBack = { back = true },
                )
            }
        }

        compose
            .onNodeWithContentDescription("Back to the team")
            .assertHeightIsAtLeast(48.dp)
            .assertHasClickAction()
            .performClick()

        assertTrue("the back control did not reach the caller", back)
    }

    @Test
    fun aMemberDetailCanBeLeft() {
        var back = false

        compose.setContent {
            AlmanaqTheme {
                MemberDetailScreen(
                    state = DetailUiState(member = member(), isLoading = true),
                    onBack = { back = true },
                    onRemove = {},
                    onOverrides = { _, _ -> },
                )
            }
        }

        compose
            .onNodeWithContentDescription("Back to the team")
            .assertHeightIsAtLeast(48.dp)
            .assertHasClickAction()
            .performClick()

        assertTrue("the back control did not reach the caller", back)
    }

    private fun member() = Member(
        name = "Ana Ruiz",
        city = "Buenos Aires",
        countryCode = "AR",
        timezone = "America/Argentina/Buenos_Aires",
    )
}
