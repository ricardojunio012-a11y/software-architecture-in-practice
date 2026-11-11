// Morada architecture test: the domain does not know the infrastructure.
module.exports = {
  forbidden: [
    {
      name: "domain-without-infrastructure",
      comment: "The domain imports neither adapters nor database libraries",
      severity: "error",
      from: { path: "/domain/" },
      to: { path: "(/adapters/|node_modules/pg/)" },
    },
  ],
  options: { tsPreCompilationDeps: true },
};
