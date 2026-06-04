const CSV_URL = "./products_export_1.csv";

const SUMMARY_FIELDS = [
  ["Vendor", "Vendor"],
  ["Product Category", "Category"],
  ["Type", "Type"],
  ["Artist (product.metafields.custom.artist)", "Artist"],
  ["Edition (product.metafields.custom.edition)", "Edition"],
  ["Size (product.metafields.custom.size)", "Size"],
  ["Tags", "Tags"],
  ["Published", "Published"],
  ["Status", "Status"],
];

let catalogPromise = null;

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

const truncate = (value, max = 180) => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1).trimEnd()}…`;
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
};

const normalizeNumeric = (value) => {
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  if (!cleaned) {
    return null;
  }
  const number = Number.parseFloat(cleaned);
  return Number.isFinite(number) ? number : null;
};

const formatPrice = (value) => {
  const number = normalizeNumeric(value);
  if (number === null) {
    return String(value ?? "").trim();
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
};

const parseTags = (value) =>
  String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

const stripHtml = (value) => {
  const html = String(value ?? "").replace(/<meta\b[^>]*>/gi, "");
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content
    .querySelectorAll("script, style, meta, iframe")
    .forEach((node) => node.remove());
  return template.textContent.replace(/\s+/g, " ").trim();
};

const cleanHtml = (value) => {
  const html = String(value ?? "").replace(/<meta\b[^>]*>/gi, "");
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content.querySelectorAll("script, style, meta, iframe").forEach((node) => node.remove());
  template.content.querySelectorAll("[data-start], [data-end], [data-pm-slice]").forEach((node) => {
    node.removeAttribute("data-start");
    node.removeAttribute("data-end");
    node.removeAttribute("data-pm-slice");
  });
  template.content.querySelectorAll("[class], [style], [id]").forEach((node) => {
    node.removeAttribute("class");
    node.removeAttribute("style");
    node.removeAttribute("id");
  });
  Array.from(template.content.querySelectorAll("div")).forEach((node) => {
    node.replaceWith(...Array.from(node.childNodes));
  });
  return template.innerHTML.trim();
};

const handleToTitle = (handle) =>
  String(handle ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const humanizeSlug = (value) =>
  String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const initials = (value) => {
  const parts = String(value ?? "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return "•";
  }
  const letters = parts.slice(0, 2).map((part) => part.charAt(0));
  return letters.join("").toUpperCase();
};

const friendlyLabel = (key) => {
  const map = {
    "Body (HTML)": "Description",
    "Google Shopping / Google Product Category": "Google product category",
    "Google Shopping / Condition": "Google condition",
    "Google Shopping / Custom Product": "Google custom product",
    "Google Shopping / Age Group": "Google age group",
    "Google Shopping / Gender": "Google gender",
    "Google Shopping / MPN": "Google MPN",
    "Google Shopping / Custom Label 0": "Google label 0",
    "Google Shopping / Custom Label 1": "Google label 1",
    "Google Shopping / Custom Label 2": "Google label 2",
    "Google Shopping / Custom Label 3": "Google label 3",
    "Google Shopping / Custom Label 4": "Google label 4",
    "Artist (product.metafields.custom.artist)": "Artist",
    "Edition (product.metafields.custom.edition)": "Edition",
    "Size (product.metafields.custom.size)": "Size",
    "Google: Custom Product (product.metafields.mm-google-shopping.custom_product)":
      "Google custom product",
    "Art movement (product.metafields.shopify.art-movement)": "Art movement",
    "Artwork authenticity (product.metafields.shopify.artwork-authenticity)":
      "Authenticity",
    "Artwork frame material (product.metafields.shopify.artwork-frame-material)":
      "Frame material",
    "Color (product.metafields.shopify.color-pattern)": "Color / pattern",
    "Frame style (product.metafields.shopify.frame-style)": "Frame style",
    "Painting medium (product.metafields.shopify.painting-medium)":
      "Painting medium",
    "Theme (product.metafields.shopify.theme)": "Theme",
  };

  return map[key] ?? key;
};

const statusClass = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "active") {
    return "badge badge-active";
  }
  if (normalized === "archived") {
    return "badge badge-archived";
  }
  return "badge";
};

const normalizeProduct = (product) => {
  const fields = product.fields;
  const price = firstNonEmpty(
    fields["Variant Price"],
    fields["Price / United States"],
    fields["Price / Canada"],
    fields["Price / International"],
  );
  const compareAt = firstNonEmpty(
    fields["Variant Compare At Price"],
    fields["Compare At Price / United States"],
    fields["Compare At Price / Canada"],
    fields["Compare At Price / International"],
  );
  const title = firstNonEmpty(fields.Title, handleToTitle(product.handle));
  const artistDisplay = humanizeSlug(fields["Artist (product.metafields.custom.artist)"] || "");
  const descriptionHTML = cleanHtml(fields["Body (HTML)"]);
  const descriptionText = stripHtml(fields["Body (HTML)"] || fields["SEO Description"]);
  const searchIndex = [
    product.handle,
    title,
    artistDisplay,
    ...Object.values(fields),
    ...product.images.flatMap((image) => [image.src, image.alt]),
  ]
    .join(" ")
    .toLowerCase();

  return {
    ...product,
    title,
    price,
    compareAt,
    descriptionHTML,
    descriptionText,
    excerpt:
      truncate(
        firstNonEmpty(
          descriptionText,
          fields["SEO Description"],
          fields["SEO Title"],
        ),
        200,
      ) || "No description provided.",
    vendor: fields.Vendor || "",
    category: fields["Product Category"] || "",
    type: fields.Type || "",
    artist: fields["Artist (product.metafields.custom.artist)"] || "",
    artistDisplay,
    edition: fields["Edition (product.metafields.custom.edition)"] || "",
    size: fields["Size (product.metafields.custom.size)"] || "",
    tags: parseTags(fields.Tags),
    published: fields.Published || "",
    status: fields.Status || "",
    searchIndex,
    images: product.images.sort((a, b) => {
      const ap = Number.parseInt(a.position, 10) || 9999;
      const bp = Number.parseInt(b.position, 10) || 9999;
      return ap - bp;
    }),
  };
};

const parseCsv = (text) => {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (i === 0 && char === "\ufeff") {
      continue;
    }

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length || currentRow.length) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows;
};

const parseCatalog = (csvText) => {
  const matrix = parseCsv(csvText);
  if (!matrix.length) {
    return [];
  }

  const headers = matrix[0];
  const products = new Map();
  let currentHandle = "";

  for (let rowIndex = 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex];
    if (!row || row.every((cell) => !String(cell ?? "").trim())) {
      continue;
    }

    const record = {};
    headers.forEach((header, columnIndex) => {
      record[header] = row[columnIndex] ?? "";
    });

    const rowHandle = String(record.Handle ?? "").trim();
    if (rowHandle) {
      currentHandle = rowHandle;
    }

    if (!currentHandle) {
      continue;
    }

    let product = products.get(currentHandle);
    if (!product) {
      product = {
        handle: currentHandle,
        fields: {},
        rows: [],
        images: [],
      };
      products.set(currentHandle, product);
    }

    product.rows.push(record);

    for (const [key, rawValue] of Object.entries(record)) {
      const value = String(rawValue ?? "").trim();
      if (value && !product.fields[key]) {
        product.fields[key] = value;
      }
    }

    const imageSrc = String(record["Image Src"] ?? "").trim();
    if (imageSrc && !product.images.some((image) => image.src === imageSrc)) {
      product.images.push({
        src: imageSrc,
        alt: String(record["Image Alt Text"] ?? "").trim(),
        position: String(record["Image Position"] ?? "").trim(),
      });
    }
  }

  return [...products.values()]
    .map(normalizeProduct)
    .sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
};

const loadCatalog = async () => {
  if (!catalogPromise) {
    catalogPromise = fetch(CSV_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Unable to load ${CSV_URL}: ${response.status}`);
      }
      return parseCatalog(await response.text());
    });
  }

  return catalogPromise;
};

const renderListItem = (product) => {
  const image = product.images[0];
  const price = product.price ? formatPrice(product.price) : "Price on request";
  const compare = product.compareAt ? formatPrice(product.compareAt) : "";
  const meta = [product.vendor, product.artistDisplay, product.size]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .map((value) => `<span>${escapeHtml(value)}</span>`)
    .join("");
  const badgeText = product.status || (String(product.published).trim() === "true" ? "Published" : "");

  return `
    <li>
      <a class="product-card" href="./product.html?handle=${encodeURIComponent(product.handle)}">
        <div class="product-thumb ${image ? "" : "placeholder"}" aria-hidden="true">
          ${
            image
              ? `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || product.title)}" loading="lazy" />`
              : `<span>${escapeHtml(initials(product.title))}</span>`
          }
        </div>

        <div class="product-main">
          <div class="product-title-row">
            <h2>${escapeHtml(product.title)}</h2>
            ${badgeText ? `<span class="${statusClass(badgeText)}">${escapeHtml(badgeText)}</span>` : ""}
          </div>

          <div class="product-meta">${meta}</div>
          <p class="excerpt">${escapeHtml(product.excerpt)}</p>
        </div>

        <div class="product-price">
          <span class="price">${escapeHtml(price)}</span>
          ${compare ? `<span class="compare">${escapeHtml(compare)}</span>` : ""}
          <span class="details-link">View details →</span>
        </div>
      </a>
    </li>
  `;
};

const renderSummaryFacts = (product) => {
  const rows = SUMMARY_FIELDS.map(([field, label]) => {
    const value = String(product.fields[field] ?? "").trim();
    if (!value) {
      return "";
    }

    if (field === "Published") {
      const rendered =
        value.toLowerCase() === "true"
          ? "Yes"
          : value.toLowerCase() === "false"
            ? "No"
            : value;
      return `
        <div class="fact-row">
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(rendered)}</dd>
        </div>
      `;
    }

    if (field === "Tags") {
      const tags = parseTags(value)
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join("");
      return `
        <div class="fact-row">
          <dt>${escapeHtml(label)}</dt>
          <dd><div class="tag-list">${tags}</div></dd>
        </div>
      `;
    }

    return `
      <div class="fact-row">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(field === "Artist (product.metafields.custom.artist)" ? product.artistDisplay || value : value)}</dd>
      </div>
    `;
  })
    .filter(Boolean)
    .join("");

  return rows || '<div class="muted">No summary metadata found.</div>';
};

const renderDetailPage = (product) => {
  const image = product.images[0];
  const price = product.price ? formatPrice(product.price) : "Price on request";
  const compare = product.compareAt ? formatPrice(product.compareAt) : "";
  const heroClass = image ? "hero-image" : "hero-image placeholder";
  const imageMarkup = image
    ? `<img id="main-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || product.title)}" />`
    : `<div><strong>No image available</strong><p>There is no product image in this export for this item.</p></div>`;

  const thumbnails =
    product.images.length > 1
      ? `
        <div class="thumbs" aria-label="Product images">
          ${product.images
            .map(
              (candidate, index) => `
                <button
                  class="thumb-button ${index === 0 ? "is-active" : ""}"
                  type="button"
                  data-src="${escapeHtml(candidate.src)}"
                  data-alt="${escapeHtml(candidate.alt || product.title)}"
                  aria-label="View image ${index + 1}"
                >
                  <img src="${escapeHtml(candidate.src)}" alt="" loading="lazy" />
                </button>
              `,
            )
            .join("")}
        </div>
      `
      : "";

  return `
    <section class="detail-top">
      <span class="kicker">Product detail</span>
      <span class="${statusClass(product.status)}">
        ${escapeHtml(product.status || (String(product.published).trim() === "true" ? "Published" : "Unpublished"))}
      </span>
      <span class="badge">${escapeHtml(product.handle)}</span>
    </section>

    <div class="detail-grid">
      <section class="gallery">
        <div class="${heroClass}" id="hero-image">
          ${imageMarkup}
        </div>
        ${thumbnails}
      </section>

      <section class="summary">
        <p class="kicker">${escapeHtml(firstNonEmpty(product.vendor, "Product"))}</p>
        <h1>${escapeHtml(product.title)}</h1>

        <div class="price-row">
          <span class="price">${escapeHtml(price)}</span>
          ${compare ? `<span class="compare">${escapeHtml(compare)}</span>` : ""}
        </div>

        ${product.descriptionHTML ? `<div class="prose">${product.descriptionHTML}</div>` : '<p class="muted">No description provided.</p>'}

        <dl class="facts">
          ${renderSummaryFacts(product)}
        </dl>
      </section>
    </div>
  `;
};

const initListPage = async () => {
  const listEl = document.querySelector("#product-list");
  const emptyEl = document.querySelector("#empty-state");
  const searchInput = document.querySelector("#search-input");
  const totalCountEl = document.querySelector("#total-count");
  const activeCountEl = document.querySelector("#active-count");
  const resultsCountEl = document.querySelector("#results-count");

  let products;

  try {
    products = await loadCatalog();
  } catch (error) {
    if (resultsCountEl) {
      resultsCountEl.textContent = `Unable to load the catalog: ${error.message}`;
    }
    if (listEl) {
      listEl.innerHTML = "";
    }
    if (emptyEl) {
      emptyEl.hidden = true;
    }
    return;
  }

  const activeCount = products.filter((product) => {
    const status = String(product.status ?? "").trim().toLowerCase();
    return status === "active" || String(product.published).trim().toLowerCase() === "true";
  }).length;

  if (totalCountEl) {
    totalCountEl.textContent = String(products.length);
  }
  if (activeCountEl) {
    activeCountEl.textContent = String(activeCount);
  }

  const render = (query = "") => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? products.filter((product) => product.searchIndex.includes(normalizedQuery))
      : products;

    if (resultsCountEl) {
      resultsCountEl.textContent =
        filtered.length === products.length
          ? `Showing all ${products.length} products.`
          : `Showing ${filtered.length} of ${products.length} products.`;
    }

    if (emptyEl) {
      emptyEl.hidden = filtered.length !== 0;
    }

    if (!listEl) {
      return;
    }

    if (!filtered.length) {
      listEl.innerHTML = "";
      return;
    }

    listEl.innerHTML = filtered.map(renderListItem).join("");
  };

  render(searchInput?.value ?? "");

  searchInput?.addEventListener("input", (event) => {
    render(event.target.value);
  });
};

const initDetailPage = async () => {
  const detailEl = document.querySelector("#product-detail");
  const params = new URLSearchParams(window.location.search);
  const handle = params.get("handle")?.trim();

  if (!detailEl) {
    return;
  }

  if (!handle) {
    detailEl.innerHTML =
      '<p class="error-state">Missing product handle. Go back to the list and choose a product.</p>';
    return;
  }

  let products;
  try {
    products = await loadCatalog();
  } catch (error) {
    detailEl.innerHTML = `<p class="error-state">Unable to load the catalog: ${escapeHtml(error.message)}</p>`;
    return;
  }

  const product = products.find((item) => item.handle === handle);
  if (!product) {
    detailEl.innerHTML = `
      <p class="error-state">
        No product was found for <strong>${escapeHtml(handle)}</strong>.
      </p>
    `;
    return;
  }

  document.title = `${product.title} | Cater Art`;
  const description = firstNonEmpty(product.descriptionText, product.excerpt);
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", truncate(description, 160));
  }

  detailEl.innerHTML = renderDetailPage(product);

  const heroImageEl = detailEl.querySelector("#hero-image");
  const thumbButtons = detailEl.querySelectorAll(".thumb-button");

  const showImage = (src, alt) => {
    if (!heroImageEl) {
      return;
    }

    heroImageEl.className = "hero-image";
    heroImageEl.innerHTML = `<img id="main-image" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`;

    const currentImage = heroImageEl.querySelector("#main-image");
    currentImage?.addEventListener("error", () => {
      if (heroImageEl) {
        heroImageEl.className = "hero-image placeholder";
        heroImageEl.innerHTML = `
          <div>
            <strong>Image unavailable</strong>
            <p>The product image could not be loaded from the source URL.</p>
          </div>
        `;
      }
    });
  };

  thumbButtons.forEach((button) => {
    button.addEventListener("click", () => {
      thumbButtons.forEach((candidate) => candidate.classList.remove("is-active"));
      button.classList.add("is-active");

      const src = button.dataset.src;
      const alt = button.dataset.alt || product.title;

      showImage(src, alt);
    });
  });

  if (image) {
    const currentImage = heroImageEl?.querySelector("#main-image");
    currentImage?.addEventListener("error", () => {
      if (heroImageEl) {
        heroImageEl.className = "hero-image placeholder";
        heroImageEl.innerHTML = `
          <div>
            <strong>Image unavailable</strong>
            <p>The product image could not be loaded from the source URL.</p>
          </div>
        `;
      }
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "list") {
    initListPage();
  } else if (page === "product") {
    initDetailPage();
  }
});
