# Ananya Patel: Finance & SAP FICO Portfolio

Static portfolio site (plain HTML/CSS/JS, no build step) for GitHub Pages.

- **Home:** `index.html`
- **Résumé:** [`resume.html`](resume.html) (printable, “Save as PDF” gives a clean A4 CV)
- **Project 1, Global Gold Market: Price Drivers and Investment Role** (MBA research): [`projects/gold-market-research/`](projects/gold-market-research/)
  - Research write-up: driver framework, transmission table, demand/supply, safe-haven evaluation
- **Project 2, SAP S/4HANA FICO End-to-End Implementation** (self project, one company code IN10, five parts):
  - **Part 1, Financial Accounting Setup:** [`projects/fi-enterprise-structure/`](projects/fi-enterprise-structure/): configuration workbook, 12-case unit-test script, interactive posting simulator, CSV configuration data
  - **Part 2, Procure-to-Pay (P2P):** [`projects/procure-to-pay/`](projects/procure-to-pay/): MM–FI configuration workbook, document flow and journal entries, 12-case unit-test script, interactive P2P simulator, CSV data
  - **Part 3, Order-to-Cash (O2C):** [`projects/order-to-cash/`](projects/order-to-cash/): SD–FI configuration workbook, credit management, document flow and journal entries, AR ageing tied to Part 5, 12-case unit-test script, interactive O2C simulator, CSV data
  - **Part 4, Asset Accounting:** [`projects/asset-accounting/`](projects/asset-accounting/): FI-AA configuration workbook, asset register tied to Part 5, AUC acquisition and settlement, asset sale, depreciation run, asset history sheet, 12-case unit-test script, interactive asset simulator, CSV data
  - **Part 5, FSV & Month-End Close:** [`projects/fsv-month-end-close/`](projects/fsv-month-end-close/): case study, live Schedule III statements, CSV dataset, Power BI build guide

All SAP data is fictional (company code IN10).

## Publish on GitHub Pages

1. On github.com create a **public** repository named exactly `<your-username>.github.io`, with no README, .gitignore or license.
2. From this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/<your-username>.github.io.git
   git push -u origin main
   ```
   Or use the repository's **Add file → Upload files** page and drag in the folder contents.
3. **Settings → Pages → Build and deployment:** Source *Deploy from a branch*, branch `main`, folder `/ (root)`.
4. After a minute or two the site is live at `https://<your-username>.github.io`.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Adding the next part

Copy `projects/fsv-month-end-close/` as a template, then add the part to the self-project list in `index.html`.
