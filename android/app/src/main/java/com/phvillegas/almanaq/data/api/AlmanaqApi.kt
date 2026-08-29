package com.phvillegas.almanaq.data.api

import com.phvillegas.almanaq.model.AvailabilityRequest
import com.phvillegas.almanaq.model.AvailabilityResponse
import com.phvillegas.almanaq.model.CalendarRequest
import com.phvillegas.almanaq.model.CalendarResponse
import com.phvillegas.almanaq.model.LocationSearchResponse
import com.phvillegas.almanaq.model.MemberDetailRequest
import com.phvillegas.almanaq.model.MemberDetailResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * The frozen v1 contract, in full. See PLAN.md section 4.
 *
 * `Accept-Language` is not declared per call: it is attached to every request by the
 * interceptor in `ApiClient`, so no call site can forget it.
 */
interface AlmanaqApi {

    @POST("v1/availability")
    suspend fun availability(@Body request: AvailabilityRequest): AvailabilityResponse

    @POST("v1/calendar")
    suspend fun calendar(@Body request: CalendarRequest): CalendarResponse

    @POST("v1/member/detail")
    suspend fun memberDetail(@Body request: MemberDetailRequest): MemberDetailResponse

    @GET("v1/locations/search")
    suspend fun searchLocations(@Query("q") query: String): LocationSearchResponse
}
