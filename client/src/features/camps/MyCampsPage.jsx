import { useState } from "react";
import ConfirmDialog from "../../components/ConfirmDialog";
import { Icon } from "../../components/Icon";
import { Empty, LoadError, Loading, RefreshButton, SectionTitle } from "../../components/States";
import { useLoad } from "../../hooks/useLoad";
import { errorMessage } from "../../lib/api";
import { notify } from "../../lib/notify";
import CampFormSheet from "./CampFormSheet";
import CampRow from "./CampRow";
import { listMyCamps, removeCamp } from "./campsApi";

/** Organisations: the blood camps they run — add, edit and remove them. */
export default function MyCampsPage() {
  const { data, loading, error, reload } = useLoad(listMyCamps);
  const [sheet, setSheet] = useState(null); // "new" | a camp being edited | null
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const remove = async () => {
    setBusyId(deleting._id);
    try {
      await removeCamp(deleting._id);
      notify.success("Camp deleted", `${deleting.name} is no longer on the map.`);
      setDeleting(null);
      reload();
    } catch (err) {
      notify.error("Could not delete this camp", errorMessage(err, "Please try again."));
      setDeleting(null);
    } finally {
      setBusyId(null);
    }
  };

  const addButton = (
    <button type="button" className="btn btn-primary" onClick={() => setSheet("new")}>
      <Icon name="plus" size={20} /> Add a camp
    </button>
  );

  return (
    <div className="stack stack-tight">
      {!(data && data.length === 0) && <div className="actions">{addButton}</div>}

      <SectionTitle action={<RefreshButton onClick={reload} loading={loading} />}>My camps</SectionTitle>

      <LoadError error={error} hasData={!!data} onRetry={reload} />
      {!data && loading && <Loading />}
      {data && data.length === 0 && (
        <div className="group">
          <Empty icon="tent" title="No camps yet" action={addButton}>
            Register a blood donation camp so donors and hospitals can see where it is.
          </Empty>
        </div>
      )}
      {data && data.length > 0 && (
        <ul className="list group">
          {data.map((camp) => (
            <CampRow
              key={camp._id}
              camp={camp}
              busy={busyId === camp._id}
              onEdit={setSheet}
              onDelete={setDeleting}
            />
          ))}
        </ul>
      )}

      {sheet && (
        <CampFormSheet
          camp={sheet === "new" ? null : sheet}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            reload();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          id="delete-camp-title"
          title="Delete this camp?"
          message={`${deleting.name} will no longer appear on anyone’s map.`}
          confirmLabel="Delete camp"
          tone="danger"
          busy={busyId === deleting._id}
          onCancel={() => setDeleting(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
