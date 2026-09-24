import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { PATHS } from "../../components/Icons";

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const DEFAULT_CENTER = [22.9734, 78.6569];
export const DEFAULT_ZOOM = 5;

const GLYPH_FOR_KIND = { hospital: "pin", organisation: "building", donar: "pin", camp: "tent" };

/** A teardrop pin in the app's accent colour, with one of the app's own icon glyphs inside it. */
const pinIcon = (kind, { muted = false } = {}) => {
  const paths = PATHS[GLYPH_FOR_KIND[kind] || "pin"];
  return L.divIcon({
    className: "map-pin",
    html: `<span class="map-pin-shape${muted ? " map-pin-muted" : ""}"><svg viewBox="0 0 24 24" width="15" height="15">${paths
      .map((d) => `<path d="${d}" />`)
      .join("")}</svg></span>`,
    iconSize: [30, 38],
    iconAnchor: [15, 36],
    popupAnchor: [0, -32],
  });
};

function Recenter({ center, zoom }) {
  const map = useMap();
  const key = center ? `${center[0]},${center[1]}` : "";
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

/** The centralized live map: every marker in `markers`: [{ id, lat, lng, kind, muted, title, body }]. */
export default function MapView({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, markers = [], height = 460 }) {
  return (
    <div className="map-frame" style={{ height }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <Recenter center={center} zoom={zoom} />
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={pinIcon(marker.kind, { muted: marker.muted })}
          >
            {(marker.title || marker.body) && (
              <Popup>
                {marker.title && <strong>{marker.title}</strong>}
                {marker.body && <div>{marker.body}</div>}
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
