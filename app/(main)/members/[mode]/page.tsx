import { Suspense } from "react";
import { Action } from "./_subpage/action";
import { MemberDetail } from "./_subpage/read";
import { Spinner } from "@heroui/spinner";

type Props = {
  params: Promise<{
    mode: string;
  }>;
};

export default async function Member({ params }: Props) {
  const { mode } = await params;
  if (mode === "read") {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner size="lg" color="warning" /></div>}>
        <MemberDetail />
      </Suspense>
    );
  } else {
    return <Action />;
  }
}
