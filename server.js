import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
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

  // 🟩 Force Mobile Browser (Flipkart works only in mobile mode)
  await page.setUserAgent(
    "Mozilla/5.0 (Linux; Android 10; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36"
  );

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    const finalURL = page.url();

    await page.goto(finalURL, { waitUntil: "networkidle2", timeout: 60000 });

    // Wait extra time for Flipkart dynamic content
    await page.waitForTimeout(1500);

    const html = await page.content();
    const $ = cheerio.load(html);

    let title = null, price = null, image = null, description = null;

    // AMAZON
    if (finalURL.includes("amazon")) {
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

    // FLIPKART – FIXED
    if (finalURL.includes("flipkart")) {
      title = $("._4rR01T").text().trim() || $(".B_NuCI").text().trim();
      price = $("._30jeq3").first().text().trim();
      image =
        $("img._396cs4").attr("src") ||
        $("img._2r_T1I").attr("src") ||
        $("img").first().attr("src");

      description = $("._1mXcCf p, ._2418kt li, ._21Ahn- li")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    // AJIO
    if (finalURL.includes("ajio")) {
      title = $(".prod-sp").text().trim();
      price = $(".prod-price").first().text().trim();
      image = $(".image-container img").attr("src");
      description = $(".prod-descp ul li")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    // MYNTRA
    if (finalURL.includes("myntra")) {
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
      description: description || "No description found",
      finalURL
    };

  } catch (err) {
    await browser.close();
    return {
      title: "Untitled Product",
      price: "N/A",
      image: null,
      description: "No description found",
      error: err.message
    };
  }
}

app.get("/scrape", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.json({ error: "Missing URL" });

  const result = await scrapeProduct(url);
  res.json(result);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));