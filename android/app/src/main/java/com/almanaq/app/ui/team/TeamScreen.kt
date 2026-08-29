package com.almanaq.app.ui.team

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.almanaq.app.model.Member
import com.almanaq.app.model.MemberAvailability
import com.almanaq.app.ui.theme.AlmanaqTheme
import com.almanaq.app.ui.theme.TabularFigures

/**
 * The "Now" screen. See PLAN.md section 7.1.
 *
 * Every value it paints is resolved by the backend. This file contains no rule about
 * who is available, no time zone arithmetic and no status text: it maps a status to a
 * colour and lays the row out.
 */
@Composable
fun TeamScreen(state: TeamUiState, modifier: Modifier = Modifier) {
    Column(modifier = modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Text(
            text = "Almanaq",
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(top = 24.dp),
        )
        Counter(state)

        if (state.staleError) StaleBanner()

        if (state.rows.isEmpty() && !state.isLoading) {
            EmptyState(modifier = Modifier.fillMaxSize())
            return@Column
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(top = 16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            items(state.rows, key = { it.member.id }) { row ->
                MemberRow(row)
            }
        }
    }
}

@Composable
private fun Counter(state: TeamUiState) {
    // The wording comes from the client because it is a count, not product copy about
    // a member's situation. Anything describing a person's availability comes from the
    // backend already written.
    Text(
        text = "${state.availableCount} / ${state.totalCount}",
        style = MaterialTheme.typography.bodyMedium.merge(TabularFigures),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@Composable
private fun StaleBanner() {
    Text(
        text = "···",
        style = MaterialTheme.typography.labelSmall,
        color = AlmanaqTheme.colors.localWeekend.text,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@Composable
private fun MemberRow(row: TeamRow, modifier: Modifier = Modifier) {
    val palette = AlmanaqTheme.colors.forStatus(row.availability?.status ?: "UNKNOWN")

    Row(
        modifier = modifier.fillMaxWidth().padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Avatar(name = row.member.name, background = palette.avatarBackground, text = palette.avatarText)

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
                // Tabular figures: without them the digits shift every minute.
                text = row.availability?.localTime.orEmpty(),
                style = MaterialTheme.typography.titleMedium.merge(TabularFigures),
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.End,
            )
            Text(
                // Written and localized by the backend. Never composed here.
                text = row.availability?.statusLabel.orEmpty(),
                style = MaterialTheme.typography.labelLarge,
                color = palette.text,
                textAlign = TextAlign.End,
            )
        }
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}

@Composable
private fun Avatar(name: String, background: androidx.compose.ui.graphics.Color, text: androidx.compose.ui.graphics.Color) {
    Box(
        modifier = Modifier.size(40.dp).clip(CircleShape).background(background),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = initialsOf(name),
            style = MaterialTheme.typography.labelLarge,
            color = text,
        )
    }
}

private fun initialsOf(name: String): String =
    name.trim().split(Regex("\\s+")).take(2).mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("")

@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Text(
            text = "—",
            style = MaterialTheme.typography.headlineMedium,
            color = AlmanaqTheme.colors.textDisabled,
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun TeamScreenPreview() {
    AlmanaqTheme {
        TeamScreen(state = previewState())
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0F0E1C)
@Composable
private fun TeamScreenDarkPreview() {
    AlmanaqTheme(darkTheme = true) {
        TeamScreen(state = previewState())
    }
}

private fun previewState() = TeamUiState(
    rows = listOf(
        row("Ana Ruiz", "Buenos Aires", "12:42", "AVAILABLE", "Disponible"),
        row("Nadia Peretz", "Tel Aviv", "18:42", "LOCAL_WEEKEND", "Fin de semana"),
        row("Selam Bekele", "Addis Abeba", "18:42", "LOCAL_HOLIDAY", "Feriado"),
        row("Bikash Thapa", "Katmandú", "21:27", "OFF_HOURS", "Fuera de horario"),
    ),
    availableCount = 1,
    totalCount = 4,
    isLoading = false,
)

private fun row(name: String, city: String, time: String, status: String, label: String) = TeamRow(
    member = Member(name = name, city = city, countryCode = null, timezone = "UTC"),
    availability = MemberAvailability(
        id = name,
        localTime = time,
        localDate = "2026-08-21",
        localWeekday = "friday",
        utcOffsetMinutes = 0,
        status = status,
        statusLabel = label,
        statusDetail = label,
    ),
)
