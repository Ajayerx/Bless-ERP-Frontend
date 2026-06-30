"use client";

import { Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { cn } from "@/lib/utils";

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  duration: 0.25,
};

function AppShell() {
  const location = useLocation();
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-app-bg">
      <Sidebar />
      <div
        className={cn(
          "transition-all duration-300",
          collapsed ? "ml-[72px]" : "ml-[260px]",
        )}
      >
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function AppLayout() {
  return (
    <SidebarProvider>
      <AppShell />
    </SidebarProvider>
  );
}
