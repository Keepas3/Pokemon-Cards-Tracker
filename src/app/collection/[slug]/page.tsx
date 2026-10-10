import type { Metadata } from "next";
import CollectionSet from "@/components/CollectionSet";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const set = await prisma.cardSet.findUnique({ where: { slug }, select: { name: true } });
  return { title: set ? `${set.name} · Collection` : "Collection" };
}

export default async function CollectionSetPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CollectionSet slug={slug} />;
}
