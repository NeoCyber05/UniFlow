import { tr } from "@/lib/i18n";

export default function NotFoundRoute() {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground">
      {tr("route.notFound")}
    </div>
  );
}
