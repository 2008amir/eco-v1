import { createFileRoute } from "@tanstack/react-router";
import { AdminPostList } from "@/components/AdminPostList";

export const Route = createFileRoute("/admin/projects")({
  component: () => <AdminPostList kind="project" />,
});
