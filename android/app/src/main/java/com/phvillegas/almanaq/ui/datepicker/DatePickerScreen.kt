package com.phvillegas.almanaq.ui.datepicker

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.R
import com.phvillegas.almanaq.ui.CalendarUiState
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme
import com.phvillegas.almanaq.ui.theme.TabularFigures
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
 */
@Composable
fun DatePickerScreen(
    state: CalendarUiState,
    onMonth: (LocalDate) -> Unit,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
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

        MonthHeader(state.month, onMonth)
        WeekdayHeader()
        MonthGrid(state, onSelect)
        Summary(state)
    }
}

@Composable
private fun MonthHeader(month: LocalDate, onMonth: (LocalDate) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        TextButton(onClick = { onMonth(month.minusMonths(1)) }) { Text("‹") }
        Text(
            // The month name comes from the device locale, which is the same locale
            // the backend is being asked for through Accept-Language.
            text = "${month.month.getDisplayName(TextStyle.FULL, Locale.getDefault())} ${month.year}",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        TextButton(onClick = { onMonth(month.plusMonths(1)) }) { Text("›") }
    }
}

@Composable
private fun WeekdayHeader() {
    // The week starts on Monday. PLAN.md section 7.2.
    val days = listOf(
        java.time.DayOfWeek.MONDAY,
        java.time.DayOfWeek.TUESDAY,
        java.time.DayOfWeek.WEDNESDAY,
        java.time.DayOfWeek.THURSDAY,
        java.time.DayOfWeek.FRIDAY,
        java.time.DayOfWeek.SATURDAY,
        java.time.DayOfWeek.SUNDAY,
    )

    Row(modifier = Modifier.fillMaxWidth()) {
        for (day in days) {
            Text(
                text = day.getDisplayName(TextStyle.NARROW, Locale.getDefault()),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun MonthGrid(state: CalendarUiState, onSelect: (String) -> Unit) {
    val month = state.month
    val firstColumn = month.dayOfWeek.value - 1 // Monday is 1 in java.time.
    val length = month.lengthOfMonth()
    val today = LocalDate.now()
    val cells = firstColumn + length
    val rows = (cells + 6) / 7

    Column(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
        for (rowIndex in 0 until rows) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (column in 0 until 7) {
                    val dayNumber = rowIndex * 7 + column - firstColumn + 1
                    DayCell(
                        state = state,
                        month = month,
                        dayNumber = dayNumber,
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
    month: LocalDate,
    dayNumber: Int,
    length: Int,
    today: LocalDate,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (dayNumber < 1 || dayNumber > length) {
        Box(modifier = modifier.aspectRatio(1f))
        return
    }

    val date = month.withDayOfMonth(dayNumber)
    val iso = date.toString()
    val isPast = date.isBefore(today)
    val isSelected = state.selected == iso
    val hasConflict = state.days.containsKey(iso)

    val background =
        if (isSelected) MaterialTheme.colorScheme.primary else androidx.compose.ui.graphics.Color.Transparent
    val textColor = when {
        isSelected -> MaterialTheme.colorScheme.onPrimary
        isPast -> AlmanaqTheme.colors.textDisabled
        else -> MaterialTheme.colorScheme.onSurface
    }

    Box(
        modifier = modifier
            .aspectRatio(1f)
            .clickable(enabled = !isPast) { onSelect(iso) },
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
            // A conflicting day gets a dot, never a block: the product informs.
            Box(
                modifier = Modifier
                    .size(5.dp)
                    .clip(CircleShape)
                    .background(
                        if (hasConflict && !isPast) {
                            AlmanaqTheme.colors.localWeekend.dot
                        } else {
                            androidx.compose.ui.graphics.Color.Transparent
                        },
                    ),
            )
        }
    }
}

@Composable
private fun Summary(state: CalendarUiState) {
    val selected = state.selected ?: return
    val day = state.days[selected]
    // "Schedule anyway" has to exist: an app that only blocks gets abandoned. The
    // product informs, it does not veto. See PLAN.md section 7.2.
    var acknowledged by remember(selected) { mutableStateOf(false) }
    val palette =
        if (day == null) AlmanaqTheme.colors.available else AlmanaqTheme.colors.localWeekend
    val container = palette.container ?: MaterialTheme.colorScheme.surfaceVariant

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 16.dp, bottom = 24.dp)
            .clip(MaterialTheme.shapes.medium)
            .background(container)
            .padding(16.dp),
    ) {
        Text(
            // Long form in the device locale, not the raw ISO date the API speaks.
            // See PLAN.md section 7.2.
            text = LocalDate.parse(selected).format(
                DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(Locale.getDefault()),
            ),
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

        if (acknowledged) return@Column

        TextButton(
            onClick = { acknowledged = true },
            modifier = Modifier.padding(top = 8.dp),
        ) {
            Text(
                text = stringResource(R.string.dates_schedule_anyway),
                color = palette.text,
            )
        }
    }
}
