import { api } from "../../lib/api";

/** The blood bank home screen in one request: { stock: [per group], records: [the newest few] } */
export const getOverview = () =>
  api.get("/analytics/overview", { params: { recent: 5 } }).then((response) => response.data);

/** Blood in stock per group for the signed-in blood bank: [{ bloodGroup, totalIn, totalOut, available }] */
export const getStock = () => api.get("/analytics/stock").then((response) => response.data.stock);

/** Every record of the signed-in blood bank, newest first. */
export const listRecords = () => api.get("/inventory").then((response) => response.data.records);

/** The records that involve the signed-in donor or hospital. `params`: { type?, bloodGroup? } */
export const listMyRecords = (params) =>
  api.get("/inventory/mine", { params }).then((response) => response.data.records);

/** Blood bank: records blood in from a donor or out to a hospital. */
export const createRecord = (record) =>
  api.post("/inventory", record).then((response) => response.data.record);

/** Blood bank: throws away a unit that was never issued. `body`: { reason, note? } */
export const discardUnit = (id, body) =>
  api.post(`/inventory/${id}/discard`, body).then((response) => response.data.unit);
