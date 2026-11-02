<?php
// State: what you can do with a booking depends on the state it is in.
// Each state is an object that knows which transitions it accepts; the booking
// only passes the call on.
namespace Morada;

require_once __DIR__ . '/types.php';

abstract class State
{
    abstract public function name(): string;

    // By default, no transition is allowed; each state allows its own
    public function approve(Booking $booking): void
    {
        $this->rejectTransition('approve');
    }

    public function reject(Booking $booking): void
    {
        $this->rejectTransition('reject');
    }

    public function cancel(Booking $booking): void
    {
        $this->rejectTransition('cancel');
    }

    private function rejectTransition(string $action): never
    {
        throw new \DomainException("cannot $action a {$this->name()} booking");
    }
}

final class Pending extends State
{
    public function name(): string
    {
        return 'pending';
    }

    public function approve(Booking $booking): void
    {
        $booking->changeTo(new Approved());
    }

    public function reject(Booking $booking): void
    {
        $booking->changeTo(new Rejected());
    }

    public function cancel(Booking $booking): void
    {
        $booking->changeTo(new Canceled());
    }
}

final class Approved extends State
{
    public function name(): string
    {
        return 'approved';
    }

    public function cancel(Booking $booking): void
    {
        $booking->changeTo(new Canceled());
    }
}

final class Rejected extends State
{
    public function name(): string
    {
        return 'rejected';
    }
}

final class Canceled extends State
{
    public function name(): string
    {
        return 'canceled';
    }
}

final class Booking
{
    private State $state;

    public function __construct(public readonly BookingRequest $request)
    {
        $this->state = new Pending();
    }

    public function state(): string
    {
        return $this->state->name();
    }

    public function approve(): void
    {
        $this->state->approve($this);
    }

    public function reject(): void
    {
        $this->state->reject($this);
    }

    public function cancel(): void
    {
        $this->state->cancel($this);
    }

    // Used only by the states
    public function changeTo(State $state): void
    {
        $this->state = $state;
    }
}
