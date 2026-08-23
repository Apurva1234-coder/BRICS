import type { LatLngExpression, Layer } from "leaflet";

declare module "leaflet" {
  function heatLayer(
    latlngs: Array<LatLngExpression | [number, number, number]>,
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<number, string>;
    }
  ): Layer;
}

declare module "leaflet.heat";
