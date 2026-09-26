# Part 3: Order-to-Cash (SAP S/4HANA SD–FI)

**Goal:** run one sale end to end in company code IN10 (sales order with credit check → delivery and goods issue → GST invoice → incoming payment with cash discount and customer TDS), configure the SD–FI integration behind it, and prove each control with a unit-test script.

Web version: [`index.html`](index.html) · Interactive: [`simulator.html`](simulator.html)

## Scenario (fictional)

| Object | Value |
|---|---|
| Company code / sales area / plant | IN10 / IN10-10-00 / IN11 Pune (Maharashtra, region 27) |
| Customer | 200001 Kalinga Auto Components, Cuttack (Odisha), recon 141000, terms IN02, credit limit ₹52,00,000 |
| Material | FG-2001 Brake Drum BD-40, FERT, valuation class 7920, price control S at ₹1,450 |
| Sales order | 0000010452: 1,000 EA × ₹2,000, K007 3%, IGST 18% = ₹22,89,200 |

## Configuration workbook

| # | T-code | Object | IN10 value |
|---|---|---|---|
| 1 | OVX5 / OVX3 | Sales org | IN10 → IN10 |
| 2 | OVXI / OVXB / OVXG | Sales area | IN10 / 10 / 00 |
| 3 | OVX6 | Plant assignment | IN11 → IN10/10 |
| 4 | OVXD / OVXC / OVL2 | Shipping point | IN11 → plant IN11 |
| 5 | OB45 / OB38 / UKM | Credit control | Area IN10, segment IN10 |
| 6 | OVAK / OVAD | Credit check | OR: check D; LF: credit group 02 |
| 7 | BP (UKM000) | Credit limits | 52 / 40 / 25 / 20 lakh; block if > 60 days overdue |
| 8 | OMSK / MM01 | Material | FG-2001, class 7920, S ₹1,450, acct assignment grp 01 |
| 9 | BP (FLCU00/01) | Customers | 200001–200004, recon 141000, IN02, tolerance grp IN10 |
| 10 | V/08 / OVKK | Pricing procedure | ZIN001: PR00, K007, JOCG, JOSG, JOIG |
| 11 | VK11 | Condition records | PR00 ₹2,000; K007 3% / 2%; GST by region |
| 12 | FS00 / OB58 | New G/L, FSV | 162000, 171200, 412000, 531000, 663000, 664000; new INS3 item PL.EXP.CHI 0000531000–0000539999 |
| 13 | VKOA | Revenue accounts | ERL 411000 · ERS 412000 |
| 14 | OBYC | Goods issue | BSX 132000 · GBB-VAX 531000 |
| 15 | OB40 | Output tax | JOI / JOC / JOS → 221000 |
| 16 | VOFA / OBA7 / FBN1 | Document types | F2 → RV (range 18); WL → range 49 |
| 17 | OBB8 / OBY6 | Terms | IN02: 2% 10 days, net 30; discount base net of tax |
| 18 | OBXI / OBXL | Discount / differences | SKT 663000 · ZDI 664000 |
| 19 | OBA3 | Customer tolerance | ₹500 or 0.5%, lower of the two |
| 20 | WHT / OBWW | Customer TDS | Type QC, 194Q 0.1% → 162000 |

## Document flow

| Date | T-code | Document | ₹ |
|---|---|---|---:|
| 01.10.2026 | VA01 | SO 0000010452, credit check passed (98% of limit) | 22,89,200 |
| 05.10.2026 | VL01N | Delivery 0080010317 | |
| 05.10.2026 | VL02N 601 | 4900000612: Dr 531000 / Cr 132000 | 14,50,000 |
| 05.10.2026 | VF01 | 1800000205: Dr 200001 22,89,200, Dr 412000 60,000, Cr 411000 20,00,000, Cr 221000 3,49,200 | 22,89,200 |
| 14.10.2026 | F-28 | 1400000088: Dr 171200 22,48,460, Dr 663000 38,800, Dr 162000 1,940, Cr 200001 22,89,200 | 22,48,460 |

Customer open items at 30.09.2026 = ₹64,80,000 (six items, four customers), matching 141000 in Part 5's trial balance.

## Unit tests

| ID | Scenario | Expected |
|---|---|---|
| O2C-01 | Happy path | Cleared 1400000088, ₹22,48,460 received |
| O2C-02 | Intra-state customer 200002 | Cleared, CGST + SGST |
| O2C-03 | 1,050 EA, exposure ₹52,35,660 | Credit block |
| O2C-04 | Same, released in UKM_MY_DCDS | Cleared, ₹23,60,883 |
| O2C-05 | Customer 200004, item 81 days overdue | Credit block |
| O2C-06 | Stock 800 EA | Stopped at goods issue |
| O2C-07 | PGI 02.11.2026 | Stopped: MM period |
| O2C-08 | Billing before PGI | Stopped: not due for billing |
| O2C-09 | No account assignment group | Billing saved, not in FI (VFX3) |
| O2C-10 | Receipt by CLERK01 | Stopped: OBA4 |
| O2C-11 | Paid day 15, discount taken | Cleared, residual item ₹38,800 |
| O2C-12 | ₹250 short | Cleared, ₹250 to 664000 |

## Data

`data/01_org_objects_sd.csv` … `data/10_unit_tests.csv`, plus `o2c_data.js` for the web page. A Python generator produced the data and expected results, and a separate JavaScript implementation (`o2c-core.js`) was checked against them.
