"use client";

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Button, SelectionBar, BulkDeleteModal, Tabs, TabsList, TabsTrigger, type BulkDeleteItem } from "@/components/ui";
import { customerService, type Customer, type CustomerListResponse } from "@/services";
import CustomerTable from "../components/CustomerTable";
import QuickAddCustomerModal from "../components/QuickAddCustomerModal";
import CustomerImportModal from "../components/CustomerImportModal";

type StatusFilter = "all" | "active" | "disabled" | "frozen";

function statusToFilters(filter: StatusFilter): unknown[] {
  switch (filter) {
    case "active": return [["disabled", "=", 0]]
    case "disabled": return [["disabled", "=", 1]]
    case "frozen": return [["is_frozen", "=", 1]]
    default: return []
  }
}

export default function Customers() {
  const navigate = useNavigate();
  const [data, setData] = useState<CustomerListResponse | null>(null);
  const [allItems, setAllItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [start, setStart] = useState(0);
  const [pageLength, setPageLength] = useState(20);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteItems, setDeleteItems] = useState<BulkDeleteItem[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchData = useCallback(async (append = false) => {
    setLoading(true);
    setError("");
    try {
      const filters = statusToFilters(statusFilter);
      const result = await customerService.list({
        search: search || undefined,
        start: append ? start : 0,
        pageLength,
        filters,
      });
      setData(result);
      setAllItems((prev) => (append ? [...prev, ...result.items] : result.items));
      if (!append) setStart(pageLength);
      else setStart((s) => s + pageLength);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, [search, start, pageLength, statusFilter]);

  useEffect(() => {
    setStart(0);
    setAllItems([]);
    fetchData(false);
  }, [search, statusFilter, pageLength]);

  const handleLoadMore = () => {
    fetchData(true);
  };

  const handlePageLengthChange = (size: number) => {
    setPageLength(size);
  };

  const handleExport = async () => {
    try {
      await customerService.exportToCsv({ search: search || undefined });
    } catch {
      // Export errors are non-critical (browser download)
    }
  };

  const handleBulkDelete = () => {
    if (!data || selectedKeys.size === 0) return;
    const items: BulkDeleteItem[] = allItems
      .filter((c) => selectedKeys.has(c.name))
      .map((c) => ({ name: c.name, label: c.customer_name }));
    setDeleteItems(items);
    setShowDeleteModal(true);
  };

  const handleDeleteComplete = () => {
    setSelectedKeys(new Set());
    setDeleteItems([]);
    setStart(0);
    fetchData(false);
  };

  // Build items to pass to table — use allItems when in loadMore mode
  const tableData = data ? { ...data, items: allItems } : null;

  return (
    <>
      <Topbar />
      <QuickAddCustomerModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onCreated={(customer) => {
          setAllItems((prev) => [customer, ...prev]);
          setData((prev) => prev ? { ...prev, total: prev.total + 1 } : prev);
        }}
      />
      <CustomerImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onComplete={() => { setStart(0); fetchData(false); }}
      />
      <BulkDeleteModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteItems([]); }}
        onComplete={handleDeleteComplete}
        items={deleteItems}
        onDelete={(name) => customerService.delete(name)}
        doctypeLabel="Customer"
      />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Customers</h1>
            <p className="text-sm text-muted mt-1">
              Manage your customer directory.
            </p>
          </div>
          <Button onClick={() => setShowQuickAdd(true)}>
            <Plus size={16} />
            Add Customer
          </Button>
        </div>

        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
            {error}
          </p>
        )}

        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="disabled">Disabled</TabsTrigger>
            <TabsTrigger value="frozen">Frozen</TabsTrigger>
          </TabsList>
        </Tabs>

        <CustomerTable
          data={tableData}
          loading={loading}
          search={search}
          onSearch={setSearch}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          toolbarActions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleExport}>
                Export
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
                Import
              </Button>
            </div>
          }
          onRowClick={(customer) => navigate(`/customers/${customer.name}`)}
          paginationMode="loadMore"
          currentPageLength={pageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
        />
      </motion.div>

      <SelectionBar
        count={selectedKeys.size}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedKeys(new Set())}
        label="customer"
      />
    </>
  );
}
