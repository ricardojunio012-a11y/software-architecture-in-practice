// Authentication: the API checks the access token issued by Keycloak.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { User } from "./authorization.ts";

export type Verifier = (token: string) => Promise<User>;

export class InvalidToken extends Error {}

export function tokenVerifier(issuer: string, keys?: JWTVerifyGetKey) {
  // The public keys come from the issuer itself (JWKS) and are cached
  const jwks =
    keys ?? createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
  const verify: Verifier = async (token) => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer, // issued by our Keycloak, and not by another one
        audience: "morada-api", // issued for this API, and not for another one
        algorithms: ["RS256"], // never "none", never the algorithm the token asks for
      });
      const roles = (payload.realm_access as { roles?: string[] })?.roles ?? [];
      // Service account (client credentials): the caller is the client, not a person
      const service = String(payload.preferred_username ?? "").startsWith(
        "service-account-",
      );
      const id = service ? `client:${payload.azp}` : String(payload.sub);
      return { id, roles };
    } catch (e) {
      throw new InvalidToken((e as { code?: string }).code ?? "ERR_UNKNOWN");
    }
  };
  return verify;
}
