import MandateProfile from "@/components/mandates/MandateProfile";

export default async function MandatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MandateProfile id={id} />;
}
