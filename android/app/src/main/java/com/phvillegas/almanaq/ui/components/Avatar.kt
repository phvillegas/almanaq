package com.phvillegas.almanaq.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.ui.theme.StatusPalette

/**
 * Initials on a status-tinted circle, optionally with the status dot in the corner.
 *
 * The dot repeats what the status label already says in words. That is the point: the
 * colour coding is a scanning aid, not the only channel, and anyone who cannot use it
 * still has the label. The whole avatar carries no accessibility semantics for the same
 * reason — announcing "AR" before the person's actual name helps nobody.
 *
 * See PLAN.md sections 7.1 and 7.3.
 */
@Composable
fun Avatar(
    name: String,
    palette: StatusPalette,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    showBadge: Boolean = true,
) {
    Box(modifier = modifier.size(size).clearAndSetSemantics { }) {
        Box(
            modifier = Modifier.fillMaxSize().clip(CircleShape).background(palette.avatarBackground),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = initialsOf(name),
                style = MaterialTheme.typography.labelLarge,
                color = palette.avatarText,
            )
        }

        if (showBadge) StatusBadge(palette, Modifier.align(Alignment.BottomEnd))
    }
}

@Composable
private fun StatusBadge(palette: StatusPalette, modifier: Modifier = Modifier) {
    Box(
        // The ring takes the page background rather than a literal white: white on the
        // dark theme would be a bright speck on every avatar in the list.
        modifier = modifier
            .size(BADGE_RING)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center,
    ) {
        Box(modifier = Modifier.size(BADGE_DOT).clip(CircleShape).background(palette.dot))
    }
}

/**
 * The first letter of at most the first two words.
 *
 * Top level and `internal` so it can be tested without an Android runtime.
 */
internal fun initialsOf(name: String): String =
    name.trim()
        .split(Regex("\\s+"))
        .take(2)
        .mapNotNull { it.firstOrNull()?.uppercase() }
        .joinToString("")

private val BADGE_RING = 12.dp
private val BADGE_DOT = 8.dp
