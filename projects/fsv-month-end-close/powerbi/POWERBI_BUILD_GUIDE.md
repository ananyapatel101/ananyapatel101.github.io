# Power BI build guide: FSV & Month-End Close (IN10)

This guide rebuilds the [live statements page](../statements.html) as a Power BI report from the CSVs in `../data/`. The target is a three-page `.pbix` whose totals match the web version exactly.

## 1. Import (Power Query)

| Query | Source file | Key steps |
|---|---|---|
| `Dim_GL` | `01_gl_master.csv` | Set `GL_Account` and `GL_Account_Full` to **Text** (keeps the leading zeros). |
| `Dim_FSV` | `02_fsv_hierarchy.csv` | Keep `Node_ID`, `Parent_ID`, `Node_Text`, `Level`, `Sort`. Remove duplicate `Node_ID` rows (a node with two ranges appears twice). |
| `FSV_Ranges` | `02_fsv_hierarchy.csv` | Keep rows where `From_Account` isn't blank. `From_Account`/`To_Account` stay **Text**. |
| `Fact_TB` | `03_trial_balance_pre_close.csv` | Add `Source = "Pre-close TB"` and `Posting_Date = 2026-09-30`. `Amount = Balance_INR`. |
| `Fact_Journal` | `06_journal_entries.csv` | `Amount = Debit_INR - Credit_INR`. Add `Source = TCode`. |
| `Fact_GL` | Append `Fact_TB` + `Fact_Journal` | Columns: `GL_Account`, `Posting_Date`, `Amount`, `Source`, `Entry_ID`, `Document`. |
| `Dim_Date` | DAX calendar | Indian fiscal year: `FY = IF(MONTH([Date])>=4, YEAR([Date]), YEAR([Date])-1)`, `Fiscal_Period = MOD(MONTH([Date])-4,12)+1`. |

**Map accounts to FSV items (Rule INS3-01).** Add a column to `Dim_GL` by range-matching on the **full 10-digit text**, never on a truncated number:

```powerquery
// Custom column in Dim_GL, returns the FSV end item for a debit balance
FSV_Item_D = Table.First(
  Table.SelectRows(FSV_Ranges, each [From_Account] <= [GL_Account_Full]
                                 and [To_Account]   >= [GL_Account_Full]
                                 and [Debit_Flag] = "X"))[Node_ID]
```

Repeat for `FSV_Item_C` with `Credit_Flag`. The two differ only for 171000 (D/C shift). The generated `01_gl_master.csv` already carries `FSV_Item` for the pre-close balance sign, so you can use that column directly for a first build.

## 2. Model

```
Dim_Date 1─* Fact_GL *─1 Dim_GL *─1 Dim_FSV
```

**Parent-child hierarchy in `Dim_FSV`.** Build it on the full node path, not on truncated display names:

```dax
FSV_Path   = PATH ( Dim_FSV[Node_ID], Dim_FSV[Parent_ID] )
FSV_Depth  = PATHLENGTH ( Dim_FSV[FSV_Path] )
Level1 = LOOKUPVALUE ( Dim_FSV[Node_Text], Dim_FSV[Node_ID], PATHITEM ( Dim_FSV[FSV_Path], 2 ) )
Level2 = LOOKUPVALUE ( Dim_FSV[Node_Text], Dim_FSV[Node_ID], PATHITEM ( Dim_FSV[FSV_Path], 3 ) )
Level3 = LOOKUPVALUE ( Dim_FSV[Node_Text], Dim_FSV[Node_ID], PATHITEM ( Dim_FSV[FSV_Path], 4 ) )
Level4 = LOOKUPVALUE ( Dim_FSV[Node_Text], Dim_FSV[Node_ID], PATHITEM ( Dim_FSV[FSV_Path], 5 ) )
```

Fill blank lower levels with the parent's text, then create the hierarchy `Level1 → Level4` and sort each level by `Sort`.

## 3. DAX measures

```dax
Balance = SUM ( Fact_GL[Amount] )

-- Show credit-nature items (equity, liabilities, revenue) as positive
Statement Amount =
VAR n = SELECTEDVALUE ( Dim_FSV[Node_ID] )
RETURN IF ( LEFT ( n, 5 ) = "BS.EL" || LEFT ( n, 6 ) = "PL.REV" || LEFT ( n, 5 ) = "PL.OI",
            -[Balance], [Balance] )

Net Result = - CALCULATE ( [Balance], Dim_GL[PL_Statement_Acct_Type] = "X" )
PAT        = [Net Result]

Total Assets   = CALCULATE ( [Balance], LEFT ( Dim_FSV[Node_ID], 4 ) = "BS.A" )
Total E and L  = - CALCULATE ( [Balance], LEFT ( Dim_FSV[Node_ID], 5 ) = "BS.EL" ) + [Net Result]
BS Check       = IF ( ROUND ( [Total Assets] - [Total E and L], 0 ) = 0, "Balanced", "Out of balance" )

Current Assets      = CALCULATE ( [Balance], LEFT ( Dim_FSV[Node_ID], 7 ) = "BS.A.CA" )
Current Liabilities = - CALCULATE ( [Balance], LEFT ( Dim_FSV[Node_ID], 8 ) = "BS.EL.CL" )
Current Ratio       = DIVIDE ( [Current Assets], [Current Liabilities] )

Close Impact on PAT =
- CALCULATE ( [Balance], Fact_GL[Source] = "FBS1", Dim_GL[PL_Statement_Acct_Type] = "X" )

Accounts Not Assigned = COUNTROWS ( FILTER ( Dim_GL, ISBLANK ( Dim_GL[FSV_Item] ) ) )
```

Use a slicer on `Fact_GL[Source]` (Pre-close TB / FBS1 / F.81 / FB60) and a date slicer to reproduce the four views of the web page.

**Expected figures (check your build against these):**

| Measure | Pre-close | After FBS1 |
|---|---|---|
| PAT | 51,91,250 | 49,17,500 |
| Total assets | 3,37,85,000 | 3,38,93,750 |
| Current ratio | 2.68 | 2.56 |
| Close impact on PAT | – | −2,73,750 |
| Accounts not assigned | 0 | 0 |

## 4. Pages

1. **Statements:** two matrix visuals (BS, P&L) on the FSV hierarchy with `Statement Amount`, a KPI card row (PAT, EBITDA, Current Ratio) and a `BS Check` card with conditional formatting (green/red plus icon).
2. **Close impact:** bar chart of `Close Impact on PAT` by `Entry_ID`, a waterfall from pre-close PAT to post-close PAT, and a journal table (Document, T-code, date, G/L, Dr, Cr).
3. **Integrity check:** card for `Accounts Not Assigned`, and a table of G/L accounts with their FSV item and D/C flags.

## 5. Portfolio tips
- Export a screenshot or short GIF of page 1 and replace the placeholder on the case-study page.
- If you use *Publish to web*, do it only with this fictional dataset.
