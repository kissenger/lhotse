#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"
source "${SCRIPT_DIR}/maintenance-common.sh"

maintenance_load_env_file "${ENV_FILE}"

cd "${REPO_ROOT}"

declare -a curl_urls=(\
# "https://beta.snorkelology.co.uk" \
"https://snorkelology.co.uk" \
)

isErr=0
emailbody="";
for url in "${curl_urls[@]}"; do
   response=$(curl -sL --head --request GET "$url")
   isOK=$(echo "${response}" | grep "200" | wc -l)
   if [ "$isOK" -eq "0" ]; then
      emailbody+="$url"$'\n'"${response}"$'\n'
      isErr=1
   fi
done

if [ "$isErr" -eq "1" ]; then
   echo -e "Subject: Site error\n\n${emailbody}" | msmtp -a default gordon.taylor@hotmail.co.uk
   echo "${emailbody}"
fi