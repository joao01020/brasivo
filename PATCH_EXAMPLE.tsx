// Na página/componente que hoje renderiza a aba "Atividade":
//
// 1) importe:
// import MandateActivityPanel from "@/components/mandate/MandateActivityPanel";
//
// 2) substitua somente o conteúdo atual da aba Atividade por:
//
// <MandateActivityPanel mandateId={mandate.id} />
//
// Se o ID que a página recebe já é o ID externo da Câmara:
//
// <MandateActivityPanel mandateId={id} />
//
// NÃO substitua a aba "Despesas". Ela continua separada como já está no BRASIVO.
//
// Exemplo:
//
// {activeTab === "activity" ? (
//   <MandateActivityPanel mandateId={id} />
// ) : (
//   <ExistingExpensesPanel ... />
// )}
