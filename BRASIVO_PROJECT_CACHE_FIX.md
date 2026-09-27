# BRASIVO — cache persistente de projetos

## Alteração principal

`src/lib/camara/projects.ts` agora usa a tabela existente `public.mandate_projects` como cache persistente dos detalhes de proposições.

Fluxo:

1. Consulta a listagem anual oficial da Câmara e filtra PL/PLP/PEC/PDL/PRC.
2. Faz uma única leitura em lote de `mandate_projects` para os IDs encontrados.
3. Usa registros com `collected_at` inferior a 6 horas como cache válido.
4. Consulta `/proposicoes/{id}` apenas para itens ausentes ou expirados.
5. Faz um único UPSERT em lote dos detalhes atualizados.
6. Se a Câmara falhar e houver cache expirado, usa o cache expirado como fallback.
7. Se o Supabase estiver indisponível ou sem chave administrativa, mantém o comportamento antigo e consulta a Câmara.

Não foi criada migration nova. A migration `202609260002_mandate_projects_cache.sql` já contém os campos e a constraint necessários.

## Variáveis esperadas no servidor

- `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`

A chave administrativa é usada somente no servidor para permitir o UPSERT com RLS habilitado.

## Validação sugerida

```bash
rm -rf .next && \
npx next typegen && \
npx tsc --noEmit && \
npx eslint src/lib/camara/projects.ts && \
git diff --check
```

Depois reinicie `npm run dev` e faça duas chamadas consecutivas ao endpoint. Como a tabela estava vazia, a primeira chamada deve preencher o cache; a segunda deve evitar o detalhamento individual dos projetos ainda dentro do TTL.

```bash
curl -sS -o /tmp/brasivo-projects-cold.json \
  -w 'HTTP: %{http_code}\nTTFB: %{time_starttransfer}s\nTOTAL: %{time_total}s\n' \
  http://localhost:3000/api/mandates/220594/projects

curl -sS -o /tmp/brasivo-projects-warm.json \
  -w 'HTTP: %{http_code}\nTTFB: %{time_starttransfer}s\nTOTAL: %{time_total}s\n' \
  http://localhost:3000/api/mandates/220594/projects
```

Para confirmar preenchimento:

```sql
select count(*) from public.mandate_projects;
```
