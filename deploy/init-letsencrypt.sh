#!/usr/bin/env bash
# Bootstrap the first Let's Encrypt certificate for all Sclero domains.
#
# Run ONCE, after `docker compose build` and after DNS A/AAAA records for every
# domain point at this VPS. It issues a single SAN certificate under the
# `scleroproteins.co.uk` lineage (the path nginx expects).
#
# Re-runnable: pass --force to replace an existing certificate.
set -euo pipefail

cd "$(dirname "$0")/.."

# Domains covered by the single SAN cert. First entry = lineage/dir name.
DOMAINS=(
  scleroproteins.co.uk www.scleroproteins.co.uk
  scleroproteins.in    www.scleroproteins.in
  scleroproteins.com   www.scleroproteins.com
)
LINEAGE="${DOMAINS[0]}"
EMAIL="${LETSENCRYPT_EMAIL:-admin@scleroproteins.co.uk}"
STAGING="${STAGING:-0}"   # set STAGING=1 to test against the LE staging CA first

compose() { docker compose "$@"; }

cert_path="/etc/letsencrypt/live/${LINEAGE}"

echo "### Creating a temporary self-signed cert so nginx can start ..."
compose run --rm --entrypoint "/bin/sh -c '\
  mkdir -p ${cert_path} && \
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout ${cert_path}/privkey.pem \
    -out    ${cert_path}/fullchain.pem \
    -subj \"/CN=${LINEAGE}\"'" certbot

echo "### Starting nginx ..."
compose up -d nginx

echo "### Removing the temporary cert ..."
compose run --rm --entrypoint "/bin/sh -c 'rm -rf /etc/letsencrypt/live/${LINEAGE} /etc/letsencrypt/archive/${LINEAGE} /etc/letsencrypt/renewal/${LINEAGE}.conf'" certbot

# Build -d flags.
domain_args=()
for d in "${DOMAINS[@]}"; do domain_args+=(-d "$d"); done

staging_arg=()
if [ "$STAGING" != "0" ]; then staging_arg=(--staging); fi

echo "### Requesting the real Let's Encrypt certificate ..."
compose run --rm --entrypoint "certbot" certbot \
  certonly --webroot -w /var/www/certbot \
  "${staging_arg[@]}" \
  "${domain_args[@]}" \
  --email "${EMAIL}" \
  --rsa-key-size 2048 \
  --agree-tos \
  --non-interactive \
  --keep-until-expiring

echo "### Reloading nginx ..."
compose exec nginx nginx -s reload

echo "### Done. Certificate issued for: ${DOMAINS[*]}"
