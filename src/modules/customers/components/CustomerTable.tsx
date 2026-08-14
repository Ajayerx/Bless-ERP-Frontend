"use client";

import { Mail, Phone, Users } from "lucide-react";
import DataTable, { type Column } from "@/components/ui/DataTable";
import { Badge, Avatar, ListFilterBar } from "@/components/ui";
import { type Customer, type CustomerListResponse } from "@/services";
import { formatCurrency, cn } from "@/lib/utils";

const columns: Column<Customer>[] = [
  {
    key: "customer_name",
    header: "Customer",
    width: "w-[23%]",
    render: (c) => (
      <div className="flex items-center gap-3 min-w-0">
        {c.image ? (
          <img
            src={c.image.startsWith("http") ? c.image : `/api/method/frappe.utils.file_manager.get_file?name=${encodeURIComponent(c.image)}`}
            alt=""
            className="w-8 h-8 rounded-lg object-cover shrink-0"
          />
        ) : (
          <Avatar name={c.customer_name} size="sm" />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-heading truncate">{c.customer_name}</p>
          <p className="text-xs text-muted truncate">{c.customer_type}</p>
        </div>
      </div>
    ),
  },
  {
    key: "email_id",
    header: "Contact",
    width: "w-[19%]",
    title: (c) => `Contact: ${[c.email_id, c.mobile_no].filter(Boolean).join(" · ")}`,
    render: (c) => (
      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Mail size={12} className="shrink-0" />
          <span className="truncate">{c.email_id || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Phone size={12} className="shrink-0" />
          <span className="truncate">{c.mobile_no || "—"}</span>
        </div>
      </div>
    ),
  },
  {
    key: "customer_group",
    header: "Group",
    width: "w-[12%]",
    render: (c) => (
      <span className="text-sm text-muted">{c.customer_group || "—"}</span>
    ),
  },
  {
    key: "territory",
    header: "Territory",
    width: "w-[15%]",
    render: (c) => (
      <span className="text-sm text-muted">{c.territory || "—"}</span>
    ),
  },
  {
    key: "outstanding",
    header: "Outstanding",
    align: "right",
    width: "w-[16%]",
    title: (c) => `Outstanding: ${formatCurrency(c.outstanding)}`,
    render: (c) => (
      <span
        className={cn(
          "font-semibold tabular-nums",
          c.outstanding > 0 ? "text-heading" : "text-muted",
        )}
      >
        {c.outstanding > 0 ? formatCurrency(c.outstanding) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    width: "w-[11%]",
    title: (c) => `Status: ${c.status === "active" ? "Active" : "Inactive"}`,
    render: (c) => (
      <Badge variant={c.status === "active" ? "success" : "default"}>
        {c.status === "active" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
];

interface CustomerTableProps {
  data: CustomerListResponse | null;
  loading: boolean;
  search: string;
  onSearch: (q: string) => void;
  toolbarActions?: React.ReactNode;
  onRowClick?: (customer: Customer) => void;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  paginationMode?: "pages" | "loadMore";
  currentPageLength?: number;
  onPageLengthChange?: (size: number) => void;
  onLoadMore?: () => void;
}

export default function CustomerTable({
  data,
  loading,
  search,
  onSearch,
  toolbarActions,
  onRowClick,
  selectable,
  selectedKeys,
  onSelectionChange,
  paginationMode = "loadMore",
  currentPageLength,
  onPageLengthChange,
  onLoadMore,
}: CustomerTableProps) {
  return (
    <div className="space-y-6">
      {data && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Users size={16} />
          <span>
            <strong className="text-heading">{data.total}</strong> total
            customers
          </span>
        </div>
      )}

      <ListFilterBar
        controls={{
          search: {
            value: search,
            onChange: onSearch,
            placeholder: "Search customers...",
            width: "w-56",
          },
        }}
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(c) => c.name}
        loading={loading}
        total={data?.total}
        pageSize={currentPageLength ?? 20}
        onRowClick={onRowClick}
        toolbarActions={toolbarActions}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        paginationMode={paginationMode}
        currentPageLength={currentPageLength}
        onPageLengthChange={onPageLengthChange}
        onLoadMore={onLoadMore}
      />
    </div>
  );
}
