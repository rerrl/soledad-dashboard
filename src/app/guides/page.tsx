import { redirect } from "next/navigation";

/**
 * Legacy path: the salesmen tool page moved from `/guides` to `/dashboard`.
 * Kept as a permanent redirect so old bookmarks and links keep working.
 */
export default function GuidesRedirect() {
  redirect("/dashboard");
}
