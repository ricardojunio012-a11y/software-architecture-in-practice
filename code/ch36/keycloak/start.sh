#!/bin/bash
# Reads the secrets the vault generated and starts Keycloak importing the "morada" realm.
# The realm file uses placeholders (${INTEGRATION_SECRET}...) that Keycloak replaces
# with the environment variables on import: no secret lives in the repository.
set -e
export INTEGRATION_SECRET="$(cat /run/secrets/integration)"
export ROTATION_SECRET="$(cat /run/secrets/rotation)"
export USER_PASSWORD="$(cat /run/secrets/user_password)"
exec /opt/keycloak/bin/kc.sh start-dev --import-realm
