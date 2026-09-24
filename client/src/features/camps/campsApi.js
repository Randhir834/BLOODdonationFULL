import { api } from "../../lib/api";

/** Organisations (blood banks): the camps they run. */
export const listMyCamps = () => api.get("/camps/mine").then((response) => response.data.camps);

export const createCamp = (body) => api.post("/camps", body).then((response) => response.data.camp);

export const updateCamp = (id, body) =>
  api.patch(`/camps/${id}`, body).then((response) => response.data.camp);

export const removeCamp = (id) => api.delete(`/camps/${id}`);
