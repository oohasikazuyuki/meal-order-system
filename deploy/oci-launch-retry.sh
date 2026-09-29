#!/usr/bin/env bash
# Ampere A1 の空きを待って起動する。
#
# 無料枠の A1 は「Out of host capacity」で弾かれることが多い。
# 空きは断続的に出るので、間隔を空けて試し続けるしかない。
# 短い間隔で叩くと "Too many requests for the user" で止められるため、
# 既定は5分間隔にしてある。
set -u
export OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING=True

INTERVAL="${INTERVAL:-300}"
OCPUS="${OCPUS:-2}"
MEM="${MEM:-12}"
NAME="${NAME:-meal-order-dev}"
AD="${AD:-Osib:AP-TOKYO-1-AD-1}"
KEY="${KEY:-$HOME/.ssh/id_ed25519.pub}"

T=$(grep -E "^tenancy" ~/.oci/config | cut -d= -f2 | tr -d ' ')
SUBNET=$(oci network subnet list --compartment-id "$T" --all --query 'data[0].id' --raw-output 2>/dev/null)
IMAGE=$(oci compute image list --compartment-id "$T" --operating-system "Canonical Ubuntu" \
  --operating-system-version "24.04" --shape VM.Standard.A1.Flex \
  --sort-by TIMECREATED --sort-order DESC --limit 1 --query 'data[0].id' --raw-output 2>/dev/null)

echo "$(date '+%H:%M:%S') 開始: ${OCPUS}OCPU/${MEM}GB を ${INTERVAL}秒ごとに試します"

while true; do
  out=$(oci compute instance launch \
    --compartment-id "$T" --availability-domain "$AD" \
    --display-name "$NAME" --shape "VM.Standard.A1.Flex" \
    --shape-config "{\"ocpus\":$OCPUS,\"memoryInGBs\":$MEM}" \
    --image-id "$IMAGE" --subnet-id "$SUBNET" \
    --assign-public-ip true --boot-volume-size-in-gbs 50 \
    --ssh-authorized-keys-file "$KEY" \
    --query 'data.id' --raw-output 2>&1)

  if echo "$out" | grep -q "ocid1.instance"; then
    echo "$(date '+%H:%M:%S') ★起動しました: $out"
    echo "$out" > /tmp/oci_new_inst.txt
    exit 0
  fi

  reason=$(echo "$out" | grep -o '"message": "[^"]*"' | head -1 | cut -d'"' -f4)
  echo "$(date '+%H:%M:%S') 空きなし（${reason:-不明}）"
  sleep "$INTERVAL"
done
