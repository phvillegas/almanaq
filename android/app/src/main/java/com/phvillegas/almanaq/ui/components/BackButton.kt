package com.phvillegas.almanaq.ui.components

import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.R

/**
 * The way out of a pushed screen.
 *
 * Both screens that sit on top of the tabs — adding a member and a member's detail —
 * hide the navigation bar, so without this there is no visible way home at all. The
 * system back gesture worked the whole time, which is exactly why the gap survived: the
 * screens were navigable by anyone who already knew they were.
 *
 * An arrow rather than a "Cancel" link, and an `IconButton` rather than a `TextButton`:
 * it is where an Android user looks, and it reads as "go back" instead of "discard" —
 * on the detail screen there is nothing to cancel.
 *
 * The explicit 48dp is not redundant. Material 3 lays an `IconButton` out at 40dp and
 * relies on `minimumInteractiveComponentSize` to widen the touch area past the layout
 * bounds, so the node an accessibility service sees — and the box TalkBack draws — stays
 * 40dp. Sizing it properly makes the two agree.
 */
@Composable
fun BackButton(onBack: () -> Unit, modifier: Modifier = Modifier) {
    IconButton(onClick = onBack, modifier = modifier.size(TOUCH_TARGET)) {
        Icon(
            painter = painterResource(R.drawable.ic_back),
            // Not a bare "Back": saying where it goes is the difference between knowing
            // and guessing when the screen is read out rather than seen.
            contentDescription = stringResource(R.string.action_back),
            tint = MaterialTheme.colorScheme.primary,
        )
    }
}

private val TOUCH_TARGET = 48.dp
