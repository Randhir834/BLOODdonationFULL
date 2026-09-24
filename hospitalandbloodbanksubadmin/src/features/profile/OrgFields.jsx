import { CheckField, PhoneField, SelectField, TextArea, TextField } from "../../components/Fields";
import { PHONE_COUNTRY } from "./orgForm";

/**
 * The organisation's details, as a form. Used to register (everything blank, the basics required) and to edit
 * (everything blank, only what is typed changes). `role` decides the wording; `errors` come from validation.
 */
export default function OrgFields({
  values,
  setValue,
  errors,
  role,
  editing = false,
  canEditRegistration = true,
}) {
  const bank = role === "organisation";
  const optional = editing; // when editing every field is optional: blank keeps what is saved
  const set = (field) => (value) => setValue(field, value);

  return (
    <>
      <div className="form-section">{bank ? "Blood bank" : "Hospital"}</div>
      <div className="form-grid">
        <TextField
          className="span-2"
          label={bank ? "Blood bank name" : "Hospital name"}
          value={values.name}
          onChange={set("name")}
          error={errors.name}
          optional={optional}
        />
        {canEditRegistration && (
          <TextField
            label="Registration or licence number"
            value={values.registrationNumber}
            onChange={set("registrationNumber")}
            error={errors.registrationNumber}
            optional={optional}
            hint={editing ? undefined : "An admin checks this number before your account is approved."}
          />
        )}
        <TextField
          label="Website"
          value={values.website}
          onChange={set("website")}
          error={errors.website}
          optional
          type="url"
        />
      </div>

      <div className="form-section">Address</div>
      <div className="form-grid">
        <TextField
          className="span-2"
          label="Street address"
          value={values.address}
          onChange={set("address")}
          error={errors.address}
          optional={optional}
        />
        <TextField
          label="City"
          value={values.city}
          onChange={set("city")}
          error={errors.city}
          optional={optional}
          hint={editing ? undefined : "Blood requests raised in this city are shown to you."}
        />
        <TextField label="State" value={values.state} onChange={set("state")} error={errors.state} optional />
        <TextField
          label="PIN code"
          value={values.pincode}
          onChange={set("pincode")}
          error={errors.pincode}
          optional
          inputMode="numeric"
        />
      </div>

      <div className="form-section">Contact</div>
      <div className="form-grid">
        <TextField
          label="Contact person"
          value={values.contactPerson}
          onChange={set("contactPerson")}
          error={errors.contactPerson}
          optional
        />
        <TextField
          label="Contact email"
          value={values.email}
          onChange={set("email")}
          error={errors.email}
          optional
          type="email"
        />
        <PhoneField
          label="Alternate phone"
          value={values.alternatePhone}
          onChange={set("alternatePhone")}
          country={PHONE_COUNTRY}
          error={errors.alternatePhone}
          optional
        />
        <PhoneField
          label="Emergency helpline"
          value={values.emergencyPhone}
          onChange={set("emergencyPhone")}
          country={PHONE_COUNTRY}
          error={errors.emergencyPhone}
          optional
        />
      </div>

      <div className="form-section">Opening hours</div>
      <div className="form-grid">
        {editing ? (
          <SelectField
            label="Open 24 hours"
            value={values.open24x7}
            onChange={set("open24x7")}
            choose="Keep as saved"
            options={[
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ]}
          />
        ) : (
          <CheckField
            label="Open 24 hours"
            checked={values.open24x7 === "true"}
            onChange={(on) => setValue("open24x7", on ? "true" : "false")}
          />
        )}
        <TextField
          label="Opening hours"
          value={values.hours}
          onChange={set("hours")}
          error={errors.hours}
          optional
        />
        <TextArea
          className="span-2"
          label="About"
          value={values.about}
          onChange={set("about")}
          error={errors.about}
          optional
          rows={3}
        />
      </div>
    </>
  );
}
