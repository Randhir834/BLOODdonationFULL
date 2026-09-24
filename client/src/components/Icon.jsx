// One icon family: 24px grid, 1.75 stroke, round caps.
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const ICONS = {
  drop: [
    "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  ],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    circle(9, 7, 4),
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  user: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", circle(12, 7, 4)],
  building: [
    "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
    "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",
    "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",
    "M10 6h4",
    "M10 10h4",
    "M10 14h4",
    "M10 18h4",
  ],
  hospital: ["M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16", "M3 21h18", "M12 7v6", "M9 10h6", "M10 21v-4h4v4"],
  clipboard: [
    "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z",
    "M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2",
    "M9 12h6",
    "M9 16h6",
  ],
  plus: ["M5 12h14", "M12 5v14"],
  search: [circle(11, 11, 8), "m21 21-4.3-4.3"],
  phone: [
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
  ],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  map: ["M9 6 3 8v12l6-2 6 2 6-2V6l-6 2-6-2Z", "M9 6v12", "M15 8v12"],
  pin: ["M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12Z", circle(12, 9, 2.5)],
  tent: ["M19 20 12 4 5 20", "M9 20l3-8 3 8", "M3 20h18"],
  crosshair: [circle(12, 12, 3), "M12 2v3", "M12 19v3", "M2 12h3", "M19 12h3"],
  check: ["M20 6 9 17l-5-5"],
  checkCircle: [circle(12, 12, 10), "m9 12 2 2 4-4"],
  alertCircle: [circle(12, 12, 10), "M12 8v4", "M12 16h.01"],
  alertTriangle: [
    "m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z",
    "M12 9v4",
    "M12 17h.01",
  ],
  info: [circle(12, 12, 10), "M12 16v-4", "M12 8h.01"],
  chevronRight: ["m9 18 6-6-6-6"],
  chevronLeft: ["m15 18-6-6 6-6"],
  arrowRight: ["M5 12h14", "m12 5 7 7-7 7"],
  more: ["M4 12h.01", "M12 12h.01", "M20 12h.01"],
  refresh: [
    "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
    "M21 3v5h-5",
    "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
    "M8 16H3v5",
  ],
  edit: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"],
  trash: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    "M10 11v6",
    "M14 11v6",
  ],
  shieldCheck: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "m9 12 2 2 4-4"],
  clock: [circle(12, 12, 10), "M12 6v6l4 2"],
  heart: [
    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z",
  ],
  globe: [
    circle(12, 12, 10),
    "M2 12h20",
    "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  ],
  calendar: [
    "M8 2v4",
    "M16 2v4",
    "M3 10h18",
    "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  ],
  inbox: [
    "M22 12h-6l-2 3h-4l-2-3H2",
    "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  ],
  wifiOff: [
    "M2 2l20 20",
    "M8.5 16.5a5 5 0 0 1 7 0",
    "M2 8.82a15 15 0 0 1 4.17-2.65",
    "M10.66 5c4.01-.36 8.14.9 11.34 3.76",
    "M16.85 11.25a10 10 0 0 1 2.22 1.68",
    "M5 13a10 10 0 0 1 5.24-2.76",
    "M12 20h.01",
  ],
};

// Exposed so map markers can draw the same glyphs inside a pin, instead of a second icon set.
export { ICONS };

const SIZE_CLASS = {
  16: "icon icon-16",
  18: "icon icon-18",
  20: "icon icon-20",
  32: "icon icon-32",
  40: "icon icon-40",
};

export function Icon({ name, size }) {
  return (
    <svg className={SIZE_CLASS[size] || "icon"} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The official app logo. */
export function BrandMark() {
  return <img className="icon" src="/logo.png" alt="Blood Bank" />;
}
