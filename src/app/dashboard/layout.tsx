import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The tool page is deliberately unbranded, so it overrides the root layout's
 * app-name tab title with a neutral one.
 */
export const metadata: Metadata = {
  title: "Vehicle Library",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
