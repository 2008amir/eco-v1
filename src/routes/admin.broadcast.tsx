import { createFileRoute } from "@tanstack/react-router";
import { AdminPostList } from "@/components/AdminPostList";

export const Route = createFileRoute("/admin/broadcast")({
  component: () => <AdminPostList kind="broadcast" />,
});
