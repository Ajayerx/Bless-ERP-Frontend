"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui";
import { Button } from "@/components/ui";
import { invoiceService } from "../services";

interface Props {
  open: boolean;
  customer: string;
  programs: string[];
  onClose: () => void;
}

/**
 * Mirrors ERPNext's "Select Loyalty Program" dialog: shown only when more
 * than one loyalty program is applicable to the customer. Its single effect
 * is persisting the chosen program on the Customer doc via set_value — the
 * invoice form's loyalty_program field is deliberately left untouched.
 */
export default function LoyaltyProgramDialog({
  open,
  customer,
  programs,
  onClose,
}: Props) {
  const [selected, setSelected] = useState(programs[0] ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(programs[0] ?? "");
    }
  }, [open, programs]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await invoiceService.setValue(
        "Customer",
        customer,
        "loyalty_program",
        selected,
      );
    } catch {
      // non-blocking: closing without persisting is acceptable
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Loyalty Program</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <label className="text-sm font-medium text-heading block mb-1.5">
            Loyalty Program
          </label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full px-3 py-2 bg-gray-50 border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {programs.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving || !selected}>
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              "Set Loyalty Program"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
