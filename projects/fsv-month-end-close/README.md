# Part 5: Financial Statement Version & Month-End Close (SAP S/4HANA FI-GL)

**Goal:** structure a chart of accounts, group it into a Schedule III Financial Statement Version so SAP produces a compliant Balance Sheet and P&L, and run a month-end close with accruals and deferrals (FBS1 → F.81).

Web version: [`index.html`](index.html) · Interactive: [`statements.html`](statements.html) · Power BI: [`powerbi/POWERBI_BUILD_GUIDE.md`](powerbi/POWERBI_BUILD_GUIDE.md)

## Scenario (fictional)

| Object | Value |
|---|---|
| Company code | IN10 XYZ Pvt Ltd |
| Chart of accounts | INCA (6-digit, stored 10-digit) |
| Fiscal year variant | V3 (April–March) |
| FSV | INS3, Schedule III, Companies Act 2013 (Division I) |
| Retained earnings (OB53) | 321000 |
| Close period | Sep 2026 = P06; reversals in P07 |

## SOP A: G/L accounts (FS00)

| Step | T-code | Action |
|---|---|---|
| 1 | OB13 | Create COA INCA |
| 2 | OB62 | Assign INCA to IN10 |
| 3 | OBD4 | Account groups and number ranges (FA, CA, BANK, CL, LOAN, EQ, REV, EXP, plus RECN for 141000 and 211000) |
| 4 | OB53 | Retained earnings account 321000 for P&L statement account type X |
| 5 | OB52 | Open periods 06 and 07 |
| 6 | FS00 | Create each account centrally: G/L account type, account group, texts, currency, open item / line item flags, recon type, sort key, field status group |

## SOP B: FSV (OB58)

| Step | Action |
|---|---|
| 1 | New FSV INS3, COA INCA, automatic item keys |
| 2 | Build the Schedule III hierarchy (see `data/02_fsv_hierarchy.csv`) |
| 3 | Assign accounts as full 10-digit From–To ranges with D/C flags |
| 4 | D/C shift for HDFC 171000: D → Cash & cash equivalents, C → Short-term borrowings |
| 5 | Place the Net result item under Reserves & surplus |
| 6 | Check assignments: 0 not assigned, 0 duplicates |
| 7 | Run S_ALR_87012284 with FSV INS3 |

## Configuration rule INS3-01: FSV integrity

1. **Assign by full account number.** Use explicit From–To ranges of full 10-digit account numbers (`0000131000`–`0000139999`). Never use truncated strings (`131`, `13*`), because a mismatch sends the account to *Not assigned* and the Balance Sheet stops balancing without any error message.
2. **Protect history.** Never delete or renumber an FSV item whose accounts have postings. Move accounts with a dated change note and re-run prior-period statements to confirm they reproduce.
3. **Check before every close.** OB58 → Check assignments must show 0 not assigned and 0 duplicates.

## Document flow

**FBS1**, posting 30.09.2026, doc type SA, reversal date 01.10.2026, reason 05

| # | Doc | Debit (PK 40) | Credit (PK 50) | ₹ | Basis |
|---|---|---|---|---:|---|
| A1 | 0100000451 | 621000 Power & Fuel | 219500 Accrued Expenses | 1,20,000 | Meter reading |
| A2 | 0100000452 | 631000 Audit Fees | 219500 Accrued Expenses | 50,000 | ₹6,00,000 ÷ 12 |
| A3 | 0100000453 | 651000 Interest on Term Loan | 219500 Accrued Expenses | 62,500 | ₹75 L × 10% ÷ 12 |
| A4 | 0100000454 | 152000 Accrued Interest Receivable | 421000 Interest Income | 18,750 | ₹30 L × 7.5% ÷ 12 |
| D1 | 0100000455 | 422000 Rental Income | 219600 Income Received in Advance | 1,50,000 | October rent |
| D2 | 0100000456 | 151000 Prepaid Expenses | 624000 Software Subscription | 90,000 | October subscription |

**F.81**, 01.10.2026: reversal documents 0100000461–466 (doc type AB, the OBA7 reverse type for SA) swap each Dr/Cr. The October true-up for 621000 is FB60 ₹1,23,500 minus the F.81 reversal ₹1,20,000, leaving ₹3,500 net.

## Result

| Measure | Pre-close | After close |
|---|---:|---:|
| PAT (YTD) | 51,91,250 | 49,17,500 |
| Total assets | 3,37,85,000 | 3,38,93,750 |
| Current ratio | 2.68 | 2.56 |

## Data

| File | Contents |
|---|---|
| `01_gl_master.csv` | 38 G/L accounts with S/4HANA G/L type, group, flags and FSV item |
| `02_fsv_hierarchy.csv` | INS3 nodes and full-number account ranges with D/C flags |
| `03_trial_balance_pre_close.csv` | YTD trial balance at 30.09.2026 before close |
| `04_fbs1_accruals_deferrals.csv` | Six FBS1 documents |
| `05_f81_reversals.csv` | Six F.81 reversal documents |
| `06_journal_entries.csv` | All 26 journal lines (FBS1, F.81, FB60 true-up) |
| `07_trial_balance_post_close.csv` | Trial balance after the September close |
| `fsv_data.js` | The same data for the web page |
