import StateMandates from "@/components/mandates/StateMandates";
const UFS = new Set(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]);
export default async function StatePage({ params }: { params: Promise<{ uf: string }> }) {
  const { uf: rawUf } = await params; const uf = rawUf.toUpperCase();
  return <StateMandates uf={UFS.has(uf) ? uf : "DF"} />;
}
