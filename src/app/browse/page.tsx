import BrowseHeader from "@/components/BrowseHeader";
import SetsBrowser from "@/components/SetsBrowser";

export const metadata = { title: "Browse" };

export default function BrowsePage() {
  return (
    <>
      <BrowseHeader />
      <SetsBrowser />
    </>
  );
}
