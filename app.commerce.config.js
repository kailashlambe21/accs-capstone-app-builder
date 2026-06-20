const { defineConfig } = require("@adobe/aio-commerce-lib-app/config");

module.exports = defineConfig({
  metadata: {
    id: "kailash-accs-capstone-app",
    displayName: "Kailash ACCS Capstone App",
    version: "1.0.0",
    description:
      "PDP Badge Management — rules-based badge assignment for Adobe Commerce products.",
  },
  eventing: {
    commerce: [
      {
        provider: {
          label: "Commerce Events",
          description: "Events from Adobe Commerce for badge evaluation.",
        },
        events: [
          {
            name: "observer.catalog_product_save_after",
            label: "Product Saved",
            description: "Triggered when a product is saved in Commerce - re-evaluates badges for that SKU.",
            runtimeActions: ["badge-management/product-event-consumer"],
            fields: [
              { name: "sku" },
            ],
          },
        ],
      },
    ],
  },
  adminUiSdk: {
    registration: {
      menuItems: [
        {
          id: 'badge_management::apps',
          title: 'Badge Management',
          isSection: true,
          sortOrder: 100,
        },
        {
          id: 'badge_management::main',
          title: 'Badge Management',
          parent: 'badge_management::apps',
          sortOrder: 1,
        },
      ],
    },
  },
});
