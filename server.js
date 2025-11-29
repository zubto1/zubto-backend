// server.js (improved)
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
// replace with your real ScraperAPI key
const SCRAPER_API_KEY = "254aa5de511e80f67e016d643d0caff5";

// -------------------------
// Helpers
// -------------------------
function normalizeText(t) {
  if (!t) return "";
  return t.replace(/\s+/g, " ").trim();
}

// Match numbers with commas and optional decimal, e.g. "1,234.56"
function extractNumberWithCommas(raw) {
  if (!raw) return null;
  const m = raw.match(/[\d,]+(\.\d+)?/);
  if (!m) return null;
  // remove commas, convert to float
  const num = parseFloat(m[0].replace(/,/g, ""));
  if (Number.isNaN(num)) return null;
  return num;
}

function cleanPrice(rawPrice) {
  if (!rawPrice) return null;
  // sometimes price contains currency symbols and text; choose first numeric block with commas allowed
  const num = extractNumberWithCommas(rawPrice);
  if (num === null) return null;
  // show integer without decimals, otherwise two decimals
  const finalNumber = Number.isInteger(num) ? num.toString() : num.toFixed(2);
  return `₹${finalNumber}`;
}

function parsePercentageFromText(text) {
  if (!text) return null;
  // patterns like "20% off", "Save 20%", "(20%)"
  const m = text.match(/(\d{1,3})\s*%/);
  if (m) return `${m[1]}%`;
  // patterns like "Save ₹200 (20%)"
  const m2 = text.match(/\((\d{1,3})\s*%\)/);
  if (m2) return `${m2[1]}%`;
  // patterns like "20 percent"
  const m3 = text.match(/(\d{1,3})\s*percent/i);
  if (m3) return `${m3[1]}%`;
  return null;
}

function parseIntFromText(text) {
  if (!text) return null;
  const m = text.match(/[\d,]+/);
  if (!m) return null;
  return parseInt(m[0].replace(/,/g, ""), 10);
}

// try to parse JSON-LD structured data for offers, aggregateRating, reviewCount, image
function parseJsonLd($) {
  const results = {};
  $("script[type='application/ld+json']").each((i, el) => {
    try {
      const raw = $(el).contents().text();
      const data = JSON.parse(raw);
      const obj = Array.isArray(data) ? data[0] : data;
      if (!obj) return;
      if (obj.offers && obj.offers.price) {
        results.price = obj.offers.price;
        if (obj.offers.priceCurrency) results.currency = obj.offers.priceCurrency;
      }
      if (obj.aggregateRating) {
        results.rating = obj.aggregateRating.ratingValue;
        results.reviewCount = obj.aggregateRating.reviewCount;
      }
      if (obj.reviews && Array.isArray(obj.reviews)) {
        results.reviews = obj.reviews.length;
      }
      if (obj.image) {
        // image can be string or array
        results.image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
      }
      if (obj.name && !results.title) results.title = obj.name;
      if (obj.description && !results.description) results.description = obj.description;
    } catch (e) {
      // ignore JSON parse errors
    }
  });
  return results;
}

// get attribute for image with many fallbacks
function getImageAttr(el) {
  if (!el) return null;
  // common attributes that hold an image
  return (
    el.attr("content") ||
    el.attr("data-src") ||
    el.attr("data-original") ||
    el.attr("data-old-hires") ||
    el.attr("data-lazy") ||
    el.attr("src") ||
    (el.attr("srcset") ? el.attr("srcset").split(",")[0].trim().split(" ")[0] : null) ||
    null
  );
}

// try several selectors in order and return first non-empty normalized text
function pickText($, selectors) {
  for (const sel of selectors) {
    const el = $(sel);
    if (el && el.length) {
      const txt = normalizeText(el.first().text() || el.first().attr("content") || "");
      if (txt) return txt;
    }
  }
  return null;
}

// -------------------------
// Root route
// -------------------------
app.get("/", (req, res) => {
  res.send("✅ Zubto Product Backend is running... (improved scraper)");
});

// -------------------------
// Scraper route (improved)
// -------------------------
app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    // Use render=true so JS-rendered content appears (ScraperAPI supports this)
    const scraperURL = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&render=true&url=${encodeURIComponent(url)}`;
    const response = await fetch(scraperURL, { timeout: 30000 });
    const html = await response.text();

    const $ = cheerio.load(html);

    // Try JSON-LD first (structured data)
    const jsonld = parseJsonLd($);

    // -------------------------
    // Title
    // -------------------------
    const title =
      jsonld.title ||
      $("meta[property='og:title']").attr("content") ||
      $("meta[name='twitter:title']").attr("content") ||
      $("h1").first().text().trim() ||
      $("span.B_NuCI").text().trim() || // Flipkart old
      $("title").text().trim() ||
      null;

    // -------------------------
    // Description
    // -------------------------
    const description =
      jsonld.description ||
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      $("meta[name='twitter:description']").attr("content") ||
      pickText($, [
        "div#productDescription",
        "div#description",
        "div._1mXcCf", // Flipkart short description
        "div._2bXVyZ", // Flipkart description block
      ]) ||
      null;

    // -------------------------
    // Price (robust)
    // -------------------------
    // candidate selectors to try (Amazon, Flipkart, generic)
    const priceCandidates = [
      jsonld.price ? `₹${jsonld.price}` : null,
      "span#priceblock_ourprice", // Amazon old
      "span#priceblock_dealprice",
      "span.a-offscreen", // Amazon shows price inside this span
      "div._30jeq3._16Jk6d", // Flipkart price
      "div._25b18c", // mobile
      "div.Nx9bqj.CxhGGd", // new Flipkart variations
      "div.price", // generic
      "[class*=price]", // wildcard
      "meta[property='product:price:amount']",
    ].filter(Boolean);

    let rawPrice = null;
    for (const sel of priceCandidates) {
      if (sel.startsWith("meta")) {
        const v = $("meta[property='product:price:amount']").attr("content");
        if (v) {
          rawPrice = v;
          break;
        }
      } else {
        const el = $(sel);
        if (el && el.length) {
          // text or content attribute
          rawPrice = el.first().text().trim() || el.first().attr("content") || el.first().attr("data-price") || null;
          if (rawPrice) break;
        }
      }
    }

    // as a fallback, search the whole page for currency symbol and nearby digits
    if (!rawPrice) {
      // try to find something like "₹1,234" anywhere within page text blocks
      const pageText = $("body").text();
      const m = pageText.match(/₹\s*[\d,]+(\.\d+)?/);
      if (m) rawPrice = m[0];
    }

    // JSON-LD numeric price
    if (!rawPrice && jsonld.price) rawPrice = jsonld.price.toString();

    const price = cleanPrice(rawPrice);

    // -------------------------
    // Image (robust)
    // -------------------------
    let image =
      jsonld.image ||
      $("meta[property='og:image']").attr("content") ||
      $("meta[name='twitter:image']").attr("content") ||
      getImageAttr($("img#landingImage")) || // Amazon
      getImageAttr($("img#icp-sprite-imagelist")) ||
      getImageAttr($("img.primary-image")) ||
      getImageAttr($("img").first()) ||
      null;

    // -------------------------
    // Rating & Review Count
    // -------------------------
    // Amazon structured: #acrPopover title contains "4.3 out of 5 stars"
    let rating =
      jsonld.rating ||
      $("#acrPopover").attr("title") ||
      $("span.a-icon-alt").first().text().trim() || // Amazon alt text
      pickText($, ["div._3LWZlK", "div._3LWZlK._3uSWvT", "span._2_R_DZ", "div._3U7b2d"]); // Flipkart

    let reviewCount =
      jsonld.reviewCount ||
      $("#acrCustomerReviewText").text().trim() || // Amazon "2,345 ratings"
      pickText($, ["span#acrCustomerReviewText", "span._2_R_DZ span", "span._2_R_DZ"]) ||
      pickText($, ["div._3UZZGt", "span._2aZyWI"]); // Flipkart variants

    // normalize rating text like "4.3 out of 5 stars" -> "4.3"
    if (rating) {
      const m = rating.match(/[\d.]+/);
      if (m) rating = m[0];
    }

    // normalize reviewCount to integer
    if (reviewCount) {
      const m = reviewCount.match(/[\d,]+/);
      if (m) reviewCount = parseInt(m[0].replace(/,/g, ""), 10);
    }

    // -------------------------
    // Discount / Percentage
    // -------------------------
    // try a list of selectors that sometimes hold discount text
    const discountSelectors = [
      "div._3Ay6Sb span", // Flipkart discount
      "span.savingsPercentage", // Amazon possible
      "td.a-span12.a-color-price.a-size-base", // Amazon offers table
      "span.priceBlockSavingsString", // Amazon "Save ₹XXX (YY%)"
      "span.a-color-price", // fallback
      "[class*=discount]",
      "[class*=save]",
      "[data-offer-percentage]",
    ];

    let discount = null;
    // check selectors
    for (const sel of discountSelectors) {
      const el = $(sel);
      if (el && el.length) {
        const t = normalizeText(el.first().text());
        const pct = parsePercentageFromText(t);
        if (pct) {
          discount = pct;
          break;
        } else if (t.toLowerCase().includes("off")) {
          // try to extract digits
          const p = parsePercentageFromText(t) || (t.match(/(\d{1,3})/) && t.match(/(\d{1,3})/)[1] + "%");
          if (p) {
            discount = p;
            break;
          }
        }
      }
    }

    // search page for percent tokens as a fallback
    if (!discount) {
      const page = $("body").text();
      discount = parsePercentageFromText(page);
    }

    // -------------------------
    // Fallback default values
    // -------------------------
    const out = {
      title: title || "No title found",
      description: description || "No description found",
      price: price || null,
      rawPrice: rawPrice || null,
      image: image || "https://via.placeholder.com/400x300?text=No+Image",
      rating: rating || null,
      reviewCount: reviewCount || null,
      discount: discount || null,
      // include some internal debug hints (optional — remove in production)
      _debug: {
        jsonld,
      },
    };

    res.json(out);
  } catch (error) {
    console.error("❌ Scraper Error:", error);
    res.status(500).json({ error: "Failed to fetch product data", details: error.message });
  }
});

// -------------------------
// Start Server
// -------------------------
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});