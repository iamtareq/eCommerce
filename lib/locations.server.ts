import locations from "@/data/bd-locations.json";
import type { LocationData } from "./locations";

/** Full location dataset for server-side validation and admin screens. */
export function getLocationData(): LocationData {
  return locations as LocationData;
}
