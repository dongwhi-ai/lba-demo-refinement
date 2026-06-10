import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { Annotator } from "@/components/annotator/annotator";
import { FILE_KEYS } from "@/lib/sc04";

const searchSchema = z.object({
  file: z.enum(FILE_KEYS).catch("drama"),
  // 1-based 행 위치
  i: z.number().int().min(1).catch(1),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  component: App,
});

function App() {
  return <Annotator />;
}
