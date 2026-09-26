# BRASIVO — Atividade de mandato v3

Atualização completa do painel **Atividade** do perfil de mandato.

## O que esta versão corrige

### Presença

A versão anterior buscava uma quantidade excessiva de eventos gerais e podia devolver `attendance: null` por limite operacional.

A v3 muda a estratégia:

1. consulta as sessões do órgão oficial **Plenário (PLEN, id 180)** no período;
2. consulta os eventos em que a Câmara registra participação do parlamentar;
3. cruza os IDs dos eventos;
4. calcula presenças, sessões consideradas e percentual;
5. exclui eventos futuros, cancelados ou adiados.

O resultado é descritivo. Não é score, nota ou avaliação de desempenho. O próprio painel informa que licenças, afastamentos ou exercício parcial podem exigir contexto adicional.

### Quatro anos do mandato

O painel tenta descobrir a legislatura do deputado por:

- `/deputados/{id}`;
- `ultimoStatus.idLegislatura`;
- `/legislaturas/{id}`.

A partir do ano inicial da legislatura, monta quatro botões de consulta. Exemplo visual:

`2023  2024  2025  2026`

Se a informação da legislatura estiver temporariamente indisponível, usa como fallback os quatro anos mais recentes até o ano atual.

### Feed

O feed público continua focado em registros diretamente atribuíveis:

- votações nominais;
- discursos/pronunciamentos.

Sessões deliberativas genéricas não são mostradas como itens principais da timeline.

## Instalação

Descompacte este ZIP na raiz do projeto BRASIVO e execute:

```bash
chmod +x INSTALL.sh && ./INSTALL.sh && rm -rf .next && npm run dev
```

Depois abra:

```text
http://localhost:3000/mandate/74646
```

## Teste da API

```bash
curl -s "http://localhost:3000/api/mandates/74646/activities?year=2026" | python3 -m json.tool | head -120
```

Procure por:

```json
"mandate": {
  "years": [2023, 2024, 2025, 2026]
},
"attendance": {
  "present": 0,
  "totalConsidered": 0,
  "rate": 0
}
```

Os números acima são apenas o formato esperado; os valores reais vêm da Câmara.

## Arquivos principais

- `src/components/mandate/MandateActivityPanel.tsx`
- `src/components/mandate/MandateActivityPanel.module.css`
- `src/lib/camara/activity.ts`
- `src/app/api/mandates/[id]/activities/route.ts`
- `src/types/mandate-activity.ts`
- `scripts/install-mandate-activity-v3.mjs`

## Fonte e metodologia

A implementação usa a API Dados Abertos da Câmara dos Deputados. O endpoint `/deputados/{id}/eventos` lista eventos com participação do parlamentar; a API também disponibiliza eventos por órgão, incluindo o Plenário, e registros individuais de votações nominais.
