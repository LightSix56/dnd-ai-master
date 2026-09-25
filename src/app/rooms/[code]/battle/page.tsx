import { redirect } from "next/navigation";

export default async function RoomsCodeBattlePage({
  params,
}: {
  params: Promise<{ code: string }> | { code: string };
}) {
  const resolvedParams = await params;
  const code = resolvedParams?.code ? decodeURIComponent(resolvedParams.code).trim().toUpperCase() : "";
  redirect(`/room/${code}/battle`);
}
