// server.js - improved Flipkart + Amazon scraping (resolves short URLs, robust selectors)
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { URL } = require("url");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY || "254aa5de511e80f67e016d643d0caff5";

// ----------------- helpers -----------------
function onlyDigitsAndComma(n) {
  if (!n) return null;
  const m = n.toString().replace(/[^\d,]/g, "");
  return m || null;
}

function formatNumberWithCommas(n) {
  if (n == null) return null;
  const num = typeof n === "number" ? n : parseInt(String(n).replace(/,/g, ""), 10);
  if (Number.isNaN(num)) return null;
  return num.toLocaleString("en-IN");
}

function cleanPrice(raw) {
  if (!raw) return null;
  // find first chunk that contains digits and optionally decimals
  const match = raw.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  if (Number.isNaN(num)) return null;
  // show without decimals if integer
  const out = Number.isInteger(num) ? num : parseFloat(num.toFixed(2));
  return `₹${formatNumberWithCommas(out)}`;
}

function extractNumberFromText(raw) {
  if (!raw) return null;
  const m = raw.match(/(\d+([,]\d{3})*|\d+)/);
  if (!m) return null;
  return m[0].replace(/,/g, "");
}

function cleanRatingRaw(raw) {
  if (!raw) return null;
  const m = raw.match(/(\d+(\.\d+)?)/);
  return m ? m[0] : null;
}

// Try to resolve a short URL (follow redirects) and return final URL
async function resolveShortUrl(url) {
  try {
    // do a direct fetch (no ScraperAPI) to follow redirects and get final URL
    const resp = await fetch(url, { redirect: "follow", timeout: 15000 });
    // node-fetch sets resp.url to final url after following
    if (resp && resp.url) return resp.url;
    return url;
  } catch (err) {
    // fallback to original url on failure
    return url;
  }
}

// Fetch HTML via ScraperAPI with desktop user-agent
async function fetchHTMLWithScraper(apiUrl) {
  const scraperURL =
    `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&device_type=desktop&url=${encodeURIComponent(apiUrl)}`;
  const resp = await fetch(scraperURL, { timeout: 30000 });
  return await resp.text();
}

// Extract first element text safely
function textOrNull($elem) {
  if (!$elem || $elem.length === 0) return null;
  const t = $elem.first().text().trim();
  return t || null;
}

// find any element text that contains '₹' and looks like price
function findAnyPriceText($) {
  // look for common price glyphs
  const candidates = [];
  $("*").each((i, el) => {
    const txt = $(el).text();
    if (!txt) return;
    if (txt.indexOf("₹") !== -1 || /Rs\s?\.?/i.test(txt)) {
      // push trimmed
      const trimmed = txt.replace(/\s+/g, " ").trim();
      if (trimmed.length < 120) candidates.push(trimmed);
    }
  });
  // prefer candidate that contains digits and ₹
  for (const c of candidates) {
    if (/\d/.test(c)) return c;
  }
  return candidates.length ? candidates[0] : null;
}

// ----------------- main route -----------------
app.get("/", (req, res) => {
  res.send("🔥 Zubto Scraper Backend (improved) running");
});

app.get("/scrape", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    // Resolve short links (dl.flipkart.com, amzn.in etc.)
    try {
      const resolved = await resolveShortUrl(url);
      url = resolved || url;
    } catch (e) {
      // ignore, continue with original url
    }

    // fetch through ScraperAPI (desktop)
    const html = await fetchHTMLWithScraper(url);
    const $ = cheerio.load(html);

    const hostname = (() => {
      try { return new URL(url).hostname; } catch (e) { return ""; }
    })();
    const isFlipkart = hostname.includes("flipkart");
    const isAmazon = hostname.includes("amazon");

    // --------- Title & Description & Image (good fallbacks) ----------
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("meta[name='twitter:title']").attr("content") ||
      $("span.B_NuCI").text().trim() ||
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      null;

    const description =
      $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      textOrNull($("div._1mXcCf")) ||
      null;

    // Best image attempts
    let image =
      $("meta[property='og:image']").attr("content") ||
      $("link[rel='image_src']").attr("href") ||
      $("img#landingImage").attr("src") ||
      $("img#icImg").attr("src") || // older amazon
      $("img._396cs4").first().attr("src") ||
      $("img").first().attr("src") ||
      null;

    // sanitize Amazon low-res urls to hi-res when possible
    if (image && isAmazon) {
      // replace common Amazon size tokens to get better image
      image = image.replace(/_SX\d+(_SY\d+)?(_QL\d+)?(_.*)?(\.jpg|\.png|\.webp)?$/, "$1$4");
      // try removing thumbnail suffixes
      image = image.replace(/(\._)SY\d+_|_SY\d+_/g, "");
      // ensure https scheme
      if (image.startsWith("//")) image = "https:" + image;
    }
    if (image && image.startsWith("//")) image = "https:" + image;

    // ---------- PRICE, MRP, DISCOUNT ----------
    // Try many selectors for Amazon & Flipkart
    let rawPrice = null;
    let rawMrp = null;
    let rawDiscount = null;

    // Amazon-specific price build from whole+fraction pieces
    if (isAmazon) {
      const whole = textOrNull($(".a-price .a-price-whole")) || textOrNull($(".a-price-whole"));
      const frac = textOrNull($(".a-price .a-price-fraction")) || textOrNull($(".a-price-fraction"));
      if (whole) {
        rawPrice = frac ? `${whole}.${frac}` : whole;
        // if leading currency sign present somewhere, try to include nearby char
        const possible = $("span.a-price").first().text().trim();
        if (possible && possible.indexOf("₹") !== -1 && rawPrice.indexOf("₹") === -1) {
          rawPrice = possible;
        }
      }
      // alternative selectors
      rawPrice = rawPrice ||
        textOrNull($("#priceblock_dealprice")) ||
        textOrNull($("#priceblock_ourprice")) ||
        textOrNull($(".apexPriceToPay .a-offscreen")) ||
        textOrNull($(".priceBlockBuyingPriceString")) ||
        null;

      // MRP / list price
      rawMrp =
        textOrNull($(".priceBlockStrikePriceString")) ||
        textOrNull($("#priceblock_ourprice")) ||
        textOrNull($(".a-text-strike")) ||
        null;

      // discount (amazon shows savings or percent)
      rawDiscount =
        textOrNull($("#regularprice_savings")) ||
        textOrNull($(".savingsPercentage")) ||
        null;
    }

    // Flipkart-specific selectors (new + old)
    if (isFlipkart) {
      // newer Flipkart price containers (2024-2025 variants)
      rawPrice =
        textOrNull($("._30jeq3._16Jk6d")) ||
        textOrNull($("._30jeq3")) ||
        textOrNull($("._25b18c")) ||
        textOrNull($("div.Nx9bqj.CxhGGd")) ||
        null;

      // fallback generic search for any text with ₹
      if (!rawPrice) {
        const found = findAnyPriceText($);
        if (found) rawPrice = found;
      }

      // MRP often in strike-through element
      rawMrp =
        textOrNull($("._3I9_wc._2p6lqe")) ||
        textOrNull($("._2whKao")) || // sometimes used
        (function(){
          // try to find <del> or <s> near price
          const del = $("del, s, ._3I9_wc").first();
          return textOrNull(del);
        })() ||
        null;

      // discount badge
      rawDiscount =
        textOrNull($("._3Ay6Sb ._2Zk0V")) ||
        textOrNull($("._3Ay6Sb span")) ||
        null;
    }

    // Generic fallbacks for any site:
    if (!rawPrice) {
      rawPrice =
        $("meta[property='product:price:amount']").attr("content") ||
        $("meta[itemprop='price']").attr("content") ||
        findAnyPriceText($) ||
        null;
    }
    if (!rawMrp) {
      // look for strike-through price
      const strike = $("strike, del, ._3I9_wc, .a-text-strike").first();
      rawMrp = textOrNull(strike) || null;
    }

    // Clean price/mrp/discount
    const price = cleanPrice(rawPrice);
    const mrp = cleanPrice(rawMrp);

    // If we have mrp and price, compute discount percentage if not provided
    let discount = rawDiscount || null;
    if (!discount && price && mrp) {
      try {
        const numPrice = parseFloat(price.replace(/[^\d.]/g, ""));
        const numMrp = parseFloat(mrp.replace(/[^\d.]/g, ""));
        if (!Number.isNaN(numPrice) && !Number.isNaN(numMrp) && numMrp > numPrice) {
          const pct = Math.round(((numMrp - numPrice) / numMrp) * 100);
          discount = `${pct}% off`;
        }
      } catch (e) {
        // ignore
      }
    }

    // ---------- RATINGS & REVIEWS ----------
    // Raw rating text
    let rawRating =
      textOrNull($(".a-icon-alt")) ||
      textOrNull($("#acrPopover")) ||
      textOrNull($("div._3LWZlK")) ||
      textOrNull($("span._1lRcqv")) ||
      null;

    // Raw reviews text (flipkart shows "4,014 ratings & 254 reviews" in one block often)
    let rawReviews =
      textOrNull($("#acrCustomerReviewText")) || // amazon "39,897 ratings"
      textOrNull($("span._2_R_DZ")) || // Flipkart block that contains ratings & reviews
      textOrNull($("span._1i0wk8")) || // alternative
      textOrNull($("._3UAT2v._16PBlm")) || // alternative
      null;

    // For flipkart sometimes ratings/reviews are in same text e.g. "4,014 Ratings & 254 Reviews"
    // We want: rating string like "4.1" and reviews string like "3,452 reviews"
    const ratingVal = cleanRatingRaw(rawRating);
    let reviewsCount = null;
    if (rawReviews) {
      // try extract the first large number and interpret it as ratings count
      const r = rawReviews.match(/(\d{1,3}(?:,\d{3})+|\d+)/g);
      if (r && r.length) {
        // Prefer the first number if it is large; otherwise take last
        // Choose the biggest by length
        let chosen = r[0];
        for (const x of r) {
          if (x.replace(/,/g, "").length > chosen.replace(/,/g, "").length) chosen = x;
        }
        reviewsCount = chosen.replace(/,/g, "");
      }
    }

    // If still null, try searching the page for the word "ratings" or "reviews"
    if (!reviewsCount) {
      const fullText = $("body").text();
      const m = fullText.match(/([\d,]{2,})\s+(?:ratings|rating|reviews|review)/i);
      if (m) reviewsCount = m[1].replace(/,/g, "");
    }

    // Format rating & reviews to the user's requested output:
    const ratingOut = ratingVal ? String(ratingVal) : null;
    const reviewsOut = reviewsCount ? `${formatNumberWithCommas(reviewsCount)} reviews` : null;

    // final JSON
    const result = {
      url,
      title: title || null,
      description: description || null,
      price: price || null,
      mrp: mrp || null,
      discount: discount || null,
      rating: ratingOut,
      reviews: reviewsOut,
      image: image || null
    };

    return res.json(result);
  } catch (err) {
    console.error("Scrape failed:", err && err.message ? err.message : err);
    return res.status(500).json({ error: "Failed to scrape product data" });
  }
});

// start
app.listen(PORT, () => {
  console.log(`🚀 Zubto Scraper (improved) running on port ${PORT}`);
});