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
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { username } = await params;
  const search = await searchParams;

  return (
    <FollowListPage kind="followers" page={search.page} username={username} />
  );
}
