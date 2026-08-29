package com.phvillegas.almanaq.data.local

import android.content.Context
import com.phvillegas.almanaq.model.Member
import com.phvillegas.almanaq.model.TeamDocument
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import java.io.File
import java.time.Instant

/**
 * Stores the team as a whole versioned JSON document, not as separate keys.
 *
 * PLAN.md section 11 keeps this deliberately separate from app preferences: the team
 * is the only thing that might ever sync, and saving it as one document is what makes
 * that a copy instead of a refactor. Writing individual fields would undo it.
 */
class TeamStore(context: Context) {

    private val file = File(context.filesDir, FILE_NAME)

    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    suspend fun load(): TeamDocument = withContext(Dispatchers.IO) {
        if (!file.exists()) return@withContext TeamDocument()
        runCatching { json.decodeFromString<TeamDocument>(file.readText()) }
            // A corrupt file must not brick the app. An empty team is recoverable;
            // a crash loop on start is not.
            .getOrElse { TeamDocument() }
    }

    suspend fun save(members: List<Member>): TeamDocument = withContext(Dispatchers.IO) {
        val document = TeamDocument(
            schemaVersion = SCHEMA_VERSION,
            updatedAt = Instant.now().toString(),
            members = members,
        )
        file.writeText(json.encodeToString(document))
        document
    }

    /** The same bytes the share sheet exports. See PLAN.md section 11. */
    suspend fun exportJson(): String = withContext(Dispatchers.IO) {
        if (file.exists()) file.readText() else json.encodeToString(TeamDocument())
    }

    private companion object {
        const val FILE_NAME = "team.json"
        const val SCHEMA_VERSION = 1
    }
}
