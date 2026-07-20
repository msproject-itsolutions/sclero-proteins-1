#!/usr/bin/env bash
set -Eeuo pipefail

readonly DEFAULT_DOMAINS="scleroproteins.co.uk,www.scleroproteins.co.uk,scleroproteins.in,www.scleroproteins.in,scleroproteins.com,www.scleroproteins.com"

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
original_args=("$@")
primary_domain="scleroproteins.co.uk"
domains_csv="$DEFAULT_DOMAINS"
certbot_email=""
app_only=false
skip_backup_cron=false
skip_release_backup=false
site_name="scleroproteins"
nginx_changed=false
nginx_backup=""
release_replaced=false
previous_image_tag=""

usage() {
  cat <<'EOF'
Usage:
  ./deploy/vps-install.sh --email ops@example.com [options]

Options:
  --email EMAIL             Certbot renewal email (required for first TLS setup)
  --primary-domain DOMAIN   Certificate name and primary smoke-test host
  --domains CSV             Comma-separated SAN hostnames
  --app-only                Start and validate containers; do not change host nginx/TLS
  --skip-backup-cron        Do not install the daily backup cron entry
  --skip-release-backup     Skip the automatic backup (new empty installs only)
  --help                    Show this help

Prerequisites:
  - Run from a clean checkout on the VPS.
  - Point every requested DNS name to this VPS before the TLS step.
  - Fill the root .env file. The script creates a secured starter file and exits
    if .env does not exist.
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  printf '\n==> %s\n' "$*"
}

run_root() {
  if [[ "$EUID" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_host_dependencies() {
  if command -v docker >/dev/null &&
    docker compose version >/dev/null 2>&1 &&
    command -v curl >/dev/null && command -v git >/dev/null &&
    command -v nginx >/dev/null && command -v certbot >/dev/null &&
    command -v openssl >/dev/null; then
    return
  fi

  [[ -r /etc/os-release ]] ||
    die "Automatic dependency installation requires Ubuntu or Debian"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" ]] ||
    die "Automatic dependency installation supports Ubuntu/Debian only"
  if [[ "$EUID" -ne 0 ]]; then
    command -v sudo >/dev/null || die "Run this installer as root to install VPS dependencies"
    exec sudo "$repo_dir/deploy/vps-install.sh" "${original_args[@]}"
  fi

  log "Installing missing VPS dependencies"
  run_root apt-get update
  run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y \
    ca-certificates certbot curl git nginx openssl
  if ! command -v docker >/dev/null; then
    run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io
  fi
  if ! docker compose version >/dev/null 2>&1; then
    if ! run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-v2; then
      run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin
    fi
  fi
  run_root systemctl enable --now docker nginx
  docker compose version >/dev/null 2>&1 ||
    die "Docker Compose v2 could not be installed"
}

env_value() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$repo_dir/.env" | tail -1 | cut -d= -f2- || true)"
  printf '%s' "$value" | sed -e "s/^[\"']//; s/[\"']$//"
}

validate_domain() {
  [[ "$1" =~ ^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$ ]] ||
    die "Invalid domain: $1"
}

restore_nginx() {
  local exit_code=$?
  if [[ "$exit_code" -ne 0 && "$release_replaced" == true && -n "$previous_image_tag" ]]; then
    echo "Deployment failed; attempting to restore the previous application images." >&2
    sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=${previous_image_tag}/" "$repo_dir/.env"
    if ! docker compose up -d --wait --force-recreate --remove-orphans; then
      echo "Automatic application rollback failed; use the verified backup and inspect container logs." >&2
    fi
  fi
  if [[ "$exit_code" -ne 0 && "$nginx_changed" == true ]]; then
    echo "Deployment failed; restoring the previous Sclero nginx site." >&2
    if [[ -n "$nginx_backup" && -f "$nginx_backup" ]]; then
      run_root cp "$nginx_backup" "/etc/nginx/sites-available/${site_name}.conf"
    else
      run_root rm -f "/etc/nginx/sites-enabled/${site_name}.conf"
      run_root rm -f "/etc/nginx/sites-available/${site_name}.conf"
    fi
    if run_root nginx -t; then
      run_root systemctl reload nginx
    fi
  fi
  exit "$exit_code"
}
trap restore_nginx EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)
      [[ $# -ge 2 ]] || die "--email requires a value"
      certbot_email="$2"
      shift 2
      ;;
    --primary-domain)
      [[ $# -ge 2 ]] || die "--primary-domain requires a value"
      primary_domain="$2"
      shift 2
      ;;
    --domains)
      [[ $# -ge 2 ]] || die "--domains requires a value"
      domains_csv="$2"
      shift 2
      ;;
    --app-only)
      app_only=true
      shift
      ;;
    --skip-backup-cron)
      skip_backup_cron=true
      shift
      ;;
    --skip-release-backup)
      skip_release_backup=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
done

cd "$repo_dir"

install_host_dependencies

if [[ ! -f .env ]]; then
  command -v openssl >/dev/null ||
    die "openssl is required to generate the initial secrets"
  umask 077
  cp .env.production.example .env
  secret_key="$(openssl rand -hex 64)"
  database_password="$(openssl rand -hex 32)"
  sed -i \
    -e "s/^SECRET_KEY=.*/SECRET_KEY=${secret_key}/" \
    -e "s/^DB_PASSWORD=.*/DB_PASSWORD=${database_password}/" \
    -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${database_password}/" \
    .env
  chmod 600 .env
  echo "Created .env with random application and database secrets."
  echo "Edit every remaining CHANGE_ME value, configure SMTP, then rerun:"
  echo "  nano $repo_dir/.env"
  exit 2
fi

chmod 600 .env

# Generate a dedicated P-256 VAPID key once. The private key is mounted into
# the backend and scheduler read-only; only the public browser key enters .env.
vapid_private_key="$repo_dir/secrets/vapid_private.pem"
if [[ ! -s "$vapid_private_key" ]]; then
  command -v openssl >/dev/null || die "openssl is required to generate Web Push keys"
  command -v tail >/dev/null || die "tail is required to derive the Web Push public key"
  mkdir -p "$repo_dir/secrets"
  umask 077
  openssl ecparam -name prime256v1 -genkey -noout -out "$vapid_private_key"
  chmod 600 "$vapid_private_key"
fi
vapid_public_key="$(
  openssl ec -in "$vapid_private_key" -pubout -conv_form uncompressed -outform DER 2>/dev/null |
    tail -c 65 |
    openssl base64 -A |
    tr '+/' '-_' |
    tr -d '='
)"
[[ -n "$vapid_public_key" ]] || die "Unable to derive the Web Push public key"
if grep -q '^VAPID_PUBLIC_KEY=' .env; then
  sed -i "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${vapid_public_key}|" .env
else
  printf '\nVAPID_PUBLIC_KEY=%s\n' "$vapid_public_key" >> .env
fi

if grep -Eq '(^|=)CHANGE_ME' .env; then
  die ".env still contains CHANGE_ME placeholders"
fi

for command in docker curl git nginx openssl sed ss; do
  command -v "$command" >/dev/null || die "Required command not found: $command"
done
docker compose version >/dev/null 2>&1 ||
  die "Docker Compose v2 is required (docker compose)"

if [[ "$EUID" -ne 0 ]]; then
  command -v sudo >/dev/null || die "sudo is required when not running as root"
  sudo -v
fi

IFS=',' read -r -a domains <<< "$domains_csv"
[[ "${#domains[@]}" -gt 0 ]] || die "At least one domain is required"
primary_present=false
for domain in "${domains[@]}"; do
  validate_domain "$domain"
  [[ "$domain" == "$primary_domain" ]] && primary_present=true
done
validate_domain "$primary_domain"
[[ "$primary_present" == true ]] ||
  die "Primary domain must also appear in --domains"

allowed_hosts="$(env_value ALLOWED_HOSTS)"
allowed_hosts=",${allowed_hosts//[[:space:]]/},"
csrf_origins="$(env_value CSRF_TRUSTED_ORIGINS)"
csrf_origins=",${csrf_origins//[[:space:]]/},"
for domain in "${domains[@]}"; do
  [[ "$allowed_hosts" == *",${domain},"* ]] ||
    die "Add ${domain} to ALLOWED_HOSTS in .env"
  [[ "$csrf_origins" == *",https://${domain},"* ]] ||
    die "Add https://${domain} to CSRF_TRUSTED_ORIGINS in .env"
done

site_url="$(env_value SITE_URL)"
public_site_url="$(env_value NEXT_PUBLIC_SITE_URL)"
[[ "$site_url" == "https://${primary_domain}" ]] ||
  die "SITE_URL must be https://${primary_domain}"
[[ "$public_site_url" == "https://${primary_domain}" ]] ||
  die "NEXT_PUBLIC_SITE_URL must be https://${primary_domain}"

port="$(env_value SCLERO_HTTP_PORT)"
port="${port:-18088}"
[[ "$port" =~ ^[0-9]+$ ]] && ((port >= 1024 && port <= 65535)) ||
  die "SCLERO_HTTP_PORT must be an unprivileged TCP port"

certificate_path="/etc/letsencrypt/live/${primary_domain}/fullchain.pem"
certificate_ready=false
if [[ -f "$certificate_path" ]]; then
  certificate_ready=true
  for domain in "${domains[@]}"; do
    if ! openssl x509 -in "$certificate_path" -noout -checkhost "$domain" >/dev/null 2>&1; then
      certificate_ready=false
      break
    fi
  done
fi

if [[ "$app_only" == false && "$certificate_ready" == false ]]; then
  command -v certbot >/dev/null ||
    die "certbot is required for first TLS setup"
  [[ "$certbot_email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] ||
    die "Provide a valid --email for Certbot"
fi

log "Checking repository and shared-host safety"
[[ -z "$(git -c safe.directory="$repo_dir" status --porcelain)" ]] ||
  die "Git checkout is dirty; commit or stash changes before deployment"
./deploy/preflight.sh

if [[ "$app_only" == false ]]; then
  site_path="/etc/nginx/sites-available/${site_name}.conf"
  site_real="$(readlink -f "$site_path" 2>/dev/null || printf '%s' "$site_path")"
  for domain in "${domains[@]}"; do
    while IFS= read -r match; do
      match_real="$(readlink -f "$match" 2>/dev/null || printf '%s' "$match")"
      [[ "$match_real" == "$site_real" ]] ||
        die "Domain ${domain} already appears in another enabled nginx site: ${match}"
    done < <(grep -RIl -- "$domain" /etc/nginx/sites-enabled 2>/dev/null || true)
  done
fi

previous_image_tag="$(env_value APP_IMAGE_TAG)"
tag="$(git -c safe.directory="$repo_dir" rev-parse --short=12 HEAD)"
if grep -q '^APP_IMAGE_TAG=' .env; then
  sed -i "s/^APP_IMAGE_TAG=.*/APP_IMAGE_TAG=${tag}/" .env
else
  printf '\nAPP_IMAGE_TAG=%s\n' "$tag" >> .env
fi

existing_db="$(docker compose ps -q db 2>/dev/null || true)"
existing_backend="$(docker compose ps -q backend 2>/dev/null || true)"
project_name="$(env_value COMPOSE_PROJECT_NAME)"
project_name="${project_name:-sclero-proteins}"
existing_volumes="$(
  docker volume ls \
    --filter "label=com.docker.compose.project=${project_name}" \
    --format '{{.Name}}'
)"
if [[ "$skip_release_backup" == true && (
  -n "$existing_db" || -n "$existing_backend" || -n "$existing_volumes"
) ]]; then
  die "--skip-release-backup is refused because existing deployment data was detected"
elif [[ "$skip_release_backup" == false && -n "$existing_db" && -n "$existing_backend" ]]; then
  log "Creating a verified database and media backup before replacement"
  BACKUP_DIR="${BACKUP_DIR:-/var/backups/sclero-proteins}" ./deploy/backup.sh
elif [[ "$skip_release_backup" == false ]]; then
  if [[ -n "$existing_volumes" ]]; then
    die "Persistent deployment volumes exist but the current stack is not running; start it and rerun so it can be backed up"
  fi
  log "No existing deployment data found; continuing with a fresh empty volume set"
fi

log "Building and replacing the isolated application stack"
docker compose build --pull
release_replaced=true
docker compose up -d --wait --force-recreate --remove-orphans
docker compose ps
curl -fsS -H "Host: ${primary_domain}" \
  "http://127.0.0.1:${port}/api/health/ready/" >/dev/null
curl -fsS -H "Host: ${primary_domain}" \
  "http://127.0.0.1:${port}/" >/dev/null
curl -fsS -H "Host: ${primary_domain}" \
  "http://127.0.0.1:${port}/api/products/" >/dev/null
curl -fsS -H "Host: ${primary_domain}" \
  "http://127.0.0.1:${port}/api/admin/hero-banners/active/" >/dev/null

log "Running production application checks"
docker compose exec -T backend python manage.py check --deploy
docker compose exec -T backend python manage.py makemigrations --check --dry-run
docker compose exec -T backend python manage.py migrate_datauri_media --base-url "$site_url"
docker compose exec -T backend python manage.py verify_storefront_content

if [[ "$app_only" == false ]]; then
  log "Configuring the dedicated host nginx site"
  run_root install -d /var/www/letsencrypt /etc/nginx/sites-available /etc/nginx/sites-enabled

  if [[ -f "$site_path" ]]; then
    nginx_backup="/etc/nginx/sites-available/${site_name}.conf.before-$(date -u +%Y%m%dT%H%M%SZ)"
    run_root cp "$site_path" "$nginx_backup"
  fi

  tmp_dir="$(mktemp -d)"
  server_names="${domains_csv//,/ }"
  sed \
    -e "s|^[[:space:]]*server_name scleroproteins.co.uk www.scleroproteins.co.uk$|    server_name ${server_names};|g" \
    -e '/^[[:space:]]*scleroproteins\.in www\.scleroproteins\.in$/d' \
    -e '/^[[:space:]]*scleroproteins\.com www\.scleroproteins\.com;$/d' \
    deploy/nginx/scleroproteins-bootstrap.conf > "${tmp_dir}/bootstrap.conf"
  sed \
    -e "s|127.0.0.1:18088|127.0.0.1:${port}|g" \
    -e "s|^[[:space:]]*server_name scleroproteins.co.uk www.scleroproteins.co.uk$|    server_name ${server_names};|g" \
    -e '/^[[:space:]]*scleroproteins\.in www\.scleroproteins\.in$/d' \
    -e '/^[[:space:]]*scleroproteins\.com www\.scleroproteins\.com;$/d' \
    -e "s|/etc/letsencrypt/live/scleroproteins.co.uk/|/etc/letsencrypt/live/${primary_domain}/|g" \
    deploy/nginx/scleroproteins-host.conf > "${tmp_dir}/host.conf"

  if [[ "$certificate_ready" == false ]]; then
    run_root cp "${tmp_dir}/bootstrap.conf" "$site_path"
    run_root ln -sfn "$site_path" "/etc/nginx/sites-enabled/${site_name}.conf"
    nginx_changed=true
    run_root nginx -t
    run_root systemctl reload nginx

    certbot_args=()
    for domain in "${domains[@]}"; do
      certbot_args+=("-d" "$domain")
    done
    if [[ -f "$certificate_path" ]]; then
      certbot_args+=("--expand")
    fi
    run_root certbot certonly --webroot -w /var/www/letsencrypt \
      --non-interactive --agree-tos --email "$certbot_email" \
      --cert-name "$primary_domain" "${certbot_args[@]}"
    for domain in "${domains[@]}"; do
      openssl x509 -in "$certificate_path" -noout -checkhost "$domain" >/dev/null ||
        die "Issued certificate does not cover ${domain}"
    done
  fi

  run_root cp "${tmp_dir}/host.conf" "$site_path"
  run_root ln -sfn "$site_path" "/etc/nginx/sites-enabled/${site_name}.conf"
  nginx_changed=true
  run_root nginx -t
  run_root systemctl reload nginx
  rm -rf "$tmp_dir"

  log "Checking HTTPS"
  for domain in "${domains[@]}"; do
    curl --retry 5 --retry-delay 3 -fsS \
      "https://${domain}/api/health/ready/" >/dev/null
  done
fi

if [[ "$skip_backup_cron" == false ]]; then
  [[ "$repo_dir" != *[[:space:]]* ]] ||
    die "Automatic cron setup requires a repository path without spaces"
  log "Installing the isolated daily backup job"
  cron_tmp="$(mktemp)"
  cat > "$cron_tmp" <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 2 * * * root cd ${repo_dir} && BACKUP_DIR=/var/backups/sclero-proteins ./deploy/backup.sh >> /var/log/sclero-proteins-backup.log 2>&1
EOF
  run_root install -m 0644 "$cron_tmp" /etc/cron.d/sclero-proteins-backup
  rm -f "$cron_tmp"
  run_root install -d -m 0700 /var/backups/sclero-proteins
fi

nginx_changed=false
release_replaced=false
trap - EXIT

log "Deployment completed successfully"
echo "Commit: $tag"
echo "Local health: http://127.0.0.1:${port}/api/health/ready/"
if [[ "$app_only" == false ]]; then
  echo "Public site: https://${primary_domain}/"
fi
echo "Next: create staff accounts, enable TOTP, verify SMTP, and test COD checkout."
