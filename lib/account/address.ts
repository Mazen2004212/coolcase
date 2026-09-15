import type { Database } from "@/lib/supabase/database.types";

export type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];
export type AddressFields = { label: string; governorate: string; city: string; area: string; street: string; building: string; floor: string; apartment: string; landmark: string };
const separator = " — ";

export function splitCityArea(value: string) {
  const index = value.indexOf(separator);
  return index < 0 ? { city: "", area: value } : { city: value.slice(0, index), area: value.slice(index + separator.length) };
}

export function joinCityArea(city: string, area: string) {
  return `${city.trim()}${separator}${area.trim()}`;
}

export function addressToFields(address: AddressRow): AddressFields {
  const { city, area } = splitCityArea(address.city_area);
  return { label: address.label || "", governorate: address.governorate, city, area, street: address.street_name, building: address.building_number, floor: address.floor || "", apartment: address.apartment || "", landmark: address.landmark || "" };
}
