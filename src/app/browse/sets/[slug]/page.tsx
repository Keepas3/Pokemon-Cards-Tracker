import type { Metadata } from "next";
import SetDetail from "@/components/SetDetail";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const set = await prisma.cardSet.findUnique({ where: { slug }, select: { name: true } });
  return { title: set?.name ?? "Set" };
}

export default async function SetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SetDetail slug={slug} />;
}
