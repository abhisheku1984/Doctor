import BillingDetailContent from "@/components/content/BillingDetailContent";

export const metadata = { title: "Invoice — Hospital Management System" };

export default function BillingDetailPage({ params }: { params: { id: string } }) {
  return <BillingDetailContent invoiceId={params.id} />;
}
