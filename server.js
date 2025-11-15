import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

// ---- FIXED: Flipkart short URL expansion ----
async function expandURL(url) {
  try {
    const response = await axios.head(url, {
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    return response.request.res.responseUrl || url;

  } catch (err) {
    return url;
  }
}

// -------- Universal Scraper --------
async function scrapeProduct(url) {
  try {
    // Expand Flipkart short URLs
    if (url.includes("dl.flipkart.com")) {
      url = await expandURL(url);
      console.log("Expanded URL:", url);
    }

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/121 Safari/537.36",
      }
    });

    const $ = cheerio.load(response.data);

    let title = null,
      price = null,
      image = null,
      description = "";

    // Amazon
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

    // Flipkart
    else if (url.includes("flipkart")) {
      title = $(".B_NuCI").text().trim();
      price = $("._30jeq3").first().text().trim();
      image = $("._396cs4, .q6DClP").first().attr("src");
      description = $("._1mXcCf p")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    // Ajio
    else if (url.includes("ajio")) {
      title = $(".prod-sp").text().trim();
      price = $(".price").first().text().trim();
      image = $("img").first().attr("src");
      description = $(".prod-descp li")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    // Myntra
    else if (url.includes("myntra")) {
      title = $(".pdp-title").text().trim() + " " + $(".pdp-name").text().trim();
      price = $(".pdp-price span").first().text().trim();
      image = $(".image-grid-image").first().attr("src");
      description = $(".pdp-product-description-content p")
        .map((i, el) => $(el).text().trim())
        .get()
        .join(" | ");
    }

    return {
      title: title || "Untitled Product",
      price: price || "N/A",
      image: image || null,
      description: description || "No description found",
      finalURL: url,
    };

  } catch (err) {
    return {
      title: "Untitled Product",
      price: "N/A",
      image: null,
      description: "No description found",
      finalURL: url
    };
  }
}

// -------- API Route --------
app.get("/scrape", async (req, res) => {
  const { url } = req.query;

  if (!url) return res.json({ error: "Missing URL" });

  const data = await scrapeProduct(url);
  res.json(data);
});

// Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("🔥 Backend running on " + PORT));