/**
 * Lina Manufacturing · Central Stock Count System V5.0
 * Generates High-Resolution Use Case Diagram PNG with 3 Primary Roles
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputPath = path.join(__dirname, '..', 'docs', 'usecase_diagram.png');
const artifactPath = 'C:\\Users\\Janagan\\.gemini\\antigravity-ide\\brain\\b40aee0c-8ef4-47bf-9ab1-eab95434858e\\usecase_diagram.png';

async function main() {
  console.log('--- Generating Use Case Diagram PNG (3 Roles) ---');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lina Manufacturing · Use Case Diagram (3 Roles)</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 30px;
      background: #f8fafc;
      font-family: 'Segoe UI', -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .diagram-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      padding: 32px 40px;
      max-width: 1300px;
      width: 100%;
    }

    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .header-left h1 {
      margin: 0 0 6px 0;
      font-size: 20pt;
      color: #0369a1;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .header-left p {
      margin: 0;
      font-size: 10.5pt;
      color: #475569;
      font-weight: 500;
    }

    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #64748b;
      line-height: 1.4;
    }

    .legend-bar {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      padding: 10px 16px;
      background: #f1f5f9;
      border-radius: 8px;
      font-size: 9pt;
      color: #334155;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }

    .legend-badge {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .mermaid {
      display: flex;
      justify-content: center;
      background: #ffffff;
    }

    .mermaid svg {
      max-width: 100%;
      height: auto;
    }

    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="diagram-card" id="capture-target">
    <div class="header">
      <div class="header-left">
        <h1>LINA MANUFACTURING (PVT) LTD · KADAWATHA</h1>
        <p>Enterprise Stock Count & Inventory Auditing Platform V5.0 · Core Use Case Model</p>
      </div>
      <div class="header-right">
        <div><strong>Parent Group:</strong> Sunshine Healthcare Lanka</div>
        <div><strong>Framework:</strong> OOSAD Enterprise Standard</div>
        <div><strong>Classification:</strong> Confidential Engineering Artifact</div>
      </div>
    </div>

    <div class="legend-bar">
      <div class="legend-item"><span class="legend-badge" style="background:#0284c7;"></span> Role 1: Inventory Manager / Admin</div>
      <div class="legend-item"><span class="legend-badge" style="background:#059669;"></span> Role 2: Warehouse Supervisor</div>
      <div class="legend-item"><span class="legend-badge" style="background:#d97706;"></span> Role 3: Floor Counter</div>
    </div>

    <div class="mermaid">
flowchart LR
    %% Actors Definition
    subgraph Primary_Actors ["Enterprise User Roles"]
        admin["👤 INVENTORY MANAGER / ADMIN<br/>(System Configuration & Reconciliations)"]
        sup["👤 WAREHOUSE SUPERVISOR<br/>(Floor Coordination & Oversight)"]
        cnt["👤 FLOOR COUNTER<br/>(Blind Physical Counting & Barcode Scan)"]
    end

    %% System Boundary
    subgraph System_Boundary ["Lina Central Stock Count & Inventory Auditing System (V5.0)"]
        direction TB

        %% Common / Auth
        UC01(["UC-01: Authenticate with PBKDF2 & JWT Token"])

        %% Counter Workflows
        subgraph Floor_Operations ["Floor Counting Operations"]
            UC06(["UC-06: Optical Camera Barcode / QR Scan"])
            UC07(["UC-07: Submit Blind Physical Count<br/><i>(Expected Book Qty Hidden by Server)</i>"])
            UC08(["UC-08: Add Unlisted Item Found on Floor"])
            UC14(["UC-14: Queue Counts Offline in Cold Storage"])
        end

        %% Supervisor Workflows
        subgraph Supervisor_Supervision ["Supervisor & Floor Oversight"]
            UC03(["UC-03: Create & Initialize Stock Count Session"])
            UC15(["UC-15: Print Item Barcode Thermal Labels"])
            UC20(["UC-20: Monitor Live Bay Counting Velocity"])
        end

        %% Manager / Admin Workflows
        subgraph Admin_Governance ["Management, Auditing & Governance"]
            UC02(["UC-02: Manage User Accounts & RBAC Roles"])
            UC04(["UC-04: Ingest & Sanitize ERP Master Spreadsheet"])
            UC05(["UC-05: Smart Datasheet Replacement & 3-Way Reconcile"])
            UC09(["UC-09: Live Real-Time Variance & Financial Impact"])
            UC10(["UC-10: Generate AI Variance Summaries & Insights"])
            UC11(["UC-11: Password-Protected Session Purge"])
            UC12(["UC-12: Export Reconciled Reports (.xlsx / .csv)"])
            UC13(["UC-13: Verify Cryptographic Audit Hash Ledger"])
        end
    end

    %% Counter Associations
    cnt ===> UC01
    cnt ===> UC06
    cnt ===> UC07
    cnt ===> UC08
    cnt ===> UC14

    %% Supervisor Associations
    sup ===> UC01
    sup ===> UC03
    sup ===> UC06
    sup ===> UC07
    sup ===> UC08
    sup ===> UC09
    sup ===> UC15
    sup ===> UC20

    %% Manager / Admin Associations
    admin ===> UC01
    admin ===> UC02
    admin ===> UC03
    admin ===> UC04
    admin ===> UC05
    admin ===> UC09
    admin ===> UC10
    admin ===> UC11
    admin ===> UC12
    admin ===> UC13

    %% Include / Extend relationships
    UC07 -.->|&lt;&lt;include&gt;&gt;| UC01
    UC08 -.->|&lt;&lt;extend&gt;&gt;| UC07
    UC05 -.->|&lt;&lt;include&gt;&gt;| UC04
    UC11 -.->|&lt;&lt;include&gt;&gt;| UC01

    %% Styling
    classDef actorAdmin fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1,font-weight:bold;
    classDef actorSup fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#065f46,font-weight:bold;
    classDef actorCnt fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#92400e,font-weight:bold;
    classDef ucCommon fill:#f8fafc,stroke:#475569,stroke-width:1.5px,color:#0f172a,font-size:10pt;
    classDef ucFloor fill:#fffbeb,stroke:#b45309,stroke-width:1.5px,color:#78350f,font-size:10pt;
    classDef ucSup fill:#ecfdf5,stroke:#047857,stroke-width:1.5px,color:#064e3b,font-size:10pt;
    classDef ucAdmin fill:#f0f9ff,stroke:#0369a1,stroke-width:1.5px,color:#0c4a6e,font-size:10pt;

    class admin actorAdmin;
    class sup actorSup;
    class cnt actorCnt;
    class UC01 ucCommon;
    class UC06,UC07,UC08,UC14 ucFloor;
    class UC03,UC15,UC20 ucSup;
    class UC02,UC04,UC05,UC09,UC10,UC11,UC12,UC13 ucAdmin;
    </div>

    <div class="footer">
      <span>Security Engine: PBKDF2 + SHA-256 Chained Ledger + IDOR Firewall Active</span>
      <span>System Architecture: Hybrid PWA & Standalone Android APK · Dual Engine (Supabase + SQLite)</span>
    </div>
  </div>

  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      securityLevel: 'loose',
      fontFamily: 'Segoe UI, sans-serif'
    });
  </script>
</body>
</html>`;

  console.log('Launching headless browser for PNG rendering...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1100, deviceScaleFactor: 2 });

  await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for Mermaid SVG rendering
  await new Promise(r => setTimeout(r, 2000));

  const cardElement = await page.$('#capture-target');
  if (!cardElement) {
    throw new Error('Capture target element not found');
  }

  console.log(`Capturing high-resolution PNG to: ${outputPath}`);
  await cardElement.screenshot({
    path: outputPath,
    type: 'png'
  });

  await browser.close();

  // Copy to artifact directory
  try {
    fs.copyFileSync(outputPath, artifactPath);
    console.log(`Copied PNG to artifact path: ${artifactPath}`);
  } catch (e) {
    console.warn('Could not copy to artifact directory:', e.message);
  }

  const stats = fs.statSync(outputPath);
  console.log(`\n======================================================`);
  console.log(`✓ USE CASE DIAGRAM PNG GENERATION SUCCESSFUL`);
  console.log(`  File Path: ${outputPath}`);
  console.log(`  File Size: ${(stats.size / 1024).toFixed(1)} KB (${stats.size.toLocaleString()} bytes)`);
  console.log(`======================================================\n`);
}

main().catch(err => {
  console.error('Use case PNG generation failed:', err);
  process.exit(1);
});
