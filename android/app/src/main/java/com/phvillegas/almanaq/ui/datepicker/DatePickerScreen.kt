package com.phvillegas.almanaq.ui.datepicker

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.R
import com.phvillegas.almanaq.ui.CalendarUiState
import com.phvillegas.almanaq.ui.components.CalendarSkeleton
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme
import com.phvillegas.almanaq.ui.theme.TabularFigures
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.util.Locale

/**
 * Picking a date. See PLAN.md section 7.2.
 *
 * The grid marks days the backend reported as conflicting. It does not decide what a
 * conflict is, and it never blocks a date: "schedule anyway" is always available,
 * because a product that only blocks gets abandoned.
 *
 * The week starts on Monday and the columns that are the phone owner's own weekend are
 * greyed. That is the one calendar fact resolved on the device, and `Weekend.kt` says
 * why it is allowed to be.
 */
@Composable
fun DatePickerScreen(
    state: CalendarUiState,
    onMonth: (LocalDate) -> Unit,
    onSelect: (String) -> Unit,
    onConflictFreeOnly: (Boolean) -> Unit,
    onRetry: () -> Unit,
    onAdd: () -> Unit,
    onSchedule: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    // The device locale does not change while the screen is composed, and the lookup
    // reaches into ICU, so it is worth remembering.
    val weekend = remember { deviceWeekend() }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        Text(
            text = stringResource(R.string.dates_title),
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(top = 24.dp),
        )

        if (!state.hasMembers && !state.isLoading) {
            EmptyState(onAdd = onAdd)
            return@Column
        }

        MonthHeader(state.month, onMonth)

        if (state.failed) FailureStrip(onRetry)

        WeekdayHeader(weekend)
        Grid(state = state, weekend = weekend, onSelect = onSelect)
        Summary(state, onSchedule)
        FilterButton(state, onConflictFreeOnly)
    }
}

@Composable
private fun MonthHeader(month: LocalDate, onMonth: (LocalDate) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        // The glyph is decorative; the description is what a screen reader announces.
        val previous = stringResource(R.string.dates_previous_month)
        val next = stringResource(R.string.dates_next_month)

        TextButton(
            onClick = { onMonth(month.minusMonths(1)) },
            modifier = Modifier.semantics { contentDescription = previous },
        ) {
            Text("‹")
        }
        Text(
            // The month name comes from the device locale, which is the same locale
            // the backend is being asked for through Accept-Language.
            text = "${month.month.getDisplayName(TextStyle.FULL, Locale.getDefault())} ${month.year}",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        TextButton(
            onClick = { onMonth(month.plusMonths(1)) },
            modifier = Modifier.semantics { contentDescription = next },
        ) {
            Text("›")
        }
    }
}

@Composable
private fun FailureStrip(onRetry: () -> Unit) {
    // Never a grid that silently looks clear. An empty month after a failed request
    // means "we do not know", not "nobody is away".
    Text(
        text = stringResource(R.string.dates_failed),
        style = MaterialTheme.typography.labelLarge,
        color = AlmanaqTheme.colors.localWeekend.text,
        modifier = Modifier.fillMaxWidth().clickable(onClick = onRetry).padding(vertical = 8.dp),
    )
}

/** Monday first, with the phone owner's weekend columns already receding. */
@Composable
private fun WeekdayHeader(weekend: Set<DayOfWeek>) {
    Row(modifier = Modifier.fillMaxWidth().clearAndSetSemantics { }) {
        for (day in WEEK) {
            Text(
                text = day.getDisplayName(TextStyle.NARROW, Locale.getDefault()),
                style = MaterialTheme.typography.labelSmall,
                color = weekdayColor(weekend.contains(day)),
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun Grid(state: CalendarUiState, weekend: Set<DayOfWeek>, onSelect: (String) -> Unit) {
    if (state.isLoading && state.days.isEmpty()) {
        CalendarSkeleton(modifier = Modifier.padding(top = 8.dp))
        return
    }

    val month = state.month
    val firstColumn = month.dayOfWeek.value - 1 // Monday is 1 in java.time.
    val length = month.lengthOfMonth()
    val today = LocalDate.now()
    val rows = (firstColumn + length + 6) / 7

    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        for (rowIndex in 0 until rows) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (column in 0 until 7) {
                    DayCell(
                        state = state,
                        weekend = weekend,
                        dayNumber = rowIndex * 7 + column - firstColumn + 1,
                        length = length,
                        today = today,
                        onSelect = onSelect,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

@Composable
private fun DayCell(
    state: CalendarUiState,
    weekend: Set<DayOfWeek>,
    dayNumber: Int,
    length: Int,
    today: LocalDate,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (dayNumber < 1 || dayNumber > length) {
        Box(modifier = modifier.heightIn(min = MIN_TOUCH_TARGET))
        return
    }

    val date = state.month.withDayOfMonth(dayNumber)
    val iso = date.toString()
    val day = state.days[iso]
    val isPast = date.isBefore(today)
    val isSelected = state.selected == iso
    // The conflict-free view does not hide days, it takes them out of reach. A grid with
    // holes in it stops being a calendar, and the user still needs to see that the 21st
    // exists before deciding to schedule on it anyway.
    val isFilteredOut = state.conflictFreeOnly && day != null
    val isSelectable = !isPast && !isFilteredOut

    val background = when {
        isSelected -> MaterialTheme.colorScheme.primary
        else -> Color.Transparent
    }
    val textColor = when {
        isSelected -> MaterialTheme.colorScheme.onPrimary
        !isSelectable -> AlmanaqTheme.colors.textDisabled
        else -> weekdayColor(weekend.contains(date.dayOfWeek))
    }

    // A bare "21" tells a screen reader nothing about why that day is worth avoiding.
    val spoken = when (day) {
        null -> longDate(iso)
        else -> stringResource(R.string.dates_day_conflicts_a11y, longDate(iso), day.conflictCount)
    }

    Box(
        modifier = modifier
            .heightIn(min = MIN_TOUCH_TARGET)
            .clickable(enabled = isSelectable) { onSelect(iso) }
            .semantics(mergeDescendants = true) { contentDescription = spoken },
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier.size(32.dp).clip(CircleShape).background(background),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = dayNumber.toString(),
                    style = MaterialTheme.typography.bodyMedium.merge(TabularFigures),
                    color = textColor,
                )
            }
            ConflictDot(visible = day != null && !isPast)
        }
    }
}

/** A dot, never a block. The product informs; it does not veto. PLAN.md section 7.2. */
@Composable
private fun ConflictDot(visible: Boolean) {
    Box(
        modifier = Modifier
            .size(5.dp)
            .clip(CircleShape)
            .background(if (visible) AlmanaqTheme.colors.localWeekend.dot else Color.Transparent),
    )
}

@Composable
private fun Summary(state: CalendarUiState, onSchedule: (String) -> Unit) {
    val selected = state.selected

    if (selected == null) {
        NoSelectionHint(state)
        return
    }

    val day = state.days[selected]
    val palette =
        if (day == null) AlmanaqTheme.colors.available else AlmanaqTheme.colors.localWeekend
    val container = palette.container ?: MaterialTheme.colorScheme.surfaceVariant

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 16.dp)
            .clip(MaterialTheme.shapes.medium)
            .background(container)
            .padding(16.dp),
    ) {
        Text(
            // Long form in the device locale, not the raw ISO date the API speaks.
            text = longDate(selected),
            style = MaterialTheme.typography.titleMedium.merge(TabularFigures),
            color = palette.text,
        )

        if (day == null) {
            Text(
                text = stringResource(R.string.dates_all_available),
                style = MaterialTheme.typography.bodyMedium,
                color = palette.text,
                modifier = Modifier.padding(top = 4.dp),
            )
            ScheduleAction(selected, hasConflicts = false, color = palette.text, onSchedule = onSchedule)
            return@Column
        }

        Text(
            text = stringResource(R.string.dates_unavailable_count, day.conflictCount),
            style = MaterialTheme.typography.labelLarge,
            color = palette.text,
            modifier = Modifier.padding(top = 4.dp),
        )
        HorizontalDivider(
            color = palette.text.copy(alpha = 0.2f),
            modifier = Modifier.padding(vertical = 12.dp),
        )
        for (conflict in day.conflicts) {
            Text(
                // The reason text is written and localized by the backend.
                text = conflict.detail,
                style = MaterialTheme.typography.bodyMedium,
                color = palette.text,
                modifier = Modifier.padding(vertical = 2.dp),
            )
        }

        ScheduleAction(selected, hasConflicts = true, color = palette.text, onSchedule = onSchedule)
    }
}

/**
 * Hands the chosen day to whatever calendar the phone has. See PLAN.md section 7.2.
 *
 * "Schedule anyway" has to exist, because an app that only blocks gets abandoned. It
 * used to only acknowledge the conflict and fall silent, which made it a dead end: the
 * product told you which day to pick and then left you to retype it somewhere else.
 *
 * The wording changes with the day and the meaning does not. On a day with conflicts it
 * still reads "schedule anyway", which is a decision the user is making with the reasons
 * in front of them. On a clear day it is simply "schedule".
 *
 * This is not calendar *integration*, which section 2 rules out. Nothing is read, no
 * account is touched, no permission is asked for: a date leaves the app through a
 * platform intent and the user's own calendar takes it from there.
 */
@Composable
private fun ScheduleAction(
    selected: String,
    hasConflicts: Boolean,
    color: Color,
    onSchedule: (String) -> Unit,
) {
    val label =
        if (hasConflicts) R.string.dates_schedule_anyway else R.string.dates_schedule

    TextButton(onClick = { onSchedule(selected) }, modifier = Modifier.padding(top = 8.dp)) {
        Text(text = stringResource(label), color = color)
    }
}

/**
 * What the card says before a day is picked.
 *
 * With the filter on and nothing left to offer, it has to say so out loud. Silence there
 * would read as "still loading" on a screen that has finished loading.
 */
@Composable
private fun NoSelectionHint(state: CalendarUiState) {
    if (!state.conflictFreeOnly || state.isLoading) return

    Text(
        text = stringResource(R.string.dates_no_clear_day),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 16.dp),
    )
}

@Composable
private fun FilterButton(state: CalendarUiState, onConflictFreeOnly: (Boolean) -> Unit) {
    val label =
        if (state.conflictFreeOnly) R.string.dates_show_all else R.string.dates_show_conflict_free

    OutlinedButton(
        onClick = { onConflictFreeOnly(!state.conflictFreeOnly) },
        modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 24.dp),
    ) {
        Text(stringResource(label))
    }
}

@Composable
private fun EmptyState(onAdd: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(R.string.dates_empty_title),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Button(onClick = onAdd, modifier = Modifier.padding(top = 16.dp)) {
            Text(stringResource(R.string.team_empty_action))
        }
    }
}

/**
 * Weekend columns recede, but they stay readable.
 *
 * Section 7.2 asks for `#9C9DB4`, which measures 2.66:1 on the light background and
 * fails the 4.5:1 rule the same plan sets in section 6. A weekend day is selectable, so
 * it is not an inactive control and the exemption does not apply. `onSurfaceVariant`
 * keeps the intent — the column is quieter than a working day — at 8.90:1 light and
 * 10.91:1 dark, measured against the generated scheme. See CLAUDE.md rule 7.
 */
@Composable
private fun weekdayColor(isWeekend: Boolean) = when (isWeekend) {
    true -> MaterialTheme.colorScheme.onSurfaceVariant
    false -> MaterialTheme.colorScheme.onSurface
}

private fun longDate(iso: String): String =
    LocalDate.parse(iso).format(
        DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(Locale.getDefault()),
    )

private val WEEK = listOf(
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY,
    DayOfWeek.FRIDAY,
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY,
)

private val MIN_TOUCH_TARGET = 48.dp
