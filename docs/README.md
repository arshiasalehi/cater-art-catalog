# Static Product Catalog

This folder is a GitHub Pages-friendly static site built from the Shopify CSV export.

## Preview locally

```bash
python3 -m http.server 4173 -d docs
```

Then open `http://localhost:4173`.

## Deploy on GitHub Pages

Set the Pages source to the `docs/` folder for the repository. The site does not need a backend or build step.
