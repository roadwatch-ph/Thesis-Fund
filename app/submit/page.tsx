import { AppShell } from "@/components/app-shell";
import { PaymentForm } from "@/components/payment-form";
import { getStaticAppData } from "@/lib/data";

export default function SubmitPage() {
  const { members, dueDates } = getStaticAppData();
  return (
    <AppShell active="Upload Payment">
      <PaymentForm members={members} dueDates={dueDates} />
    </AppShell>
  );
}
