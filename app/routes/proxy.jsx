import { json } from "@remix-run/node";
import { shopifyGraphQL } from "../shopify.server";

// Loader (optional, can be used to test route)
export async function loader() {
  return json({ ok: true });
}

// Action handles POST requests for all three operations
export async function action({ request }) {
  try {
    const body = await request.json();
    const { actionType, customerId, repCode, companyId } = body;

    if (!actionType) {
      return json({ error: "Missing actionType" }, { status: 400 });
    }

    switch (actionType) {
      // 1️⃣ Fetch the current company of a customer
      case "fetchCompany": {
        if (!customerId) {
          return json({ error: "Missing customerId" }, { status: 400 });
        }

        const query = `
          query ($id: ID!) {
            customer(id: $id) {
              displayName
              email
              metafield(namespace: "custom", key: "rep_code") { value }
              companyContactProfiles {
                id
                company {
                  id
                  name
                  metafield(namespace: "custom", key: "rep_codes") { value }
                  locations(first: 50) { nodes { id name shippingAddress { formattedAddress } } }
                }
              }
            }
          }
        `;

        const variables = { id: `gid://shopify/Customer/${customerId}` };

        const result = await shopifyGraphQL({
          shop: process.env.SHOPIFY_STORE_DOMAIN,
          query,
          variables,
        });

        const customer = result.data?.customer ?? null;
        const profile = customer?.companyContactProfiles?.[0] ?? null;
        const company = profile?.company ?? null;
        const repCodeValue = customer?.metafield?.value || "";

        return json({ company, repCode: repCodeValue });
      }

      // 2️⃣ Fetch all companies linked to a Rep Code
      case "fetchRepCompanies": {
        if (!repCode) {
          return json({ companies: [] });
        }

        const query = `
          query ListRepCompanies($query: String!) {
            companies(first: 250, query: $query) {
              edges {
                node {
                  id
                  name
                  externalId
                  locations(first: 50) { nodes { id name } }
                }
              }
            }
          }
        `;

        const variables = { query: `metafields.custom.rep_codes:"${repCode}"` };
        const result = await shopifyGraphQL({
          shop: process.env.SHOPIFY_STORE_DOMAIN,
          query,
          variables,
        });

        const companies =
          result.data?.companies?.edges?.map((e) => e.node) || [];

        return json({ companies });
      }

      // 3️⃣ Assign customer to a company
      case "assignCompany": {
        if (!customerId || !companyId) {
          return json(
            { error: "Missing customerId or companyId" },
            { status: 400 }
          );
        }

        // Step 1: Remove customer from current company
        const fetchQuery = `
          query ($id: ID!) {
            customer(id: $id) {
              companyContactProfiles { id }
            }
          }
        `;
        const fetchVars = { id: `gid://shopify/Customer/${customerId}` };
        const fetchResult = await shopifyGraphQL({
          shop: process.env.SHOPIFY_STORE_DOMAIN,
          query: fetchQuery,
          variables: fetchVars,
        });

        const currentProfiles =
          fetchResult.data?.customer?.companyContactProfiles || [];

        for (let profile of currentProfiles) {
          const removeMutation = `
            mutation RemoveCustomerFromCompany($companyContactId: ID!) {
              companyContactRemoveFromCompany(companyContactId: $companyContactId) {
                removedCompanyContactId
                userErrors { field message }
              }
            }
          `;
          await shopifyGraphQL({
            shop: process.env.SHOPIFY_STORE_DOMAIN,
            query: removeMutation,
            variables: { companyContactId: profile.id },
          });
        }

        // Step 2: Assign customer to new company
        const assignMutation = `
          mutation AssignRepAsCompanyContact($companyId: ID!, $customerId: ID!) {
            companyAssignCustomerAsContact(companyId: $companyId, customerId: $customerId) {
              companyContact { id customer { id email } company { id name } }
              userErrors { field message }
            }
          }
        `;
        const assignResult = await shopifyGraphQL({
          shop: process.env.SHOPIFY_STORE_DOMAIN,
          query: assignMutation,
          variables: {
            companyId,
            customerId: `gid://shopify/Customer/${customerId}`,
          },
        });

        if (
          assignResult.data?.companyAssignCustomerAsContact?.userErrors?.length
        ) {
          return json(
            { error: assignResult.data.companyAssignCustomerAsContact.userErrors[0].message },
            { status: 400 }
          );
        }

        return json({ success: true });
      }

      default:
        return json({ error: "Invalid actionType" }, { status: 400 });
    }
  } catch (err) {
    console.error("❌ PROXY BACKEND ERROR:", err);
    return json({ error: "Internal proxy error" }, { status: 500 });
  }
}