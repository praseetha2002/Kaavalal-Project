import { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  GeoJSON,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

import lacData from "./lac_locations.json";

const API_URL = "http://127.0.0.1:8000";

function normalizeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\bdistrict\b/g, "")
    .replace(/[^a-z]/g, "");
}

function getDistrictName(feature) {
  const properties = feature?.properties || {};

  return (
    properties.DISTRICT ||
    properties.district ||
    properties.NAME_2 ||
    properties.name ||
    ""
  );
}

// Fits the map to all of Kerala, or flies to the selected district
function MapBounds({ geojson, selectedDistrict }) {
  const map = useMap();

  useEffect(() => {
    if (!geojson?.features?.length) return;

    // All districts: show the whole state
    if (selectedDistrict === "ALL") {
      const bounds = L.geoJSON(geojson).getBounds();

      if (bounds.isValid()) {
        map.flyToBounds(bounds, {
          padding: [20, 20],
          maxZoom: 9,
          duration: 0.8,
        });
      }

      return;
    }

    // One district: zoom to its boundary
    const features = geojson.features.filter(
      (feature) =>
        normalizeName(getDistrictName(feature)) ===
        normalizeName(selectedDistrict)
    );

    if (!features.length) return;

    const bounds = L.geoJSON({
      type: "FeatureCollection",
      features,
    }).getBounds();

    if (bounds.isValid()) {
      map.flyToBounds(bounds, {
        padding: [30, 30],
        maxZoom: 11,
        duration: 0.8,
      });
    }
  }, [geojson, selectedDistrict, map]);

  return null;
}

export default function App() {
  // Selected district
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");

  // Kerala district map
  const [keralaDistricts, setKeralaDistricts] = useState(null);
  const [geojsonError, setGeojsonError] = useState("");

  // Backend districts
  const [backendDistricts, setBackendDistricts] = useState([]);

  // Weather data
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  // Search
  const [searchText, setSearchText] = useState("");

  // Load Kerala district GeoJSON
  useEffect(() => {
    fetch("/Data/Kerala_districts.geojson")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`GeoJSON loading failed: ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        if (
          data.type !== "FeatureCollection" ||
          !Array.isArray(data.features)
        ) {
          throw new Error("Invalid Kerala GeoJSON file.");
        }

        setKeralaDistricts(data);
      })
      .catch((error) => {
        console.error("GeoJSON error:", error);
        setGeojsonError(error.message);
      });
  }, []);

  // Fetch districts from FastAPI
  useEffect(() => {
    const controller = new AbortController();

    async function loadDistricts() {
      try {
        const response = await fetch(`${API_URL}/api/districts`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to fetch districts from backend.");
        }

        const data = await response.json();

        setBackendDistricts(data);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("District API error:", error);
        }
      }
    }

    loadDistricts();

    return () => controller.abort();
  }, []);

  // Get constituency locations
  const constituencies = useMemo(() => {
    return (lacData.constituencies || []).filter((lac) => {
      const latitude = Number(lac.latitude);
      const longitude = Number(lac.longitude);

      return (
        lac.latitude != null &&
        lac.longitude != null &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= 8 &&
        latitude <= 13 &&
        longitude >= 74 &&
        longitude <= 78
      );
    });
  }, []);

  // Create a combined district list
  const districts = useMemo(() => {
    const names = [
      ...(backendDistricts || []).map((district) => district.name),
      ...(lacData.constituencies || []).map((lac) => lac.district),
      ...(keralaDistricts?.features || []).map(getDistrictName),
    ];

    const unique = new Map();

    names.forEach((name) => {
      const cleanName = String(name || "").trim();

      if (cleanName) {
        unique.set(normalizeName(cleanName), cleanName);
      }
    });

    return [...unique.values()].sort((a, b) => a.localeCompare(b));
  }, [backendDistricts, keralaDistricts]);

  // Search district list
  const visibleDistricts = districts.filter((district) =>
    district.toLowerCase().includes(searchText.trim().toLowerCase())
  );

  // Find selected district in backend
  const selectedDistrictInfo = backendDistricts.find(
    (district) =>
      normalizeName(district.name) === normalizeName(selectedDistrict)
  );

  // Fetch selected district weather
  useEffect(() => {
    if (selectedDistrict === "ALL") {
      setWeather(null);
      setWeatherError("");
      setWeatherLoading(false);
      return;
    }

    const district = backendDistricts.find(
      (item) =>
        normalizeName(item.name) === normalizeName(selectedDistrict)
    );

    if (!district) {
      if (backendDistricts.length > 0) {
        setWeather(null);
        setWeatherError("District not found in the backend.");
        setWeatherLoading(false);
      }

      return;
    }

    const controller = new AbortController();

    async function loadWeather() {
      setWeather(null);
      setWeatherError("");
      setWeatherLoading(true);

      try {
        const response = await fetch(
          `${API_URL}/api/districts/${district.id}/weather`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`Weather request failed: ${response.status}`);
        }

        const data = await response.json();

        setWeather(data);
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Weather API error:", error);
          setWeatherError("Unable to load current weather.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setWeatherLoading(false);
        }
      }
    }

    loadWeather();

    return () => controller.abort();
  }, [selectedDistrict, backendDistricts]);

  // Filter constituency markers
  const filteredConstituencies =
    selectedDistrict === "ALL"
      ? constituencies
      : constituencies.filter(
          (lac) =>
            normalizeName(lac.district) ===
            normalizeName(selectedDistrict)
        );

  // District polygon style (used for normal state and after hover)
  const districtStyle = (feature) => {
    const name = getDistrictName(feature);
    const selected =
      selectedDistrict !== "ALL" &&
      normalizeName(name) === normalizeName(selectedDistrict);

    return {
      color: selected ? "#0c5364" : "#167d8d",
      weight: selected ? 3 : 1.5,
      fillColor: selected ? "#e8bc71" : "#7bc8c4",
      fillOpacity: selected ? 0.95 : 0.72,
    };
  };

  // Loading screen
  if (!keralaDistricts && !geojsonError) {
    return (
      <div className="loading-screen">
        <h2>🛡️ KAAVALAL</h2>
        <p>Loading Kerala district map...</p>
      </div>
    );
  }

  // Map error
  if (geojsonError) {
    return (
      <div className="loading-screen">
        <h2>Unable to load Kerala map</h2>
        <p>{geojsonError}</p>
        <code>public/Data/Kerala_districts.geojson</code>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <h2>🛡️ KAAVALAL</h2>
          <p>Disaster Intelligence</p>
        </div>

        <div className="district-heading">
          <h3>Kerala Districts</h3>
          <span>{districts.length}</span>
        </div>

        <input
          type="text"
          className="district-search"
          placeholder="Search district..."
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />

        <button
          type="button"
          className={`district-item ${
            selectedDistrict === "ALL" ? "active" : ""
          }`}
          onClick={() => setSelectedDistrict("ALL")}
        >
          All Districts
        </button>

        <div className="district-list">
          {visibleDistricts.map((district) => (
            <button
              type="button"
              key={district}
              className={`district-item ${
                normalizeName(selectedDistrict) === normalizeName(district)
                  ? "active"
                  : ""
              }`}
              onClick={() => setSelectedDistrict(district)}
            >
              <span className="district-dot" />
              {district}
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          Kerala Disaster Monitoring
        </div>
      </aside>

      {/* CENTER MAP */}
      <main className="main-content">
        <header className="dashboard-header">
          <div>
            <h1>Kerala Disaster Dashboard</h1>
            <p>
              District boundaries and Assembly Constituencies
            </p>
          </div>

          <span className="status-badge">● Map Active</span>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Districts</span>
            <h2>{districts.length || 14}</h2>
          </div>

          <div className="stat-card">
            <span>Total Constituencies</span>
            <h2>{(lacData.constituencies || []).length}</h2>
          </div>

          <div className="stat-card">
            <span>Mapped Constituencies</span>
            <h2>{constituencies.length}</h2>
          </div>
        </section>

        <section className="map-section">
          <div className="map-toolbar">
            <div>
              <h2>Kerala Interactive Map</h2>
              <p>
                Click a district on the map or select it from the sidebar.
              </p>
            </div>

            <select
              value={selectedDistrict}
              onChange={(event) => setSelectedDistrict(event.target.value)}
              aria-label="Filter by district"
            >
              <option value="ALL">All Districts</option>

              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>

          <div className="map-container">
            <MapContainer
              center={[10.5, 76.2]}
              zoom={7}
              minZoom={6}
              maxZoom={12}
              scrollWheelZoom
              className="kerala-map"
            >
              <MapBounds
                geojson={keralaDistricts}
                selectedDistrict={selectedDistrict}
              />

              <GeoJSON
                key={`district-boundaries-${selectedDistrict}`}
                data={keralaDistricts}
                style={districtStyle}
                onEachFeature={(feature, layer) => {
                  const districtName = getDistrictName(feature);

                  if (districtName) {
                    layer.bindTooltip(districtName, { sticky: true });

                    layer.on({
                      mouseover: (event) =>
                        event.target.setStyle({
                          weight: 3,
                          fillOpacity: 0.9,
                        }),
                      mouseout: (event) =>
                        event.target.setStyle(districtStyle(feature)),
                      click: () => setSelectedDistrict(districtName),
                    });
                  }
                }}
              />

              {filteredConstituencies.map((lac) => (
                <CircleMarker
                  key={lac.lac_code}
                  center={[
                    Number(lac.latitude),
                    Number(lac.longitude),
                  ]}
                  radius={5}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 1,
                    fillColor: "#e05252",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <strong>{lac.lac_name}</strong>
                    <br />
                    LAC Code: {lac.lac_code}
                    <br />
                    District: {lac.district}
                    <br />
                    Latitude: {lac.latitude}
                    <br />
                    Longitude: {lac.longitude}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <div className="map-legend">
            <span>
              <span className="legend-district" />
              District Boundaries
            </span>

            <span>
              <span className="legend-marker" />
              Assembly Constituencies
            </span>
          </div>
        </section>
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="right-sidebar">
        <section className="selected-location">
          <span className="section-label">SELECTED LOCATION</span>

          <h2>
            {selectedDistrict === "ALL" ? "Kerala" : selectedDistrict}
          </h2>

          <p>
            {selectedDistrict === "ALL" ? "STATE" : "DISTRICT"}
          </p>
        </section>

        <section className="sidebar-section">
          <h3>Current Conditions</h3>

          {selectedDistrict === "ALL" ? (
            <p className="weather-message">
              Select a district to view its current weather.
            </p>
          ) : weatherLoading ? (
            <p className="weather-message">Loading weather data...</p>
          ) : weatherError ? (
            <p className="weather-message error-message">
              {weatherError}
            </p>
          ) : (
            <div className="weather-grid">
              <div className="weather-card">
                <span>Temperature</span>
                <strong>
                  {weather?.temperature != null
                    ? `${weather.temperature} °C`
                    : "--"}
                </strong>
              </div>

              <div className="weather-card">
                <span>Humidity</span>
                <strong>
                  {weather?.humidity != null
                    ? `${weather.humidity}%`
                    : "--"}
                </strong>
              </div>

              <div className="weather-card">
                <span>Rainfall</span>
                <strong>
                  {weather?.rainfall != null
                    ? `${weather.rainfall} mm`
                    : "--"}
                </strong>
              </div>

              <div className="weather-card">
                <span>Wind Speed</span>
                <strong>
                  {weather?.wind_speed != null
                    ? `${weather.wind_speed} km/h`
                    : "--"}
                </strong>
              </div>
            </div>
          )}

          {weather && !weatherLoading && (
            <p className="weather-timestamp">
              Last observation: {weather.time || "Time unavailable"}
            </p>
          )}
        </section>

        <section className="sidebar-section">
          <h3>District Information</h3>

          {selectedDistrictInfo ? (
            <>
              <p>
                <strong>District:</strong> {selectedDistrictInfo.name}
              </p>

              <p>
                <strong>Latitude:</strong>{" "}
                {selectedDistrictInfo.latitude ?? "--"}
              </p>

              <p>
                <strong>Longitude:</strong>{" "}
                {selectedDistrictInfo.longitude ?? "--"}
              </p>
            </>
          ) : (
            <p className="weather-message">
              Select a district to view its details.
            </p>
          )}
        </section>

        <section className="sidebar-section">
          <h3>Disaster Risk</h3>

          <div className="risk-row">
            <span>Flood Risk</span>
            <strong>--</strong>
          </div>

          <div className="risk-row">
            <span>Landslide Risk</span>
            <strong>--</strong>
          </div>

          <div className="risk-row">
            <span>Drought Risk</span>
            <strong>--</strong>
          </div>

          <p className="weather-message">
            Risk indicators will be available when the relevant backend
            data is connected.
          </p>
        </section>
      </aside>
    </div>
  );
}