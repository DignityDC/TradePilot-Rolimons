export const REQUEST_TAGS = [
  "any",
  "demand",
  "rares",
  "rap",
  "wishlist",
  "robux",
  "upgrade",
  "downgrade",
  "adds",
  "projecteds",
] as const;

export type RequestTag = (typeof REQUEST_TAGS)[number];

export const TAG_IMAGES: Record<RequestTag, string> = {
  any: "/tradetagany-420.png",
  demand: "/tradetagdemand-420.png",
  rares: "/tradetagrares-420.png",
  rap: "/tradetagrap-420.png",
  wishlist: "/tradetagwishlist-420.png",
  robux: "/tradetagrobux-420.png",
  upgrade: "/tradetagupgrade-420.png",
  downgrade: "/tradetagdowngrade-420.png",
  adds: "/tradetagadds-420.png",
  projecteds: "/tradetagprojecteds-420.png",
};
