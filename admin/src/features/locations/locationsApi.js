import api from "../../lib/api";

/** Every donor, hospital and blood bank sharing their location, plus every camp. */
export const fetchLocations = () => api.get("/locations").then((response) => response.data);

export const suspendCamp = (id) => api.post(`/camps/${id}/suspend`);
export const reactivateCamp = (id) => api.post(`/camps/${id}/reactivate`);
export const removeCamp = (id) => api.delete(`/camps/${id}`);
