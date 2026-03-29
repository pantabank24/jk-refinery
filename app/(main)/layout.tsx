import { MainContent } from "@/components/main-content";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainContent>{children}</MainContent>;
}
