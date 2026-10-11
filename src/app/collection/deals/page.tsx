import Deals from "@/components/Deals";

export const metadata = { title: "Deals" };

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  return <Deals initialKind={kind === "products" ? "products" : "cards"} />;
}
