package com.phvillegas.almanaq.ui.member

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.phvillegas.almanaq.R
import com.phvillegas.almanaq.model.Location
import com.phvillegas.almanaq.ui.SearchUiState
import com.phvillegas.almanaq.ui.components.BackButton

/**
 * Adding a member: a name and a city, nothing else.
 *
 * Everything else — country, time zone, work week, holidays — is inferred by the
 * backend from the city. That is the single-player model of PLAN.md section 1: the
 * person being added installs nothing and confirms nothing.
 */
@Composable
fun AddMemberScreen(
    state: SearchUiState,
    onQuery: (String) -> Unit,
    onPick: (String, Location) -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var name by remember { mutableStateOf("") }

    Column(modifier = modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        // The navigation bar is hidden on this screen, so this is the only visible way
        // out of it. It used to be a small "Cancel" link below the city field, which
        // read as "discard what you typed" rather than "go back", and was easy to miss.
        BackButton(onBack = onBack, modifier = Modifier.padding(top = 8.dp))

        Text(
            text = stringResource(R.string.add_title),
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onBackground,
            modifier = Modifier.padding(bottom = 16.dp),
        )

        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text(stringResource(R.string.add_name_label)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )

        OutlinedTextField(
            value = state.query,
            onValueChange = onQuery,
            label = { Text(stringResource(R.string.add_city_label)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        )

        LazyColumn(modifier = Modifier.fillMaxSize().padding(top = 8.dp)) {
            items(state.results, key = { "${it.city}-${it.countryCode}-${it.timezone}" }) { location ->
                LocationRow(
                    location = location,
                    // A member without a name is unusable in a list, so the city row
                    // only becomes tappable once there is one.
                    enabled = name.isNotBlank(),
                    onClick = { onPick(name, location) },
                )
            }
        }
    }
}

@Composable
private fun LocationRow(location: Location, enabled: Boolean, onClick: () -> Unit) {
    val alpha = if (enabled) 1f else 0.4f

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 12.dp),
    ) {
        Text(
            text = location.city,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = alpha),
        )
        Text(
            // Region and country come from the backend; the country name is localized.
            text = listOf(location.region, location.country).filter { it.isNotBlank() }.joinToString(", "),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha),
        )
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
}
