import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { ICONS } from "../../components/Icon";

// No API key, no billing account: OpenStreetMap's own tiles.
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Roughly the centre of India, used only until a real position is known.
export const DEFAULT_CENTER = [22.9734, 78.6569];
export const DEFAULT_ZOOM = 5;

const GLYPH_FOR_KIND = { hospital: "pin", organisation: "building", donar: "pin", camp: "tent" };

/** A teardrop pin in the app's accent colour, with one of the app's own icon glyphs inside it. */
const pinIcon = (glyphName, { muted = false } = {}) => {
  const paths = ICONS[glyphName] || ICONS.pin;
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

const markerIcon = (kind, options) => pinIcon(GLYPH_FOR_KIND[kind] || "pin", options);

/** Recentres the map without remounting it, only when `center` actually changes. */
function Recenter({ center, zoom }) {
  const map = useMap();
  const key = center ? `${center[0]},${center[1]}` : "";
  useEffect(() => {
    if (center) map.setView(center, zoom ?? map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}

function ClickToPick({ onPick }) {
  useMapEvents({ click: (event) => onPick(event.latlng) });
  return null;
}

/**
 * A Leaflet map showing a set of markers, or (with `onPick`) a single "tap to place" marker for
 * choosing a camp's venue. `markers`: [{ id, lat, lng, kind, title, body }].
 */
export default function MapView({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  markers = [],
  onPick,
  picked,
  height = 320,
}) {
  return (
    <div className="map-frame" style={{ height }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer url={TILE_URL} attribution={ATTRIBUTION} />
        <Recenter center={center} zoom={zoom} />
        {onPick && <ClickToPick onPick={onPick} />}
        {onPick && picked && <Marker position={[picked.lat, picked.lng]} icon={pinIcon("pin")} />}
        {markers.map((marker) => (
          <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={markerIcon(marker.kind)}>
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
