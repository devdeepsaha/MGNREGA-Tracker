from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
from dotenv import load_dotenv
import os
import requests
import math

# ------------------ Load environment variables ------------------
load_dotenv()

# ------------------ Initialize FastAPI ------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000","https://mgnrega-tracker-rose.vercel.app"],  # your React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ Supabase Setup ------------------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ------------------ Reverse Geocoding ------------------
@app.get("/api/reverse-geocode")
def reverse_geocode(lat: float, lon: float):
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}"
    headers = {"User-Agent": "MNREGA-Tracker/1.0 (contact@example.com)"}
    res = requests.get(url, headers=headers)
    return res.json()


# ------------------ Find Nearest District ------------------
@app.get("/api/nearest-district")
def get_nearest_district(lat: float, lon: float):
    # Fetch all districts with lat & lon
    response = supabase.table("districts").select("id, name_en, state_id, latitude, longitude").execute()
    districts = response.data

    if not districts:
        raise HTTPException(status_code=404, detail="No districts found")

    # Haversine formula to calculate distance
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371  # km
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    # Find the district with minimum distance
    nearest = min(districts, key=lambda d: haversine(lat, lon, d["latitude"], d["longitude"]))

    # Fetch state name
    state_res = supabase.table("states").select("name_en").eq("id", nearest["state_id"]).execute()
    state_name = state_res.data[0]["name_en"] if state_res.data else ""

    return {
        "district_id": nearest["id"],
        "district_name_en": nearest["name_en"],
        "state_id": nearest["state_id"],
        "state_name_en": state_name
    }


# ------------------ Root ------------------
@app.get("/")
def root():
    return {"message": "MNREGA Tracker Backend Connected to Supabase ✅"}


# ------------------ Fetch States ------------------
@app.get("/api/states")
def get_states():
    response = supabase.table("states").select("*").execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="No states found")
    return response.data


# ------------------ Fetch Districts ------------------
@app.get("/api/districts")
def get_districts(state: str):
    response = supabase.table("districts").select("*").eq("state_id", state).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="No districts found for that state")
    return response.data


# ------------------ Fetch MNREGA Data ------------------
@app.get("/api/mnrega")
def get_mnrega(state: int, district: str):
    clean_district = district.split("(")[-1].replace(")", "").strip() if "(" in district else district.strip()

    district_query = supabase.table("districts").select("id, name_hi").or_(
        f"name_en.eq.{clean_district},name_hi.eq.{clean_district}"
    ).execute()

    if not district_query.data:
        raise HTTPException(status_code=404, detail=f"District '{district}' not found")

    district_id = district_query.data[0]["id"]
    district_name_hi = district_query.data[0]["name_hi"]

    mnrega_query = supabase.table("mnrega_data").select("*").eq("district_id", district_id).execute()

    if not mnrega_query.data:
        raise HTTPException(status_code=404, detail=f"No MNREGA data found for district '{district}'")

    data_sorted = sorted(mnrega_query.data, key=lambda x: (x["year"], x["month"]))
    history = [
        {"month": d["month"], "families": d["families_worked"]}
        for d in data_sorted[-6:]
    ]

    current = data_sorted[-1]
    prev = data_sorted[-2] if len(data_sorted) > 1 else current

    return {
        "districtName_hi": district_name_hi,
        "currentMonth": current,
        "prevMonth": prev,
        "history": history
    }
