// Anemic model: only data, all public and writable. No rule lives here.
export class Booking {
  id = "";
  unit = "";
  space = "";
  date = "";
  start = 0;
  end = 0;
  status = "confirmed";
  feeCents = 0;
}

export class Space {
  id = "";
  feeCents = 0;
  minNoticeDays = 0;
  monthlyLimit = 0;
}

// The data of every booking, which any part of the system can read and change
export const bookings: Booking[] = [];
