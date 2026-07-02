import { Suspense } from "react";
import { Spinner } from "@heroui/spinner";
import { CustomerAction } from "./_subpage/action";
import { CustomerDetail } from "./_subpage/read";

type Props = {
  params: Promise<{ mode: string }>;
};

const Loading = () => (
  <div className="flex items-center justify-center h-full">
    <Spinner size="lg" color="warning" />
  </div>
);

export default async function CustomerModePage({ params }: Props) {
  const { mode } = await params;
  if (mode === "read") {
    return (
      <Suspense fallback={<Loading />}>
        <CustomerDetail />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<Loading />}>
      <CustomerAction />
    </Suspense>
  );
}
