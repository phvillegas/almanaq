package com.phvillegas.almanaq.ui.team

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.R
import com.phvillegas.almanaq.model.Member
import com.phvillegas.almanaq.model.MemberAvailability
import com.phvillegas.almanaq.ui.TeamRow
import com.phvillegas.almanaq.ui.TeamUiState
import com.phvillegas.almanaq.ui.clockAt
import com.phvillegas.almanaq.ui.components.Avatar
import com.phvillegas.almanaq.ui.components.TeamListSkeleton
import com.phvillegas.almanaq.ui.rememberMinuteTicker
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme
import com.phvillegas.almanaq.ui.theme.TabularFigures
import java.time.Duration
import java.time.Instant

/**
 * The "Now" screen. See PLAN.md section 7.1.
 *
 * Every value it paints is resolved by the backend. This file contains no rule about
 * who is available, no time zone arithmetic and no status text: it maps a status to a
 * colour and lays the row out.
 *
 * The one thing that moves on its own is the clock, which advances every minute without
 * asking the backend again — the plan requires both halves of that. See `Clock.kt`.
 */
@Composable
fun TeamScreen(
    state: TeamUiState,
    onAdd: () -> Unit,
    onOpen: (Member) -> Unit,
    onFindTime: () -> Unit,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val now by rememberMinuteTicker()
    // A team that is still loading is not an empty team. Getting this wrong is how the
    // first version of this screen showed its empty state for a second on every open.
    val isEmpty = state.rows.isEmpty() && !state.isLoading

    Column(modifier = modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Title(onAdd = onAdd, showAdd = !isEmpty)
        Counter(state)

        if (state.staleError) StaleBanner(loadedAt = state.loadedAt, now = now, onRetry = onRefresh)

        Content(
            state = state,
            now = now,
            onAdd = onAdd,
            onOpen = onOpen,
            onRefresh = onRefresh,
            modifier = Modifier.weight(1f),
        )

        // Kept in place through the skeleton on purpose: appearing once the list lands
        // would shift everything above it at the moment the user starts reading.
        if (isEmpty) return@Column

        Button(
            onClick = onFindTime,
            modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
        ) {
            Text(stringResource(R.string.team_find_time))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun Content(
    state: TeamUiState,
    now: Instant,
    onAdd: () -> Unit,
    onOpen: (Member) -> Unit,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (state.rows.isEmpty() && state.isLoading) {
        TeamListSkeleton(modifier = modifier.padding(top = 16.dp))
        return
    }

    if (state.rows.isEmpty()) {
        EmptyState(onAdd = onAdd, modifier = modifier.fillMaxSize())
        return
    }

    // Pull to refresh, on open and on returning from the background are the three
    // moments the plan lists for re-querying. Never on a timer. PLAN.md 7.1.
    PullToRefreshBox(
        isRefreshing = state.isLoading,
        onRefresh = onRefresh,
        modifier = modifier,
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(top = 16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            items(state.rows, key = { it.member.id }) { row ->
                MemberRow(row = row, now = now, onClick = { onOpen(row.member) })
            }
        }
    }
}

/**
 * The screen title, with the way to add somebody next to it.
 *
 * The plus is not decoration. Before it existed, the only route into "add a teammate"
 * was the empty state's button, which means the app held exactly one person: add the
 * first, and the button that let you do it disappears forever. Section 7.1 lists the
 * vertical structure of this screen and does not mention an add control, but section 2
 * puts "add and remove team members" in scope, so the omission is in the plan.
 *
 * It is hidden on the empty state, where the big button already says the same thing and
 * two ways to do one thing is worse than one.
 */
@Composable
private fun Title(onAdd: () -> Unit, showAdd: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = stringResource(R.string.team_title),
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.weight(1f),
        )

        if (!showAdd) return@Row

        // Explicit 48dp for the same reason as BackButton: Material 3 lays an IconButton
        // out at 40 and widens only the touch area, leaving the accessibility node short.
        IconButton(onClick = onAdd, modifier = Modifier.size(48.dp)) {
            Icon(
                painter = painterResource(R.drawable.ic_add),
                // The glyph is a plus; what a screen reader needs is the verb.
                contentDescription = stringResource(R.string.team_empty_action),
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun Counter(state: TeamUiState) {
    // Chrome copy, so it lives in strings.xml. Anything describing a person's
    // availability arrives already written from the backend.
    Text(
        text = stringResource(
            R.string.team_available_count,
            state.availableCount,
            state.totalCount,
        ),
        style = MaterialTheme.typography.bodyMedium.merge(TabularFigures),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 4.dp),
    )
}

/**
 * A discreet strip over stale data, never a full screen error. See PLAN.md 7.4.
 *
 * It says how old the data is when there is data to age. On a first load that never
 * succeeded there is nothing to date, and claiming "0 minutes ago" over an empty list
 * would be a lie, so the wording changes instead.
 */
@Composable
private fun StaleBanner(loadedAt: Instant?, now: Instant, onRetry: () -> Unit) {
    val minutes = loadedAt?.let { Duration.between(it, now).toMinutes() } ?: 0L

    // Under a minute there is no age worth stating, and "0 minutes ago" reads as broken
    // rather than fresh.
    val text = when {
        minutes < 1L -> stringResource(R.string.team_stale_unknown)
        else -> pluralStringResource(R.plurals.team_stale_minutes, minutes.toInt(), minutes.toInt())
    }

    Text(
        text = text,
        style = MaterialTheme.typography.labelLarge,
        color = AlmanaqTheme.colors.localWeekend.text,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onRetry)
            .padding(top = 8.dp),
    )
}

@Composable
private fun MemberRow(row: TeamRow, now: Instant, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val availability = row.availability
    val palette = AlmanaqTheme.colors.forStatus(availability?.status ?: "UNKNOWN")

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            // One TalkBack stop per person, reading name, city, time and status in the
            // order they are laid out. Four separate stops per row makes a list of six
            // people twenty-four swipes long.
            .semantics(mergeDescendants = true) { }
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(name = row.member.name, palette = palette)

        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
            Text(
                text = row.member.name,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = row.member.city,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Column(horizontalAlignment = Alignment.End) {
            Text(
                // Ticks on the minute from the offset the backend resolved, so the row
                // does not go stale between refreshes. Tabular figures: without them the
                // digits shift every time it advances.
                text = availability?.let { clockAt(now, it.utcOffsetMinutes) }.orEmpty(),
                style = MaterialTheme.typography.titleMedium.merge(TabularFigures),
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.End,
            )
            Text(
                // Written and localized by the backend. Never composed here.
                text = availability?.statusLabel.orEmpty(),
                style = MaterialTheme.typography.labelLarge,
                color = palette.text,
                textAlign = TextAlign.End,
            )
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

/** Text and a button, no illustration. See PLAN.md section 7.1. */
@Composable
private fun EmptyState(onAdd: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(R.string.team_empty_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Button(
            onClick = onAdd,
            modifier = Modifier.padding(top = 16.dp),
        ) {
            Text(text = stringResource(R.string.team_empty_action))
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun TeamScreenPreview() {
    AlmanaqTheme {
        TeamScreen(state = previewState(), onAdd = {}, onOpen = {}, onFindTime = {}, onRefresh = {})
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0F0E1C)
@Composable
private fun TeamScreenDarkPreview() {
    AlmanaqTheme(darkTheme = true) {
        TeamScreen(state = previewState(), onAdd = {}, onOpen = {}, onFindTime = {}, onRefresh = {})
    }
}

@Preview(showBackground = true, name = "Loading")
@Composable
private fun TeamScreenLoadingPreview() {
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

private fun previewState() = TeamUiState(
    rows = listOf(
        row("Ana Ruiz", "Buenos Aires", -180, "AVAILABLE", "Disponible"),
        row("Nadia Peretz", "Tel Aviv", 180, "LOCAL_WEEKEND", "Fin de semana"),
        row("Selam Bekele", "Addis Abeba", 180, "LOCAL_HOLIDAY", "Feriado"),
        row("Bikash Thapa", "Katmandú", 345, "OFF_HOURS", "Fuera de horario"),
    ),
    availableCount = 1,
    totalCount = 4,
    isLoading = false,
)

private fun row(name: String, city: String, offset: Int, status: String, label: String) = TeamRow(
    member = Member(name = name, city = city, countryCode = null, timezone = "UTC"),
    availability = MemberAvailability(
        id = name,
        localTime = "18:42",
        localDate = "2026-08-21",
        localWeekday = "friday",
        utcOffsetMinutes = offset,
        status = status,
        statusLabel = label,
        statusDetail = label,
    ),
)
