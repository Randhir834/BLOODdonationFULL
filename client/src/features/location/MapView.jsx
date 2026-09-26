import { AdvancedMarker, APIProvider, InfoWindow, Map, useAdvancedMarkerRef, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import { ICONS } from "../../components/Icon";
import { env } from "../../lib/env";

// Roughly the centre of India, used only until a real position is known.
export const DEFAULT_CENTER = [22.9734, 78.6569];
export const DEFAULT_ZOOM = 5;

const GLYPH_FOR_KIND = { hospital: "pin", organisation: "building", donar: "pin", camp: "tent" };

const toLatLng = ([lat, lng]) => ({ lat, lng });

/** A teardrop pin in the app's accent colour, with one of the app's own icon glyphs inside it. */
function Pin({ glyph, muted = false }) {
  const paths = ICONS[glyph] || ICONS.pin;
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

/** Recentres the map without remounting it, only when `center` actually changes. */
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
        <Pin glyph={GLYPH_FOR_KIND[marker.kind] || "pin"} />
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

/**
 * A Google map showing a set of markers, or (with `onPick`) a single "tap to place" marker for
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
  const [openId, setOpenId] = useState(null);

  if (!env.googleMapsApiKey) {
    return (
      <div className="map-frame map-frame-empty" style={{ height }}>
        Map unavailable: set VITE_GOOGLE_MAPS_API_KEY.
      </div>
    );
  }

  return (
    <div className="map-frame" style={{ height }}>
      <APIProvider apiKey={env.googleMapsApiKey}>
        <Map
          mapId={env.googleMapsMapId}
          defaultCenter={toLatLng(center)}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          style={{ height: "100%", width: "100%" }}
          onClick={(event) => {
            setOpenId(null);
            if (onPick && event.detail.latLng) onPick(event.detail.latLng);
          }}
        >
          <Recenter center={center} zoom={zoom} />
          {onPick && picked && (
            <AdvancedMarker position={{ lat: picked.lat, lng: picked.lng }}>
              <Pin glyph="pin" />
            </AdvancedMarker>
          )}
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
