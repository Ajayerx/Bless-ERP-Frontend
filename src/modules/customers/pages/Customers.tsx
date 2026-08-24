"use client";

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Download, Trash2, UserRound, Tag } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import {
  Button,
  Modal,
  ModalFooter,
  Input,
  ListBulkActions,
  BulkDeleteModal,
  FilterPills,
  LinkSearchField,
  useMessageDialog,
  messageFromError,
  type BulkDeleteItem,
} from "@/components/ui";
import { customerService, type Customer, type CustomerListResponse } from "@/services";
import { CUSTOMER_EXPORT_FIELDS } from "../services";
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
  const { showMessage } = useMessageDialog();
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
  const [actingToolbar, setActingToolbar] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignee, setAssignee] = useState("");

  // Tags dialog
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"CSV" | "Excel">("CSV");
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(() =>
    JSON.parse(JSON.stringify(CUSTOMER_EXPORT_FIELDS))
  );

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

  const handleBulkAssign = async (remove = false) => {
    const names = Array.from(selectedKeys);
    setAssignOpen(false);
    setActingToolbar(true);
    try {
      if (remove) {
        await customerService.removeAssignment(names);
      } else if (!assignee.trim()) {
        throw new Error("Please enter an assignee.");
      } else {
        await customerService.assignTo(names, assignee.trim());
      }
      showMessage(remove ? "Assignment cleared." : `Assigned ${names.length} customer${names.length === 1 ? "" : "s"} to ${assignee.trim()}.`);
      setAssignee("");
    } catch (err) {
      showMessage(messageFromError(err, "Assignment failed."));
    } finally {
      setActingToolbar(false);
    }
  };

  const handleBulkAddTags = async () => {
    const names = Array.from(selectedKeys);
    setTagsOpen(false);
    setActingToolbar(true);
    try {
      const labels = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      if (labels.length === 0) throw new Error("Please enter at least one tag.");
      await customerService.addTags(names, labels);
      showMessage(`Added ${labels.length} tag${labels.length === 1 ? "" : "s"} to ${names.length} customer${names.length === 1 ? "" : "s"}.`);
      setTagsInput("");
    } catch (err) {
      showMessage(messageFromError(err, "Adding tags failed."));
    } finally {
      setActingToolbar(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const exportScopeFilters = (): unknown[] | undefined => {
    if (selectedKeys.size > 0) return [["name", "in", Array.from(selectedKeys)]];
    const filters: unknown[] = statusToFilters(statusFilter);
    if (search.trim()) filters.push(["customer_name", "like", `%${search.trim()}%`]);
    return filters.length > 0 ? filters : undefined;
  };

  const toggleExportField = (group: string, field: string) => {
    setExportFields((prev) => {
      const groupFields = prev[group] ?? [];
      const has = groupFields.includes(field);
      return {
        ...prev,
        [group]: has ? groupFields.filter((f) => f !== field) : [...groupFields, field],
      };
    });
  };

  const resetExportFields = () => {
    setExportFields(JSON.parse(JSON.stringify(CUSTOMER_EXPORT_FIELDS)));
  };

  const handleExport = async () => {
    setActingToolbar(true);
    try {
      const selectedGroups = Object.fromEntries(
        Object.entries(exportFields).filter(([, fields]) => fields.length > 0)
      );
      if (Object.keys(selectedGroups).length === 0) {
        throw new Error("Select at least one column to export.");
      }
      const blob = await customerService.exportRecords({
        fileType: exportFormat,
        recordMode: "by_filter",
        fields: selectedGroups,
        filters: exportScopeFilters(),
      });
      downloadBlob(blob, `Customers.${exportFormat === "CSV" ? "csv" : "xlsx"}`);
      setExportOpen(false);
      showMessage(`Exported ${selectedKeys.size > 0 ? selectedKeys.size : "filtered"} customers.`);
    } catch (err) {
      showMessage(messageFromError(err, "Export failed."));
    } finally {
      setActingToolbar(false);
    }
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

      {/* Assign dialog */}
      <Modal
        open={assignOpen}
        onClose={() => {
          setAssignOpen(false);
          setAssignee("");
        }}
        title="Assign Customers"
        description={`Assign ${selectedKeys.size} selected customer${selectedKeys.size === 1 ? "" : "s"} to a user, or clear the current assignment.`}
      >
        <LinkSearchField
          value={assignee || undefined}
          onChange={(v) => setAssignee(v ?? "")}
          searchFn={(query) =>
            customerService.searchAssignableUsers(query).then((users) => ({
              items: users.map((u) => ({ value: u.value, label: u.label, description: u.description })),
            }))
          }
          placeholder="Type to search users..."
          required
          className="w-full"
          clearIconMode="hover"
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button
            variant="ghost"
            className="text-danger-600 border border-danger-100 bg-danger-50 hover:bg-danger-100"
            onClick={() => handleBulkAssign(true)}
            loading={actingToolbar}
          >
            <UserRound size={14} /> Remove
          </Button>
          <Button onClick={() => handleBulkAssign(false)} loading={actingToolbar}>
            <UserRound size={14} /> Assign
          </Button>
        </ModalFooter>
      </Modal>

      {/* Tags dialog */}
      <Modal
        open={tagsOpen}
        onClose={() => {
          setTagsOpen(false);
          setTagsInput("");
        }}
        title="Add Tags"
        description={`Add tags to ${selectedKeys.size} selected customer${selectedKeys.size === 1 ? "" : "s"}. Separate tags with commas.`}
      >
        <Input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. Audit, Q1-Review, Priority"
          className="w-full"
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setTagsOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkAddTags} loading={actingToolbar}>
            <Tag size={14} /> Add Tags
          </Button>
        </ModalFooter>
      </Modal>

      {/* Export dialog */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Customers"
        description={`Export ${selectedKeys.size > 0 ? `${selectedKeys.size} selected` : "all filtered"} customers.`}
      >
        <label className="block text-xs font-semibold text-muted mb-1.5">Format</label>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as "CSV" | "Excel")}
          className="w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          <option value="CSV">CSV (.csv)</option>
          <option value="Excel">Excel (.xlsx)</option>
        </select>
        <div className="mt-4 flex items-center justify-between">
          <label className="text-xs font-semibold text-muted mb-1.5 block">Columns</label>
          <button
            type="button"
            onClick={resetExportFields}
            className="text-xs text-primary-600 hover:underline"
          >
            Reset to all
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto pr-1 space-y-3 mt-1">
          {Object.entries(CUSTOMER_EXPORT_FIELDS).map(([group, fields]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-body mb-1.5">
                {group === "Customer" ? "Customer" : `${group} (child table)`}
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {fields.map((field) => {
                  const checked = (exportFields[group] ?? []).includes(field);
                  return (
                    <label key={field} className="flex items-center gap-2 text-sm text-body cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExportField(group, field)}
                        className="accent-primary-600"
                      />
                      <span className="capitalize">{field.replace(/_/g, " ")}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button onClick={handleExport} loading={actingToolbar}>
            <Download size={14} /> Export
          </Button>
        </ModalFooter>
      </Modal>

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

        <FilterPills
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
            { value: "frozen", label: "Frozen" },
          ]}
        />

        <CustomerTable
          data={tableData}
          loading={loading}
          search={search}
          onSearch={setSearch}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          toolbarActions={
            <ListBulkActions
              count={selectedKeys.size}
              noun="customers"
              fallback={
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
                    <Download size={13} /> Export
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
                    Import
                  </Button>
                </div>
              }
              items={[
                {
                  label: "Delete",
                  icon: <Trash2 size={14} />,
                  danger: true,
                  onClick: handleBulkDelete,
                },
                {
                  label: "Export",
                  icon: <Download size={14} />,
                  separatorBefore: true,
                  onClick: () => setExportOpen(true),
                },
                {
                  label: "Assign to…",
                  icon: <UserRound size={14} />,
                  onClick: () => setAssignOpen(true),
                },
                {
                  label: "Clear Assignment",
                  icon: <UserRound size={14} />,
                  onClick: () => handleBulkAssign(true),
                },
                {
                  label: "Add Tags",
                  icon: <Tag size={14} />,
                  onClick: () => setTagsOpen(true),
                },
              ]}
            />
          }
          onRowClick={(customer) => navigate(`/customers/${customer.name}`)}
          paginationMode="loadMore"
          currentPageLength={pageLength}
          onPageLengthChange={handlePageLengthChange}
          onLoadMore={handleLoadMore}
        />
      </motion.div>
    </>
  );
}