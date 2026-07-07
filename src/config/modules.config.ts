export interface Module {
  id: string
  label: string
  description: string
  status: "active" | "coming_soon" | "stub"
  icon: string
  color: string
  route?: string
}

export const AVAILABLE_MODULES: Module[] = [
  {
    id: "blesspos",
    label: "BlessPOS",
    description: "Point of Sale for retail and restaurants",
    status: "coming_soon",
    icon: "ShoppingCart",
    color: "#2563EB",
  },
  {
    id: "blesshipping",
    label: "BlessShipping",
    description: "Logistics and delivery management",
    status: "coming_soon",
    icon: "Truck",
    color: "#16A34A",
  },
  {
    id: "blessupply",
    label: "BlessSupply",
    description: "Route sales and wholesale distribution",
    status: "coming_soon",
    icon: "Package",
    color: "#F59E0B",
  },
  {
    id: "blesseats",
    label: "BlessEats",
    description: "Restaurant and food delivery operations",
    status: "coming_soon",
    icon: "ShoppingBag",
    color: "#7C3AED",
  },
]
