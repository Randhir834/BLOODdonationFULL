import { ROLES } from "../lib/constants";

// Navigation for each kind of user. Wide screens list every destination in a side bar. Phones show the
// bottom bar: a blood bank has more destinations than fit, so the ones marked `secondary` move under
// a "More" tab there. `pin: "bottom"` sits an item at the foot of the side bar.
export const NAVIGATION = {
  [ROLES.ORGANISATION]: [
    { to: "/", label: "Home", title: "Stock", icon: "drop", end: true },
    { to: "/records", label: "Records", title: "Records", icon: "list" },
    { to: "/requests", label: "Requests", title: "Requests", icon: "clipboard" },
    { to: "/donors", label: "Donors", title: "Donors", icon: "users", secondary: true },
    { to: "/hospitals", label: "Hospitals", title: "Hospitals", icon: "hospital", secondary: true },
    { to: "/my-camps", label: "Camps", title: "My camps", icon: "tent", secondary: true },
    { to: "/map", label: "Map", title: "Nearby map", icon: "map" },
    { to: "/profile", label: "Profile", title: "Profile", icon: "user", secondary: true, pin: "bottom" },
  ],
  [ROLES.DONOR]: [
    { to: "/", label: "Home", title: "My donations", icon: "drop", end: true },
    { to: "/requests", label: "Requests", title: "My requests", icon: "clipboard" },
    { to: "/organisations", label: "Blood banks", title: "Blood banks", icon: "building" },
    { to: "/map", label: "Map", title: "Nearby map", icon: "map" },
    { to: "/profile", label: "Profile", title: "Profile", icon: "user", pin: "bottom" },
  ],
  [ROLES.HOSPITAL]: [
    { to: "/", label: "Home", title: "Blood received", icon: "drop", end: true },
    { to: "/requests", label: "Requests", title: "My requests", icon: "clipboard" },
    { to: "/organisations", label: "Blood banks", title: "Blood banks", icon: "building" },
    { to: "/map", label: "Map", title: "Nearby map", icon: "map" },
    { to: "/profile", label: "Profile", title: "Profile", icon: "user", pin: "bottom" },
  ],
};
