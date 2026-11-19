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
import { addLeave } from "@/app/actions/leave";

const types = [
  { value: "annual", label: "Annual leave" },
  { value: "sick", label: "Sick leave" },
  { value: "personal", label: "Personal day" },
  { value: "parental", label: "Parental leave" },
  { value: "unpaid", label: "Unpaid leave" },
];

/**
 * Leave is approved by email. Leads and admins get an "Add leave" button in the sidebar that records
 * an already approved leave for a member, with Arc's dialog, select and date range picker.
 */
export function LeaveEntry({ children, people, canAdd }: { children: ReactNode; people: { id: string; name: string }[]; canAdd: boolean }) {
  const app = useScreenShellApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState(people[0]?.id ?? "");
  const [type, setType] = useState("annual");
  const [range, setRange] = useState<DateRange | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () => start(async () => {
    if (!range) { setError("Pick the dates first."); return; }
    const result = await addLeave({ memberId, type, from: format(range.start, "yyyy-MM-dd"), to: format(range.end, "yyyy-MM-dd"), note: note || undefined });
    if (!result.ok) { setError(result.error); return; }
    setOpen(false); setRange(null); setNote(""); setError("");
    router.refresh();
  });

  const trigger = (
    <Button variant="secondary" size="sm" style={{ width: "100%", marginTop: 8 }} onClick={() => setOpen(true)}>
      <Plane size={16} strokeWidth={1.75} aria-hidden="true" />Add leave
    </Button>
  );

  return (
    <>
      {app && canAdd ? <ScreenShellAppProvider value={{ ...app, sidebarTop: <>{app.sidebarTop}{trigger}</> }}>{children}</ScreenShellAppProvider> : children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Add leave" description="Record leave that was already approved by email.">
          <div className="tt-stack">
            <Select label="Person" options={people.map(p => ({ value: p.id, label: p.name }))} value={memberId} onValueChange={setMemberId} />
            <Select label="Type" options={types} value={type} onValueChange={setType} />
            <DateRangePicker label="Dates" value={range} onChange={setRange} weekStartsOn={1} presets={[]} />
            <Textarea label="Note" description="Optional" value={note} onChange={event => setNote(event.target.value)} error={error || undefined} />
            <div className="tt-row">
              <Button onClick={submit} loading={pending}>Add leave</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
