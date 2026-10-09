[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

# BRASIVO

**Brasil em transparência.**

Plataforma independente para consultar e acompanhar informações públicas sobre
deputados federais brasileiros de forma mais simples, visual e organizada.

O BRASIVO reúne dados de diferentes fontes oficiais em uma única interface para
facilitar a consulta da atuação parlamentar, despesas, projetos, patrimônio
declarado e outras informações relacionadas ao mandato.

---

## Visão geral

Informações públicas sobre deputados federais existem em diferentes portais,
APIs e arquivos governamentais.

O BRASIVO organiza essas informações em uma experiência única:

```text
Brasil
  ↓
Estado
  ↓
Deputados federais
  ↓
Perfil do parlamentar
  ↓
Atividade · Despesas · Projetos · Patrimônio
```

A plataforma não classifica parlamentares como bons ou ruins e não recomenda
candidatos.

O objetivo é apresentar os dados disponíveis para que cada pessoa possa fazer
sua própria análise.

---

# Funcionalidades

## Exploração de deputados

- Consulta de deputados federais
- Navegação por estado
- Mapa interativo do Brasil
- Lista de representantes por unidade federativa
- Busca por parlamentares
- Perfil individual de cada deputado
- Foto oficial
- Nome parlamentar
- Nome civil
- Partido
- Estado
- Situação do mandato
- Informações gerais da legislatura

---

## Perfil do parlamentar

Cada deputado possui uma página própria com diferentes áreas de consulta.

```text
Atividade
Despesas
Projetos e resultados
Patrimônio
```

Os módulos carregam de forma independente para evitar bloquear toda a página
enquanto uma fonte externa está sendo consultada.

---

# Resumo do mandato

O BRASIVO possui um resumo automático para ajudar o usuário a entender
rapidamente o mandato antes de analisar os dados detalhados.

Ao abrir o perfil, o resumo começa a ser preparado automaticamente.

O usuário não precisa iniciar manualmente a análise.

O resumo pode considerar informações como:

- atividade parlamentar;
- projetos;
- despesas;
- dados oficiais disponíveis sobre o mandato.

O carregamento acontece progressivamente.

Exemplo:

```text
Preparando resumo do mandato

✓ Atividade
✓ Despesas
● Projetos e resultados
```

---

## Streaming do resumo

O resumo é processado em etapas e enviado progressivamente para a interface.

Isso permite que o BRASIVO informe ao usuário o que está acontecendo enquanto os
dados são consultados.

O restante da página continua disponível durante esse processo.

---

## Cache do resumo

Resumos recentes podem ser armazenados em cache.

Quando existe uma versão válida:

```text
abre o perfil
      ↓
cache disponível
      ↓
resumo exibido rapidamente
```

Isso evita gerar novamente o mesmo conteúdo a cada acesso.

---

## Fallback factual

A geração automática do resumo não é um ponto único de falha.

Quando o serviço responsável pela geração do texto não consegue responder, o
BRASIVO pode utilizar um resumo factual construído diretamente a partir dos
dados oficiais já confirmados.

A prioridade é semelhante a:

```text
Resumo atual
      ↓
Cache anterior
      ↓
Resumo factual
      ↓
Erro somente quando nenhum dado utilizável existe
```

Assim, uma falha temporária de um serviço externo não transforma necessariamente
o perfil em um estado de erro.

---

# Atividade parlamentar

A aba **Atividade** organiza diferentes informações relacionadas à atuação
legislativa.

Entre os dados trabalhados estão:

- presença;
- sessões;
- votações;
- votações nominais;
- pronunciamentos;
- discursos;
- registros de atividade parlamentar;
- dados disponíveis no período selecionado.

---

## Consulta por ano

O usuário pode selecionar o período que deseja analisar.

Exemplo:

```text
2023
2024
2025
2026
```

O seletor permanece disponível enquanto os dados daquele ano são carregados.

---

## Carregamento progressivo

O perfil principal aparece antes das consultas mais pesadas terminarem.

Exemplo:

```text
Perfil do parlamentar
✓ pronto

Atividade
carregando...

Despesas
carregando...

Projetos
carregando...
```

Isso reduz a sensação de espera e permite continuar utilizando a página.

---

# Despesas parlamentares

O BRASIVO consulta dados relacionados à **Cota para o Exercício da Atividade
Parlamentar — CEAP**.

A aba de despesas possui diferentes formas de visualização.

---

## Informações disponíveis

- Total de despesas
- Consulta por ano
- Gastos mensais
- Gastos por categoria
- Distribuição das despesas
- Histórico de gastos
- Registros individuais
- Registros recentes
- Valores utilizados no período
- Visualização gráfica

---

## Gastos por mês

Os valores podem ser organizados cronologicamente.

```text
JAN  ███████
FEV  ████
MAR  █████████
ABR  ██████
```

Isso facilita a identificação de períodos com maior ou menor volume de despesas.

---

## Gastos por categoria

Os registros também podem ser agrupados pelo tipo de despesa.

Dependendo do parlamentar, podem existir categorias como:

- divulgação da atividade parlamentar;
- passagens aéreas;
- combustíveis;
- telefonia;
- locação de veículos;
- manutenção de escritório;
- consultorias;
- hospedagem;
- outros serviços relacionados ao mandato.

As categorias são determinadas pelos registros oficiais existentes.

---

## Registros recentes

Além das informações agregadas, o BRASIVO permite consultar despesas
individuais.

Para evitar uma lista muito longa, os dados são carregados progressivamente.

```text
Mostrar mais
```

O usuário pode expandir a lista quando desejar consultar novos registros.

---

# Projetos e resultados

A aba **Projetos e resultados** reúne informações legislativas associadas ao
parlamentar.

O objetivo é facilitar a consulta de proposições e outros registros sem exigir
que o usuário navegue diretamente por diversas páginas externas.

A quantidade de informações exibidas depende da disponibilidade dos dados
oficiais.

---

# Patrimônio declarado

O BRASIVO consulta declarações de bens disponibilizadas pela Justiça Eleitoral.

Esses dados são utilizados para construir uma visão histórica do patrimônio
declarado pelo candidato ao longo das eleições.

---

## Histórico patrimonial

Quando existem registros suficientes, o sistema pode consultar diferentes
eleições.

Exemplo:

```text
2006
2010
2014
2018
2022
2026
```

Nem todos os políticos possuem registros em todos os anos.

---

## Gráfico patrimonial

As declarações confirmadas podem ser apresentadas em um gráfico histórico.

```text
R$

3M |                         █
   |                         █
2M |             █           █
   |             █           █
1M |     █       █           █
   |     █       █           █
   +--------------------------------

      2014      2018        2022
```

---

# Patrimônio antes e depois de assumir

O BRASIVO também pode comparar a declaração patrimonial anterior à posse com uma
declaração posterior ao início do mandato.

A declaração apresentada na eleição que levou ao primeiro mandato federal é
considerada uma fotografia patrimonial anterior à posse.

Exemplo:

```text
Eleição
2022

Declaração patrimonial
R$ 500.000

        ↓

Posse
2023

        ↓

Declaração posterior
2026

R$ 720.000
```

A interface pode então apresentar:

```text
Antes de assumir

R$ 500.000
Declaração de 2022


Depois de assumir

R$ 720.000
Declaração de 2026


Variação nominal

+ R$ 220.000


Variação percentual

+44%
```

---

## Comparação entre declarações

Além da comparação principal, o histórico pode mostrar a diferença entre
eleições consecutivas.

Exemplo:

```text
2014
R$ 350.000

2018
R$ 500.000
+ R$ 150.000 · +42,8%

2022
R$ 720.000
+ R$ 220.000 · +44%
```

---

## Validação da identidade

Dados patrimoniais exigem um cuidado especial para evitar associar os bens de
uma pessoa ao político errado.

O BRASIVO utiliza critérios conservadores.

A identificação considera principalmente:

```text
UF
+
nome civil exato
```

ou:

```text
UF
+
nome de urna exato
```

O sistema evita aproximações livres de nomes para atribuição patrimonial.

Quando não consegue confirmar a identidade, o dado não é utilizado.

---

## Ausência de patrimônio não significa zero

O BRASIVO diferencia:

```text
R$ 0,00 declarado oficialmente
```

de:

```text
nenhum valor patrimonial confirmado
```

Se nenhuma linha de bens for encontrada para aquele candidato, o sistema não
transforma automaticamente a ausência de informação em:

```text
R$ 0,00
```

Um valor zero somente deve ser apresentado quando existir um registro oficial
numérico correspondente.

Anos sem dados confirmados ficam fora dos gráficos e dos cálculos de variação.

---

## Interpretação dos dados patrimoniais

Uma variação no patrimônio declarado não significa automaticamente:

- aumento de renda;
- lucro;
- enriquecimento;
- enriquecimento ilícito;
- relação causal com o exercício do mandato.

As diferenças podem ocorrer por diversos motivos, incluindo:

- compra de bens;
- venda de bens;
- investimentos;
- participações societárias;
- atualização de valores;
- mudança na forma de declaração;
- alterações patrimoniais legítimas;
- outros fatores.

O BRASIVO apresenta a variação dos valores declarados e deixa a interpretação
para o usuário.

---

# Fontes oficiais

O BRASIVO utiliza principalmente dados disponibilizados por órgãos públicos
brasileiros.

---

## Câmara dos Deputados

Utilizada para informações relacionadas a:

- deputados;
- dados do mandato;
- legislaturas;
- partidos;
- estados;
- atividades;
- eventos;
- presença;
- votações;
- pronunciamentos;
- discursos;
- proposições;
- despesas da CEAP;
- histórico parlamentar.

Fonte principal:

**Dados Abertos da Câmara dos Deputados**

---

## Tribunal Superior Eleitoral

Utilizado principalmente para informações eleitorais e patrimoniais.

Entre os dados consultados estão:

- candidatos;
- eleições;
- nome civil;
- nome de urna;
- cargo disputado;
- unidade federativa;
- sequência do candidato;
- bens declarados;
- valores dos bens;
- histórico patrimonial eleitoral.

Fonte principal:

**Portal de Dados Abertos do Tribunal Superior Eleitoral**

---

# Regras de integridade dos dados

O BRASIVO possui algumas regras para reduzir interpretações incorretas.

---

## Informação ausente não vira zero

Se uma fonte oficial não retornar determinado dado, a plataforma não deve
assumir automaticamente:

```text
0
```

Ausência de informação e valor igual a zero são situações diferentes.

---

## Identidade ambígua não é associada

Quando não é possível confirmar com segurança que um registro pertence ao
parlamentar correto, ele não deve ser utilizado.

---

## Fonte oficial é a referência principal

O BRASIVO organiza e apresenta informações públicas.

Ele não substitui a fonte original.

Em caso de divergência, os dados publicados pelo órgão responsável devem ser
considerados a referência principal.

---

# Contas de usuário

A plataforma possui sistema de autenticação para funcionalidades personalizadas.

Entre as funções já implementadas estão:

- criação de conta;
- login;
- logout;
- sessão persistente;
- área autenticada;
- recuperação de acesso;
- redefinição de senha;
- proteção adicional da conta.

---

# Dashboard

Usuários autenticados possuem uma área própria dentro do BRASIVO.

O dashboard serve como ponto de acesso às funcionalidades personalizadas da
plataforma.

Ele pode reunir informações relacionadas a:

- parlamentares acompanhados;
- acesso rápido a representantes;
- informações da conta;
- navegação personalizada.

---

# Parlamentares acompanhados

O projeto possui suporte para acompanhar parlamentares.

A plataforma mantém informações relacionadas aos usuários que observam
determinados mandatos.

Isso permite construir uma experiência personalizada sem modificar os dados
públicos exibidos no perfil.

---

# Recuperação de senha

O BRASIVO possui um fluxo completo para recuperação de conta.

Na página de login o usuário pode utilizar:

```text
Esqueceu a senha?
```

O fluxo funciona aproximadamente assim:

```text
Usuário informa o e-mail
        ↓
Supabase envia o link
        ↓
Usuário acessa o link
        ↓
BRASIVO confirma a recuperação
        ↓
Sessão temporária é validada
        ↓
Usuário define uma nova senha
```

---

## Confirmação de recuperação

A aplicação utiliza uma rota própria para confirmar tokens/códigos enviados pelo
sistema de autenticação.

Isso permite integrar corretamente o fluxo de recuperação com autenticação SSR.

---

# MFA

O BRASIVO também possui suporte a **Multi-Factor Authentication — MFA**.

O objetivo é adicionar uma camada extra de proteção à conta.

O sistema possui rotas específicas para:

- consultar o estado do MFA;
- validar o nível de autenticação;
- gerenciar operações relacionadas à segurança da conta.

---

# Rate limiting

Rotas sensíveis possuem proteção contra excesso de requisições.

Operações diferentes podem possuir limites diferentes.

Exemplo:

```text
Leitura de informações de segurança
→ limite mais flexível

Alterações de segurança
→ limite mais restrito
```

Isso ajuda a reduzir abuso sem prejudicar operações normais da interface.

---

# Página inicial

A página inicial apresenta o projeto e permite iniciar a exploração dos
representantes.

A comunicação utiliza o conceito:

> **Brasil em transparência.**

A página possui uma experiência visual focada em:

- exploração do Brasil;
- seleção por estado;
- acesso aos deputados;
- apresentação da proposta da plataforma;
- transparência pública.

---

# Mapa do Brasil

A home possui uma experiência de exploração geográfica.

O usuário pode navegar pelos estados brasileiros e acessar os representantes
daquela região.

```text
Brasil
   ↓
UF
   ↓
Representantes
```

---

# Busca

O BRASIVO possui campo de busca integrado à interface.

A busca segue a identidade visual da aplicação e possui:

- estados de foco;
- animações sutis;
- feedback visual;
- integração com a navegação de representantes.

---

# Interface

O projeto possui uma identidade visual própria com foco em:

- fundo escuro;
- alto contraste;
- verde como destaque;
- gráficos;
- cartões de informações;
- hierarquia visual;
- animações sutis;
- transições discretas;
- carregamento por skeleton;
- interfaces progressivas.

---

# Skeleton loading

Áreas que dependem de APIs mais lentas utilizam skeletons.

O objetivo é evitar páginas completamente vazias durante as consultas.

O fluxo do perfil foi organizado para:

```text
Perfil básico
      ↓
Atividade
      ↓
Despesas
      ↓
Projetos
      ↓
Patrimônio
```

sem exigir que todos os módulos terminem antes de mostrar a página.

---

# Performance

O BRASIVO utiliza algumas estratégias para reduzir chamadas desnecessárias.

---

## Cache de representantes

Dados agregados de representantes podem permanecer temporariamente em cache.

Isso reduz consultas repetidas às APIs externas.

---

## Deduplicação de requisições

Quando múltiplas partes da aplicação solicitam os mesmos dados em um curto
intervalo, algumas requisições podem compartilhar uma operação pendente.

Essa estratégia foi utilizada em consultas como:

- dashboard;
- representantes;
- parlamentares acompanhados.

---

## Revalidação

Algumas consultas possuem períodos de revalidação para equilibrar:

- atualidade;
- velocidade;
- quantidade de chamadas aos serviços públicos.

---

## Cache de resumo

O resumo do mandato também possui cache independente.

Isso evita repetir processamento quando uma versão recente já está disponível.

---

# APIs internas

O projeto possui diferentes endpoints internos.

Alguns exemplos:

```text
/api/dashboard

/api/representatives

/api/mandates/followers

/api/mandates/[id]/activities

/api/mandates/[id]/expenses

/api/mandates/[id]/patrimony

/api/mandates/[id]/summary-stream

/api/account/security/mfa

/api/auth/recovery
```

Essas rotas funcionam como uma camada entre a interface do BRASIVO e as fontes
externas.

---

# Arquitetura de dados

Uma visão simplificada:

```text
                ┌─────────────────────┐
                │      Usuário        │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │       Next.js       │
                │                     │
                │ UI + API internas   │
                └──────────┬──────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
┌─────────────────────┐       ┌─────────────────────┐
│ Câmara dos Deputados│       │         TSE         │
│                     │       │                     │
│ atividade           │       │ candidatos          │
│ despesas            │       │ eleições            │
│ projetos            │       │ bens declarados     │
│ legislaturas        │       │ patrimônio          │
└──────────┬──────────┘       └──────────┬──────────┘
           │                             │
           └──────────────┬──────────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │       BRASIVO       │
                │                     │
                │ tratamento          │
                │ validação           │
                │ cache               │
                │ visualização        │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │      Supabase       │
                │                     │
                │ autenticação        │
                │ usuários            │
                │ dados privados      │
                └─────────────────────┘
```

---

# Tecnologias

## Aplicação

- Next.js 16
- React 19
- TypeScript
- CSS Modules

---

## Backend

- Next.js Route Handlers
- APIs internas
- Streaming
- Cache
- processamento server-side

---

## Banco e autenticação

- Supabase
- Supabase Auth
- autenticação SSR
- cookies de sessão
- recuperação de senha
- MFA

---

## Dados públicos

- API de Dados Abertos da Câmara dos Deputados
- arquivos públicos da Câmara
- Dados Abertos do TSE
- arquivos CSV do TSE
- arquivos ZIP eleitorais

---

## Infraestrutura

- Cloudflare Workers
- arquitetura serverless
- integração com Vinext para deploy

---

# Estrutura principal

Uma visão simplificada das páginas:

```text
/
├── Home
│
├── representatives
│   └── consulta de representantes
│
├── mandate/[id]
│   ├── resumo
│   ├── atividade
│   ├── despesas
│   ├── projetos e resultados
│   └── patrimônio
│
├── dashboard
│
├── login
│
├── forgot-password
│
├── reset-password
│
└── mfa
```

---

# Executando localmente

Clone o repositório:

```bash
git clone <URL_DO_REPOSITORIO>
```

Entre no projeto:

```bash
cd brasivo
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo de ambiente:

```text
.env.local
```

Configure as variáveis necessárias para Supabase e demais serviços utilizados
pela aplicação.

Exemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
```

Outras variáveis podem ser necessárias dependendo da configuração utilizada no
ambiente.

Nunca envie segredos ou chaves privadas para o repositório.

---

# Desenvolvimento

Execute:

```bash
npm run dev
```

A aplicação ficará disponível normalmente em:

```text
http://localhost:3000
```

---

# Build

Para verificar a aplicação para produção:

```bash
npm run build
```

---

# Deploy

O projeto possui configuração para Cloudflare Workers.

O deploy pode utilizar:

```bash
npm run deploy:vinext
```

As credenciais e variáveis necessárias devem estar configuradas no ambiente
utilizado para produção.

---

# Segurança

Algumas medidas presentes no projeto:

- autenticação com Supabase;
- sessões SSR;
- recuperação segura de senha;
- MFA;
- validação do nível de autenticação;
- rate limiting;
- proteção de rotas sensíveis;
- tratamento de tokens de recuperação;
- validação de parâmetros;
- separação entre dados públicos e dados da conta;
- respostas de recuperação que evitam revelar se um e-mail existe.

---

# Neutralidade

O BRASIVO não possui vínculo com partidos, candidatos ou parlamentares.

A plataforma não busca dizer:

```text
quem é melhor
quem é pior
em quem votar
```

O objetivo é facilitar o acesso aos registros públicos disponíveis.

A interpretação dessas informações pertence ao usuário.

---

# Independência

O BRASIVO é um projeto independente.

Não possui vínculo institucional com:

- Câmara dos Deputados;
- Tribunal Superior Eleitoral;
- partidos políticos;
- candidatos;
- parlamentares;
- governos.

Os nomes e dados apresentados pertencem às respectivas fontes públicas.

---

# Limitações

O projeto depende de serviços e bases externas.

Por isso, determinadas informações podem:

- demorar para carregar;
- ficar temporariamente indisponíveis;
- possuir lacunas históricas;
- mudar conforme atualizações dos órgãos responsáveis;
- não existir para determinados períodos;
- depender da estabilidade das APIs oficiais.

Quando um dado não pode ser confirmado, o BRASIVO procura não substituí-lo por
uma inferência apresentada como fato.

---

# Estado atual

O BRASIVO já possui uma base funcional ampla.

Atualmente o projeto inclui:

- home própria;
- mapa do Brasil;
- exploração por estado;
- consulta de deputados;
- busca;
- perfil individual de mandato;
- resumo automático;
- resumo progressivo por streaming;
- fallback factual;
- cache de resumo;
- atividade parlamentar;
- consulta por ano;
- presença;
- sessões;
- votações;
- pronunciamentos;
- discursos;
- despesas CEAP;
- histórico mensal;
- categorias de despesas;
- registros recentes;
- carregamento progressivo;
- projetos e resultados;
- patrimônio declarado;
- série patrimonial histórica;
- gráfico de patrimônio;
- comparação antes e depois de assumir;
- variação nominal;
- variação percentual;
- validação de identidade eleitoral;
- proteção contra falsos valores zero;
- integração com Câmara;
- integração com TSE;
- sistema de contas;
- login;
- cadastro;
- sessão autenticada;
- dashboard;
- parlamentares acompanhados;
- recuperação de senha;
- redefinição de senha;
- confirmação de recuperação;
- MFA;
- rate limiting;
- cache de APIs;
- deduplicação de requisições;
- skeleton loading;
- carregamento independente entre módulos;
- interface responsiva;
- Cloudflare Workers;
- Supabase.

---

# Próximos passos

A partir desta versão, o foco principal pode passar para:

- estabilidade;
- testes;
- performance;
- qualidade dos dados;
- cobertura histórica;
- acessibilidade;
- experiência mobile;
- documentação;
- monitoramento das APIs externas;
- melhorias graduais na interface.

---

# Contribuições

Contribuições são bem-vindas.

Elas podem envolver:

- correções;
- testes;
- documentação;
- performance;
- acessibilidade;
- melhorias de interface;
- tratamento de dados públicos;
- novas visualizações.

Para mudanças maiores, recomenda-se abrir uma issue explicando a proposta antes
da implementação.

---

# Autor

Desenvolvido por **João Vitor**.

Projeto independente voltado para desenvolvimento de software, transparência e
organização de dados públicos.

---

# Licença

Consulte o arquivo:

[LICENSE](LICENSE)

---

<p align="center">
  <strong>BRASIVO</strong><br>
  Brasil em transparência.
</p>
