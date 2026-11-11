#!/bin/sh
# The lab's "vault": generates random secrets in a volume, on the first start.
# In production, this job belongs to a secrets manager (Vault, AWS Secrets Manager,
# Azure Key Vault, GCP Secret Manager), not to a file in the repository.
set -e
umask 077
for name in integration rotation user_password; do
  if [ ! -s "/secrets/$name" ]; then
    head -c 24 /dev/urandom | base64 | tr -d '/+=\n' > "/secrets/$name"
    echo "secret '$name' generated"
  fi
done
# Keycloak and the application run as different users; both need to read
chmod 0644 /secrets/*
