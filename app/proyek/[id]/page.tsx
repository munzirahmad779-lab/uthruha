"use client";

import { useParams } from "next/navigation";
import { Workspace } from "@/components/workspace/shell";

export default function ProyekPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  return <Workspace id={id} />;
}
