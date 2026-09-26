#!/usr/bin/env bash
set -euo pipefail

if [ ! -f package.json ] || [ ! -d src ]; then
  echo "ERRO: execute este script na raiz do projeto BRASIVO."
  exit 1
fi

node scripts/install-mandate-activity-v3.mjs

echo ""
echo "✓ BRASIVO Atividade v3 instalado."
echo "✓ Presença passa a usar as sessões do órgão Plenário (PLEN / id 180)."
echo "✓ Os 4 anos do mandato aparecem como seletor no painel."
echo "✓ Eventos genéricos continuam fora do feed público."
echo ""
echo "Agora rode: rm -rf .next && npm run dev"
