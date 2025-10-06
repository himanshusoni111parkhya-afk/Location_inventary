require('dotenv').config();
const express = require('express');
const { Shopify, ApiVersion } = require('@shopify/shopify-api');

const app = express();

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Initialize Shopify API client
Shopify.Context.initialize({
  API_KEY: process.env.SHOPIFY_API_KEY,
  API_SECRET_KEY: process.env.SHOPIFY_API_SECRET,
  SCOPES: ['read_inventory'],
  HOST_NAME: process.env.HOST || 'location-inventary.onrender.com',
  API_VERSION: ApiVersion.October23, // Use 2023-10 API version
  IS_EMBEDDED_APP: false,
});

app.get('/inventory-proxy', async (req, res) => {
  const { variant_id, location_id } = req.query;

  if (!variant_id || !location_id) {
    return res.status(400).json({ error: 'Missing variant_id or location_id' });
  }

  try {
    const client = new Shopify.Clients.Graphql(
      process.env.SHOPIFY_STORE_DOMAIN,
      process.env.SHOPIFY_ACCESS_TOKEN
    );

    // GraphQL query to fetch inventory level
    const query = `
      query ($variantId: ID!, $locationId: ID!) {
        productVariant(id: "gid://shopify/ProductVariant/${variant_id}") {
          inventoryItem {
            inventoryLevels(first: 1, query: "location_id:${location_id}") {
              edges {
                node {
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

    const response = await client.query({
      data: {
        query,
        variables: { variantId: `gid://shopify/ProductVariant/${variant_id}`, locationId: `gid://shopify/Location/${location_id}` },
      },
    });

    res.json(response.body.data);
  } catch (error) {
    console.error('Shopify GraphQL error:', error.message, error.response?.errors);
    res.status(500).json({ error: 'Failed to fetch inventory', details: error.message, graphqlErrors: error.response?.errors });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));