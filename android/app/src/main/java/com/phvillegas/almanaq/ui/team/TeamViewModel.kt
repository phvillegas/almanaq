package com.phvillegas.almanaq.ui.team

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.phvillegas.almanaq.data.api.ApiClient
import com.phvillegas.almanaq.data.local.TeamStore
import com.phvillegas.almanaq.model.AvailabilityRequest
import com.phvillegas.almanaq.model.Member
import com.phvillegas.almanaq.model.MemberAvailability
import com.phvillegas.almanaq.model.toRef
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant

/** A member joined with the availability the backend resolved for them. */
data class TeamRow(
    val member: Member,
    val availability: MemberAvailability?,
)

data class TeamUiState(
    val rows: List<TeamRow> = emptyList(),
    val availableCount: Int = 0,
    val totalCount: Int = 0,
    val isLoading: Boolean = true,
    /** Set when the last refresh failed and the rows are stale. */
    val staleError: Boolean = false,
)

/**
 * Backs the "Now" screen.
 *
 * It holds no availability logic: it sends the team and an instant, and keeps what
 * comes back. Deciding who is available happens in the backend. See CLAUDE.md rule 1.
 */
class TeamViewModel(application: Application) : AndroidViewModel(application) {

    private val store = TeamStore(application)
    private val api = ApiClient.create()

    private val _state = MutableStateFlow(TeamUiState())
    val state: StateFlow<TeamUiState> = _state.asStateFlow()

    private var members: List<Member> = emptyList()

    init {
        viewModelScope.launch {
            members = store.load().members
            refresh()
        }
    }

    /**
     * Reloads availability.
     *
     * Called on open, on returning from the background and on pull to refresh — not
     * every minute. The clock in each row ticks on its own; re-querying the API once a
     * minute would be traffic for a value that changes at most once an hour.
     * See PLAN.md section 7.1.
     */
    fun refresh() {
        if (members.isEmpty()) {
            _state.value = TeamUiState(isLoading = false)
            return
        }

        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true)
            val request = AvailabilityRequest(
                at = Instant.now().toString(),
                members = members.map { it.toRef() },
            )

            runCatching { api.availability(request) }
                .onSuccess { response ->
                    // The backend returns members ordered by status. Keeping that order
                    // and sorting by name inside each run is the client's whole job
                    // here: it never decides which status outranks which.
                    val rows = response.members.mapNotNull { availability ->
                        members.find { it.id == availability.id }
                            ?.let { TeamRow(it, availability) }
                    }
                    _state.value = TeamUiState(
                        rows = sortByNameWithinStatus(rows),
                        availableCount = response.availableCount,
                        totalCount = response.totalCount,
                        isLoading = false,
                        staleError = false,
                    )
                }
                .onFailure {
                    // Keep whatever is on screen and flag it as stale. A full-screen
                    // error over usable data is worse than a discreet strip.
                    // See PLAN.md section 7.4.
                    _state.value = _state.value.copy(isLoading = false, staleError = true)
                }
        }
    }

    /** Stable sort by name inside each run of equal status. */
    private fun sortByNameWithinStatus(rows: List<TeamRow>): List<TeamRow> =
        rows.groupBy { it.availability?.status }
            .values
            .flatMap { group -> group.sortedBy { it.member.name.lowercase() } }
}
