import { AdvancedMarker, APIProvider, InfoWindow, Map, useAdvancedMarkerRef, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import { PATHS } from "../../components/Icons";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// Advanced markers need a map ID; Google's demo ID works until you create your own in the Cloud console.
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export const DEFAULT_CENTER = [22.9734, 78.6569];
export const DEFAULT_ZOOM = 5;

const GLYPH_FOR_KIND = { hospital: "pin", organisation: "building", donar: "pin", camp: "tent" };

const toLatLng = ([lat, lng]) => ({ lat, lng });

/** A teardrop pin in the app's accent colour, with one of the app's own icon glyphs inside it. */
function Pin({ kind, muted = false }) {
  const paths = PATHS[GLYPH_FOR_KIND[kind] || "pin"];
  return (
    <span className="map-pin">
      <span className={`map-pin-shape${muted ? " map-pin-muted" : ""}`}>
        <svg viewBox="0 0 24 24" width="15" height="15">
          {paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      </span>
    </span>
  );
}

function Recenter({ center, zoom }) {
  const map = useMap();
  const key = center ? `${center[0]},${center[1]}` : "";
  useEffect(() => {
    if (!map || !center) return;
    map.setCenter(toLatLng(center));
    if (zoom !== undefined && zoom !== null) map.setZoom(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

function MarkerWithPopup({ marker, open, onToggle }) {
  const [markerRef, anchor] = useAdvancedMarkerRef();
  const hasPopup = marker.title || marker.body;
  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: marker.lat, lng: marker.lng }}
        title={marker.title}
        onClick={hasPopup ? onToggle : undefined}
      >
        <Pin kind={marker.kind} muted={marker.muted} />
      </AdvancedMarker>
      {hasPopup && open && (
        <InfoWindow anchor={anchor} onCloseClick={onToggle} headerDisabled>
          <div className="map-popup">
            {marker.title && <strong>{marker.title}</strong>}
            {marker.body && <div>{marker.body}</div>}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

/** The centralized live map: every marker in `markers`: [{ id, lat, lng, kind, muted, title, body }]. */
export default function MapView({ center = DEFAULT_CENTER, zoom = DEFAULT_ZOOM, markers = [], height = 460 }) {
  const [openId, setOpenId] = useState(null);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="map-frame map-frame-empty" style={{ height }}>
        Map unavailable: set VITE_GOOGLE_MAPS_API_KEY.
      </div>
    );
  }

  return (
    <div className="map-frame" style={{ height }}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          mapId={GOOGLE_MAPS_MAP_ID}
          defaultCenter={toLatLng(center)}
          defaultZoom={zoom}
          gestureHandling="greedy"
          clickableIcons={false}
          style={{ height: "100%", width: "100%" }}
          onClick={() => setOpenId(null)}
        >
          <Recenter center={center} zoom={zoom} />
          {markers.map((marker) => (
            <MarkerWithPopup
              key={marker.id}
              marker={marker}
              open={openId === marker.id}
              onToggle={() => setOpenId((current) => (current === marker.id ? null : marker.id))}
            />
          ))}
        </Map>
      </APIProvider>
    </div>
  );
}
