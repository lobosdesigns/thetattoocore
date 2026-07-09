import type { Metadata } from "next";
import { FollowListPage } from "../follow-list-page";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false,
  },
  title: "Followers",
};

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return <FollowListPage kind="followers" username={username} />;
}
