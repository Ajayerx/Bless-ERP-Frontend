"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Button, SelectionBar, BulkDeleteModal, type BulkDeleteItem } from "@/components/ui";
import { useCustomers } from "../hooks/useCustomers";
import CustomerTable from "../components/CustomerTable";
import QuickAddCustomerModal from "../components/QuickAddCustomerModal";
import CustomerImportModal from "../components/CustomerImportModal";
import { customerService } from "@/services";

export default function Customers() {
  const navigate = useNavigate();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteItems, setDeleteItems] = useState<BulkDeleteItem[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { data, loading, error, search, setSearch, page, setPage, refetch } =
    useCustomers({ pageSize: 10 });

  useEffect(() => {
    setSelectedKeys(new Set());
  }, [search, page]);

  const handleExport = async () => {
    try {
      await customerService.exportToCsv({ search: search || undefined });
    } catch {
      // Export errors are non-critical (browser download)
    }
  };

  const handleBulkDelete = () => {
    if (!data || selectedKeys.size === 0) return;
    const items: BulkDeleteItem[] = data.items
      .filter((c) => selectedKeys.has(c.name))
      .map((c) => ({ name: c.name, label: c.customer_name }));
    setDeleteItems(items);
    setShowDeleteModal(true);
  };

  const handleDeleteComplete = () => {
    setSelectedKeys(new Set());
    setDeleteItems([]);
    refetch();
  };

  return (
    <>
      <Topbar />
      <QuickAddCustomerModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
      />
      <CustomerImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onComplete={() => refetch()}
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

        <CustomerTable
          data={data}
          loading={loading}
          search={search}
          onSearch={setSearch}
          page={page}
          onPageChange={setPage}
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
