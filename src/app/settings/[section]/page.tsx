import { redirect } from "next/navigation";

const accountSettingAnchors: Record<string, string> = {
  ads: "advertising-settings",
  advertising: "advertising-settings",
  bookings: "booking-settings",
  data: "data-settings",
  help: "data-settings",
  orders: "order-settings",
  payouts: "order-settings",
  profile: "profile-settings",
  verification: "verification-settings",
};

type SettingsSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function SettingsSectionPage({
  params,
}: SettingsSectionPageProps) {
  const { section } = await params;
  const anchor = accountSettingAnchors[section.toLowerCase()] ?? "profile-settings";

  redirect(`/account#${anchor}`);
}
