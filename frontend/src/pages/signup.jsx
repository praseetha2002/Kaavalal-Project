import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout, { Icon, RoleToggle } from "./AuthLayout";
import lacData from "../lac_locations.json";

const API_URL = "http://127.0.0.1:8000";

const DISTRICTS = [
  "Thiruvananthapuram",
  "Kollam",
  "Pathanamthitta",
  "Alappuzha",
  "Kottayam",
  "Idukki",
  "Ernakulam",
  "Thrissur",
  "Palakkad",
  "Malappuram",
  "Kozhikode",
  "Wayanad",
  "Kannur",
  "Kasaragod",
];

// Normalize district names for comparison.
const normalize = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^a-z]/g, "");

// Support common variations in LAC JSON property names.
function getDistrict(lac) {
  return (
    lac.district ??
    lac.district_name ??
    lac.districtName ??
    lac.District ??
    ""
  );
}

function getLacName(lac) {
  return (
    lac.lac_name ??
    lac.lacName ??
    lac.constituency_name ??
    lac.constituency ??
    lac.name ??
    ""
  );
}

function getLacCode(lac, index) {
  return (
    lac.lac_code ??
    lac.lacCode ??
    lac.code ??
    `${getLacName(lac)}-${index}`
  );
}

// Extract LAC records from common JSON structures.
function extractLacs(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.constituencies)) {
    return data.constituencies;
  }

  if (Array.isArray(data?.lacs)) {
    return data.lacs;
  }

  if (Array.isArray(data?.lac_locations)) {
    return data.lac_locations;
  }

  if (Array.isArray(data?.features)) {
    return data.features.map((feature) => ({
      ...feature.properties,
      district:
        feature.properties?.district ??
        feature.properties?.DISTRICT ??
        feature.properties?.district_name,
    }));
  }

  return [];
}

function Field({ icon, children }) {
  return (
    <div className="field">
      <span className="field-icon">
        <Icon name={icon} />
      </span>

      {children}
    </div>
  );
}

function PasswordField({ icon = "lock", ...props }) {
  const [show, setShow] = useState(false);

  return (
    <Field icon={icon}>
      <input
        {...props}
        type={show ? "text" : "password"}
        autoComplete={
          props.name === "confirm"
            ? "new-password"
            : "new-password"
        }
        required
      />

      <button
        type="button"
        className="eye"
        onClick={() => setShow((previous) => !previous)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        <Icon name={show ? "eye" : "eyeoff"} size={16} />
      </button>
    </Field>
  );
}

export default function Signup() {
  const navigate = useNavigate();

  const [role, setRole] = useState("citizen");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm: "",
    district: "",
    nearest_lac: "",
    organization_code: "",
    rescuer_id: "",
  });

  // Read and normalize the LAC dataset.
  const allLacs = useMemo(() => {
    return extractLacs(lacData)
      .map((lac, index) => ({
        ...lac,
        _name: String(getLacName(lac)).trim(),
        _district: String(getDistrict(lac)).trim(),
        _code: getLacCode(lac, index),
      }))
      .filter((lac) => lac._name && lac._district);
  }, []);

  // Update an ordinary form field.
  function update(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setMessage("");
  }

  // Changing district clears the previous LAC.
  function changeDistrict(event) {
    const selectedDistrict = event.target.value;

    setForm((previous) => ({
      ...previous,
      district: selectedDistrict,
      nearest_lac: "",
    }));

    setError("");
    setMessage("");
  }

  // Filter LACs for the selected district.
  const lacOptions = useMemo(() => {
    if (!form.district) {
      return [];
    }

    const selectedDistrict = normalize(form.district);

    return allLacs
      .filter(
        (lac) => normalize(lac._district) === selectedDistrict
      )
      .sort((a, b) => a._name.localeCompare(b._name));
  }, [form.district, allLacs]);

  // Submit signup details to FastAPI.
  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (!form.district) {
      setError("Please select your district.");
      return;
    }

    if (!form.nearest_lac) {
      setError("Please select your nearest LAC.");
      return;
    }

    if (
      role === "rescuer" &&
      (!form.organization_code.trim() ||
        !form.rescuer_id.trim())
    ) {
      setError("Organization Code and Rescuer ID are required.");
      return;
    }

    const body = {
      full_name: form.full_name.trim(),
      email: form.email.trim(),
      password: form.password,
      role,
      district: form.district,
      nearest_lac: form.nearest_lac,
    };

    if (role === "rescuer") {
      body.organization_code = form.organization_code.trim();
      body.rescuer_id = form.rescuer_id.trim();
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((item) => item.msg).join(", ")
          : data.detail;

        throw new Error(detail || "Registration failed.");
      }

      if (role === "rescuer") {
        setMessage(
          "Registration submitted successfully. An administrator must approve your account before you can log in."
        );
      } else {
        navigate("/login");
      }
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the backend. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout variant="signup" role={role}>
      <form className="form" onSubmit={handleSubmit}>
        <h1>Create Your Account</h1>

        <p className="sub">
          Join KAAVALAL and be a part of a safer Kerala.
        </p>

        <RoleToggle role={role} setRole={setRole} />

        <Field icon="user">
          <input
            name="full_name"
            placeholder="Full Name"
            value={form.full_name}
            onChange={update}
            autoComplete="name"
            required
          />
        </Field>

        <Field icon="mail">
          <input
            name="email"
            type="email"
            placeholder="Email Address"
            value={form.email}
            onChange={update}
            autoComplete="email"
            required
          />
        </Field>

        <PasswordField
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={update}
          autoComplete="new-password"
        />

        <PasswordField
          name="confirm"
          placeholder="Confirm Password"
          value={form.confirm}
          onChange={update}
          autoComplete="new-password"
        />

        <Field icon="pin">
          <select
            name="district"
            value={form.district}
            onChange={changeDistrict}
            required
          >
            <option value="">Select District</option>

            {DISTRICTS.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </Field>

        <Field icon="wave">
          <select
            name="nearest_lac"
            value={form.nearest_lac}
            onChange={update}
            disabled={!form.district}
            required
          >
            <option value="">
              {!form.district
                ? "Select district first"
                : lacOptions.length > 0
                  ? "Select Nearest LAC"
                  : "No LACs found for this district"}
            </option>

            {lacOptions.map((lac) => (
              <option key={lac._code} value={lac._name}>
                {lac._name}
              </option>
            ))}
          </select>
        </Field>

        {form.district && lacOptions.length === 0 && (
          <p className="msg error">
            No LAC records matched this district in the imported
            dataset. Check the district fields in lac_locations.json.
          </p>
        )}

        {role === "rescuer" && (
          <>
            <Field icon="building">
              <input
                name="organization_code"
                placeholder="Organization Code"
                value={form.organization_code}
                onChange={update}
                required
              />
            </Field>

            <Field icon="id">
              <input
                name="rescuer_id"
                placeholder="Rescuer ID"
                value={form.rescuer_id}
                onChange={update}
                required
              />
            </Field>
          </>
        )}

        {error && <p className="msg error">{error}</p>}

        {message && <p className="msg success">{message}</p>}

        <button className="primary" disabled={loading}>
          {loading ? "Please wait..." : "Sign Up"}
        </button>

        <p className="switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </AuthLayout>
  );
}