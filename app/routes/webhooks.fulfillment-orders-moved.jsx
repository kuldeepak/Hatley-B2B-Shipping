import { authenticate } from "../shopify.server";

export async function action({ request }) {
  await authenticate.webhook(request);
  const payload = await request.json();

  console.log("🔵 FULFILLMENT MOVED CONFIRMED:", payload);

  return new Response("OK", { status: 200 });
}
