import { ItemDetail } from "@/components/ItemDetail";

export const dynamic = "force-dynamic";

export default async function OssItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemDetail id={id} expectedType="oss" />;
}
