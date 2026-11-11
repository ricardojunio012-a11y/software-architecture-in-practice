// The integration's configuration as it was in Morada's first draft.
// DO NOT DO THIS: everything here goes to Git, to every copy of the
// repository, and to every image built from it.
export const config = {
  issuer: "http://keycloak:8080/realms/morada",
  clientId: "integration-mc1",
  clientSecret: "mc1-integration-2026-secret",
  database: "postgresql://morada:Morada2026@db:5432/morada",
  awsAccessKeyId: "AKIAIOSFODNN7EXAMPLE", // the example key from the AWS documentation
};
