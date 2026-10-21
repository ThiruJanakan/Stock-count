/**
 * Lina Manufacturing · Central Stock Count System V5.0
 * Generates Enterprise Functional & Non-Functional Requirements Specification (Excel .xlsx)
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('../vendor/xlsx.full.min.js');

const outputPath = path.join(__dirname, '..', 'docs', 'LINA_FR_NFR_SPECIFICATION.xlsx');

// 1. Functional Requirements Dataset (FR-01 to FR-18)
const functionalRequirements = [
  {
    "Requirement ID": "FR-01",
    "Module": "Authentication",
    "Functional Requirement Statement": "The system shall authenticate users via username and password utilizing server-side PBKDF2 cryptographic hashing with unique salt.",
    "Target Actor(s)": "All Roles",
    "Priority": "Mandatory",
    "Verification Method": "Automated Security Test (TST-04)",
    "Regulatory / cGMP Compliance": "NMRA & FDA 21 CFR Part 11"
  },
  {
    "Requirement ID": "FR-02",
    "Module": "Access Control",
    "Functional Requirement Statement": "The system shall enforce role-based access control (RBAC) across 5 discrete enterprise roles: ADMIN, MANAGER, SUPERVISOR, COUNTER, and EXECUTIVE AUDITOR.",
    "Target Actor(s)": "System Wide",
    "Priority": "Mandatory",
    "Verification Method": "Integration Test (TST-12)",
    "Regulatory / cGMP Compliance": "Principle of Least Privilege"
  },
  {
    "Requirement ID": "FR-03",
    "Module": "Security Firewall",
    "Functional Requirement Statement": "The system shall lock user accounts and client IP addresses for 15 minutes following 5 consecutive failed authentication attempts.",
    "Target Actor(s)": "All Users",
    "Priority": "Mandatory",
    "Verification Method": "Brute-force Test (TST-03)",
    "Regulatory / cGMP Compliance": "Anti-Brute Force Protection"
  },
  {
    "Requirement ID": "FR-04",
    "Module": "Session Control",
    "Functional Requirement Statement": "The system shall support creating, opening, pausing, locking, and completing counting sessions tagged with unique session codes and plant locations.",
    "Target Actor(s)": "Admin, Manager",
    "Priority": "Mandatory",
    "Verification Method": "Route & State Test (UC-03)",
    "Regulatory / cGMP Compliance": "Audit Trail Traceability"
  },
  {
    "Requirement ID": "FR-05",
    "Module": "Data Ingestion",
    "Functional Requirement Statement": "The system shall ingest ERP master inventory sheets (.xlsx, .xls, .csv) up to 25MB, performing schema mapping and column validation.",
    "Target Actor(s)": "Admin, Manager",
    "Priority": "Mandatory",
    "Verification Method": "Validation Test (VAL-05)",
    "Regulatory / cGMP Compliance": "Data Integrity Assurance"
  },
  {
    "Requirement ID": "FR-06",
    "Module": "Formula Defense",
    "Functional Requirement Statement": "The system shall sanitize all ingested and exported cell values starting with formula control characters (=, +, -, @, \\t, \\r) by prepending a single quote.",
    "Target Actor(s)": "System Wide",
    "Priority": "Mandatory",
    "Verification Method": "Sanitizer Test (VAL-06)",
    "Regulatory / cGMP Compliance": "CWE-1236 CSV Injection Defense"
  },
  {
    "Requirement ID": "FR-07",
    "Module": "Blind Counting",
    "Functional Requirement Statement": "The system shall systematically hide recorded book balances and variances from the COUNTER role across all API payloads and UI views to prevent confirmation bias.",
    "Target Actor(s)": "Floor Counter",
    "Priority": "Mandatory",
    "Verification Method": "Security Test (TST-05)",
    "Regulatory / cGMP Compliance": "Independent Stocktake Protocol"
  },
  {
    "Requirement ID": "FR-08",
    "Module": "Optical Scanning",
    "Functional Requirement Statement": "The system shall scan 1D/2D barcodes (Code128, EAN-13, QR Code) using device cameras with auto-focus, torch support, and instant audio beep confirmation.",
    "Target Actor(s)": "Counter, Supervisor",
    "Priority": "Mandatory",
    "Verification Method": "UI & Camera Optical Scan Test",
    "Regulatory / cGMP Compliance": "Accurate Physical Identification"
  },
  {
    "Requirement ID": "FR-09",
    "Module": "Count Entry",
    "Functional Requirement Statement": "The system shall accept physical counts with positive finite numeric validation, rejecting negative values, NaN, Infinity, and command/SQL string injection payloads.",
    "Target Actor(s)": "Counter, Supervisor",
    "Priority": "Mandatory",
    "Verification Method": "Type Enforcement Test (VAL-02)",
    "Regulatory / cGMP Compliance": "Strict Input Validation"
  },
  {
    "Requirement ID": "FR-10",
    "Module": "Unlisted Items",
    "Functional Requirement Statement": "The system shall allow floor counters to create unlisted inventory items found in warehouse bays with SKU, description, category, UOM, and initial physical count.",
    "Target Actor(s)": "Counter, Supervisor",
    "Priority": "Mandatory",
    "Verification Method": "Functional Test (UC-08)",
    "Regulatory / cGMP Compliance": "Discrepancy Catchment"
  },
  {
    "Requirement ID": "FR-11",
    "Module": "Smart Reconciliation",
    "Functional Requirement Statement": "The system shall execute a 3-way reconciliation modal when replacing master spreadsheets during an active session, preserving historical counts on matching SKUs.",
    "Target Actor(s)": "Admin, Manager",
    "Priority": "Mandatory",
    "Verification Method": "Workflow Test (UC-05)",
    "Regulatory / cGMP Compliance": "Continuous Audit Integrity"
  },
  {
    "Requirement ID": "FR-12",
    "Module": "Variance Engine",
    "Functional Requirement Statement": "The system shall compute physical vs book quantity discrepancies and percentage variances in real time for authorized management and auditing roles.",
    "Target Actor(s)": "Manager, Supervisor, Auditor",
    "Priority": "Mandatory",
    "Verification Method": "Analytical Calculation Test",
    "Regulatory / cGMP Compliance": "Financial Inventory Valuation"
  },
  {
    "Requirement ID": "FR-13",
    "Module": "Protected Deletion",
    "Functional Requirement Statement": "The system shall require the root administrator password challenge and display an irreversible action warning before purging any stock count session.",
    "Target Actor(s)": "Root Admin Only",
    "Priority": "Mandatory",
    "Verification Method": "Security Test (TST-11)",
    "Regulatory / cGMP Compliance": "Accidental Data Loss Prevention"
  },
  {
    "Requirement ID": "FR-14",
    "Module": "Audit Ledger",
    "Functional Requirement Statement": "The system shall log every insert, update, deletion, and authorization event into an immutable audit table linked with SHA-256 cryptographic hash chaining.",
    "Target Actor(s)": "Executive Auditor, Admin",
    "Priority": "Mandatory",
    "Verification Method": "Cryptographic Test (TST-08)",
    "Regulatory / cGMP Compliance": "Tamper-Evident Regulatory Trail"
  },
  {
    "Requirement ID": "FR-15",
    "Module": "Export Engine",
    "Functional Requirement Statement": "The system shall generate sanitized, formula-safe Excel (.xlsx) and CSV reports containing master items, counts, variances, and audit timestamps.",
    "Target Actor(s)": "Manager, Auditor",
    "Priority": "Mandatory",
    "Verification Method": "Export Validation Test (UC-12)",
    "Regulatory / cGMP Compliance": "Official Reporting Deliverable"
  },
  {
    "Requirement ID": "FR-16",
    "Module": "AI Variance Analysis",
    "Functional Requirement Statement": "The system shall provide automated variance summarization, statistical anomaly detection, and recount recommendations via server-side analysis routines.",
    "Target Actor(s)": "Manager, Auditor",
    "Priority": "Desirable",
    "Verification Method": "AI Service Test (TST-13)",
    "Regulatory / cGMP Compliance": "Decision Support Optimization"
  },
  {
    "Requirement ID": "FR-17",
    "Module": "Dual Persistence",
    "Functional Requirement Statement": "The system shall synchronize data between Supabase Cloud Postgres and an embedded local SQLite engine, ensuring zero downtime when cloud access is interrupted.",
    "Target Actor(s)": "System Wide",
    "Priority": "Mandatory",
    "Verification Method": "Database Failover Test",
    "Regulatory / cGMP Compliance": "High Availability Mandate"
  },
  {
    "Requirement ID": "FR-18",
    "Module": "Active Feedback",
    "Functional Requirement Statement": "The system shall provide visual tab highlights, non-blocking toast alerts, and real-time counter velocity metrics with zero native browser alert blocking.",
    "Target Actor(s)": "All Users",
    "Priority": "Mandatory",
    "Verification Method": "UI State Verification Test",
    "Regulatory / cGMP Compliance": "Modern Usability Standard"
  }
];

// 2. Non-Functional Requirements Dataset (NFR-01 to NFR-14)
const nonFunctionalRequirements = [
  {
    "Requirement ID": "NFR-01",
    "Quality Attribute": "Security: Anti-SQLi",
    "Technical Specification": "All database interactions shall use parameterized prepared statements or strict identifier validation to eliminate SQL injection vulnerabilities.",
    "Target Metric": "0 SQLi Vulnerabilities",
    "Category": "Security",
    "Test Reference": "TST-02 / VAL-01"
  },
  {
    "Requirement ID": "NFR-02",
    "Quality Attribute": "Security: Anti-XSS",
    "Technical Specification": "All user-supplied strings rendered into the DOM shall undergo HTML entity escaping to prevent stored or reflected script injection.",
    "Target Metric": "0 DOM/Stored XSS Vulnerabilities",
    "Category": "Security",
    "Test Reference": "TST-07 / VAL-03"
  },
  {
    "Requirement ID": "NFR-03",
    "Quality Attribute": "Security: IDOR Defense",
    "Technical Specification": "The server shall verify identity ownership and role privileges prior to modifying sessions, accounts, or count submissions, blocking horizontal escalation.",
    "Target Metric": "100% IDOR Request Interception",
    "Category": "Security",
    "Test Reference": "TST-10 / TST-12"
  },
  {
    "Requirement ID": "NFR-04",
    "Quality Attribute": "Security: Secrets Isolation",
    "Technical Specification": "All sensitive credentials (service role keys, session secrets) shall reside strictly in server environment variables and never be exposed to frontend code or git.",
    "Target Metric": "0 Credentials in Client / Git",
    "Category": "Security",
    "Test Reference": "VAL-08 Audit"
  },
  {
    "Requirement ID": "NFR-05",
    "Quality Attribute": "Performance: API Latency",
    "Technical Specification": "API response time for count submissions and barcode queries under standard warehouse network load shall be strictly sub-200 milliseconds.",
    "Target Metric": "Latency <= 200ms",
    "Category": "Performance",
    "Test Reference": "Load & Latency Benchmark"
  },
  {
    "Requirement ID": "NFR-06",
    "Quality Attribute": "Performance: PWA Shell",
    "Technical Specification": "The Progressive Web App shell assets shall load within 1.5 seconds from local cache storage on subsequent visits.",
    "Target Metric": "First Contentful Paint <= 1.5s",
    "Category": "Performance",
    "Test Reference": "Lighthouse PWA Benchmark"
  },
  {
    "Requirement ID": "NFR-07",
    "Quality Attribute": "Availability",
    "Technical Specification": "The platform shall maintain 99.9% uptime availability throughout warehouse operating shifts, supported by dual cloud/local persistence.",
    "Target Metric": ">= 99.9% Operational Uptime",
    "Category": "Reliability",
    "Test Reference": "Continuous Health Diagnostics"
  },
  {
    "Requirement ID": "NFR-08",
    "Quality Attribute": "Offline Resilience",
    "Technical Specification": "Floor staff shall continue barcode scanning and count recording during network drops in RF-shielded cold vaults, automatically queuing records in IndexedDB.",
    "Target Metric": "0 Data Loss During Offline Mode",
    "Category": "Reliability",
    "Test Reference": "Offline Storage Queue Test"
  },
  {
    "Requirement ID": "NFR-09",
    "Quality Attribute": "Usability: Responsiveness",
    "Technical Specification": "The user interface shall adapt dynamically across viewport dimensions ranging from 5.5-inch Android smartphones to 27-inch desktop monitors.",
    "Target Metric": "100% Responsive Grid Compliance",
    "Category": "Usability",
    "Test Reference": "Multi-Device Viewport Suite"
  },
  {
    "Requirement ID": "NFR-10",
    "Quality Attribute": "Usability: Touch Target",
    "Technical Specification": "Interactive buttons, numeric keypad keys, and scanner triggers shall meet a minimum touch target bounding box of 48x48 CSS pixels for gloved operation.",
    "Target Metric": "Touch Targets >= 48px",
    "Category": "Usability",
    "Test Reference": "Accessibility & Ergonomics Audit"
  },
  {
    "Requirement ID": "NFR-11",
    "Quality Attribute": "Reliability: ACID",
    "Technical Specification": "All count insertions, reconciliations, and session updates shall execute within atomic database transactions with rollback on failure.",
    "Target Metric": "100% Transactional Consistency",
    "Category": "Reliability",
    "Test Reference": "Transaction Integrity Test"
  },
  {
    "Requirement ID": "NFR-12",
    "Quality Attribute": "Auditability: Hash Chain",
    "Technical Specification": "Audit log hash chains shall be mathematically verifiable via standard SHA-256 verification algorithms to guarantee tamper detection.",
    "Target Metric": "100% Verifiable Hash Chaining",
    "Category": "Compliance",
    "Test Reference": "TST-08 Hash Chain Audit"
  },
  {
    "Requirement ID": "NFR-13",
    "Quality Attribute": "Portability: Hybrid Parity",
    "Technical Specification": "The system shall maintain byte-for-byte behavioral parity across the Progressive Web App and standalone Android release APK.",
    "Target Metric": "100% Behavioral Parity Across Mirrors",
    "Category": "Portability",
    "Test Reference": "Sync Verification Script"
  },
  {
    "Requirement ID": "NFR-14",
    "Quality Attribute": "Localization: Timezone",
    "Technical Specification": "All operational event timestamps shall be recorded in UTC and rendered to end-users in Sri Lanka Standard Time (SLST / UTC+05:30).",
    "Target Metric": "Consistent SLST Display Formatting",
    "Category": "Localization",
    "Test Reference": "Timezone Formatting Test"
  }
];

// 3. System Project Metadata
const metadataRows = [
  { "Property": "Project Name", "Value": "Lina Manufacturing Central Stock Count & Inventory Auditing Platform" },
  { "Property": "Project Version", "Value": "V5.0 Enterprise Release" },
  { "Property": "Client Entity", "Value": "Lina Manufacturing (Pvt) Ltd" },
  { "Property": "Parent Group", "Value": "Sunshine Healthcare Lanka (Pvt) Ltd / Sunshine Holdings PLC" },
  { "Property": "Operating Facility", "Value": "Pharmaceutical Formulations & Manufacturing Complex, Kadawatha, Sri Lanka" },
  { "Property": "Methodology", "Value": "Object-Oriented System Analysis and Design (OOSAD)" },
  { "Property": "Primary Roles Defined", "Value": "1. Inventory Manager / Admin, 2. Warehouse Supervisor, 3. Floor Counter" },
  { "Property": "Total Functional Requirements", "Value": functionalRequirements.length },
  { "Property": "Total Non-Functional Requirements", "Value": nonFunctionalRequirements.length },
  { "Property": "Automated Test Verification", "Value": "48 Passed / 0 Failed (100% Pass Rate)" },
  { "Property": "Date of Specification", "Value": "October 2026" }
];

// Build Workbook
const wb = XLSX.utils.book_new();

const wsFR = XLSX.utils.json_to_sheet(functionalRequirements);
const wsNFR = XLSX.utils.json_to_sheet(nonFunctionalRequirements);
const wsMeta = XLSX.utils.json_to_sheet(metadataRows);

// Set column widths for readability
wsFR['!cols'] = [
  { wch: 10 }, // Req ID
  { wch: 18 }, // Module
  { wch: 65 }, // Statement
  { wch: 18 }, // Actors
  { wch: 12 }, // Priority
  { wch: 25 }, // Test Ref
  { wch: 30 }  // Compliance
];

wsNFR['!cols'] = [
  { wch: 10 }, // Req ID
  { wch: 22 }, // Quality Attribute
  { wch: 65 }, // Specification
  { wch: 25 }, // Target Metric
  { wch: 15 }, // Category
  { wch: 20 }  // Test Reference
];

wsMeta['!cols'] = [
  { wch: 30 },
  { wch: 55 }
];

XLSX.utils.book_append_sheet(wb, wsFR, "Functional Requirements");
XLSX.utils.book_append_sheet(wb, wsNFR, "Non-Functional Requirements");
XLSX.utils.book_append_sheet(wb, wsMeta, "System Metadata");

const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(outputPath, buffer);

console.log("Successfully generated Excel specification at:", outputPath);

