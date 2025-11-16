const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());

// Helper: safely extract text
const clean = (txt) => txt?.replace(/\s+/g, " ").trim() || "";

// SCRAPER FUNCTION
async function scrape(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    let title = "";
    let price = "";
    let image = "";
    let desc = "";

    // ----------------------------
    // 🔵 FLIPKART SCRAPER
    // ----------------------------
    if (url.includes("flipkart.com")) {
      title =
        clean($("span.B_NuCI").text()) ||
        clean($("h1").text());

      price =
        clean($("div._30jeq3._16Jk6d").text()) ||
        clean($("div._25b18c ._30jeq3").text());

      image =
        $("img._396cs4._2amPTt").attr("src") ||
        $("img._96yvcc").attr("src") ||
        $("img._2r_T1I").attr("src");

      desc =
        clean($("div._1AN87F p").text()) ||
        clean($("div._2418kt ul li").first().text());
    }

    // ----------------------------
    // 🟠 AMAZON SCRAPER
    // ----------------------------
    else if (url.includes("amazon.")) {
      title =
        clean($("#productTitle").text()) ||
        clean($("#title").text());

      price =
        clean($("#priceblock_ourprice").text()) ||
        clean($("#priceblock_dealprice").text()) ||
        clean($(".a-price-whole").first().text());

      image =
        $("#landingImage").attr("src") ||
        $("img.a-dynamic-image").attr("src");

      desc =
        clean($("#feature-bullets ul li span").first().text()) ||
        clean($("#productDescription p").text());
    }

    // ----------------------------
    // 🟣 MEESHO SCRAPER
    // ----------------------------
    else if (url.includes("meesho.com")) {
      title = clean($("h1").first().text());
      price = clean($("h4").first().text());
      image = $("img").first().attr("src");
      desc = clean($("p").first().text());
    }

    // ----------------------------
    // 🟢 AJIO SCRAPER
    // ----------------------------
    else if (url.includes("ajio.com")) {
      title = clean($(".prod-name").text());
      price = clean($(".price").text());
      image = $("img").first().attr("src");
      desc = clean($(".prod-info-section").text());
    }

    // ----------------------------
    // 🟡 MYNTRA SCRAPER
    // ----------------------------
    else if (url.includes("myntra.com")) {
      title = clean($(".pdp-title").text() + " " + $(".pdp-name").text());
      price = clean($(".pdp-price").text());
      image = $("img").first().attr("src");
      desc = clean($(".pdp-product-description-content").text());
    }

    return {
      title: title || "No title found",
      price: price || "N/A",
      image: image || null,
      description: desc || "No description found",
      finalURL: url,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// ----------------------------
// ROUTE
// ----------------------------
app.get("/scrape", async (req, res) => {
  const url = req.query.url;

  if (!url) return res.json({ error: "URL is required" });

  const data = await scrape(url);
  res.json(data);
});

app.listen(3000, () =>
  console.log("Server running on port 3000")
);