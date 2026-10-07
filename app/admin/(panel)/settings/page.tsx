import { PageHeader } from "@/components/admin/ui";
import { requireOwner } from "@/lib/auth/guard";
import { getSettingsFresh } from "@/lib/settings";
import { SettingsForm, type SettingsFormValue } from "./SettingsForm";

export const metadata = { title: "Site settings" };

export default async function SettingsPage() {
  await requireOwner();
  const s = await getSettingsFresh();

  const initial: SettingsFormValue = {
    acceptingOrders: s.acceptingOrders,
    cashOnDelivery: s.cashOnDelivery,
    closedMessage: s.closedMessage,
    defaultMaxPerOrder: String(s.defaultMaxPerOrder),
    duplicateWindowHours: String(s.duplicateWindowHours),
    freeDeliveryMinAmount: s.freeDeliveryMinAmount == null ? "" : String(s.freeDeliveryMinAmount),
    giftWrapPrice: s.giftWrapPrice == null ? "" : String(s.giftWrapPrice),
    announcement: s.announcement,
    homeHeadline: s.homeHeadline,
    homeSubheadline: s.homeSubheadline,
    contactPhone: s.contactPhone,
    whatsappNumber: s.whatsappNumber,
    messengerUrl: s.messengerUrl,
    facebookPageUrl: s.facebookPageUrl,
    email: s.email,
    businessAddress: s.businessAddress,
    whyChoose: s.whyChoose.map((w) => ({ title: w.title, description: w.description })),
    faqs: s.faqs.map((f) => ({ question: f.question, answer: f.answer })),
    returnPolicy: s.returnPolicy,
  };

  return (
    <>
      <PageHeader
        title="Site settings"
        description="Store-wide text, contact details and ordering rules. Customer-facing text should be in Bangla."
      />
      <SettingsForm initial={initial} />
    </>
  );
}
