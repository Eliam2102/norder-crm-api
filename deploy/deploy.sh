#!/usr/bin/env bash
set -Eeuo pipefail

readonly DEPLOY_ROOT="/opt/norder"
readonly API_DIR="${DEPLOY_ROOT}/API/norder-crm-api"
readonly FRONTEND_DIR="${DEPLOY_ROOT}/Frontend/norer-health-hub"
readonly COMPOSE_FILE="${API_DIR}/deploy/compose.production.yml"
readonly ENV_FILE="${API_DIR}/deploy/.env"
readonly LOCK_FILE="${DEPLOY_ROOT}/deploy.lock"
readonly DEPLOY_BRANCH="production"

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Ya existe otro despliegue de NORDER en curso."
  exit 1
fi

for repo in "${API_DIR}" "${FRONTEND_DIR}"; do
  git -C "${repo}" switch "${DEPLOY_BRANCH}"
  git -C "${repo}" pull --ff-only origin "${DEPLOY_BRANCH}"
done

docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" build --pull
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --remove-orphans
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps
