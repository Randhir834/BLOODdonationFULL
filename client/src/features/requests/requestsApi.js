import { api } from "../../lib/api";

/** Any signed-in donor, hospital or blood bank: raises a request, broadcast to their own city. */
export const createRequest = (body) => api.post("/requests", body).then((response) => response.data.request);

/** The requester: edits their own pending request. */
export const updateRequest = (id, body) =>
  api.patch(`/requests/${id}`, body).then((response) => response.data.request);

/** The signed-in user's own requests. */
export const listMyRequests = () => api.get("/requests/mine").then((response) => response.data.requests);

/** Blood bank: every (legacy, optional) request naming it directly. */
export const listRequests = () => api.get("/requests").then((response) => response.data.requests);

/** Other people's pending requests from the signed-in user's own city: the discovery feed. */
export const listNearbyRequests = () =>
  api.get("/requests/nearby").then((response) => response.data.requests);

/** One request in full, with the signed-in user's own response to it, if any. */
export const getRequest = (id) => api.get(`/requests/${id}`).then((response) => response.data);

/** Blood bank: fulfils a pending request by issuing the blood now (FEFO, same as an ordinary issue). */
export const fulfilRequest = (id) =>
  api.post(`/requests/${id}/fulfil`).then((response) => response.data.request);

/** Blood bank: turns down a pending request, with a reason the requester sees. */
export const rejectRequest = (id, reason) =>
  api.post(`/requests/${id}/reject`, { reason }).then((response) => response.data.request);

/** The requester: withdraws their own request while it is still pending. */
export const cancelRequest = (id) =>
  api.post(`/requests/${id}/cancel`).then((response) => response.data.request);

/** Any role: offers some number of units against someone else's pending request. */
export const respondToRequest = (id, unitsOffered) =>
  api.post(`/requests/${id}/respond`, { unitsOffered }).then((response) => response.data.response);

/** The requester: every response their request has received. */
export const listResponses = (id) =>
  api.get(`/requests/${id}/responses`).then((response) => response.data.responses);

/** The requester: accepts one response, applying its units toward the request. */
export const confirmResponse = (requestId, responseId) =>
  api.post(`/requests/${requestId}/responses/${responseId}/confirm`).then((response) => response.data);

/** The requester: turns down one response. */
export const declineResponse = (requestId, responseId) =>
  api
    .post(`/requests/${requestId}/responses/${responseId}/decline`)
    .then((response) => response.data.response);

/** The responder: withdraws their own still-pending offer. */
export const withdrawResponse = (requestId, responseId) =>
  api
    .post(`/requests/${requestId}/responses/${responseId}/withdraw`)
    .then((response) => response.data.response);
