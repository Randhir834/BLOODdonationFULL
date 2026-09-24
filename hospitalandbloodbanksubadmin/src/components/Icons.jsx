// One icon family for navigation and actions: 24px grid, 1.75 stroke, round caps. Kept in sync with
// the client app's icon style (and reuses its exact paths for "drop", "users" and "list") so the two
// products read as one system.
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const PATHS = {
  drop: [
    "M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z",
  ],
  grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    circle(9, 7, 4),
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  shield: ["M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z", "M9 12l2 2 4-4"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  inbox: [
    "M22 12h-6l-2 3h-4l-2-3H2",
    "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  ],
  plus: ["M5 12h14", "M12 5v14"],
  close: ["M18 6 6 18", "m6 6 12 12"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"],
  map: ["M9 6 3 8v12l6-2 6 2 6-2V6l-6 2-6-2Z", "M9 6v12", "M15 8v12"],
  building: [
    "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
    "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2",
    "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2",
    "M10 6h4",
    "M10 10h4",
    "M10 14h4",
    "M10 18h4",
  ],
  tent: ["M19 20 12 4 5 20", "M9 20l3-8 3 8", "M3 20h18"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  eye: ["M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z", circle(12, 12, 3)],
  eyeOff: [
    "M9.9 4.24A9.12 9.12 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68",
    "M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61",
    "M2 2l20 20",
    "M14.12 14.12a3 3 0 1 1-4.24-4.24",
  ],
  refresh: [
    "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
    "M21 3v5h-5",
    "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
    "M8 16H3v5",
  ],
  search: [circle(11, 11, 8), "m21 21-4.3-4.3"],
  checkCircle: [circle(12, 12, 10), "m9 12 2 2 4-4"],
  alertCircle: [circle(12, 12, 10), "M12 8v4", "M12 16h.01"],
  alertTriangle: [
    "m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z",
    "M12 9v4",
    "M12 17h.01",
  ],
  info: [circle(12, 12, 10), "M12 16v-4", "M12 8h.01"],
  wifiOff: [
    "M2 2l20 20",
    "M8.5 16.5a5 5 0 0 1 7 0",
    "M2 8.82a15 15 0 0 1 4.17-2.65",
    "M10.66 5c4.01-.36 8.14.9 11.34 3.76",
    "M16.85 11.25a10 10 0 0 1 2.22 1.68",
    "M5 13a10 10 0 0 1 5.24-2.76",
    "M12 20h.01",
  ],
  bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  clipboard: [
    "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
    "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
    "M9 12h6",
    "M9 16h4",
  ],
  download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "m7 10 5 5 5-5", "M12 15V3"],
  edit: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"],
  trash: [
    "M3 6h18",
    "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    "M10 11v6",
    "M14 11v6",
    "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2",
  ],
  check: ["m5 12 5 5L20 7"],
  arrowLeft: ["M19 12H5", "m12 19-7-7 7-7"],
  chevronRight: ["m9 6 6 6-6 6"],
  phone: [
    "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
  ],
  clock: [circle(12, 12, 10), "M12 6v6l4 2"],
  truck: ["M1 3h15v13H1z", "M16 8h4l3 3v5h-7", circle(5.5, 18.5, 2.5), circle(18.5, 18.5, 2.5)],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", circle(12, 7, 4)],
  hospital: ["M3 21h18", "M5 21V7l7-4 7 4v14", "M12 8v6", "M9 11h6", "M10 21v-4h4v4"],
  arrowRight: ["M5 12h14", "m12 5 7 7-7 7"],
  activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  more: ["M12 12h.01", "M19 12h.01", "M5 12h.01"],
  shieldCheck: ["M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z", "m9 12 2 2 4-4"],
  pin: ["M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12Z", circle(12, 9, 2.5)],
};

// Exposed so map markers can draw the same glyphs inside a pin, instead of a second icon set.
export { PATHS };

export function NavIcon({ name, size = 20 }) {
  return (
    <svg
      className="line-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** The official app logo. */
export function BrandMark({ size = 28 }) {
  return <img className="brand-icon" width={size} height={size} src="/logo.png" alt="Blood Bank" />;
}
