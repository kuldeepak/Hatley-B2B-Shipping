import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = "2026-04";

// -----------------------------
// Shopify GraphQL helper (SAFE)
// -----------------------------
async function shopifyGraphQL({ shop, query, variables }) {
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  console.log("➡️ Shopify GraphQL Request:", {
    shop,
    variables,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error("❌ Invalid JSON from Shopify:", text);
    throw new Error("Invalid Shopify response");
  }

  if (!res.ok || data.errors) {
    console.error("❌ Shopify GraphQL Error:", {
      status: res.status,
      data,
    });
  }

  return data;
}

// -----------------------------
// Main Action
// -----------------------------
export async function action({ request }) {
  console.log("🚀 Webhook hit");

  try {
    let order;
    let shop;

    // -----------------------------
    // DEV vs PROD
    // -----------------------------
    if (process.env.NODE_ENV === "development") {
      console.log("⚠️ DEV MODE");

      order = await request.json();
      shop =
        request.headers.get("x-shopify-shop-domain") ||
        order?.shop_domain;
    } else {
      const rawBody = await request.text();
      const { payload } = await authenticate.webhook(request, rawBody);
      order = payload;
      shop =
        request.headers.get("x-shopify-shop-domain") ||
        payload?.shop_domain;
    }

    console.log("🛒 Shop:", shop);
    console.log("📦 Order payload received");

    if (!shop) throw new Error("Shop not found");

    // -----------------------------
    // Order ID
    // -----------------------------
    const orderId = order.admin_graphql_api_id || order.id;
    console.log("🆔 Order ID:", orderId);

    // -----------------------------
    // Fulfillment Mode
    // -----------------------------
    const fulfillmentMode = order.note_attributes?.find(
      (a) => a.name === "fulfillment_mode"
    )?.value;

    console.log("📦 fulfillment_mode:", fulfillmentMode);
    if (!fulfillmentMode) {
      console.log("ℹ️ No fulfillment_mode, exiting");
      return json({ success: true });
    }

    // -----------------------------
    // Target Location
    // -----------------------------
    const TARGET_LOCATIONS = {
      booking: "gid://shopify/Location/77507559507",
      immediate: "gid://shopify/Location/77507592275",
    };

    const targetLocation = TARGET_LOCATIONS[fulfillmentMode];
    console.log("📍 Target Location:", targetLocation);

    if (!targetLocation) {
      console.log("❌ Invalid fulfillment mode");
      return json({ success: false });
    }

    // -----------------------------
    // Get Fulfillment Orders
    // -----------------------------
    const GET_FULFILLMENT_ORDERS = `
      query ($orderId: ID!) {
        order(id: $orderId) {
          fulfillmentOrders(first: 10) {
            edges {
              node {
                id
                assignedLocation {
                  location {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const foData = await shopifyGraphQL({
      shop,
      query: GET_FULFILLMENT_ORDERS,
      variables: { orderId },
    });

    console.log("📦 foData:", foData);

    const fulfillmentOrders =
      foData.data?.order?.fulfillmentOrders?.edges?.map(e => e.node) || [];

    console.log(
      "📦 Fulfillment Orders found:",
      fulfillmentOrders.map(f => f.id)
    );

    if (!fulfillmentOrders.length) {
      console.log("⚠️ No fulfillment orders found");
      return json({ success: true });
    }

    // -----------------------------
    // Move Fulfillment Orders dynamically
    // -----------------------------
    const MOVE_FULFILLMENT_ORDER = `
      mutation ($fulfillmentOrderId: ID!, $newLocationId: ID!) {
        fulfillmentOrderMove(
          id: $fulfillmentOrderId,
          newLocationId: $newLocationId
        ) {
          movedFulfillmentOrder {
            id
            assignedLocation {
              location { id name }
            }
          }
          originalFulfillmentOrder { id }
          remainingFulfillmentOrder { id }
          userErrors { field message }
        }
      }
    `;

    const moveResults = [];

    for (const fo of fulfillmentOrders) {
      console.log("➡️ Processing FO:", fo.id);

      const assignedLocationId = fo.assignedLocation?.location?.id;
      console.log("📍 Assigned Location:", assignedLocationId);

      if (assignedLocationId === targetLocation) {
        console.log("ℹ️ Already at target location");
        continue;
      }

      // -----------------------------
      // Move FO using the mutation (like your curl)
      // -----------------------------
      const moveData = await shopifyGraphQL({
        shop,
        query: MOVE_FULFILLMENT_ORDER,
        variables: {
          fulfillmentOrderId: fo.id, // dynamic FO ID
          newLocationId: targetLocation, // dynamic location based on fulfillment_mode
        },
      });

      console.log("✅ Move response:", moveData);
      moveResults.push(moveData);
    }

    return json({ success: true, moveResults });
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    return new Response("Error", { status: 500 });
  }
}
