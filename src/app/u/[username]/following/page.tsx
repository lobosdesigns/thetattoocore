import type { Metadata } from "next";
import { FollowListPage } from "../follow-list-page";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Following",
};

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return <FollowListPage kind="following" username={username} />;
}
