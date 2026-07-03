"use client";

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Button } from "@/components/ui";
import { useCustomers } from "../hooks/useCustomers";
import CustomerTable from "../components/CustomerTable";

export default function Customers() {
  const navigate = useNavigate();
  const { data, loading, error, search, setSearch, page, setPage } =
    useCustomers({ pageSize: 10 });

  return (
    <>
      <Topbar />
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
          <Button onClick={() => navigate("/customers/new")}>
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
          toolbarActions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm">
                Export
              </Button>
              <Button variant="secondary" size="sm">
                Import
              </Button>
            </div>
          }
          onRowClick={(customer) => navigate(`/customers/${customer.name}`)}
        />
      </motion.div>
    </>
  );
}
