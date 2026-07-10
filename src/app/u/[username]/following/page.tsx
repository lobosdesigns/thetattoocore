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
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { username } = await params;
  const search = await searchParams;

  return (
    <FollowListPage kind="following" page={search.page} username={username} />
  );
}
