# Part 4: Asset Accounting (SAP S/4HANA FI-AA)

**Goal:** set up Asset Accounting for company code IN10 (chart of depreciation, book and tax areas, asset classes, depreciation keys, AO90 account determination), run one asset month (machine bought through an AUC and capitalised → old asset sold → depreciation run), and prove each control with a unit-test script. The asset register ties to Part 5's trial balance.

Web version: [`index.html`](index.html) · Interactive: [`simulator.html`](simulator.html)

## Scenario (fictional)

| Object | Value |
|---|---|
| Company code / chart of depreciation | IN10 / IN10 (copy of 1IN) |
| Areas | 01 Book, Companies Act (posts to 0L) · 15 Income Tax Act (values only) |
| New asset | AUC 4000001 → 1100008 VMC-1060, ₹21,00,000 machine + ₹60,000 installation, capitalised 20.10.2026, 10 years |
| Sale | 1100002 manual lathe, NBV ₹4,56,000, sold for ₹5,00,000 + GST to customer 200005 |

## Configuration workbook

| # | T-code | Object | IN10 value |
|---|---|---|---|
| 1 | EC08 | Chart of depreciation | IN10 from 1IN |
| 2 | OADB | Depreciation areas | 01 book (real-time posting, IND-GAAP) · 15 tax (no posting) |
| 3 | OAOB | Assignment | Chart IN10 → company code IN10 |
| 4 | FS00 | Recon accounts | 111000, 111900, 112000, 112900, 119000: recon type A |
| 5 | FS00 / OB58 | New G/L, FSV | 119000 CWIP, 219700, 423000, 665000; new INS3 item BS.A.NCA.CWIP 0000119000–0000119999, PPE cut to 0000111000–0000118999 |
| 6 | AO90 | Account determination | 11000 P&M · 12000 office equipment · 40000 AUC |
| 7 | OAOA / AS08 | Asset classes | 1100 P&M (11) · 1200 office eqpt (12) · 1500 LVA (15) · 4000 AUC (40, line item settlement) |
| 8 | OAYZ | Areas per class | ZSLM / ZWDV; LVA ZLVA; AUC 0000 |
| 9 | AFAMA / AFAMP | Keys, period control | ZSLM straight line, period control 01; ZWDV 15% WDV, half rate if used < 180 days in year 1 |
| 10 | OAYK | LVA limit | ₹5,000 per item, class 1500 |
| 11 | OAYR / OBA7 / FBN1 | Depreciation posting | Monthly; doc type AF, range 05 |
| 12 | BP | Partners | Vendors 100003, 100004 (194C); customer 200005 |
| 13 | AJRW / AJAB | Asset fiscal year | 2026 open, 2025 closed |

## Document flow

| Date | T-code | Document | ₹ |
|---|---|---|---:|
| 09.10.2026 | F-90 | 1900000124: Dr AUC 4000001 21,00,000, Dr 161000 3,78,000, Cr 100003 24,78,000 | 24,78,000 |
| 16.10.2026 | F-90 | 1900000125: Dr AUC 60,000, Dr 161000 10,800, Cr 100004 69,600, Cr 222000 1,200 | 70,800 |
| 20.10.2026 | AIBU | 0100000467: Dr 1100008 / Cr 4000001 | 21,60,000 |
| 26.10.2026 | F-92 | 1800000206: Dr 200005 5,90,000, Dr 111900 2,64,000, Cr 111000 7,20,000, Cr 221000 90,000, Cr 423000 44,000 (219700 nets to zero) | 5,90,000 |
| 31.10.2026 | AFAB | 0500000007: Dr 641000 1,84,000, Cr 111900 1,64,000, Cr 112900 20,000 | 1,84,000 |

Asset register at 30.09.2026: P&M ₹1,85,00,000 / acc. dep. ₹42,00,000, office equipment ₹12,00,000 / ₹3,60,000, depreciation April–September ₹9,90,000, matching 111000, 111900, 112000, 112900 and 641000 in Part 5's trial balance.

## Unit tests

| ID | Scenario | Expected |
|---|---|---|
| AA-01 | Happy path | Capitalised ₹21,60,000, October depreciation ₹18,000 |
| AA-02 | Sale of lathe 1100002 | Profit ₹44,000, no October depreciation |
| AA-03 | Scrap photocopiers 1200003 | Loss ₹2,50,000 |
| AA-04 | AUC not settled | Held in CWIP, no depreciation |
| AA-05 | Put to use 03.10 | Tax full rate ₹3,24,000 |
| AA-06 | Settlement before last invoice | Stopped: AIBU |
| AA-07 | Invoice 02.11.2026 | Stopped: OB52 |
| AA-08 | Class 1300 | Stopped: no AO90 |
| AA-09 | Invoice by CLERK01 | Stopped: OBA4 |
| AA-10 | Value date in FY 2025 | Stopped: AJAB |
| AA-11 | Retire before capitalisation | Stopped: value date |
| AA-12 | AFAB period 008 | Stopped: OB52 |

## Data

`data/01_org_objects_aa.csv` … `data/10_unit_tests.csv`, plus `aa_data.js` for the web page. A Python generator produced the data and expected results, and a separate JavaScript implementation (`aa-core.js`) was checked against them.
