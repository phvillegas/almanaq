package com.phvillegas.almanaq.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp

/**
 * Loading placeholders shaped like the content that replaces them.
 *
 * Section 7.4 of the plan asks for skeletons rather than a centred spinner, and the
 * reason is the "Now" screen: it is the first thing on open, and a spinner in the middle
 * of an empty screen says nothing about what is coming. A shape that matches the row
 * that lands there means the layout does not jump when it does.
 *
 * They are invisible to accessibility services on purpose. There is nothing to announce
 * in a grey rectangle, and announcing four of them would bury the content that follows.
 */
@Composable
fun SkeletonBox(
    modifier: Modifier = Modifier,
    shape: Shape = MaterialTheme.shapes.extraSmall,
) {
    val transition = rememberInfiniteTransition(label = "skeleton")
    val alpha by transition.animateFloat(
        initialValue = 0.45f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse),
        label = "skeleton-alpha",
    )

    Box(
        modifier = modifier
            .alpha(alpha)
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceContainerHigh),
    )
}

/** The shape of the member list while availability is on its way. */
@Composable
fun TeamListSkeleton(modifier: Modifier = Modifier, rows: Int = 4) {
    Column(
        modifier = modifier.fillMaxWidth().clearAndSetSemantics { },
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        repeat(rows) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonBox(modifier = Modifier.size(40.dp), shape = CircleShape)
                Column(
                    modifier = Modifier.padding(start = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    SkeletonBox(modifier = Modifier.height(14.dp).fillMaxWidth(0.45f))
                    SkeletonBox(modifier = Modifier.height(12.dp).fillMaxWidth(0.3f))
                }
            }
        }
    }
}

/** The shape of the member detail: the big clock, then the label rows. */
@Composable
fun DetailSkeleton(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth().clearAndSetSemantics { },
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SkeletonBox(modifier = Modifier.height(46.dp).fillMaxWidth(0.5f))
        SkeletonBox(modifier = Modifier.height(14.dp).fillMaxWidth(0.6f))
        SkeletonBox(
            modifier = Modifier.height(56.dp).fillMaxWidth().padding(top = 4.dp),
            shape = MaterialTheme.shapes.medium,
        )
        repeat(3) {
            SkeletonBox(modifier = Modifier.height(14.dp).fillMaxWidth())
        }
    }
}
