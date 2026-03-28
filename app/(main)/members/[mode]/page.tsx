import { Action } from "./_subpage/action";
import { MemberDetail } from "./_subpage/read";

type Props = {
  params: {
    mode: string;
  };
};

export default async function Member({ params }: Props) {
  if ((await params)?.mode === "read") {
    return <MemberDetail />;
  } else {
    return <Action />;
  }
}
