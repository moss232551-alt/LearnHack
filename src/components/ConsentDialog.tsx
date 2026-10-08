import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLang } from "@/lib/i18n";

export const CONSENT_POLICY_VERSION = "1.0";

export function ConsentDialog({
  open,
  onOpenChange,
  onDecision,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDecision: (accepted: boolean) => void;
}) {
  const { t } = useLang();

  const sections = [
    ["consentData", "consentDataBody"],
    ["consentPurpose", "consentPurposeBody"],
    ["consentRetention", "consentRetentionBody"],
    ["consentAccess", "consentAccessBody"],
    ["consentRights", "consentRightsBody"],
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("consentTitle")}</DialogTitle>
          <DialogDescription>{t("privacyFirst")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {sections.map(([head, body]) => (
            <div key={head}>
              <p className="text-sm font-semibold text-foreground">{t(head)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onDecision(false)}>
            {t("consentDecline")}
          </Button>
          <Button onClick={() => onDecision(true)}>{t("consentAccept")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
