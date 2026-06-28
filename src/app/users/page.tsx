import UserProfileClient from "@/components/UserProfileClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Profile - LeetProof",
  description: "View LeetProof profile and progress.",
};

// A single static page. The target user id is passed as a query param
// (/users?id=<uuid>) and all profile data is fetched dynamically client-side.
export default function UsersPage() {
  return <UserProfileClient />;
}
