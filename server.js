import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  })
);

const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const PORT = process.env.PORT || 3000;

app.get("/inventory-proxy", async (req, res) => {
  const variantId = req.query.variant_id;
  const locationId = req.query.location_id;

  if (!variantId || !locationId) {
    return res
      .status(400)
      .json({ error: "variant_id and location_id are required" });
  }

  // Build GraphQL query to fetch all inventory levels for the variant
  const query = `
    query {
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
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2023-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    const jsonData = await response.json();

    if (jsonData.errors) {
      return res.status(500).json({ error: jsonData.errors });
    }

    // Filter inventoryLevels by requested location
    const edges =
      jsonData.data.productVariant.inventoryItem.inventoryLevels.edges || [];

    const inventoryLevel = edges.find((e) =>
      e.node.location.id.endsWith(locationId)
    );

    if (!inventoryLevel) {
      return res
        .status(404)
        .json({ error: "Inventory for this location not found" });
    }

    const availableQuantity =
      inventoryLevel.node.quantities[0]?.quantity ?? 0;

    res.json({
      variantId,
      locationId,
      locationName: inventoryLevel.node.location.name,
      availableQuantity,
       inventoryLevels: {
        edges
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Inventory proxy server running on port ${PORT}`);
});
