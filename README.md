# Ananya Patel: Finance & SAP FICO Portfolio

Static portfolio site (plain HTML/CSS/JS, no build step) for GitHub Pages.

- **Home:** `index.html`
- **Project 01, FSV & Month-End Close:** [`projects/fsv-month-end-close/`](projects/fsv-month-end-close/)
  - Case study, live Schedule III statements, CSV dataset, Power BI build guide
- **Project 02, End-to-End Financial Accounting Setup:** [`projects/fi-enterprise-structure/`](projects/fi-enterprise-structure/)
  - Configuration workbook, 12-case unit-test script, interactive posting simulator, CSV configuration data
- **Project 03, Procure-to-Pay (P2P):** [`projects/procure-to-pay/`](projects/procure-to-pay/)
  - MM–FI configuration workbook, document flow and journal entries, 12-case unit-test script, interactive P2P simulator, CSV data

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

## Adding the next project

Copy `projects/fsv-month-end-close/` as a template, then update the project list in `index.html`.
