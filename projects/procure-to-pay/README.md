# Project 03: Procure-to-Pay (SAP S/4HANA MM–FI)

**Goal:** run one purchase end to end in company code IN10 (requisition → PO → goods receipt → three-way-matched invoice → F110 payment), configure the MM–FI integration behind it, and prove each control with a unit-test script.

Web version: [`index.html`](index.html) · Interactive: [`simulator.html`](simulator.html)

## Scenario (fictional)

| Object | Value |
|---|---|
| Company code / plant | IN10 / IN11 Pune |
| Purchasing org / group | IN10 / P01 |
| Vendor | 100001 Shakti Steel Suppliers, recon 211000, NT30, TDS 194Q |
| Material | RM-1001 HR Steel Coil 2 mm, ROH, valuation class 3000, price control V |
| PO | 4500000118: 10 MT × ₹58,000 = ₹5,80,000, tax code I8 (CGST 9% + SGST 9%) |

## Configuration workbook

| # | T-code | Object | IN10 value |
|---|---|---|---|
| 1 | OX10 / OX18 | Plant | IN11 → IN10 |
| 2 | OX09 | Storage location | RM01 |
| 3 | OX08 / OX01 / OX17 | Purchasing org | IN10 → IN10, IN11 |
| 4 | OME4 | Purchasing group | P01 |
| 5 | OMSY / MMPV | MM period | 2026/06, previous allowed |
| 6 | OX14 / OMWD | Valuation | Plant level, grouping code 0001 |
| 7 | OMSK / MM01 | Material | RM-1001, class 3000, V |
| 8 | OBYC | Account determination | BSX 131000 · WRX 219100 · PRD 512000 |
| 9 | FS00 / OB58 | New G/L, FSV | 171100, 512000; INS3 range 0000171100–0000171999 added |
| 10 | FTXP / OB40 | Tax code | I8 → 161000 (JIC, JIS) |
| 11 | WHT / OBWW | TDS | Type/code Q1, 194Q 0.1% → 222000 |
| 12 | BP | Vendor | 100001 with GR-based IV and double-invoice check |
| 13 | OBB8 | Payment terms | NT30 |
| 14 | OMR6 | Tolerances | PP ₹5,000 / 2% upper · DQ ₹0 |
| 15 | OMRDC / OMRM | Duplicate check | Company code + reference, error |
| 16 | OBA7 / FBN1 | Document types | WE → 50, RE → 51 (FY 2026); F110 uses KZ (15) |
| 17 | FI12 | House bank | HDFC1 / CUR01 → 171000 |
| 18 | FBZP | Payment program | Method T, doc type KZ, clearing 171100 |

## Document flow

| Date | T-code | Document | ₹ |
|---|---|---|---:|
| 01.09.2026 | ME51N | PR 0010000045 | |
| 03.09.2026 | ME21N | PO 4500000118 | 5,80,000 |
| 10.09.2026 | MIGO 101 | 5000000187 (6 MT): Dr 131000 / Cr 219100 | 3,48,000 |
| 18.09.2026 | MIGO 101 | 5000000188 (4 MT): Dr 131000 / Cr 219100 | 2,32,000 |
| 20.09.2026 | MIRO | 5100000093: Dr 219100 5,80,000, Dr 161000 1,04,400, Cr 222000 580, Cr 100001 6,83,820 | 6,84,400 |
| 20.10.2026 | F110 | 1500000123: Dr 100001 / Cr 171100 | 6,83,820 |

GR/IR at 30.09.2026 = ₹3,40,000 Cr (PO 4500000121, received, not invoiced), matching Project 01's trial balance.

## Unit tests

| ID | Scenario | Expected |
|---|---|---|
| P2P-01 | Happy path | Paid 1500000123, ₹6,83,820 |
| P2P-02 | GR 01.10.2026 before MMPV | Stopped: MM period |
| P2P-03 | GR 10.5 MT | Stopped: over-delivery (limit 10.2) |
| P2P-04 | Invoice before GR | Stopped: GR-based IV |
| P2P-05 | GR 6, invoice 10 | Posted, block R (DQ) |
| P2P-06 | ₹58,400/MT, price control V | Paid, ₹4,000 to 131000 |
| P2P-07 | ₹58,400/MT, price control S | Paid, ₹9,000 to 512000 |
| P2P-08 | ₹58,900/MT | Posted, block R (PP) |
| P2P-09 | Same, released in MRBR | Paid, ₹6,94,431 |
| P2P-10 | Duplicate reference | Stopped: already posted as 5100000071 |
| P2P-11 | Invoice 30.09 | Posted, not due in run of 20.10 |
| P2P-12 | Posting date 31.08.2026 | Stopped: OB52 period 005 |

## Data

`data/01_org_objects_mm.csv` … `data/10_unit_tests.csv`, plus `p2p_data.js` for the web page. A Python generator produced the data and expected results, and a separate JavaScript implementation (`p2p-core.js`) was checked against them.
