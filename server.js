import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";  // <-- add this

dotenv.config();

const app = express();

// Allow CORS for Shopify frontend
app.use(cors({
  origin: 'https://himanshu-self.myshopify.com', // Shopify store URL
  methods: ['GET', 'POST'],
}));

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const PORT = process.env.PORT || 3000;

app.get("/inventory-proxy", async (req, res) => {
  const variantId = req.query.variant_id;
  const locationId = req.query.location_id;

  if (!variantId || !locationId) {
    return res.status(400).json({ error: "variant_id and location_id are required" });
  }

  const query = `
  {
    productVariant(id: "${variantId}") {
      id
      sku
      inventoryItem {
        inventoryLevels(first: 10, query: "location_id:${locationId}") {
          edges {
            node {
              location { id name }
              quantities(names: ["available"]) { name quantity }
            }
          }
        }
      }
    }
  }`;

  try {
    const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2023-07/graphql.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const json = await response.json();

    if (json.errors) {
      return res.status(500).json({ error: json.errors });
    }

    res.json(json.data.productVariant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Inventory proxy server running on port ${PORT}`);
});
