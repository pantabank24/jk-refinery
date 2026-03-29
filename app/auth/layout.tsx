export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-tl from-[#c09c42]/40 via-transparent to-transparent">
      {children}
    </div>
  );
}
