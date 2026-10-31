import { CAPTURE_SITES } from "@/lib/capture/extension";
import { tr } from "@/lib/i18n";

import { useTitle } from "../lib/use-title";

/** Privacy policy; required by the extension store listing. */
export default function PrivacyRoute() {
  useTitle(tr("privacy.title"));
  const sites = CAPTURE_SITES.join(", ");

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-4 py-10 text-sm leading-6 text-neutral-700">
      <h1 className="text-2xl font-semibold text-neutral-900">{tr("privacy.title")}</h1>
      <p>{tr("privacy.intro")}</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">{tr("privacy.whatStoredTitle")}</h2>
        <p>{tr("privacy.whatStoredBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">{tr("privacy.extensionTitle")}</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>{tr("privacy.ext1", { sites })}</li>
          <li>{tr("privacy.ext2")}</li>
          <li>{tr("privacy.ext3")}</li>
          <li>{tr("privacy.ext4")}</li>
          <li>{tr("privacy.ext5")}</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">{tr("privacy.aiTitle")}</h2>
        <p>{tr("privacy.aiBody")}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-neutral-900">{tr("privacy.deleteTitle")}</h2>
        <p>{tr("privacy.deleteBody")}</p>
      </section>
    </main>
  );
}
