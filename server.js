import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();

app.use(cors({
  origin: '*', // Allow all origins for now (you can restrict later)
  methods: ['GET', 'POST'],
}));

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const PORT = process.env.PORT || 3000;

app.get("/inventory-proxy", async (req, res) => {
  const variantId = req.query.variant_id;

  if (!variantId) {
    return res.status(400).json({ error: "variant_id is required" });
  }

  const query = `
    query getAllInventoryLevels {
      productVariant(id: "gid://shopify/ProductVariant/${variantId}") {
        id
        title
        inventoryItem {
          id
          inventoryLevels(first: 10) {
            edges {
              node {
                id
                location {
                  id
                  name
                }
                quantities(names: ["available"]) {
                  name
                  quantity
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(`https://${SHOPIFY_STORE}/admin/api/2024-07/graphql.json`, {
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

    res.json(json.data.productVariant.inventoryItem.inventoryLevels.edges.map(e => e.node));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
