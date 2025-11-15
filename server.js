// server.js
import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";   // ✅ FIXED: correct import

const app = express();
app.use(cors());

async function launchBrowser() {
  return await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process"
    ]
  });
}

async function scrapeProduct(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    let title = null;
    let price = null;
    let image = null;
    let description = null;

    if (url.includes("amazon")) {
      title = $("#productTitle").text().trim();
      price =
        $("#priceblock_ourprice").text().trim() ||
        $("#priceblock_dealprice").text().trim() ||
        $(".a-price-whole").first().text().trim();
      image = $("#landingImage").attr("src");
      description = $("#feature-bullets ul li span")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    if (url.includes("flipkart")) {
      title = $(".B_NuCI").text().trim();
      price = $("._30jeq3").first().text().trim();
      image = $("._396cs4").attr("src");
      description = $("._1mXcCf p")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    if (url.includes("ajio")) {
      title = $(".prod-sp").text().trim();
      price = $(".prod-sp .price").first().text().trim();
      image = $(".image-container img").attr("src");
      description = $(".prod-descp ul li")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    if (url.includes("myntra")) {
      title = $(".pdp-title").text().trim() + " " + $(".pdp-name").text().trim();
      price = $(".pdp-price span").first().text().trim();
      image = $(".image-grid-image").attr("src");
      description = $(".pdp-product-description-content p")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    await browser.close();

    return {
      title: title || "Untitled Product",
      price: price || "N/A",
      image: image || null,
      description: description || "No description"
    };

  } catch (err) {
    await browser.close();
    return {
      title: "Untitled Product",
      price: "N/A",
      image: null,
      description: "No description"
    };
  }
}

app.get("/scrape", async (req, res) => {
  const { url } = req.query;

  if (!url) return res.json({ error: "Missing URL" });

  const info = await scrapeProduct(url);
  res.json(info);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🔥 Server running at ${PORT}`));