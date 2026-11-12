import { useState } from "react";
import { Inbox, Plus } from "lucide-react";
import { ROLE_LABELS, canCreateSamples, type SampleSummary } from "../../shared/workflow";
import { useApi } from "../lib/api";
import { useUser } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { SampleList } from "../components/workflow";
import { NewSampleSheet } from "../components/NewSampleSheet";

export function QueuePage() {
  const user = useUser();
  const { t, l } = useI18n();
  const { data, error, reload } = useApi<{ samples: SampleSummary[] }>("/queue");
  const [open, setOpen] = useState(false);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("myQueue")}
        sub={<>{l(ROLE_LABELS[user.role])} · {t("queueSub")}</>}
        actions={canCreateSamples(user.role) && <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>{t("newSample")}</Button>}
      />
      <Card>
        {error ? (
          <ErrorState onRetry={reload} />
        ) : !data ? (
          <div className="flex flex-col gap-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : user.role === "viewer" ? (
          <EmptyState icon={<Inbox className="size-5" />} title={t("viewOnlyQueue")} />
        ) : data.samples.length === 0 ? (
          <EmptyState icon={<Inbox className="size-5" />} title={t("queueEmpty")} sub={t("queueEmptySub")} />
        ) : (
          <SampleList samples={data.samples} />
        )}
      </Card>
      <NewSampleSheet open={open} onOpenChange={setOpen} />
    </div>
  );
}
