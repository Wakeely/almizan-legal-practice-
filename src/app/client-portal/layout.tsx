import ClientPortalShell from "@/components/client-portal/client-portal-shell";

export const metadata = {
  title: "Client Portal | Al Mizan Legal Practice",
};

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return <ClientPortalShell>{children}</ClientPortalShell>;
}
