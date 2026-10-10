// Shapes taken directly from tcgapi.dev's published docs
// (tcgapi.dev/introduction/, tcgapi.dev/api/cards/), fetched 2026-09-25 while
// researching this integration.

export const tcgApiDevSearchResponse = {
  data: [
    {
      id: 12345,
      name: "Charizard ex",
      set_name: "Obsidian Flames",
      rarity: "Double Rare",
      product_type: "Cards",
      printing: "Normal",
      market_price: 24.99,
      low_price: 19.5,
      median_price: 26.5,
      lowest_with_shipping: 20.99,
      image_url: "https://tcgplayer-cdn.tcgplayer.com/product/example.jpg",
    },
  ],
  meta: { total: 1, page: 1, per_page: 50, has_more: false },
  rate_limit: { daily_limit: 100, daily_remaining: 99 },
};

export const tcgApiDevPricesArrayResponse = {
  data: [
    {
      card_id: 12345,
      printing: "Normal",
      market_price: 22.5,
      low_price: 18.0,
      median_price: 24.0,
      lowest_with_shipping: 19.25,
      buylist_price: 16.0,
      price_change_24h: -1.1,
      price_change_7d: -5.3,
      last_updated_at: "2026-02-19T07:00:00.000Z",
    },
  ],
};

export const tcgApiDevPricesSingleResponse = {
  data: {
    card_id: 999,
    printing: "Foil",
    market_price: 42.5,
    low_price: 35.0,
  },
};

export const tcgApiDevMissingKeyError = { error: "API key is required" };
