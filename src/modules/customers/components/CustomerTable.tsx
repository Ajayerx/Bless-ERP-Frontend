"use client";

import { Mail, Phone, Users } from "lucide-react";
import DataTable, { type Column } from "@/components/ui/DataTable";
import { Badge, Avatar } from "@/components/ui";
import { type Customer, type CustomerListResponse } from "@/services";
import { formatCurrency, cn } from "@/lib/utils";

const columns: Column<Customer>[] = [
  {
    key: "customer_name",
    header: "Customer",
    render: (c) => (
      <div className="flex items-center gap-3">
        {c.image ? (
          <img
            src={c.image.startsWith("http") ? c.image : `/api/method/frappe.utils.file_manager.get_file?name=${encodeURIComponent(c.image)}`}
            alt=""
            className="w-8 h-8 rounded-lg object-cover shrink-0"
          />
        ) : (
          <Avatar name={c.customer_name} size="sm" />
        )}
        <div>
          <p className="font-semibold text-heading">{c.customer_name}</p>
          <p className="text-xs text-muted">{c.customer_type}</p>
        </div>
      </div>
    ),
  },
  {
    key: "email_id",
    header: "Contact",
    hideOnMobile: true,
    render: (c) => (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Mail size={12} />
          {c.email_id || "—"}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Phone size={12} />
          {c.mobile_no || "—"}
        </div>
      </div>
    ),
  },
  {
    key: "customer_group",
    header: "Group",
    hideOnMobile: true,
    render: (c) => (
      <span className="text-sm text-muted">{c.customer_group || "—"}</span>
    ),
  },
  {
    key: "territory",
    header: "Territory",
    hideOnMobile: true,
    render: (c) => (
      <span className="text-sm text-muted">{c.territory || "—"}</span>
    ),
  },
  {
    key: "outstanding",
    header: "Outstanding",
    align: "right",
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

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        keyExtractor={(c) => c.name}
        searchable
        searchPlaceholder="Search customers..."
        searchQuery={search}
        onSearch={onSearch}
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
