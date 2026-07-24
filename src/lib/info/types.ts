export type InfoSection = {
  id: string;
  property_id: string;
  title: string;
  body: string;
  icon: string | null;
  display_order: number;
  updated_at: string;
  created_at: string;
};

/** Allowed lucide icon names for info sections. */
export const INFO_ICONS = [
  "wifi",
  "flame",
  "wrench",
  "droplet",
  "beer",
  "alert-triangle",
  "key",
  "car",
  "trash",
  "thermometer",
  "phone",
  "book",
] as const;

export type InfoIconName = (typeof INFO_ICONS)[number];

export function isInfoIconName(value: unknown): value is InfoIconName {
  return (
    typeof value === "string" &&
    (INFO_ICONS as readonly string[]).includes(value)
  );
}

export const STARTER_SECTIONS: Array<{
  title: string;
  body: string;
  icon: InfoIconName;
  display_order: number;
}> = [
  {
    title: "Wifi",
    body: "Network: \nPassword: ",
    icon: "wifi",
    display_order: 0,
  },
  {
    title: "House rules",
    body: "- Quiet hours after 10pm\n- Shoes off at the door\n- Leave it better than you found it",
    icon: "book",
    display_order: 1,
  },
  {
    title: "Emergency shutoffs",
    body: "1. Gas: see valve by the kitchen\n2. Water: main shutoff in the utility closet\n3. Electric: breaker panel in the garage",
    icon: "alert-triangle",
    display_order: 2,
  },
];
