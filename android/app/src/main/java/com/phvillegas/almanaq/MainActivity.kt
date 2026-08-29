package com.phvillegas.almanaq

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.phvillegas.almanaq.ui.AppViewModel
import com.phvillegas.almanaq.ui.datepicker.DatePickerScreen
import com.phvillegas.almanaq.ui.member.AddMemberScreen
import com.phvillegas.almanaq.ui.member.MemberDetailScreen
import com.phvillegas.almanaq.ui.settings.SettingsScreen
import com.phvillegas.almanaq.ui.team.TeamScreen
import com.phvillegas.almanaq.ui.theme.AlmanaqTheme

/**
 * Three tabs and two pushed screens.
 *
 * Navigation is a sealed state rather than a navigation library: five destinations do
 * not justify another dependency and another version to keep aligned with AGP.
 * See CLAUDE.md rule 5.
 */
private sealed interface Destination {
    data object Team : Destination
    data object Dates : Destination
    data object Settings : Destination
    data object AddMember : Destination
    data object Detail : Destination
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AlmanaqTheme {
                AlmanaqApp()
            }
        }
    }
}

@Composable
private fun AlmanaqApp() {
    val model: AppViewModel = viewModel()
    val team by model.team.collectAsStateWithLifecycle()
    val search by model.search.collectAsStateWithLifecycle()
    val calendar by model.calendar.collectAsStateWithLifecycle()
    val detail by model.detail.collectAsStateWithLifecycle()
    val baseUrl by model.baseUrl.collectAsStateWithLifecycle()

    var destination by remember { mutableStateOf<Destination>(Destination.Team) }
    val isTab = destination is Destination.Team ||
        destination is Destination.Dates ||
        destination is Destination.Settings

    BackHandler(enabled = !isTab) {
        model.clearSearch()
        model.closeDetail()
        destination = Destination.Team
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            if (!isTab) return@Scaffold
            NavigationBar {
                NavigationBarItem(
                    selected = destination is Destination.Team,
                    onClick = { destination = Destination.Team },
                    icon = {},
                    label = { Text(stringResource(R.string.tab_team)) },
                )
                NavigationBarItem(
                    selected = destination is Destination.Dates,
                    onClick = {
                        destination = Destination.Dates
                        model.loadCalendar()
                    },
                    icon = {},
                    label = { Text(stringResource(R.string.tab_dates)) },
                )
                NavigationBarItem(
                    selected = destination is Destination.Settings,
                    onClick = { destination = Destination.Settings },
                    icon = {},
                    label = { Text(stringResource(R.string.tab_settings)) },
                )
            }
        },
    ) { innerPadding ->
        val content = Modifier.padding(innerPadding)

        when (destination) {
            Destination.Team -> TeamScreen(
                state = team,
                onAdd = { destination = Destination.AddMember },
                onOpen = { member ->
                    model.openDetail(member)
                    destination = Destination.Detail
                },
                modifier = content,
            )

            Destination.Dates -> DatePickerScreen(
                state = calendar,
                onMonth = model::showMonth,
                onSelect = model::selectDay,
                modifier = content,
            )

            Destination.Settings -> SettingsScreen(
                baseUrl = baseUrl,
                onBaseUrl = model::updateBaseUrl,
                modifier = content,
            )

            Destination.AddMember -> AddMemberScreen(
                state = search,
                onQuery = model::onSearchQuery,
                onPick = { name, location ->
                    model.addMember(name, location)
                    model.clearSearch()
                    destination = Destination.Team
                },
                onCancel = {
                    model.clearSearch()
                    destination = Destination.Team
                },
                modifier = content,
            )

            Destination.Detail -> MemberDetailScreen(
                state = detail,
                onBack = {
                    model.closeDetail()
                    destination = Destination.Team
                },
                onRemove = { id ->
                    model.removeMember(id)
                    model.closeDetail()
                    destination = Destination.Team
                },
                modifier = content,
            )
        }
    }
}
