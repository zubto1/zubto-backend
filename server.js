import express from "express";
import cors from "cors";
import cheerio from "cheerio";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const app = express();
app.use(cors());

async function launchBrowser() {
  const executablePath = await chromium.executablePath;

  return await puppeteer.launch({
    executablePath,
    headless: chromium.headless,
    args: chromium.args,
    defaultViewport: chromium.defaultViewport
  });
}

async function scrapeProduct(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    const finalURL = page.url();

    await page.goto(finalURL, { waitUntil: "networkidle2", timeout: 45000 });
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

    // FLIPKART
    if (finalURL.includes("flipkart")) {
      title = $(".B_NuCI").text().trim();
      price = $("._30jeq3").first().text().trim();
      image =
        $("img._396cs4").attr("src") ||
        $("img._2r_T1I").attr("src") ||
        $("img").first().attr("src");
      description = $("._1mXcCf p")
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

  res.json(await scrapeProduct(url));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));