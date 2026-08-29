package com.almanaq.app.data.api

import com.almanaq.app.model.AvailabilityRequest
import com.almanaq.app.model.AvailabilityResponse
import com.almanaq.app.model.LocationSearchResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * The frozen v1 contract. See PLAN.md section 4.
 *
 * Only the two endpoints the "Now" screen needs are declared so far; `/v1/calendar`
 * and `/v1/member/detail` land with their screens.
 *
 * `Accept-Language` is not declared per call: it is attached to every request by the
 * interceptor in `ApiClient`, so no call site can forget it.
 */
interface AlmanaqApi {

    @POST("v1/availability")
    suspend fun availability(@Body request: AvailabilityRequest): AvailabilityResponse

    @GET("v1/locations/search")
    suspend fun searchLocations(@Query("q") query: String): LocationSearchResponse
}
