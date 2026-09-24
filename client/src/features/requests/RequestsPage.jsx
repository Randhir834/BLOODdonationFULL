import { useCallback, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { Empty, LoadError, Loading, Notice, RefreshButton, SectionTitle } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { useRealtime } from "../../hooks/useRealtime";
import { errorMessage } from "../../lib/api";
import { ROLES } from "../../lib/constants";
import { fmtNum, nameOf } from "../../lib/format";
import { notify } from "../../lib/notify";
import NewRequestSheet from "./NewRequestSheet";
import RejectRequestSheet from "./RejectRequestSheet";
import RequestRow from "./RequestRow";
import RespondSheet from "./RespondSheet";
import ResponsesSheet from "./ResponsesSheet";
import {
  cancelRequest,
  fulfilRequest,
  listMyRequests,
  listNearbyRequests,
  listRequests,
} from "./requestsApi";

const newestFirst = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);
const idOf = (value) => value?._id || value;

/**
 * One Request page for every role: a "Request blood" button, and below it every request relevant to the
 * signed-in user, grouped by how it relates to them — sent straight to their blood bank, raised near them
 * by someone else, or their own. Each row's actions depend only on that relationship.
 */
export default function RequestsPage() {
  const { user } = useSelector((state) => state.auth);
  const isBank = user.role === ROLES.ORGANISATION;

  const fetchAll = useCallback(async () => {
    const [mine, nearby, incoming] = await Promise.all([
      listMyRequests(),
      listNearbyRequests(),
      isBank ? listRequests() : Promise.resolve([]),
    ]);
    const byId = new Map();
    [...nearby, ...mine, ...incoming].forEach((item) => byId.set(item._id, item));
    return [...byId.values()].sort(newestFirst);
  }, [isBank]);

  const { data, loading, error, reload } = useLoad(fetchAll, [], "requests:all");
  useRealtime("requests", reload);

  const [sheet, setSheet] = useState(null); // {} to create, or the request object to edit
  const [rejecting, setRejecting] = useState(null);
  const [responding, setResponding] = useState(null);
  const [viewingResponses, setViewingResponses] = useState(null);
  const [confirming, setConfirming] = useState(null); // { kind: "fulfil" | "cancel", item }
  const [busyId, setBusyId] = useState(null);
  // A ref, not state, so a second click before the first render commits is still caught: state updates
  // land next-render, but this is checked and set synchronously. Fulfilling issues real blood, so a
  // duplicate call is worth blocking on the client too, even though the server rejects it safely either way.
  const acting = useRef(false);

  const run = async (item, action, onSuccess, failure) => {
    if (acting.current) return;
    acting.current = true;
    setBusyId(item._id);
    try {
      await action(item._id);
      onSuccess();
      reload();
    } catch (err) {
      notify.error(failure, errorMessage(err, "Please try again."));
    } finally {
      acting.current = false;
      setBusyId(null);
      setConfirming(null);
    }
  };

  const fulfil = (item) =>
    run(
      item,
      fulfilRequest,
      () =>
        notify.success("Request fulfilled", `${fmtNum(item.quantity)} ML of ${item.bloodGroup} was issued.`),
      "Could not fulfil this request"
    );

  const cancel = (item) =>
    run(
      item,
      cancelRequest,
      () => notify.success("Request cancelled", "People nearby will no longer see it."),
      "Could not cancel this request"
    );

  // Own request, or one naming this blood bank, or a nearby one from someone else's city feed: which of
  // the three decides both the row's "party" and which actions it offers.
  const kindOf = (item) => {
    if (idOf(item.requester) === user._id) return "mine";
    if (isBank && idOf(item.organisation) === user._id) return "incoming";
    return "nearby";
  };

  const groups = [
    { kind: "incoming", title: "Sent to your blood bank" },
    { kind: "nearby", title: "Near you" },
    { kind: "mine", title: "Your requests" },
  ]
    .map((group) => ({ ...group, items: (data || []).filter((item) => kindOf(item) === group.kind) }))
    .filter((group) => group.items.length > 0);

  const requestButton = (
    <button type="button" className="btn btn-primary" onClick={() => setSheet({})}>
      <Icon name="plus" size={20} /> Request blood
    </button>
  );

  return (
    <div className="stack stack-tight">
      {!(data && data.length === 0) && <div className="actions">{requestButton}</div>}

      {!user.city && (
        <Notice
          tone="info"
          action={
            <Link className="link-btn" to="/profile">
              Go to profile
            </Link>
          }
        >
          Add your city in your profile to see requests from others near you.
        </Notice>
      )}

      <SectionTitle action={<RefreshButton onClick={reload} loading={loading || busyId !== null} />}>
        Blood requests
      </SectionTitle>

      <LoadError error={error} hasData={!!data} onRetry={reload} />
      {!data && loading && <Loading />}
      {data && data.length === 0 && (
        <div className="group">
          <Empty icon="clipboard" title="No requests yet" action={requestButton}>
            Requests you raise, and requests from others in your city, will appear here.
          </Empty>
        </div>
      )}
      {groups.map((group) => (
        <section key={group.kind}>
          <h3 className="day">{group.title}</h3>
          <ul className="list group">
            {group.items.map((item) => (
              <RequestRow
                key={item._id}
                request={item}
                party={group.kind === "mine" ? item.organisation : item.requester}
                partyLabel={group.kind === "mine" ? "To" : "From"}
                busy={busyId === item._id}
                onFulfil={
                  group.kind === "incoming"
                    ? (target) => setConfirming({ kind: "fulfil", item: target })
                    : undefined
                }
                onReject={group.kind === "incoming" ? setRejecting : undefined}
                onEdit={group.kind === "mine" ? setSheet : undefined}
                onCancel={
                  group.kind === "mine"
                    ? (target) => setConfirming({ kind: "cancel", item: target })
                    : undefined
                }
                onRespond={group.kind === "nearby" ? setResponding : undefined}
                onViewResponses={group.kind === "mine" ? setViewingResponses : undefined}
              />
            ))}
          </ul>
        </section>
      ))}

      {confirming?.kind === "fulfil" && (
        <ConfirmDialog
          id="fulfil-title"
          title="Fulfil this request?"
          message={`This issues ${fmtNum(confirming.item.quantity)} ML of ${confirming.item.bloodGroup} from your stock to ${nameOf(confirming.item.requester)}.`}
          confirmLabel="Issue blood"
          busy={busyId !== null}
          onCancel={() => setConfirming(null)}
          onConfirm={() => fulfil(confirming.item)}
        />
      )}
      {confirming?.kind === "cancel" && (
        <ConfirmDialog
          id="cancel-title"
          title="Cancel this request?"
          message="People nearby will no longer see it or be able to offer help."
          confirmLabel="Cancel request"
          cancelLabel="Keep request"
          tone="danger"
          busy={busyId !== null}
          onCancel={() => setConfirming(null)}
          onConfirm={() => cancel(confirming.item)}
        />
      )}

      {sheet && (
        <NewRequestSheet
          request={sheet._id ? sheet : undefined}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            reload();
          }}
        />
      )}
      {rejecting && (
        <RejectRequestSheet
          request={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            reload();
          }}
        />
      )}
      {responding && (
        <RespondSheet
          request={responding}
          onClose={() => setResponding(null)}
          onDone={() => {
            setResponding(null);
            reload();
          }}
        />
      )}
      {viewingResponses && (
        <ResponsesSheet
          request={viewingResponses}
          onClose={() => setViewingResponses(null)}
          onDone={reload}
        />
      )}
    </div>
  );
}
