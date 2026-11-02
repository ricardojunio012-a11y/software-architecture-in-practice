// Global configuration: any module reads and changes it (common coupling).
export const config = {
  reservePercent: 10,
  lateFeePercent: 2,
  today: new Date(),
  data: null as any, // the whole community, filled in by main
};
