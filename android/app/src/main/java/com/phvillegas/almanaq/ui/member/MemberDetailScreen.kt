package com.phvillegas.almanaq.ui.member

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.R
import com.phvillegas.almanaq.ui.DetailUiState
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme
import com.phvillegas.almanaq.ui.theme.TabularFigures

/**
 * One person's detail. See PLAN.md section 7.3.
 *
 * Every label on this screen — the work week, the calendar name, the holiday names —
 * arrives written and localized from the backend. The client lays them out.
 */
@Composable
fun MemberDetailScreen(
    state: DetailUiState,
    onBack: () -> Unit,
    onRemove: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val member = state.member ?: return
    val detail = state.detail

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        TextButton(onClick = onBack, modifier = Modifier.padding(top = 8.dp)) {
            Text(stringResource(R.string.detail_back))
        }

        Text(
            text = member.name,
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Text(
            text = member.city,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        if (detail == null) {
            Text(
                text = stringResource(if (state.isLoading) R.string.detail_loading else R.string.detail_failed),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 24.dp),
            )
            RemoveAction(member.id, onRemove)
            return@Column
        }

        Text(
            text = detail.localTime,
            style = MaterialTheme.typography.displayLarge.merge(TabularFigures),
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(top = 16.dp),
        )
        Text(
            text = detail.localDateFormatted,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        StatusBanner(status = detail.status, label = detail.statusLabel)

        SectionTitle(stringResource(R.string.detail_work_week))
        LabelRow(stringResource(R.string.detail_days), detail.workWeek.daysLabel)
        LabelRow(stringResource(R.string.detail_weekend), detail.workWeek.weekendLabel)
        LabelRow(stringResource(R.string.detail_hours), detail.workWeek.hoursLabel)

        // Hidden entirely when the country has no calendar of its own, rather than
        // showing an empty row. PLAN.md section 7.3.
        detail.localCalendar?.let { calendar ->
            LabelRow(
                stringResource(R.string.detail_local_calendar),
                "${calendar.label} · ${calendar.currentYear}",
            )
        }

        if (detail.upcomingHolidays.isNotEmpty()) {
            SectionTitle(stringResource(R.string.detail_upcoming_holidays))
            for (holiday in detail.upcomingHolidays) {
                LabelRow(holiday.name, holiday.dateLabel)
            }
        }

        detail.localCalendar?.note?.let { note ->
            Text(
                text = note,
                style = MaterialTheme.typography.bodyMedium,
                color = AlmanaqTheme.colors.textDisabled,
                modifier = Modifier.padding(top = 16.dp),
            )
        }

        RemoveAction(member.id, onRemove)
    }
}

@Composable
private fun RemoveAction(id: String, onRemove: (String) -> Unit) {
    TextButton(onClick = { onRemove(id) }, modifier = Modifier.padding(vertical = 24.dp)) {
        Text(
            text = stringResource(R.string.detail_remove),
            color = AlmanaqTheme.colors.localHoliday.text,
        )
    }
}

@Composable
private fun StatusBanner(status: String, label: String) {
    val palette = AlmanaqTheme.colors.forStatus(status)
    val container = palette.container ?: MaterialTheme.colorScheme.surfaceVariant

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 16.dp)
            .clip(MaterialTheme.shapes.medium)
            .background(container)
            .padding(16.dp),
    ) {
        Text(
            // Written and localized by the backend.
            text = label,
            style = MaterialTheme.typography.titleMedium,
            color = palette.text,
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 24.dp, bottom = 8.dp),
    )
}

@Composable
private fun LabelRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}
