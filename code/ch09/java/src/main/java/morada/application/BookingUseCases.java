// Inbound port: what the system offers, whoever drives it.
package morada.application;

import java.util.List;

public interface BookingUseCases {
    record BookingRequest(
        String booking,
        String unit,
        String space,
        String date,
        Integer start,
        Integer end,
        String requestedOn
    ) {}

    record ListedSpace(String id, String fee, int minNoticeDays) {}

    record Confirmation(String booking, String status, String fee) {}

    record Cancellation(String booking, String status, String cancellationFee) {}

    record ListedBooking(String booking, String unit, String slot) {}

    List<ListedSpace> listSpaces();

    Confirmation book(BookingRequest request);

    Cancellation cancel(String booking, String requestedOn);

    List<ListedBooking> bookingsForSpace(String space);
}
