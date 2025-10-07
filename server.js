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
  const productId = req.query.product_id;
  const locationId = req.query.location_id;

  if (!productId || !locationId) {
    return res.status(400).json({ error: "product_id and location_id are required" });
  }

  const productGID = `gid://shopify/Product/${productId}`;
  let allVariants = [];
  let hasNextPage = true;
  let cursor = null;
 
  try {
    while (hasNextPage) {
      const query = `
        query getInventoryLevels($productId: ID!, $after: String) {
          product(id: $productId) {
            id
            title
            variants(first: 10, after: $after) {
              edges {
                cursor
                node {
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
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `;

      const response = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2023-07/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            variables: {
              productId: productGID,
              after: cursor,
            },
          }),
        }
      );

      const jsonData = await response.json();

      if (jsonData.errors) {
        return res.status(500).json({ error: jsonData.errors });
      }

      const product = jsonData.data.product;
      const variantEdges = product?.variants?.edges || [];

      variantEdges.forEach((edge) => {
        const variant = edge.node;
        const inventoryLevels = variant.inventoryItem?.inventoryLevels?.edges || [];

        // Filter inventory by requested location
        const level = inventoryLevels.find((lvl) =>
          lvl.node.location.id.endsWith(locationId)
        );

        if (level) {
          allVariants.push({
            variantId: variant.id,
            variantTitle: variant.title,
            locationId: level.node.location.id,
            locationName: level.node.location.name,
            availableQuantity: level.node.quantities[0]?.quantity ?? 0,
            inventoryLevels:inventoryLevels,
          });
        }
  
      });



      hasNextPage = product?.variants?.pageInfo?.hasNextPage;
      cursor = product?.variants?.pageInfo?.endCursor;
    }

    res.json({
      productId,
      locationId,
      totalVariants: allVariants.length,
      variants: allVariants,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Inventory proxy server running on port ${PORT}`);
});
