import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/overview")({
  component: () => <Navigate to="/" />,
  head: () => ({
    meta: [
      { title: "Dashboard — Ecomedic Squad" },
      { name: "description", content: "Redirecting to the Ecomedic Squad dashboard." },
    ],
  }),
});
