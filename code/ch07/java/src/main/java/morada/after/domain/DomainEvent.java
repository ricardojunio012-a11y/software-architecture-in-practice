// Domain events: facts that have already happened, in the vocabulary of the business.
package morada.after.domain;

public sealed interface DomainEvent {
    record BookingConfirmed(
        String booking,
        String space,
        TimeSlot slot,
        String unit,
        Money fee
    ) implements DomainEvent {}

    record BookingCanceled(
        String booking,
        Money cancellationFee
    ) implements DomainEvent {}
}
