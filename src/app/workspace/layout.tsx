import WorkspaceShell from "@/components/workspace/workspace-shell";

export const metadata = {
  title: "Workspace | Al Mizan Legal Practice",
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
