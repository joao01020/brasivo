import {
  ArrowLeft,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import styles from "./privacy.module.css";

export const metadata = {
  title: "Política de Privacidade | BRASIVO",
  description:
    "Saiba quais dados o BRASIVO trata, por que são utilizados, com quem podem ser compartilhados, seus direitos e como excluir sua conta.",
};

const LAST_UPDATED =
  "27 de setembro de 2026";

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link
            className={styles.brand}
            href="/"
            aria-label="BRASIVO"
          >
            <span>BR</span>
            <b>A</b>
            <span>SIVO</span>
          </Link>

          <Link
            className={styles.back}
            href="/settings"
          >
            <ArrowLeft size={15} />
            Voltar às configurações
          </Link>
        </div>
      </header>

      <div className={styles.shell}>
        <aside className={styles.index}>
          <span className={styles.indexKicker}>
            PRIVACIDADE
          </span>

          <strong>
            Nesta página
          </strong>

          <nav>
            <a href="#resumo">
              Visão geral
            </a>
            <a href="#dados">
              Dados tratados
            </a>
            <a href="#uso">
              Como usamos
            </a>
            <a href="#compartilhamento">
              Compartilhamento
            </a>
            <a href="#retencao">
              Retenção
            </a>
            <a href="#seguranca">
              Segurança
            </a>
            <a href="#direitos">
              Seus direitos
            </a>
            <a href="#exclusao">
              Excluir a conta
            </a>
            <a href="#contato">
              Contato
            </a>
          </nav>
        </aside>

        <article className={styles.document}>
          <div className={styles.hero}>
            <span className={styles.kicker}>
              TRANSPARÊNCIA E PROTEÇÃO DE DADOS
            </span>

            <h1>
              Política de Privacidade
            </h1>

            <p>
              Esta Política explica, em linguagem direta,
              quais dados pessoais podem ser tratados pelo
              BRASIVO, para que são utilizados, como são
              protegidos, quais são seus direitos e como você
              pode excluir sua conta.
            </p>

            <div className={styles.updated}>
              <ShieldCheck size={15} />
              Última atualização: {LAST_UPDATED}
            </div>
          </div>

          <section
            className={styles.section}
            id="resumo"
          >
            <div className={styles.sectionHeading}>
              <FileText size={18} />
              <div>
                <span>01</span>
                <h2>Sobre esta Política</h2>
              </div>
            </div>

            <p>
              O BRASIVO é uma plataforma de acompanhamento
              de informações públicas sobre representantes
              e mandatos. Esta Política se aplica aos dados
              pessoais relacionados à sua conta e ao uso das
              funcionalidades personalizadas da plataforma.
            </p>

            <p>
              Dados públicos sobre agentes políticos,
              mandatos, proposições, atividades e despesas
              obtidos de fontes oficiais não são dados
              fornecidos por você ao criar uma conta. Eles
              fazem parte do conteúdo público organizado pelo
              BRASIVO.
            </p>

            <div className={styles.notice}>
              <CheckCircle2 size={17} />
              <p>
                Acompanhar um representante no BRASIVO serve
                apenas para organizar atualizações na sua
                conta. Isso não significa apoio, oposição,
                intenção de voto ou preferência política.
              </p>
            </div>
          </section>

          <section
            className={styles.section}
            id="dados"
          >
            <div className={styles.sectionHeading}>
              <Database size={18} />
              <div>
                <span>02</span>
                <h2>Quais dados podemos tratar</h2>
              </div>
            </div>

            <p>
              Dependendo das funcionalidades que você utiliza,
              o BRASIVO pode tratar as seguintes categorias:
            </p>

            <div className={styles.dataGrid}>
              <div>
                <strong>Conta e identificação</strong>
                <p>
                  Nome de exibição, e-mail, identificador
                  interno da conta e informações necessárias
                  para autenticação.
                </p>
              </div>

              <div>
                <strong>Foto de perfil</strong>
                <p>
                  Imagem enviada voluntariamente por você para
                  personalizar sua conta.
                </p>
              </div>

              <div>
                <strong>Preferências de acompanhamento</strong>
                <p>
                  Representantes que você decidiu acompanhar,
                  além de preferências relacionadas ao seu
                  painel e às notificações.
                </p>
              </div>

              <div>
                <strong>Interações com a plataforma</strong>
                <p>
                  Ações necessárias para manter funcionalidades
                  da conta, como alterações de perfil,
                  preferências e registros de notificações.
                </p>
              </div>

              <div>
                <strong>Dados técnicos e de segurança</strong>
                <p>
                  Serviços de infraestrutura podem processar
                  dados técnicos como endereço IP, navegador,
                  data e horário de acesso, logs de erro e
                  informações necessárias para segurança,
                  prevenção de abuso e disponibilidade.
                </p>
              </div>

              <div>
                <strong>Comunicações</strong>
                <p>
                  Informações que você envie voluntariamente
                  ao entrar em contato com o BRASIVO.
                </p>
              </div>
            </div>

            <p>
              O BRASIVO não precisa que você informe dados
              pessoais sensíveis para usar as funcionalidades
              comuns da plataforma. Não envie esse tipo de
              informação sem necessidade.
            </p>
          </section>

          <section
            className={styles.section}
            id="uso"
          >
            <div className={styles.sectionHeading}>
              <UserRound size={18} />
              <div>
                <span>03</span>
                <h2>Para que usamos seus dados</h2>
              </div>
            </div>

            <ul>
              <li>
                criar, autenticar e manter sua conta;
              </li>
              <li>
                permitir que você altere nome e foto de perfil;
              </li>
              <li>
                salvar os representantes que você escolheu
                acompanhar;
              </li>
              <li>
                montar seu dashboard e entregar atualizações
                relacionadas aos acompanhamentos escolhidos;
              </li>
              <li>
                enviar e organizar notificações da própria
                plataforma;
              </li>
              <li>
                proteger a conta, prevenir fraude, abuso,
                acessos indevidos e incidentes de segurança;
              </li>
              <li>
                diagnosticar erros e manter o serviço
                disponível e confiável;
              </li>
              <li>
                cumprir obrigações legais ou regulatórias
                aplicáveis;
              </li>
              <li>
                responder solicitações relacionadas à sua conta
                e aos seus direitos de privacidade.
              </li>
            </ul>

            <h3>Bases legais</h3>

            <p>
              O tratamento é realizado conforme a finalidade
              e a hipótese legal aplicável prevista na Lei
              Geral de Proteção de Dados Pessoais (LGPD).
              Dependendo da operação, isso pode incluir
              execução de contrato ou procedimentos
              relacionados ao serviço solicitado por você,
              cumprimento de obrigação legal ou regulatória,
              exercício regular de direitos, legítimo
              interesse observado nos limites da LGPD e
              consentimento quando essa for a base adequada.
            </p>

            <p>
              Quando o tratamento depender de consentimento,
              você poderá revogá-lo nos termos da legislação,
              sem afetar tratamentos realizados anteriormente
              de forma legítima.
            </p>
          </section>

          <section
            className={styles.section}
            id="compartilhamento"
          >
            <div className={styles.sectionHeading}>
              <ExternalLink size={18} />
              <div>
                <span>04</span>
                <h2>Serviços de terceiros e compartilhamento</h2>
              </div>
            </div>

            <p>
              O BRASIVO pode utilizar prestadores de
              infraestrutura tecnológica necessários para
              operar a plataforma, como serviços de
              autenticação, banco de dados, armazenamento,
              hospedagem, rede, proteção contra abuso e
              entrega da aplicação.
            </p>

            <p>
              Atualmente, a arquitetura do BRASIVO utiliza
              serviços como Supabase para recursos de conta,
              autenticação, banco de dados e armazenamento,
              e Cloudflare para infraestrutura de entrega e
              execução da aplicação. Esses fornecedores podem
              tratar dados técnicos e operacionais necessários
              à prestação dos respectivos serviços, sujeitos
              às suas próprias condições e medidas de
              proteção.
            </p>

            <p>
              O BRASIVO não vende seus dados pessoais.
              Compartilhamentos poderão ocorrer quando
              necessários para executar o serviço, cumprir
              obrigação legal, exercer direitos ou responder
              a ordem válida de autoridade competente.
            </p>

            <h3>Transferência internacional</h3>

            <p>
              Prestadores de infraestrutura podem operar ou
              armazenar informações em outros países. Quando
              houver transferência internacional de dados
              pessoais, ela deverá observar os requisitos da
              LGPD e as salvaguardas aplicáveis.
            </p>
          </section>

          <section
            className={styles.section}
            id="cookies"
          >
            <div className={styles.sectionHeading}>
              <Database size={18} />
              <div>
                <span>05</span>
                <h2>Cookies e armazenamento no navegador</h2>
              </div>
            </div>

            <p>
              O BRASIVO pode utilizar cookies ou mecanismos
              equivalentes estritamente necessários para
              autenticação, sessão, segurança, preferências e
              funcionamento da aplicação.
            </p>

            <p>
              Caso ferramentas opcionais de medição,
              publicidade ou personalização que exijam
              consentimento sejam adotadas futuramente, esta
              Política deverá ser atualizada e, quando
              necessário, será apresentada uma escolha ao
              usuário.
            </p>
          </section>

          <section
            className={styles.section}
            id="retencao"
          >
            <div className={styles.sectionHeading}>
              <Database size={18} />
              <div>
                <span>06</span>
                <h2>Por quanto tempo mantemos os dados</h2>
              </div>
            </div>

            <p>
              Os dados pessoais são mantidos pelo tempo
              necessário para cumprir as finalidades
              informadas nesta Política, manter a conta e
              prestar os serviços solicitados.
            </p>

            <p>
              Após o encerramento da conta ou término de uma
              finalidade, determinados dados poderão ser
              conservados quando a legislação autorizar ou
              exigir, por exemplo para cumprimento de
              obrigação legal ou regulatória, exercício
              regular de direitos, prevenção de fraude ou
              segurança. Quando a conservação não for mais
              necessária, os dados deverão ser eliminados ou,
              quando cabível, anonimizados.
            </p>

            <p>
              Cópias técnicas de segurança podem levar algum
              tempo para serem eliminadas de sistemas de
              backup, respeitados os ciclos técnicos de
              retenção e as obrigações aplicáveis.
            </p>
          </section>

          <section
            className={styles.section}
            id="seguranca"
          >
            <div className={styles.sectionHeading}>
              <LockKeyhole size={18} />
              <div>
                <span>07</span>
                <h2>Como protegemos seus dados</h2>
              </div>
            </div>

            <p>
              O BRASIVO adota medidas técnicas e
              organizacionais proporcionais ao serviço para
              reduzir riscos de acesso não autorizado,
              alteração, perda, exposição ou uso indevido de
              dados pessoais.
            </p>

            <p>
              Nenhum sistema conectado à internet pode
              garantir segurança absoluta. Por isso, medidas
              de segurança são revisadas e ajustadas conforme
              a evolução da plataforma e dos riscos.
            </p>
          </section>

          <section
            className={styles.section}
            id="direitos"
          >
            <div className={styles.sectionHeading}>
              <ShieldCheck size={18} />
              <div>
                <span>08</span>
                <h2>Seus direitos</h2>
              </div>
            </div>

            <p>
              Nos termos da LGPD e quando aplicável ao caso,
              você pode solicitar:
            </p>

            <ul>
              <li>
                confirmação da existência de tratamento;
              </li>
              <li>
                acesso aos seus dados pessoais;
              </li>
              <li>
                correção de dados incompletos, inexatos ou
                desatualizados;
              </li>
              <li>
                anonimização, bloqueio ou eliminação de dados
                desnecessários, excessivos ou tratados em
                desconformidade com a LGPD;
              </li>
              <li>
                portabilidade, quando aplicável e conforme
                regulamentação;
              </li>
              <li>
                informação sobre compartilhamentos;
              </li>
              <li>
                informação sobre a possibilidade de não
                fornecer consentimento e as consequências,
                quando aplicável;
              </li>
              <li>
                revogação de consentimento, quando essa for a
                base legal utilizada;
              </li>
              <li>
                eliminação dos dados tratados com
                consentimento, observadas as hipóteses legais
                de conservação;
              </li>
              <li>
                revisão de decisões tomadas unicamente com
                base em tratamento automatizado, quando
                aplicável.
              </li>
            </ul>

            <p>
              Alguns direitos não são absolutos. Uma
              solicitação pode exigir validação de identidade
              e poderá ser limitada quando existir obrigação
              legal de conservação ou outra hipótese prevista
              na LGPD.
            </p>
          </section>

          <section
            className={`${styles.section} ${styles.deleteSection}`}
            id="exclusao"
          >
            <div className={styles.sectionHeading}>
              <Trash2 size={18} />
              <div>
                <span>09</span>
                <h2>Como excluir sua conta</h2>
              </div>
            </div>

            <p>
              Você pode iniciar a exclusão diretamente dentro
              da sua conta BRASIVO:
            </p>

            <ol className={styles.steps}>
              <li>
                Entre na sua conta.
              </li>
              <li>
                Abra <strong>Configurações</strong>.
              </li>
              <li>
                Acesse a seção <strong>Conta</strong>.
              </li>
              <li>
                Abra <strong>Zona de perigo</strong>.
              </li>
              <li>
                Em “Excluir conta permanentemente”, digite
                exatamente <code>EXCLUIR MINHA CONTA</code>.
              </li>
              <li>
                Clique em <strong>Excluir minha conta</strong>
                e confirme a solicitação final.
              </li>
            </ol>

            <div className={styles.deleteWarning}>
              <Trash2 size={18} />
              <div>
                <strong>
                  A exclusão é permanente
                </strong>
                <p>
                  A conta é encerrada e os dados vinculados à
                  conta são removidos conforme o processo de
                  exclusão do BRASIVO, ressalvados dados cuja
                  conservação seja permitida ou exigida pela
                  legislação. Dados públicos sobre políticos
                  e mandatos continuam existindo porque não
                  pertencem à conta do usuário.
                </p>
              </div>
            </div>

            <Link
              className={styles.settingsButton}
              href="/settings#zona-de-perigo"
            >
              Ir para exclusão da conta
              <Trash2 size={14} />
            </Link>
          </section>

          <section
            className={styles.section}
            id="contato"
          >
            <div className={styles.sectionHeading}>
              <UserRound size={18} />
              <div>
                <span>10</span>
                <h2>Contato e solicitações de privacidade</h2>
              </div>
            </div>

            <p>
              Para exercer direitos relacionados a dados
              pessoais, entre em contato pelos canais oficiais
              de atendimento disponibilizados pelo BRASIVO.
              Antes da publicação comercial definitiva, o
              responsável pelo projeto deve disponibilizar
              nesta página a identificação do controlador e
              um canal específico de contato para privacidade.
            </p>

            <div className={styles.legalPending}>
              <strong>
                Informação administrativa pendente
              </strong>
              <p>
                Identificação jurídica do controlador,
                endereço de contato e canal do encarregado ou
                responsável por privacidade devem ser
                preenchidos antes do lançamento público
                definitivo.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <FileText size={18} />
              <div>
                <span>11</span>
                <h2>Alterações nesta Política</h2>
              </div>
            </div>

            <p>
              Esta Política poderá ser atualizada para
              refletir mudanças na plataforma, nos serviços
              utilizados ou nas obrigações legais. A data da
              versão mais recente será indicada no início
              deste documento. Quando uma alteração exigir
              comunicação adicional ou novo consentimento,
              isso será feito de acordo com a legislação
              aplicável.
            </p>
          </section>

          <footer className={styles.footer}>
            <span>
              BRASIVO · Política de Privacidade
            </span>
            <span>
              Versão de {LAST_UPDATED}
            </span>
          </footer>
        </article>
      </div>
    </main>
  );
}
