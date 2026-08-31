package com.phvillegas.almanaq.ui

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.phvillegas.almanaq.data.api.AlmanaqApi
import com.phvillegas.almanaq.data.api.ApiClient
import com.phvillegas.almanaq.data.local.SettingsStore
import com.phvillegas.almanaq.data.local.TeamStore
import com.phvillegas.almanaq.model.AvailabilityRequest
import com.phvillegas.almanaq.model.CalendarDay
import com.phvillegas.almanaq.model.CalendarRequest
import com.phvillegas.almanaq.model.Location
import com.phvillegas.almanaq.model.Member
import com.phvillegas.almanaq.model.MemberAvailability
import com.phvillegas.almanaq.model.MemberDetailRequest
import com.phvillegas.almanaq.model.MemberDetailResponse
import com.phvillegas.almanaq.model.Overrides
import com.phvillegas.almanaq.model.toRef
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate

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
    /** Set when the last refresh failed and the rows on screen are stale. */
    val staleError: Boolean = false,
    /**
     * When the rows on screen were last resolved by the backend. `null` means nothing
     * has ever loaded, which is why the strip can say how old the data is only
     * sometimes. See PLAN.md section 7.4.
     */
    val loadedAt: Instant? = null,
)

data class SearchUiState(
    val query: String = "",
    val results: List<Location> = emptyList(),
    val isSearching: Boolean = false,
)

data class CalendarUiState(
    val month: LocalDate = LocalDate.now().withDayOfMonth(1),
    val days: Map<String, CalendarDay> = emptyMap(),
    val selected: String? = null,
    val isLoading: Boolean = false,
    /** When on, the grid dims the days that have conflicts. See PLAN.md section 7.2. */
    val conflictFreeOnly: Boolean = false,
    /**
     * False when the team is empty. Without it every day comes back clear and the card
     * would announce that the whole team is available, which is true and useless.
     */
    val hasMembers: Boolean = false,
    /**
     * Set when the last load failed.
     *
     * It exists because "no conflicts came back" and "nothing came back" look identical
     * in the grid, and one of them means the whole team is free while the other means we
     * have no idea. Never claim the first when it was the second.
     */
    val failed: Boolean = false,
)

data class DetailUiState(
    val member: Member? = null,
    val detail: MemberDetailResponse? = null,
    val isLoading: Boolean = false,
    val failed: Boolean = false,
)

/**
 * Sorts by name inside each status group, leaving the groups where the backend put them.
 *
 * `groupBy` keeps the order the keys were first seen, which is the order the response
 * arrived in. That matters: the backend decides that available outranks off hours
 * outranks weekend, and the client must not re-decide it. All this does is settle ties.
 *
 * Top level and `internal` so it can be tested without an Android runtime.
 */
internal fun sortByNameWithinStatus(rows: List<TeamRow>): List<TeamRow> =
    rows.groupBy { it.availability?.status }
        .values
        .flatMap { group -> group.sortedBy { it.member.name.lowercase() } }

/**
 * The first day in the visible month that nobody is away on, today or later.
 *
 * It decides nothing about availability. A day is clear when the backend did not return
 * it, and the backend only returns days that have a conflict — so "clear" here means
 * "the backend said nothing about it", which is the only definition the client is
 * allowed to hold. See CLAUDE.md rule 1.
 *
 * Top level and `internal` so it can be tested without an Android runtime.
 */
internal fun firstClearDay(month: LocalDate, conflicts: Set<String>, today: LocalDate): String? {
    val start = maxOf(month.withDayOfMonth(1), today)
    val end = month.withDayOfMonth(month.lengthOfMonth())

    var day = start
    while (!day.isAfter(end)) {
        if (!conflicts.contains(day.toString())) return day.toString()
        day = day.plusDays(1)
    }

    // A month entirely in the past, or one where every remaining day has a conflict.
    return null
}

/**
 * Holds everything the three screens read.
 *
 * It contains no availability logic: it sends the team and an instant, and keeps what
 * comes back. Deciding who is available happens in the backend, always.
 * See CLAUDE.md rule 1.
 */
class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val teamStore = TeamStore(application)
    private val settings = SettingsStore(application)

    private var api: AlmanaqApi = ApiClient.create(SettingsStore.DEFAULT_BASE_URL)

    private val _team = MutableStateFlow(TeamUiState())
    val team: StateFlow<TeamUiState> = _team.asStateFlow()

    private val _search = MutableStateFlow(SearchUiState())
    val search: StateFlow<SearchUiState> = _search.asStateFlow()

    private val _calendar = MutableStateFlow(CalendarUiState())
    val calendar: StateFlow<CalendarUiState> = _calendar.asStateFlow()

    private val _detail = MutableStateFlow(DetailUiState())
    val detail: StateFlow<DetailUiState> = _detail.asStateFlow()

    private val _baseUrl = MutableStateFlow(SettingsStore.DEFAULT_BASE_URL)
    val baseUrl: StateFlow<String> = _baseUrl.asStateFlow()

    private var members: List<Member> = emptyList()

    init {
        viewModelScope.launch {
            val stored = settings.baseUrl.first()
            _baseUrl.value = stored
            api = ApiClient.create(stored)
            members = teamStore.load().members
            refreshTeam()
        }
    }

    // --- Settings ---------------------------------------------------------------

    fun updateBaseUrl(value: String) {
        viewModelScope.launch {
            settings.setBaseUrl(value)
            val stored = settings.baseUrl.first()
            _baseUrl.value = stored
            api = ApiClient.create(stored)
            refreshTeam()
        }
    }

    // --- Team -------------------------------------------------------------------

    /**
     * Reloads availability.
     *
     * Called on open, on returning from the background and on pull to refresh — not
     * every minute. The clock in each row ticks on its own; re-querying once a minute
     * would be traffic for a value that changes at most once an hour.
     * See PLAN.md section 7.1.
     */
    fun refreshTeam() {
        if (members.isEmpty()) {
            _team.value = TeamUiState(isLoading = false)
            return
        }

        viewModelScope.launch {
            _team.value = _team.value.copy(isLoading = true)
            val request = AvailabilityRequest(
                at = Instant.now().toString(),
                members = members.map { it.toRef() },
            )

            runCatching { api.availability(request) }
                .onSuccess { response ->
                    // The backend groups by status. The client only sorts by name
                    // inside each group: it never decides which status outranks which.
                    val rows = response.members.mapNotNull { availability ->
                        members.find { it.id == availability.id }
                            ?.let { TeamRow(it, availability) }
                    }
                    _team.value = TeamUiState(
                        rows = sortByNameWithinStatus(rows),
                        availableCount = response.availableCount,
                        totalCount = response.totalCount,
                        isLoading = false,
                        staleError = false,
                        loadedAt = Instant.now(),
                    )
                }
                .onFailure { error ->
                    Log.w(TAG, "availability failed", error)
                    // Keep what is on screen and flag it stale. A full-screen error
                    // over usable data is worse than a discreet strip. PLAN.md 7.4.
                    _team.value = _team.value.copy(
                        isLoading = false,
                        staleError = true,
                        totalCount = members.size,
                        rows = if (_team.value.rows.isEmpty()) {
                            members.map { TeamRow(it, null) }
                        } else {
                            _team.value.rows
                        },
                    )
                }
        }
    }

    // --- Adding and removing members --------------------------------------------

    fun onSearchQuery(query: String) {
        _search.value = _search.value.copy(query = query)
        if (query.trim().length < 2) {
            _search.value = _search.value.copy(results = emptyList(), isSearching = false)
            return
        }

        viewModelScope.launch {
            _search.value = _search.value.copy(isSearching = true)
            runCatching { api.searchLocations(query.trim()) }
                .onSuccess { _search.value = _search.value.copy(results = it.results, isSearching = false) }
                .onFailure { error ->
                    Log.w(TAG, "location search failed", error)
                    _search.value = _search.value.copy(results = emptyList(), isSearching = false)
                }
        }
    }

    fun clearSearch() {
        _search.value = SearchUiState()
    }

    fun addMember(name: String, location: Location) {
        val member = Member(
            name = name.trim(),
            city = location.city,
            countryCode = location.countryCode,
            timezone = location.timezone,
            updatedAt = Instant.now().toString(),
        )
        persist(members + member)
    }

    fun removeMember(id: String) {
        persist(members.filterNot { it.id == id })
    }

    fun updateOverrides(id: String, overrides: Overrides?) {
        persist(members.map { if (it.id == id) it.copy(overrides = overrides) else it })
    }

    private fun persist(updated: List<Member>) {
        members = updated
        viewModelScope.launch {
            teamStore.save(updated)
            refreshTeam()
        }
    }

    suspend fun exportJson(): String = teamStore.exportJson()

    /** Returns false when the document is unreadable or from a newer schema. */
    suspend fun importJson(text: String): Boolean {
        val document = teamStore.importJson(text) ?: return false
        members = document.members
        refreshTeam()
        return true
    }

    // --- Calendar ---------------------------------------------------------------

    fun showMonth(month: LocalDate) {
        _calendar.value = _calendar.value.copy(month = month.withDayOfMonth(1), selected = null)
        loadCalendar()
    }

    fun selectDay(date: String) {
        _calendar.value = _calendar.value.copy(selected = date)
    }

    /**
     * What the "Find a time" button does. See PLAN.md section 7.2.
     *
     * It opens the month with the filter already on, which lands the user on the first
     * day nobody is away rather than on a grid they have to read.
     */
    fun findTime() {
        _calendar.value = _calendar.value.copy(conflictFreeOnly = true)
        loadCalendar()
    }

    fun showConflictFreeOnly(enabled: Boolean) {
        _calendar.value = _calendar.value.copy(conflictFreeOnly = enabled)
        if (!enabled) return
        selectFirstClearDay()
    }

    private fun selectFirstClearDay() {
        val state = _calendar.value
        val clear = firstClearDay(state.month, state.days.keys, LocalDate.now()) ?: return
        _calendar.value = state.copy(selected = clear)
    }

    fun loadCalendar() {
        if (members.isEmpty()) {
            _calendar.value = _calendar.value.copy(
                days = emptyMap(),
                isLoading = false,
                hasMembers = false,
            )
            return
        }

        val month = _calendar.value.month
        viewModelScope.launch {
            _calendar.value = _calendar.value.copy(isLoading = true, failed = false)
            val request = CalendarRequest(
                from = month.toString(),
                to = month.withDayOfMonth(month.lengthOfMonth()).toString(),
                members = members.map { it.toRef() },
            )
            runCatching { api.calendar(request) }
                .onSuccess { response ->
                    _calendar.value = _calendar.value.copy(
                        days = response.days.associateBy { it.date },
                        isLoading = false,
                        hasMembers = true,
                        failed = false,
                    )
                    if (_calendar.value.conflictFreeOnly) selectFirstClearDay()
                }
                .onFailure { error ->
                    Log.w(TAG, "calendar failed", error)
                    _calendar.value = _calendar.value.copy(
                        days = emptyMap(),
                        selected = null,
                        isLoading = false,
                        hasMembers = true,
                        failed = true,
                    )
                }
        }
    }

    // --- Member detail ----------------------------------------------------------

    fun openDetail(member: Member) {
        _detail.value = DetailUiState(member = member, isLoading = true)
        viewModelScope.launch {
            val request = MemberDetailRequest(member = member.toRef(), at = Instant.now().toString())
            runCatching { api.memberDetail(request) }
                .onSuccess { _detail.value = DetailUiState(member = member, detail = it, isLoading = false) }
                .onFailure { error ->
                    Log.w(TAG, "member detail failed", error)
                    _detail.value = DetailUiState(member = member, isLoading = false, failed = true)
                }
        }
    }

    fun closeDetail() {
        _detail.value = DetailUiState()
    }

    private companion object {
        // Network failures are recoverable for the user but must not be invisible to
        // whoever is debugging: a silent catch is how a broken base URL looks like an
        // empty result list.
        const val TAG = "Almanaq"
    }
}
