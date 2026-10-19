// This can be executed via browser or page evaluate
const master = {
  meta: {
    fileName: "LINA_Monthly_Stock_OnHand_Oct_2026.xlsx",
    uploadedAt: new Date().toISOString()
  },
  items: [
    { key: "ITM001#B101", itemCode: "RAW-CAP-500", itemName: "Paracetamol 500mg Raw Material", batch: "B101", systemQty: 1000 },
    { key: "ITM002#B102", itemCode: "PKG-BOX-100", itemName: "Printed Cartons 10x10", batch: "B102", systemQty: 4500 },
    { key: "ITM003#B103", itemCode: "SOL-SYR-120", itemName: "Cough Syrup Liquid Base 120ml", batch: "B103", systemQty: 800 },
    { key: "ITM004#B104", itemCode: "CAP-GEL-001", itemName: "Gelatin Capsules Size 0 Empty", batch: "B104", systemQty: 25000 }
  ]
};

const session = {
  status: "draft",
  startDate: "2026-10-15",
  endDate: null,
  responsiblePersons: ["Janagan (Audit)", "Kavitha (Stores)"],
  counts: {
    "ITM001#B101": { physicalQty: 1000, variance: 0, countedBy: "Janagan (Audit)", remark: "Full verified" },
    "ITM002#B102": { physicalQty: 4450, variance: -50, countedBy: "Kavitha (Stores)", remark: "Shortage box" }
  },
  excludedKeys: []
};

const historyIndex = [
  {
    id: "hist-sep2026-demo",
    fileName: "LINA_Stock_OnHand_September_2026.xlsx",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
    status: "complete",
    itemCount: 42,
    countedCount: 42,
    mismatchCount: 3
  },
  {
    id: "hist-aug2026-demo",
    fileName: "LINA_Stock_OnHand_August_2026.xlsx",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    status: "complete",
    itemCount: 38,
    countedCount: 38,
    mismatchCount: 1
  }
];

window.localStorage.setItem("lina-stock-count::stock-master", JSON.stringify(master));
window.localStorage.setItem("lina-stock-count::count-session", JSON.stringify(session));
window.localStorage.setItem("lina-stock-count::history-index", JSON.stringify(historyIndex));
console.log("Seeded sample session and history!");
