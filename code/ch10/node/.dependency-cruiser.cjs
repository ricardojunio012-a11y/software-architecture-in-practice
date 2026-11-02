// Architecture test: the boundary rules between the modules of the monolith.
module.exports = {
  forbidden: [
    {
      name: "bookings-only-uses-the-billing-api",
      comment: "Bookings must not read the internal data (the table) of Billing",
      severity: "error",
      from: { path: "^src/(before|after)/modules/bookings/" },
      to: { path: "^src/$1/modules/billing/internal/" },
    },
    {
      name: "billing-does-not-depend-on-bookings",
      comment: "Billing does not know Bookings: the dependency goes one way only",
      severity: "error",
      from: { path: "^src/(before|after)/modules/billing/" },
      to: { path: "^src/$1/modules/bookings/" },
    },
  ],
  options: { tsPreCompilationDeps: true },
};
