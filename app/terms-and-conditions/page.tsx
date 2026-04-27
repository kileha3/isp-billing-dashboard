// app/terms-and-conditions/page.tsx
import { Suspense } from "react";
import TermsPageContent from "./TermsContent";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TermsPageContent />
    </Suspense>
  );
}