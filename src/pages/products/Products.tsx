"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Topbar from "@/components/layout/Topbar";
import { productService } from "@/services";
import type { ProductListResponse } from "@/services/products.service";
import ProductTable from "@/modules/products/ProductTable";
import type { ProductFilter } from "@/modules/products/ProductTable";

export default function Products() {
  const navigate = useNavigate();
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<ProductFilter>("All");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await productService.list({ search, page, pageSize: 10, filter: activeFilter });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, [search, page, activeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <ProductTable
          items={data?.items ?? []}
          total={data?.total}
          loading={loading}
          search={search}
          onSearch={(q) => { setSearch(q); setPage(1); }}
          page={page}
          onPageChange={setPage}
          activeFilter={activeFilter}
          onFilterChange={(f) => { setActiveFilter(f); setPage(1); }}
          onRowClick={(p) => navigate(`/products/${p.id}`)}
          onNewProduct={() => navigate("/products/new")}
        />
      </motion.div>
    </>
  );
}
