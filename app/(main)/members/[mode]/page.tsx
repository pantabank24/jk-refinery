import { SkeletonList } from "@/components/skeleton";
import { Suspense } from "react";
import { Action } from "./_subpage/action";
import { MemberDetail } from "./_subpage/read";

type Props = {
  params: Promise<{
    mode: string;
  }>;
};

const Loading = () => (
  <SkeletonList rows={6} />
);

export default async function Member({ params }: Props) {
  const { mode } = await params;
  if (mode === "read") {
    return (
      <Suspense fallback={<Loading />}>
        <MemberDetail />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<Loading />}>
      <Action />
    </Suspense>
  );
}
