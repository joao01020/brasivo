# Contribuindo com o BRASIVO

Obrigado pelo interesse em contribuir com o **BRASIVO**.

O projeto é uma iniciativa independente de tecnologia cívica que busca facilitar
o acesso a informações públicas sobre deputados federais brasileiros.

Contribuições são bem-vindas em áreas como:

- correções de bugs;
- interface e experiência do usuário;
- acessibilidade;
- performance;
- testes;
- documentação;
- tratamento de dados públicos;
- integrações com fontes oficiais;
- visualizações;
- segurança;
- arquitetura;
- melhorias de código.

Antes de contribuir, leia as orientações abaixo.

---

## Princípios do projeto

O BRASIVO trabalha com informações relacionadas à atividade política e, por
isso, algumas regras são especialmente importantes.

### Neutralidade política

O BRASIVO não deve:

- promover candidatos;
- atacar candidatos;
- recomendar voto;
- criar ranking ideológico;
- classificar parlamentares como "bons" ou "ruins";
- apresentar opiniões políticas como fatos;
- utilizar linguagem partidária na interface.

As funcionalidades devem priorizar a apresentação de informações verificáveis.

---

### Fontes oficiais

Sempre que possível, dados parlamentares ou eleitorais devem vir de fontes
públicas oficiais.

As principais fontes utilizadas atualmente são:

- Câmara dos Deputados;
- Tribunal Superior Eleitoral — TSE.

Novas fontes podem ser propostas, mas devem ser documentadas e avaliadas antes
de serem utilizadas como referência.

---

### Ausência de dados não significa zero

Uma das regras mais importantes do BRASIVO é:

> Dados ausentes não devem ser transformados automaticamente em zero.

Exemplo:

```text
Nenhum registro encontrado
```

não é necessariamente equivalente a:

```text
0
```

Isso vale especialmente para:

- patrimônio declarado;
- despesas;
- atividades;
- votações;
- presença;
- contagens agregadas.

Quando não houver informação confirmada, prefira estados como:

```text
Indisponível
Sem registro confirmado
Não informado
```

em vez de inferir um valor.

---

### Patrimônio declarado

Dados patrimoniais exigem cuidado adicional.

O BRASIVO apresenta:

> variação do patrimônio declarado

Evite textos que sugiram automaticamente:

- enriquecimento;
- enriquecimento ilícito;
- lucro;
- aumento de renda;
- corrupção;
- relação causal com o exercício do mandato.

Uma diferença entre duas declarações patrimoniais não permite concluir, por si
só, a origem dessa variação.

---

### Identificação de candidatos

Ao relacionar dados eleitorais do TSE com um parlamentar, não utilize
correspondência aproximada de nomes sem validação adequada.

Uma associação incorreta pode atribuir patrimônio ou informações eleitorais de
uma pessoa a outra.

Em caso de dúvida:

```text
não associe o registro
```

---

# Antes de começar

Para mudanças pequenas, como:

- correções de texto;
- pequenos bugs;
- documentação;
- acessibilidade;
- ajustes visuais;

você pode abrir diretamente um Pull Request.

Para mudanças maiores, recomendamos abrir primeiro uma **Issue** explicando a
proposta.

Exemplos:

- novo módulo;
- nova fonte de dados;
- alteração importante na arquitetura;
- mudança na autenticação;
- nova forma de cálculo;
- alteração na interpretação de dados públicos.

Isso evita trabalho duplicado e permite discutir a abordagem antes da
implementação.

---

# Configurando o projeto

Clone o repositório:

```bash
git clone https://github.com/joao01020/brasivo/tree/main
```

Entre na pasta:

```bash
cd brasivo
```

Instale as dependências:

```bash
npm install
```

Configure as variáveis de ambiente necessárias:

```text
.env.local
```

Depois execute:

```bash
npm run dev
```

A aplicação normalmente ficará disponível em:

```text
http://localhost:3000
```

---

# Variáveis de ambiente

Nunca envie para o GitHub:

- senhas;
- tokens;
- chaves privadas;
- secrets;
- service role keys;
- credenciais da Cloudflare;
- credenciais do Supabase;
- chaves de APIs privadas.

Arquivos locais como:

```text
.env
.env.local
.env.production
```

não devem conter credenciais reais em commits.

Quando uma nova variável for necessária, documente apenas o nome dela.

Exemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

---

# Criando uma branch

Não faça desenvolvimento diretamente na `main`.

Crie uma branch para sua alteração.

Exemplos:

```bash
git checkout -b feat/nova-funcionalidade
```

```bash
git checkout -b fix/correcao-despesas
```

```bash
git checkout -b docs/melhorar-readme
```

```bash
git checkout -b refactor/patrimony-service
```

Alguns prefixos recomendados:

```text
feat/       nova funcionalidade
fix/        correção de bug
docs/       documentação
refactor/   refatoração
test/       testes
perf/       performance
security/   segurança
style/      mudanças visuais
```

---

# Padrão de código

Procure manter o estilo já utilizado no projeto.

O BRASIVO utiliza principalmente:

- TypeScript;
- React;
- Next.js;
- CSS Modules;
- Route Handlers;
- Supabase.

Algumas recomendações:

- mantenha TypeScript tipado;
- evite `any` quando houver alternativa razoável;
- utilize nomes claros;
- mantenha componentes pequenos quando possível;
- evite lógica de negócio complexa diretamente no JSX;
- reutilize serviços existentes;
- evite duplicar chamadas externas;
- trate estados de erro;
- trate estados de carregamento;
- considere acessibilidade;
- mantenha comportamento responsivo.

---

# APIs externas

Chamadas para APIs públicas devem considerar que serviços externos podem:

- falhar;
- responder lentamente;
- retornar dados incompletos;
- aplicar rate limits;
- mudar estruturas;
- ficar temporariamente indisponíveis.

Não assuma que uma API sempre responderá corretamente.

Sempre que possível:

- valide a resposta;
- trate timeouts;
- trate campos ausentes;
- utilize cache quando apropriado;
- evite chamadas duplicadas;
- forneça fallback seguro para a interface.

---

# Cache

O BRASIVO utiliza cache em diferentes áreas para reduzir consultas repetidas.

Ao modificar uma funcionalidade com cache:

- verifique se os dados podem ficar desatualizados;
- defina uma estratégia de revalidação;
- não faça cache permanente de dados que precisam ser atualizados;
- não transforme falha de atualização em perda imediata de dados válidos;
- evite criar múltiplas consultas simultâneas para o mesmo recurso.

---

# Resumo do mandato

O resumo automático deve continuar baseado nos registros disponíveis.

Ele não deve:

- inventar fatos;
- criar avaliações;
- dar notas ao parlamentar;
- recomendar apoio;
- recomendar voto;
- preencher dados ausentes com suposições.

O resumo deve organizar informações confirmadas.

Quando a geração automática não estiver disponível, o sistema pode utilizar
dados factuais já confirmados como fallback.

---

# Despesas

Dados da CEAP devem refletir os registros disponibilizados pela Câmara dos
Deputados.

Ao trabalhar com despesas:

- preserve os valores originais;
- diferencie ausência de registros de valor zero;
- informe a fonte;
- evite conclusões subjetivas sobre os gastos;
- não atribua irregularidade sem uma fonte oficial que estabeleça isso.

---

# Patrimônio

Ao modificar o módulo patrimonial:

- utilize dados oficiais do TSE;
- valide a identidade do candidato;
- não associe nomes ambiguamente;
- preserve o ano da declaração;
- calcule variações somente quando existirem valores confirmados;
- utilize linguagem neutra.

Prefira:

```text
Variação do patrimônio declarado
```

em vez de:

```text
Enriquecimento
```

---

# Interface

A interface do BRASIVO utiliza uma identidade visual escura e orientada à
leitura de dados.

Novos componentes devem procurar manter:

- consistência visual;
- hierarquia de informação;
- responsividade;
- acessibilidade;
- animações discretas;
- estados de carregamento;
- estados vazios;
- estados de erro.

Evite animações que prejudiquem a leitura dos dados.

Sempre que possível, respeite:

```css
prefers-reduced-motion
```

---

# Acessibilidade

Contribuições de acessibilidade são especialmente bem-vindas.

Considere:

- navegação por teclado;
- foco visível;
- contraste;
- texto alternativo;
- labels;
- elementos semânticos;
- `aria-*` quando necessário;
- leitores de tela;
- redução de movimento.

---

# Segurança

Mudanças envolvendo:

- autenticação;
- sessão;
- cookies;
- MFA;
- recuperação de conta;
- rate limiting;
- permissões;
- Supabase RLS;

devem ser revisadas com cuidado.

Nunca reduza uma proteção de segurança apenas para resolver um problema de
interface.

---

## Vulnerabilidades

Se você encontrar uma vulnerabilidade que possa colocar usuários ou dados em
risco, **não publique detalhes exploráveis em uma Issue pública**.

Entre em contato com o mantenedor do projeto por um canal privado antes de
divulgar os detalhes.

---

# Testando sua alteração

Antes de abrir um Pull Request, execute pelo menos:

```bash
npm run build
```

O build deve terminar sem erros.

Também teste manualmente a área modificada.

Se você alterou uma funcionalidade existente, verifique se outras partes
relacionadas continuam funcionando.

---

# Commits

Prefira commits pequenos e descritivos.

Exemplos:

```text
feat: add patrimony history view
```

```text
fix: prevent missing assets from becoming zero
```

```text
perf: deduplicate representative requests
```

```text
docs: improve contribution guide
```

```text
security: harden MFA rate limiting
```

Evite mensagens como:

```text
update
```

```text
changes
```

```text
fix stuff
```

---

# Pull Requests

Um Pull Request deve explicar:

### O que mudou?

Descreva a alteração de forma objetiva.

### Por que essa mudança é necessária?

Explique o problema ou melhoria.

### Como foi testado?

Informe os testes realizados.

### Existe impacto nos dados?

Se a alteração modifica:

- cálculos;
- fontes;
- filtros;
- correspondência de identidade;
- agregações;

explique claramente.

### Há mudanças visuais?

Se possível, inclua imagens ou vídeos mostrando antes e depois.

---

## Exemplo de Pull Request

```markdown
## O que mudou

Adiciona carregamento progressivo aos registros recentes de despesas.

## Por quê

A lista completa deixava o carregamento inicial do perfil mais pesado.

## Como foi testado

- npm run build
- perfil com registros
- perfil sem registros
- desktop
- mobile

## Fonte dos dados

Nenhuma alteração.

Os registros continuam vindo da Câmara dos Deputados.
```

---

# O que pode impedir um Pull Request de ser aceito

Um Pull Request pode precisar de alterações quando:

- introduz opinião política na plataforma;
- utiliza fontes não verificáveis;
- altera dados oficiais sem justificativa;
- transforma ausência de dados em zero;
- associa candidatos de forma insegura;
- introduz vulnerabilidades;
- inclui credenciais;
- quebra o build;
- adiciona dependência sem necessidade clara;
- aumenta significativamente a complexidade sem benefício proporcional;
- muda a proposta do projeto sem discussão anterior.

---

# Issues

Antes de abrir uma nova Issue, verifique se já existe outra tratando do mesmo
assunto.

Títulos bons:

```text
[Bug] Histórico de despesas não carrega determinados anos
```

```text
[Feature] Adicionar filtro de legislatura
```

```text
[Docs] Documentar variáveis de ambiente
```

Inclua sempre que possível:

- descrição;
- comportamento atual;
- comportamento esperado;
- passos para reproduzir;
- screenshots;
- navegador;
- sistema operacional;
- logs relevantes.

Nunca publique secrets ou tokens nos logs.

---

# Primeira contribuição

Se você está começando agora no projeto, procure Issues marcadas como:

```text
good first issue
```

ou:

```text
help wanted
```

Boas primeiras contribuições podem envolver:

- documentação;
- textos;
- acessibilidade;
- pequenos bugs;
- responsividade;
- componentes isolados;
- testes;
- tratamento de estados vazios.

Não é necessário conhecer todo o BRASIVO para começar a contribuir.

---

# Licença das contribuições

Ao enviar uma contribuição para o BRASIVO, você concorda que seu código seja
distribuído sob a mesma licença utilizada pelo projeto:

**GNU Affero General Public License v3.0 — AGPL-3.0**

Consulte:

[LICENSE](LICENSE)

---

# Código de terceiros

Não envie código copiado de projetos cuja licença seja incompatível com a
licença do BRASIVO.

Ao adicionar:

- bibliotecas;
- imagens;
- ícones;
- datasets;
- componentes externos;

confirme se o uso é permitido e preserve os avisos exigidos pela licença
original.

---

# Dados públicos de terceiros

A licença do BRASIVO se aplica ao código do projeto.

Ela não altera automaticamente a licença, propriedade ou condições de uso de:

- dados da Câmara dos Deputados;
- dados do TSE;
- fotografias oficiais;
- marcas;
- logos;
- materiais de terceiros.

Esses recursos continuam sujeitos às regras de suas respectivas fontes.

---

# Dúvidas

Se você não souber qual abordagem utilizar, abra uma Issue antes de começar uma
mudança grande.

Discussões técnicas e propostas de melhoria são bem-vindas.

O objetivo é construir o BRASIVO de forma colaborativa sem comprometer:

- neutralidade;
- qualidade dos dados;
- segurança;
- transparência;
- confiabilidade.

---

Obrigado por contribuir com o **BRASIVO**.

**Brasil em transparência.**
