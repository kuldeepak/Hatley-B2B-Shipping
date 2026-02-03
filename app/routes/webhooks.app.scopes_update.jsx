import { json } from "@remix-run/node";

async function shopifyGraphQL({ shop, query, variables }) {
  const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
  const API_VERSION = "2026-04";
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  return data;
}

// POST action for your fetch
export async function action({ request }) {
  const { query, variables } = await request.json();
  const shop = process.env.SHOPIFY_ADMIN_TOKEN;
  const response = await shopifyGraphQL({ shop, query, variables });
  return json(response);
}
