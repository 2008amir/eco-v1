import { createFileRoute } from "@tanstack/react-router";
import { AdminPostList } from "@/components/AdminPostList";

export const Route = createFileRoute("/admin/news")({
  component: () => <AdminPostList kind="news" />,
});
