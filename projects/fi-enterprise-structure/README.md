# Part 1: End-to-End Financial Accounting Setup (SAP S/4HANA FI)

**Goal:** configure company code IN10 from a blank client to its first valid posting (enterprise structure and global settings), and prove each control with a unit-test script.

Web version: [`index.html`](index.html) · Interactive: [`validator.html`](validator.html)

## Configuration workbook

| # | T-code | Object | IN10 value |
|---|---|---|---|
| 1 | OX15 | Company | IN00 XYZ Group |
| 2 | OX02 | Company code | IN10, Pune, IN, INR, EN |
| 3 | OX16 | Assignment | IN10 → IN00 |
| 4 | FINSC_LEDGER | Ledger | 0L, currency type 10 (INR), ACDOCA |
| 5 | OB29 / OB37 | Fiscal year variant | V3 Apr–Mar, 12 + 4 |
| 6 | OBBO / OBBP | Posting period variant | IN10 → IN10 |
| 7 | OB52 | Periods | Int 1: 013–016/2025 (auth group FICL) · Int 2: 006/2026 |
| 8 | OBC4 / OBC5 | Field status variant | IN10: G001, G004, G005, G029, G067 |
| 9 | OB13 / OB62 | Chart of accounts | INCA → IN10 (Part 5) |
| 10 | OBY6 | Global parameters | COA, FYV, PPV, field status variant |
| 11 | FBN1 | Number ranges | 01, 14, 15, 18, 19 for FY 2025/2026 (state before the September close: 01 at 0100000450, 19 at 1900000122) |
| 12 | OBA7 | Document types | SA, AB, AA, KR, KZ, DR, DZ |
| 13 | OB41 | Posting keys | Standard 40/50, 31/21, 01/15 |
| 14 | OBA4 / OB57 | Tolerance groups | (blank) ₹1 L · FI_CLERK ₹5 L · FI_MGR ₹50 L |
| 15 | OB53 | Retained earnings | 321000 |

## Unit tests

| ID | Scenario | Expected |
|---|---|---|
| UT-01 | G/L accrual, open period 06 | Posted 0100000451 |
| UT-02 | Period 07 not yet open | Blocked: OB52 |
| UT-02b | After opening period 07 | Posted 0100000451 |
| UT-03 | Cost account, no cost center | Blocked: field status G004 |
| UT-04 | Clerk posts ₹6,00,000 | Blocked: tolerance FI_CLERK |
| UT-05 | Vendor line on SA | Blocked: account type K not allowed |
| UT-06 | Vendor invoice on KR | Posted 1900000123 |
| UT-07 | Special period 13 by clerk | Blocked: auth group FICL |
| UT-08 | Special period 13 by MGR01 | Posted 0100009833 (FY 2025) |
| UT-09 | EUR, no rate | Blocked: OB08 |
| UT-10 | USD at 85.40 | Posted 0100000451 |
| UT-11 | Unassigned user ₹1,50,000 | Blocked: blank tolerance group |

## Data

`data/01_org_objects.csv` … `data/08_unit_tests.csv`, plus `es_data.js` for the web page. A Python generator produced the expected results, and a separate JavaScript implementation (`validator-core.js`) was checked against them.
