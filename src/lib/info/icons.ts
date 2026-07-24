import {
  AlertTriangle,
  Beer,
  Book,
  Car,
  Droplet,
  Flame,
  Key,
  Phone,
  Thermometer,
  Trash2,
  Wifi,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { InfoIconName } from "./types";

export const INFO_ICON_MAP: Record<InfoIconName, LucideIcon> = {
  wifi: Wifi,
  flame: Flame,
  wrench: Wrench,
  droplet: Droplet,
  beer: Beer,
  "alert-triangle": AlertTriangle,
  key: Key,
  car: Car,
  trash: Trash2,
  thermometer: Thermometer,
  phone: Phone,
  book: Book,
};
