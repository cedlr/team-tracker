"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Plane } from "lucide-react";
import { ScreenShellAppProvider, useScreenShellApp } from "@/components/arc/screen-shell/screen-shell";
import { Button } from "@/components/arc/button/button";
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog";
import { DateRangePicker, type DateRange } from "@/components/arc/date-range-picker/date-range-picker";
import { Select } from "@/components/arc/select/select";
import { Textarea } from "@/components/arc/textarea/textarea";
import { requestLeave } from "@/app/actions/leave";

const types = [
  { value: "annual", label: "Annual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "personal", label: "Personal day" },
  { value: "parental", label: "Parental leave" },
  { value: "unpaid", label: "Unpaid leave" },
];

/** Adds a "Request leave" button to the shared sidebar and opens Arc's dialog with Arc's date range picker and select. */
export function LeaveRequest({ children }: { children: ReactNode }) {
  const app = useScreenShellApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("annual");
  const [range, setRange] = useState<DateRange | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    if (!range) { setError("Pick the dates first."); return; }
    const result = await requestLeave({ type, from: format(range.start, "yyyy-MM-dd"), to: format(range.end, "yyyy-MM-dd"), note: note || undefined });
    if (!result.ok) { setError(result.error); return; }
    setOpen(false); setRange(null); setNote(""); setError("");
    router.refresh();
  });

  const trigger = (
    <Button variant="secondary" size="sm" style={{ width: "100%", marginTop: 8 }} onClick={() => setOpen(true)}>
      <Plane size={16} strokeWidth={1.75} aria-hidden="true" />Request leave
    </Button>
  );

  return (
    <>
      {app ? <ScreenShellAppProvider value={{ ...app, sidebarTop: <>{app.sidebarTop}{trigger}</> }}>{children}</ScreenShellAppProvider> : children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Request leave" description="Your team lead approves it on this page.">
          <div className="tt-stack">
            <Select label="Type" options={types} value={type} onValueChange={setType} />
            <DateRangePicker label="Dates" value={range} onChange={setRange} weekStartsOn={1} minDate={new Date()} presets={[]} />
            <Textarea label="Note" description="Optional" value={note} onChange={event => setNote(event.target.value)} error={error || undefined} />
            <div className="tt-row">
              <Button onClick={submit} loading={pending}>Send request</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
