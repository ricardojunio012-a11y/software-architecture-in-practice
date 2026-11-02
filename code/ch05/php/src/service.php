<?php
// Receives the request, consults the approval chain, stores and announces the result.
namespace Morada;

require_once __DIR__ . '/approval.php';
require_once __DIR__ . '/events.php';
require_once __DIR__ . '/state.php';

final class BookingService
{
    public function __construct(
        private readonly Stage $approval,
        private readonly BookingRepository $bookings,
        private readonly EventBus $events,
    ) {}

    public function submit(BookingRequest $request): Decision
    {
        $booking = new Booking($request);
        $decision = $this->approval->evaluate($request);
        // The chain saw the space free, but another request may have saved since:
        // saving checks again, in a single operation (step 6 of the lab)
        if ($decision->approved && !$this->bookings->saveIfFree($booking)) {
            $decision = new Decision(false, 'space already booked on this date');
        }
        if ($decision->approved) {
            $booking->approve();
            $this->events->publish(new Event('BookingConfirmed', $request));
        } else {
            $booking->reject();
            $this->bookings->save($booking);
            $this->events->publish(
                new Event('BookingRejected', $request, $decision->reason),
            );
        }
        return $decision;
    }

    // The state decides whether the booking can be canceled
    public function cancel(string $id): string
    {
        $booking = $this->bookings->find($id);
        if ($booking === null) {
            throw new \DomainException("booking $id not found");
        }
        $before = $booking->state();
        $booking->cancel();
        return "$before -> {$booking->state()}";
    }
}
