// The port: the domain only needs to know whether a day is a business day
export interface Calendar {
  isBusinessDay(day: string): boolean;
}
