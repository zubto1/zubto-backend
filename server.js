import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

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
    await page.goto(url, { waitUntil: "networkidle2", timeout: 50000 });

    const finalURL = page.url();

    const data = await page.evaluate(() => {
      const $ = document;

      const get = (selector) =>
        $.querySelector(selector)?.textContent?.trim() || null;
      const getAll = (selector) =>
        [...$.querySelectorAll(selector)].map(el => el.textContent.trim()).join(" | ") || null;
      const getSrc = (selector) =>
        $.querySelector(selector)?.src || null;

      let title = get("#productTitle") || get(".B_NuCI") || get(".prod-title") || get(".pdp-title");
      let price =
        get("#priceblock_ourprice") ||
        get("#priceblock_dealprice") ||
        get(".a-price-whole") ||
        get("._30jeq3") ||
        get(".price") ||
        get("span[data-testid='price']");

      let image =
        getSrc("#landingImage") ||
        getSrc("img._396cs4") ||
        getSrc("img._2r_T1I") ||
        getSrc(".image-grid-image") ||
        getSrc(".image-container img");

      let description =
        getAll("#feature-bullets ul li span") ||
        getAll("._1mXcCf p") ||
        getAll(".product-description p") ||
        getAll(".pdp-product-description-content p");

      return { title, price, image, description };
    });

    await browser.close();

    return {
      title: data.title || "No title found",
      price: data.price || "N/A",
      image: data.image || null,
      description: data.description || "No description found",
      finalURL
    };

  } catch (err) {
    await browser.close();
    return {
      title: "Error",
      price: "N/A",
      image: null,
      description: err.message,
      finalURL: url
    };
  }
}

app.get("/scrape", async (req, res) => {
  if (!req.query.url) return res.json({ error: "Missing URL" });
  res.json(await scrapeProduct(req.query.url));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🔥 Server live on ${PORT}`));