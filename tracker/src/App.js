import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Users,
  Wallet,
  CalendarDays,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

const BACKEND_URL = "https://mgnrega-tracker-1064589003793.us-central1.run.app/"; // change if backend deployed

function App() {
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [districtData, setDistrictData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);

  // ------------------ Fetch MNREGA Data ------------------
  const fetchMnregaData = async (stateId, districtName) => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/mnrega`, {
        params: { state: stateId, district: districtName },
      });
      setDistrictData(res.data);
    } catch (error) {
      console.error("Error fetching MNREGA data:", error);
      toast.error("Error loading MNREGA data");
    } finally {
      setLoading(false);
    }
  };

  // ------------------ Load all States ------------------
  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/api/states`)
      .then((res) => setStates(res.data))
      .catch((err) => console.error("Error loading states:", err));
  }, []);

  // ------------------ Load Districts ------------------
  const fetchDistricts = async (stateId) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/districts`, {
        params: { state: stateId },
      });
      setDistricts(res.data);
    } catch (error) {
      console.error("Error loading districts:", error);
    }
  };

  // ------------------ When a state is selected manually ------------------
  useEffect(() => {
    if (!selectedState) return;
    fetchDistricts(selectedState);
  }, [selectedState]);

  // ------------------ When a district is selected manually ------------------
  const handleDistrictSelect = async (district) => {
    if (!selectedState) return;
    setSelectedDistrict(district);
    fetchMnregaData(selectedState, district);
  };

  // ------------------ Auto-detect Location ------------------
  useEffect(() => {
    if (states.length === 0) return; // Wait until states are loaded
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        console.log("Detected coordinates:", lat, lon);

        try {
          // Ask backend for the nearest district using latitude & longitude
          const res = await axios.get(`${BACKEND_URL}/api/nearest-district`, {
            params: { lat, lon },
          });

          const nearest = res.data; // { state_id, state_name_en, district_name_en, district_id }
          console.log("Nearest district from backend:", nearest);

          if (!nearest || !nearest.state_id || !nearest.district_name_en) {
            toast.warn("Couldn't detect your district");
            return;
          }

          setSelectedState(nearest.state_id);
          setSelectedDistrict(nearest.district_name_en);

          toast.success(
            `Detected: ${nearest.district_name_en}, ${nearest.state_name_en}`
          );

          // Fetch MNREGA data
          fetchMnregaData(nearest.state_id, nearest.district_name_en);
        } catch (error) {
          console.error("Error detecting location:", error);
          toast.error("Location detection failed");
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.warn("Please allow location access");
      }
    );
  }, [states]);

  // ------------------ Helpers ------------------
  const formatNumber = (num) => num?.toLocaleString("en-IN") || "—";

  const getComparison = (current, prev) => {
    const diff = current - prev;
    if (diff > 0)
      return (
        <span className="text-green-600 flex items-center gap-1">
          <ArrowUp size={16} /> +{formatNumber(diff)}
        </span>
      );
    if (diff < 0)
      return (
        <span className="text-red-600 flex items-center gap-1">
          <ArrowDown size={16} /> {formatNumber(diff)}
        </span>
      );
    return (
      <span className="text-gray-500 flex items-center gap-1">
        <Minus size={16} /> No change
      </span>
    );
  };

  const createBar = (history) => {
    const max = Math.max(...history.map((d) => d.families));
    return history.map((d) => {
      const width = (d.families / max) * 100;
      return (
        <div key={d.month} className="flex items-center text-sm space-x-2">
          <span className="w-20 font-medium text-gray-700">{d.month}</span>
          <div className="flex-1 bg-gray-200 rounded-full h-5">
            <div
              className="bg-blue-600 h-5 rounded-full flex items-center justify-end pr-2 text-white text-xs font-semibold transition-all"
              style={{ width: `${width}%` }}
            >
              {formatNumber(d.families)}
            </div>
          </div>
        </div>
      );
    });
  };

  // ------------------ UI ------------------
  return (
    <div className="App">
      <ToastContainer position="top-center" autoClose={3000} />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
        <header className="bg-blue-700 text-white py-6 shadow-md text-center">
          <h1 className="text-3xl md:text-4xl font-bold">
            हमारा स्वर, हमारे अधिकार
          </h1>
          <p className="text-blue-100">MGNREGA Performance Dashboard</p>
        </header>

        <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
          {/* State & District Dropdowns */}
          <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-xl">
            <h2 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6 text-center">
              Select Your Region
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">
                  राज्य (State)
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedDistrict("");
                    setDistrictData(null);
                  }}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select State --</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name_hi} ({state.name_en})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  जिला (District)
                </label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictSelect(e.target.value)}
                  disabled={!selectedState}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {!selectedState
                      ? "-- Select State first --"
                      : "-- Select District --"}
                  </option>
                  {districts.map((d) => (
                    <option key={d.id || d.code} value={d.name_en}>
                      {d.name_hi} ({d.name_en})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center items-center py-10">
              <div className="border-4 border-gray-200 border-t-blue-500 rounded-full w-10 h-10 animate-spin"></div>
              <p className="ml-4 text-gray-600">Loading data...</p>
            </div>
          )}

          {districtData && !loading && (
            <div className="bg-white/90 backdrop-blur-lg rounded-2xl shadow-xl p-8 space-y-6">
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedDistrict}
                </h2>
                <p className="text-gray-500">
                  Performance for Current Month (Nov 2025)
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  {
                    color: "blue",
                    label: "Families Provided Work",
                    icon: <Users className="text-blue-600" />,
                    current: districtData.currentMonth.families_worked,
                    prev: districtData.prevMonth.families_worked,
                  },
                  {
                    color: "green",
                    label: "Average Daily Wage",
                    icon: <Wallet className="text-green-600" />,
                    current: districtData.currentMonth.avg_wage,
                    prev: districtData.prevMonth.avg_wage,
                    prefix: "₹",
                  },
                  {
                    color: "purple",
                    label: "Total Workdays",
                    icon: <CalendarDays className="text-purple-600" />,
                    current: districtData.currentMonth.total_days,
                    prev: districtData.prevMonth.total_days,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className={`border p-5 rounded-xl flex items-center gap-4 hover:shadow-md transition bg-${item.color}-50 border-${item.color}-200`}
                  >
                    <div className={`bg-${item.color}-100 p-3 rounded-full`}>
                      {item.icon}
                    </div>
                    <div>
                      <p
                        className={`text-sm text-${item.color}-700 font-semibold`}
                      >
                        {item.label}
                      </p>
                      <p className="text-2xl font-bold">
                        {item.prefix || ""}
                        {formatNumber(item.current)}
                      </p>
                      {getComparison(item.current, item.prev)}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Work (Families) in Last 6 Months
                </h3>
                <div className="space-y-3">{createBar(districtData.history)}</div>
              </div>
            </div>
          )}
        </main>

        <footer className="text-center p-4 text-gray-500 text-xs">
          © 2025 हमारा स्वर, हमारे अधिकार
        </footer>
      </div>
    </div>
  );
}

export default App;
