import { redirect } from "next/navigation";

export default function RoomsCodePage({ params }: { params: { code: string } }) {
  const code = params?.code ? decodeURIComponent(params.code).trim().toUpperCase() : "";
  redirect(`/room/${code}`);
}
