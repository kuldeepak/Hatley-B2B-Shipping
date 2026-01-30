# Shopify Plus – Fulfillment Routing Constraints Solution

## IMPORTANT
This solution works **ONLY on Shopify Plus**.

If the store is **Basic / Advanced**, routing constraints via
`fulfillmentConstraintRuleCreate` WILL NOT work.

---

## WHAT THIS ZIP DOES
✔ Uses Shopify Functions (Order Routing)
✔ Creates Fulfillment Constraint Rules
✔ Shows Routing Constraints in Admin
✔ Designed for Shopify Plus stores

---

## SETUP STEPS

### 1. Scopes (MANDATORY)
Add these scopes and reinstall app:
```
write_fulfillment_constraint_rules
write_fulfillments
read_orders
```

---

### 2. Deploy the Function
```
cd extensions/order-routing
shopify app deploy
```

---

### 3. Create Constraint Rule (GraphQL)
Run this mutation AFTER app install:
```
mutation {
  fulfillmentConstraintRuleCreate(
    functionHandle: "order-routing"
    name: "Hatley B2B Constraint"
    enabled: true
  ) {
    fulfillmentConstraintRule {
      id
    }
    userErrors {
      message
    }
  }
}
```

---

## VERIFY
Admin → Shipping & Delivery → Order Routing → Routing Constraints

---
