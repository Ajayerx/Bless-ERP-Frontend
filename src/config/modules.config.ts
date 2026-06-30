export interface Module {
  id: string
  label: string
  description: string
  status: "active" | "coming_soon" | "stub"
  icon?: string
}

export const AVAILABLE_MODULES: Module[] = [
  { id: "blesspos", label: "BlessPOS", description: "Point of Sale for retail and restaurants", status: "coming_soon" },
  { id: "blesshipping", label: "BlessShipping", description: "Logistics and delivery management", status: "coming_soon" },
  { id: "blessupply", label: "BlessSupply", description: "Route sales and wholesale distribution", status: "coming_soon" },
  { id: "blesseats", label: "BlessEats", description: "Restaurant and food delivery operations", status: "coming_soon" },
]
