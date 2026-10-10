import Unlock from "@/components/Unlock";
import { safeNext } from "@/lib/auth/redirect";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <Unlock next={safeNext(next)} />;
}
