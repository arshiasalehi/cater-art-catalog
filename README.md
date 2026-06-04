# Cater Art Shopify Theme Workflow

This workspace is configured to edit a **safe unpublished theme** first.

## 1) Create a draft theme from the current live theme

```bash
npm run setup:draft -- your-store.myshopify.com "Cater Art Draft"
```

What it does:
- Finds your live theme
- Duplicates it as an unpublished draft
- Pulls that draft theme locally into `./theme`
- Saves draft details in `.shopify-theme.env`

## 2) Start local development against that unpublished theme

```bash
npm run dev:draft
```

This always targets the draft theme ID from `.shopify-theme.env`, not the live theme.

## Useful commands

```bash
npm run theme:list -- --store your-store.myshopify.com
```

If needed, rerun setup to create a fresh new draft copy:

```bash
npm run setup:draft -- your-store.myshopify.com "Cater Art Draft v2"
```

## Static product catalog

There is also a GitHub Pages-friendly static product catalog in `docs/`.

Preview it locally with:

```bash
npm run catalog:serve
```

Then open `http://localhost:4173`.

For GitHub Pages, point the repository site source at the `docs/` folder.
