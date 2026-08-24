# ORCA — Marine Ecosystem Reasoning with Collaborative Agents
## PLAN.md — Final Source of Truth for SIH 2026 Prototype

> **STATUS: FROZEN**
> This document is the project contract. Do not change the architecture, technology stack, or scope without explicit team agreement.
> Before adding any feature, ask: *"Does this help demonstrate the Living Decision Lifecycle?"*
> If NO — do not build it in V1.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Final Solution](#3-final-solution)
4. [Core Innovation](#4-core-innovation--living-decision-lifecycle)
5. [Frozen Scope](#5-frozen-scope)
6. [User Journey](#6-user-journey)
7. [Complete Architecture](#7-complete-architecture)
8. [Component Responsibilities](#8-component-responsibilities)
9. [Data Sources](#9-data-sources)
10. [API Strategy](#10-api-strategy)
11. [Data Schemas](#11-data-schemas)
12. [Decision Object Schema](#12-decision-object-schema)
13. [Decision Engine Logic](#13-decision-engine-logic)
14. [Safety Rule Structure](#14-safety-rule-structure)
15. [Change Detection Logic](#15-change-detection-logic)
16. [Repair / Wait Logic](#16-repair--wait-logic)
17. [Gemini Integration Design](#17-gemini-integration-design)
18. [Dashboard Structure](#18-dashboard-structure)
19. [Frontend Architecture](#19-frontend-architecture)
20. [Backend Architecture](#20-backend-architecture)
21. [Folder / Project Structure](#21-folder--project-structure)
22. [API Endpoints](#22-api-endpoints)
23. [Request / Response Examples](#23-request--response-examples)
24. [Demo Data Strategy](#24-demo-data-strategy)
25. [Fallback Strategy](#25-fallback-strategy)
26. [Error Handling](#26-error-handling)
27. [Development Phases](#27-development-phases)
28. [P0 / P1 / P2 Priorities](#28-p0--p1--p2-priorities)
29. [Demo Flow](#29-demo-flow)
30. [SIH Presentation Flow](#30-sih-presentation-flow)
31. [Testing Strategy](#31-testing-strategy)
32. [Definition of Done](#32-definition-of-done)
33. [Future Scope](#33-future-scope)
34. [Explicit NOT-TO-BUILD List](#34-explicit-not-to-build-list)

---

## 1. Executive Summary

**ORCA** (Marine Ecosystem Reasoning with Collaborative Agents) is a marine decision-support platform built for SIH 2026, Problem Statement ID 26176, submitted by ISRO / Department of Space.

ORCA answers four core marine questions:
- Where should I go?
- When should I go?
- Is it safe?
- What should I do if conditions change?

What separates ORCA from existing marine information systems is the **Living Decision Lifecycle**: once a user accepts a recommendation, ORCA does not discard it. It saves the decision, monitors the conditions that justified it, detects when conditions change enough to invalidate it, explains the impact in plain language, and suggests verified safe alternatives — all without ever letting Gemini make a safety-critical calculation.

**One-line USP:**
> *"ORCA doesn't just tell you what to do — it keeps checking whether that decision is still right."*

**Guiding architectural principle:**
> *"AI understands and explains. Code calculates and decides."*

The prototype is scoped to a single user role (Fisherman), a single demo flow, and enough data infrastructure to make that flow reliable during a live SIH presentation.

---

## 2. Problem Statement

| Field | Value |
|---|---|
| **ID** | 26176 |
| **Title** | ORCA Marine EcOsystem Reasoning with Collaborative Agents |
| **Organisation** | Indian Space Research Organisation (ISRO) |
| **Department** | Department of Space |
| **Category** | Software |
| **Theme** | Miscellaneous |

**In plain words:** ISRO needs an intelligent conversational platform that integrates satellite Earth Observation (SST, chlorophyll), ocean data, weather forecasts, GIS layers, and marine advisories to help users make real decisions — not just retrieve raw data. The platform must reason, explain, support multiple Indian languages, enforce geofencing, and produce actionable, evidence-backed recommendations.

**Key user queries the system must handle:**
- Where is the nearest Potential Fishing Zone today?
- Is it safe to venture into the sea tomorrow morning?
- What are tide, weather, and sea conditions near my location?
- Are there lightning or cyclone alerts in my area?
- What is the safest route considering weather and sea-state?
- Which zones should be avoided due to hazardous conditions or boundaries?

---

## 3. Final Solution

### What ORCA Is

ORCA is a **marine decision-support platform** — not a chatbot, not a data portal, and not a weather widget. It combines:

- Satellite / Earth Observation data (SST, chlorophyll — simulated in prototype)
- Ocean and wave data (Open-Meteo Marine API)
- Weather data (Open-Meteo Forecast API)
- Marine advisories (simulated in prototype)
- GIS and map data (Leaflet + OpenStreetMap + GeoJSON)
- Fishing zone information (demo GeoJSON with PFZ scores)
- User and mission information (stored in Decision Object)

### What ORCA Is Not

ORCA is **not** a generic AI assistant that happens to know about the sea. It is a system where:
- **Rules and code** determine whether something is safe.
- **Gemini** understands what the user meant and explains what the system found.

### Single-Sentence Position

> *ORCA turns a one-time marine recommendation into a living decision that it monitors, re-evaluates, explains, and repairs as conditions evolve.*

---

## 4. Core Innovation — Living Decision Lifecycle

The Living Decision Lifecycle (LDL) is the central innovation of ORCA. It has nine stages but the prototype must prove only the following are working reliably:

```
[P0 — MUST WORK]
Query -> Plan -> Decide -> TRACK -> WATCH -> CHANGE DETECTION
-> IMPACT CHECK -> EXPLAIN -> REPAIR / WAIT

[P1 — If time allows]
Mission -> Feedback -> Learn / Compare (Predicted vs Actual)
```

### The Nine Stages (Conceptual)

| Stage | Description | Prototype Priority |
|---|---|---|
| 1. Query | User asks in natural language | P0 |
| 2. Plan | ORCA identifies data needed and collects it | P0 |
| 3. Decide | Decision engine produces GO / CAUTION / WAIT | P0 |
| 4. Watch | User tracks decision; ORCA saves Decision Object and monitors it | P0 |
| 5. Explain | ORCA detects a change and explains why the decision is affected | P0 |
| 6. Repair / Wait | ORCA generates verified safe alternatives; user selects | P0 |
| 7. Mission | User executes the plan | P0 (UI state only) |
| 8. Feedback | User submits post-mission feedback | P1 |
| 9. Learn / Compare | ORCA stores Predicted vs Actual | P1 |

### Why This Is the Innovation

Most marine platforms stop at Stage 3. They give a recommendation and it disappears. ORCA is designed so the recommendation is a persistent, living object that the system stays responsible for. This is what differentiates ORCA from:
- A chatbot with marine data (stops at Stage 3)
- A weather alert system (notifies but does not connect alert to a specific user decision)
- A PFZ portal (shows information but does not link it to a tracked mission)

**The real innovation is Stages 4-6: Watch, Explain, Repair/Wait.**

---

## 5. Frozen Scope

### What is IN the V1 Prototype

- Single user role: **Fisherman**
- Chat interface (text, English + Hindi + Hinglish)
- Gemini query understanding and intent extraction
- Data collection: Open-Meteo (real API with fallback), demo marine/PFZ data
- Deterministic decision engine: GO / CAUTION / WAIT
- Map dashboard: Leaflet + OpenStreetMap
- Decision Object: persistent storage (SQLite)
- Track Decision button
- Check Again button
- Simulate Condition Change button (demo reliability)
- Impact check and threshold comparison
- Gemini explanation of change and alternatives
- Repair / Wait selection and state update
- Basic feedback submission (P1)
- Predicted vs Actual display (P1)
- Fallback data for all external APIs

### What is OUT of the V1 Prototype

See Section 34 for the full explicit list.

---

## 6. User Journey

This is the complete journey a Fisherman user experiences during the prototype demo. Every step listed here must work.

```
1.  User opens ORCA in browser.

2.  User sees a map of Indian coastal waters with demo fishing zones
    marked (Zone A, Zone B, Zone C).

3.  User types in the chat:
    "Where should I go fishing tomorrow morning?"
    (or in Hindi: "kal subah mujhe machli pakadne kahan jana chahiye?")

4.  ORCA (Gemini) extracts intent:
    - purpose: fishing
    - time: tomorrow morning
    - role: fisherman
    - location: (from user profile or last known)

5.  ORCA collects:
    - Wave height, wind speed, wind direction (Open-Meteo or cache)
    - PFZ scores for available zones (demo data)
    - Distance from user location to each zone (calculated)
    - Boundary check for each zone (GeoJSON polygon check)

6.  Decision engine evaluates each zone.
    Produces: Zone B -> GO (score 82), Zone A -> CAUTION (score 61),
              Zone C -> WAIT (score 38)

7.  Dashboard updates:
    - Map shows Zone B highlighted GREEN
    - Side panel shows: GO | Wave: 1.4m | Wind: 12 km/h | PFZ: 86 | Distance: 18 km
    - Explanation: "Zone B is recommended. Sea conditions are safe,
      fishing potential is high, and no boundary restrictions apply."

8.  User clicks: [TRACK DECISION]

9.  ORCA creates and persists Decision Object in SQLite.
    Side panel shows: WATCHING (checkmark)

10. User (or demo presenter) clicks: [SIMULATE CONDITION CHANGE]
    or [CHECK AGAIN]

11. System simulates: Wave height changes 1.4m -> 2.8m

12. Decision Watch runs:
    - Loads Decision Object
    - Loads new conditions
    - Compares: 2.8m > threshold 2.5m
    - Decision is AFFECTED

13. Decision status changes to ALERT.

14. ORCA (Gemini) generates explanation:
    "Your Zone B plan is no longer suitable.
     Wave height has increased from 1.4m to 2.8m,
     exceeding the safety limit of 2.5m."

15. Repair engine runs deterministically:
    - Option A: Leave 2 hours earlier -> rechecks engine -> SAFE
    - Option B: Go to Zone C -> rechecks engine -> SAFE
    - Option C: Wait until 14:00 -> rechecks engine -> SAFE

16. Dashboard shows REPAIR / WAIT options with verification badges.

17. User selects REPAIR -> Option A (Leave earlier)

18. Decision Object updated: status = REPAIRED, repair_action = "depart_early_2h"

19. [P1] After mission, user submits feedback.
20. [P1] ORCA stores Predicted vs Actual.
```

---

## 7. Complete Architecture

### Architecture Flow

```
USER (Fisherman, Browser, Chat UI)
        |
        | HTTP / REST
        v
FRONTEND (Next.js + React + Leaflet)
Map | Chat Panel | Decision Panel | Status Indicators
        |
        | REST API calls
        v
FASTAPI BACKEND (Python 3.11+)
        |
        +---> GEMINI QUERY UNDERSTANDING
        |       - Parse natural language -> structured intent
        |       - Language detection (EN / HI / Hinglish)
        |       - Extract: zone, time, purpose, constraints
        |
        +---> DATA COLLECTION LAYER
        |       - Open-Meteo adapter (wave, wind, weather)
        |       - PFZ adapter (demo data / GeoJSON)
        |       - SST adapter (NOAA ERDDAP / cache) [P1]
        |       - Boundary loader (GeoJSON polygons)
        |       - Distance calculator (Haversine)
        |       - Cache layer (prevents repeat API calls)
        |
        +---> DETERMINISTIC DECISION ENGINE
        |       - Hard rules: boundary -> WAIT
        |       - Hard rules: critical safety -> WAIT
        |       - Safety score (wave, wind, current)
        |       - Fishing score (PFZ)
        |       - Effort score (distance)
        |       - Weighted sum -> GO / CAUTION / WAIT
        |       - Configurable thresholds from config.json
        |
        +---> DECISION RESULT (structured JSON)
        |
        |   [User clicks TRACK DECISION]
        v
DECISION OBJECT (persisted in SQLite)
        |
        |   [CHECK AGAIN / SIMULATE button]
        v
DECISION WATCH
        - Loads Decision Object
        - Fetches current conditions
        - Compares to saved conditions + thresholds
        |
        v
CHANGE DETECTION
        - Identifies which conditions crossed threshold
        - Produces structured ChangeEvent
        |
        v
IMPACT CHECK
        - Determines if change invalidates decision
        - Updates decision status
        |
        v
GEMINI EXPLANATION
        - Receives ChangeEvent + Decision Object
        - Generates human-readable explanation
        - Multilingual output
        |
        v
REPAIR / WAIT ENGINE
        - Generates candidate alternatives
        - Re-runs decision engine on each candidate
        - Returns only verified-safe options
        |
        v
UPDATED DECISION OBJECT
        - status = REPAIRED / WAITING
        - repair_action saved
        - change_history appended
```

### Why This Architecture

| Decision | Reason |
|---|---|
| **FastAPI (Python)** | Fast to build, great async support, easy for Python-familiar teams. Decision engine and Gemini calls fit naturally. |
| **Next.js / React** | Well-supported, allows SSR if needed, great ecosystem for map + UI components. |
| **Leaflet + OpenStreetMap** | Free, no API key needed, excellent react-leaflet wrapper, supports GeoJSON layers natively. |
| **Gemini API** | Required by the PS context. Handles multilingual NL understanding and explanation generation. |
| **SQLite** | Zero-config, file-based, sufficient for ~100 Decision Objects. No setup burden or network dependency. |
| **Python deterministic rules** | Safety decisions must never depend on LLM output. Python functions are auditable, testable, deterministic. |
| **Simple module functions** | Each conceptual "agent" is a Python module. Simpler, more reliable, less likely to break during live demo than n8n/LangGraph. |

---

## 8. Component Responsibilities

### 8.1 Gemini Query Understanding Module

**File:** `backend/modules/query_understanding.py`

**Responsibility:** Translate user's natural-language message into a structured intent object.

**Input:** Raw user message (string, any language)

**Output (JSON):**
```json
{
  "intent": "fishing_recommendation",
  "zone": "Zone B",
  "time_reference": "tomorrow_morning",
  "resolved_datetime": "2026-08-26T06:00:00",
  "user_role": "fisherman",
  "language": "en",
  "constraints": [],
  "raw_query": "Where should I go fishing tomorrow morning?"
}
```

**Gemini is allowed to:** parse language, extract entities, return JSON
**Gemini is NOT allowed to:** return a safety verdict, invent marine data, or override any threshold

**Why Gemini here:** Natural language understanding and multilingual support are exactly what LLMs excel at. This is not safety-critical — it is a parsing task.

---

### 8.2 Data Collection Layer

**File:** `backend/modules/data_collection.py`

**Responsibility:** Collect all data required for the decision engine. Returns a unified MarineConditions object.

**Sub-adapters:**

| Adapter | Source | Fallback |
|---|---|---|
| WeatherAdapter | Open-Meteo Marine + Forecast API | cache/weather_demo.json |
| PFZAdapter | data/pfz_zones.geojson (demo) | Same file (always available) |
| SSTAdapter | NOAA CoastWatch ERDDAP [P1] | cache/sst_demo.json |
| BoundaryAdapter | data/boundaries.geojson | Same file (always available) |
| DistanceCalculator | Haversine formula (pure Python) | N/A (pure calculation) |

**Why a unified adapter pattern:** Data sources will change in production (ISRO/INCOIS). The adapter interface isolates those changes. The decision engine always receives the same MarineConditions structure regardless of the source.

---

### 8.3 Deterministic Decision Engine

**File:** `backend/modules/decision_engine.py`

**Responsibility:** Accept MarineConditions and DecisionRequest -> return DecisionResult.

This is the most important module in ORCA. It must never delegate a safety-critical decision to Gemini.

**Details:** See Section 13.

---

### 8.4 Decision Object Store

**File:** `backend/modules/decision_store.py`

**Responsibility:** Create, read, update, and list Decision Objects. Backed by SQLite (data/decisions.db).

**Why SQLite over JSON files:** SQLite is a single file, supports basic queries, handles concurrent reads, and is a standard Python library.

**Why NOT PostgreSQL:** The prototype needs to persist ~10-20 Decision Objects at most. PostgreSQL adds deployment complexity with zero benefit at this scale.

---

### 8.5 Decision Watch Module

**File:** `backend/modules/decision_watch.py`

**Responsibility:** Triggered on demand (via API call from frontend button). Loads a Decision Object, fetches current conditions, compares against saved conditions, determines impact.

**Details:** See Section 15.

---

### 8.6 Repair / Wait Engine

**File:** `backend/modules/repair_engine.py`

**Responsibility:** Given an affected Decision Object, generate a list of safe alternative options. Each option is verified by re-running the decision engine.

**Details:** See Section 16.

---

### 8.7 Gemini Explanation Module

**File:** `backend/modules/explanation.py`

**Responsibility:** Generate human-readable, multilingual explanation text from structured data. Called after impact check and after repair engine.

**Gemini receives:** A structured prompt containing the original decision data, what changed (ChangeEvent), what the alternatives are (RepairOptions), and user language preference.

**Gemini returns:** Plain text explanation in appropriate language.

**Why Gemini here:** Explanation of complex multi-factor marine decisions in natural language (including Hindi/Hinglish) is a natural fit for an LLM. The decisions are already made by Python code — Gemini only writes the explanation.

---

## 9. Data Sources

### 9.1 Weather and Marine Data — Open-Meteo

**Why Open-Meteo:** Free, no API key required, reliable uptime, comprehensive marine variables (wave height, wave direction, wave period, wind speed, wind direction, ocean current), and a JSON REST API trivial to call from Python.

**Endpoints:**
- Marine API: `https://marine-api.open-meteo.com/v1/marine`
- Forecast API: `https://api.open-meteo.com/v1/forecast`

**Variables requested:**
```
Marine:  wave_height, wave_direction, wave_period, swell_wave_height, ocean_current_velocity
Forecast: wind_speed_10m, wind_direction_10m, precipitation, weather_code, visibility
```

**Prototype strategy:** Call the real API. Cache the response locally for 1 hour. If API is down, use `cache/weather_demo.json`. Cached/demo data must be labelled `[DEMO DATA]` in the UI.

---

### 9.2 SST — NOAA CoastWatch ERDDAP [P1]

**Why:** NOAA CoastWatch ERDDAP is a public, reliable endpoint for Sea Surface Temperature data requiring no API key for basic datasets.

**Prototype strategy:** This is P1. Cache a sample SST grid for the Indian Ocean region as `cache/sst_demo.json`. Always have the cache ready for demo day.

---

### 9.3 Map — Leaflet + OpenStreetMap

**Why Leaflet:** Free, no API key, excellent `react-leaflet` wrapper, supports GeoJSON layers, polygon overlays, custom markers, and route polylines.

**Why OpenStreetMap:** Free tiles, no usage limits for prototype, covers Indian coastal regions well.

---

### 9.4 Geocoding — Nominatim [P1]

**Prototype strategy:** Do not make the prototype depend on Nominatim for the core demo flow. Pre-define demo locations (e.g., "Kochi Port" = lat 9.966, lon 76.267) in a lookup table. Use Nominatim only for user-typed location searches in P1.

---

### 9.5 PFZ / Fishing Zones — Demo GeoJSON

**Why simulated:** Building a real PFZ ML model is out of scope. Official INCOIS PFZ APIs are not publicly accessible for prototype purposes.

**Prototype data:** `data/pfz_zones.geojson` — a GeoJSON FeatureCollection where each feature is a fishing zone polygon.

**Demo values (fixed for prototype):**

| Zone | PFZ Score | Label |
|---|---|---|
| Zone A | 72 | Moderate |
| Zone B | 86 | High |
| Zone C | 91 | Very High |

**IMPORTANT:** These values are prototype demo data. They must NOT be presented as official, real-time PFZ predictions from ISRO or INCOIS.

---

### 9.6 Boundaries — GeoJSON Polygons

**File:** `data/boundaries.geojson`

**Included for prototype:**
- Indian EEZ boundary (approximate, for demo)
- Restricted maritime zone (demo polygon)
- Marine Protected Area (demo polygon)

**Rule:** Boundary check is always deterministic Python. Gemini never decides whether a boundary is crossed.

---

### 9.7 AIS Dataset — OPTIONAL / P2

Not included in V1. The Kaggle fishing/AIS trajectory dataset may be added later for route visualization, but it is not needed for the Living Decision Lifecycle demo.

---

## 10. API Strategy

### Pattern for Every External Data Source

```
1. Try live API call with 5-second timeout
2. On success: cache response with timestamp
3. On failure (timeout / error): load from cache file
4. If cache is empty: load from demo data file
5. Always return data with source label:
   "source": "live" | "cache" | "demo"
```

### Frontend Responsibility

Display a small badge whenever data source is not "live":
- [CACHED] — from recent cache
- [DEMO DATA] — from demo fallback file

This is mandatory for SIH presentation honesty and prototype labelling.

---

## 11. Data Schemas

### MarineConditions

```python
@dataclass
class MarineConditions:
    timestamp: str                  # ISO 8601
    location: Location              # lat, lon
    wave_height_m: float
    wave_direction_deg: float
    wave_period_s: float
    wind_speed_kmh: float
    wind_direction_deg: float
    current_speed_ms: float
    weather_code: int               # WMO code
    visibility_km: float
    lightning_alert: bool
    cyclone_alert: bool
    sst_celsius: Optional[float]    # P1
    data_source: str                # "live" | "cache" | "demo"
```

### ZoneInfo

```python
@dataclass
class ZoneInfo:
    zone_id: str
    zone_name: str
    pfz_score: int                  # 0-100
    pfz_label: str                  # Low / Moderate / High / Very High
    centroid: Location
    polygon: List[List[float]]      # GeoJSON coordinates
    distance_km: float
    boundary_violation: bool
    restricted: bool
```

### DecisionResult

```python
@dataclass
class DecisionResult:
    zone_id: str
    status: str                     # "GO" | "CAUTION" | "WAIT"
    score: int                      # 0-100
    safety_score: int
    fishing_score: int
    effort_score: int
    boundary_violation: bool
    hard_stop: bool
    reasons: List[str]
    conditions: MarineConditions
    thresholds_used: dict
```

---

## 12. Decision Object Schema

The Decision Object is persisted in SQLite as a JSON blob with indexed columns for querying.

```json
{
  "decision_id": "dec_20260826_001",
  "created_at": "2026-08-26T05:30:00Z",
  "updated_at": "2026-08-26T07:15:00Z",

  "user": {
    "user_id": "user_demo_fisherman",
    "user_role": "fisherman",
    "name": "Raju",
    "language": "en",
    "origin": { "lat": 9.966, "lon": 76.267, "name": "Kochi Port" }
  },

  "mission": {
    "purpose": "fishing",
    "zone_id": "zone_b",
    "zone_name": "Zone B",
    "destination": { "lat": 10.5, "lon": 76.8 },
    "planned_start": "2026-08-26T06:00:00Z",
    "planned_return": "2026-08-26T14:00:00Z"
  },

  "original_decision": {
    "status": "GO",
    "score": 82,
    "safety_score": 90,
    "fishing_score": 86,
    "effort_score": 74,
    "hard_stop": false,
    "boundary_violation": false,
    "reasons": [
      "Wave height 1.4m is within safe limit (2.5m)",
      "Wind speed 12 km/h is within safe limit (30 km/h)",
      "PFZ score 86 indicates high fishing potential",
      "Distance 18km is within acceptable range",
      "No boundary restrictions apply"
    ]
  },

  "original_conditions": {
    "timestamp": "2026-08-26T05:30:00Z",
    "wave_height_m": 1.4,
    "wave_direction_deg": 225,
    "wave_period_s": 8.0,
    "wind_speed_kmh": 12.0,
    "wind_direction_deg": 210,
    "current_speed_ms": 0.3,
    "weather_code": 1,
    "visibility_km": 10.0,
    "lightning_alert": false,
    "cyclone_alert": false,
    "data_source": "live"
  },

  "thresholds": {
    "wave_height_safe_m": 1.5,
    "wave_height_caution_m": 2.5,
    "wind_speed_safe_kmh": 30,
    "wind_speed_caution_kmh": 50,
    "current_speed_caution_ms": 1.0,
    "visibility_min_km": 2.0,
    "score_go_threshold": 75,
    "score_caution_threshold": 50,
    "weights": { "safety": 0.50, "fishing": 0.30, "effort": 0.20 },
    "config_version": "prototype_v1"
  },

  "boundaries_checked": [
    { "boundary_id": "indian_eez", "name": "Indian EEZ", "violated": false },
    { "boundary_id": "restricted_zone_alpha", "name": "Restricted Zone Alpha", "violated": false }
  ],

  "current_status": "ALERT",
  "tracking_status": "WATCHING",

  "latest_conditions": {
    "timestamp": "2026-08-26T07:15:00Z",
    "wave_height_m": 2.8,
    "wind_speed_kmh": 14.0,
    "data_source": "demo"
  },

  "change_history": [
    {
      "detected_at": "2026-08-26T07:15:00Z",
      "changes": [
        {
          "field": "wave_height_m",
          "original": 1.4,
          "current": 2.8,
          "threshold": 2.5,
          "threshold_crossed": true
        }
      ],
      "decision_affected": true,
      "explanation": "Wave height increased from 1.4m to 2.8m, exceeding the safety limit of 2.5m. Your Zone B plan is no longer suitable."
    }
  ],

  "repair_options": [
    {
      "option_id": "repair_depart_early",
      "type": "depart_early",
      "description": "Leave 2 hours earlier (04:00 instead of 06:00)",
      "modified_start": "2026-08-26T04:00:00Z",
      "decision_result": { "status": "GO", "score": 79 },
      "verified": true
    },
    {
      "option_id": "repair_zone_c",
      "type": "alternate_zone",
      "description": "Move to Zone C instead",
      "zone_id": "zone_c",
      "decision_result": { "status": "GO", "score": 81 },
      "verified": true
    },
    {
      "option_id": "repair_wait",
      "type": "wait",
      "description": "Wait until 14:00 when conditions improve",
      "modified_start": "2026-08-26T14:00:00Z",
      "decision_result": { "status": "GO", "score": 76 },
      "verified": true
    }
  ],

  "selected_action": {
    "action_type": "repair",
    "option_id": "repair_depart_early",
    "selected_at": "2026-08-26T07:20:00Z"
  },

  "feedback": null
}
```

### SQLite Table Structure

```sql
CREATE TABLE decisions (
    decision_id     TEXT PRIMARY KEY,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    zone_id         TEXT NOT NULL,
    current_status  TEXT NOT NULL,
    tracking_status TEXT NOT NULL,
    data            TEXT NOT NULL
);
```

**Why JSON blob in SQLite:** The Decision Object is complex and evolves. Storing it as a JSON blob gives us full flexibility without schema migrations. We can query by `decision_id`, `user_id`, and `current_status` using indexed columns.

---

## 13. Decision Engine Logic

**File:** `backend/modules/decision_engine.py`

### Step-by-Step Logic

```
STEP 1: HARD STOPS (immediate WAIT, no score calculation)

  IF zone.boundary_violation:
    status = "WAIT"
    reason = "Boundary restriction applies to this zone"
    return immediately

  IF conditions.cyclone_alert:
    status = "WAIT"
    reason = "Active cyclone advisory"
    return immediately

  IF conditions.lightning_alert:
    status = "WAIT"
    reason = "Lightning alert active"
    return immediately

STEP 2: SAFETY SCORE (0-100)

  wave_score:
    wave < wave_safe_threshold    -> 100
    wave < wave_caution_threshold -> 60
    else                          -> 0

  wind_score:
    wind < wind_safe_threshold    -> 100
    wind < wind_caution_threshold -> 60
    else                          -> 0

  current_score:
    current < current_caution     -> 100
    else                          -> 40

  visibility_score:
    visibility > visibility_min   -> 100
    else                          -> 20

  safety_score = mean(wave_score, wind_score, current_score, visibility_score)

STEP 3: FISHING SCORE (0-100)
  fishing_score = zone.pfz_score  (directly, 0-100)

STEP 4: EFFORT SCORE (0-100)
  distance < 20km   -> 100
  distance < 50km   -> 70
  distance < 100km  -> 40
  else              -> 10

STEP 5: WEIGHTED FINAL SCORE
  final_score = (safety_score * 0.50) + (fishing_score * 0.30) + (effort_score * 0.20)

STEP 6: STATUS DETERMINATION
  score >= 75  -> GO
  score >= 50  -> CAUTION
  else         -> WAIT

STEP 7: BUILD REASONS LIST
  Append human-readable reason for each significant factor.

STEP 8: RETURN DecisionResult
```

### Configurable Thresholds — config/thresholds.json

```json
{
  "config_version": "prototype_v1",
  "disclaimer": "PROTOTYPE THRESHOLDS ONLY. Not official maritime safety standards.",
  "wave_height_safe_m": 1.5,
  "wave_height_caution_m": 2.5,
  "wind_speed_safe_kmh": 30,
  "wind_speed_caution_kmh": 50,
  "current_speed_caution_ms": 1.0,
  "visibility_min_km": 2.0,
  "score_go_threshold": 75,
  "score_caution_threshold": 50,
  "weights": {
    "safety": 0.50,
    "fishing": 0.30,
    "effort": 0.20
  }
}
```

**Why configurable:** Thresholds must never be hardcoded. During the SIH demo, judges may ask "what if you change the threshold?" — we must be able to show it is a configuration, not embedded in code.

---

## 14. Safety Rule Structure

Safety rules have two tiers:

### Tier 1 — Hard Stops (Binary, Immediate WAIT)

These rules bypass scoring entirely. No score matters if a hard stop is triggered.

| Condition | Rule | Outcome |
|---|---|---|
| Boundary violation | Zone polygon intersects restricted GeoJSON area | WAIT — Hard Stop |
| Cyclone alert | cyclone_alert == True | WAIT — Hard Stop |
| Lightning alert | lightning_alert == True | WAIT — Hard Stop |
| Extreme wave | wave_height > 4.0m | WAIT — Hard Stop |

### Tier 2 — Scored Conditions (Affect score, not binary)

| Condition | Safe | Caution | Unsafe |
|---|---|---|---|
| Wave height | < 1.5m | 1.5-2.5m | > 2.5m |
| Wind speed | < 30 km/h | 30-50 km/h | > 50 km/h |
| Current | < 1.0 m/s | 1.0-1.5 m/s | > 1.5 m/s |
| Visibility | > 5 km | 2-5 km | < 2 km |

**Rule:** Gemini never evaluates any of these conditions. Python code evaluates them using the loaded threshold configuration. Gemini only explains the result that the Python code already calculated.

---

## 15. Change Detection Logic

**File:** `backend/modules/decision_watch.py`

**Triggered by:** POST /api/decisions/{id}/watch  
**Also triggered by:** POST /api/decisions/{id}/simulate-change (demo button)

### Algorithm

```
FUNCTION watch_decision(decision_id, override_conditions=None):

  1. Load Decision Object from SQLite
  2. Fetch current MarineConditions for decision's zone
     (use Data Collection Layer, same fallback rules)
     If override_conditions provided, inject those values

  3. FOR EACH relevant field:
     Compare current value against original value AND threshold

     EXAMPLE:
       original_wave = decision.original_conditions.wave_height_m  (1.4)
       current_wave  = current_conditions.wave_height_m             (2.8)
       threshold     = decision.thresholds.wave_height_caution_m    (2.5)

       IF current_wave > threshold AND original_wave <= threshold:
         threshold_crossed = True
         change_detected = True

  4. IF no threshold crossed:
     Update decision.latest_conditions
     Return: { "affected": false, "status": "WATCHING" }

  5. IF threshold crossed:
     Create ChangeEvent:
       { "field": "wave_height_m", "original": 1.4, "current": 2.8,
         "threshold": 2.5, "threshold_crossed": true }
     Update decision.current_status = "ALERT"
     Append to decision.change_history
     Call Gemini Explanation with ChangeEvent
     Call Repair Engine
     Persist updated Decision Object
     Return: { "affected": true, "change_event": ..., "explanation": ..., "repair_options": ... }
```

### Simulate Condition Change (Demo Button)

The simulate endpoint accepts a payload of overridden conditions:

```json
{ "override_conditions": { "wave_height_m": 2.8 } }
```

This is injected into the Watch algorithm as if it were a live condition fetch. This gives the demo team full control and makes the presentation reliable even if Open-Meteo returns unchanged data.

**Why simulate:** SIH demonstrations are live and time-constrained. Depending on real weather to change within 20 minutes is not reliable. The simulation button produces the exact same code path as a real change — it is not a fake; it is a controlled condition injection.

---

## 16. Repair / Wait Logic

**File:** `backend/modules/repair_engine.py`

**Input:** Affected Decision Object + ChangeEvent
**Output:** List of RepairOption objects, each pre-verified by the decision engine

### Candidates Generated

| Option Type | How Generated |
|---|---|
| depart_early | Try planned_start - 2h, re-run decision engine |
| depart_early_4h | Try planned_start - 4h, re-run decision engine |
| alternate_zone | For each other available zone, re-run decision engine |
| return_earlier | Try planned_return - 2h, re-run decision engine |
| wait | Try planned_start + 3h, +6h, +12h, re-run decision engine |

### Verification Rule

Each candidate is only included in the final repair_options list if the re-run decision engine returns status == "GO". Candidates returning CAUTION or WAIT are excluded.

**Why this matters:** Gemini must never suggest an option without verification. If all candidates fail, the only option returned is WAIT with an estimated time window.

### Gemini Role in Repair

After Python generates and verifies the options, Gemini receives the verified options list and writes human-readable descriptions.

---

## 17. Gemini Integration Design

### When Gemini Is Called

| Call Point | What Gemini Receives | What Gemini Returns |
|---|---|---|
| Query Understanding | Raw user message | Structured intent JSON |
| Decision Explanation | DecisionResult + reasons list | Plain-language explanation |
| Change Explanation | ChangeEvent + Decision Object | Alert message explaining impact |
| Repair Explanation | Verified RepairOptions list | Plain-language option descriptions |

### What Gemini Must NEVER Do

- Return a GO/CAUTION/WAIT verdict
- Invent wave heights, wind values, or PFZ scores
- Decide whether a boundary is crossed
- Suggest repair options that have not been pre-verified by Python
- Override any threshold value

### Prompt Structure Pattern

```
SYSTEM:
You are ORCA's explanation engine. You receive structured marine data
from ORCA's decision system. Your role is to explain results clearly in
{language}. Do NOT invent any data values. Do NOT make safety decisions.
Only explain what the system has calculated.

DATA:
{structured_json}

TASK:
{specific_explanation_task}

RULES:
- Respond in {language}
- Keep explanation under 3 sentences for alerts
- Be factual, not alarmist
- If uncertain about anything, say so
```

### Structured JSON Output for Query Understanding

Gemini is instructed to return JSON for the query understanding call:

```
Parse the user's marine query. Return ONLY valid JSON in this exact format:
{
  "intent": "fishing_recommendation | safety_check | condition_query | zone_suitability",
  "zone": "Zone A | Zone B | Zone C | null",
  "time_reference": "now | tomorrow_morning | tomorrow_afternoon | specific_time | null",
  "resolved_datetime": "ISO 8601 datetime or null",
  "user_role": "fisherman",
  "language": "en | hi | mixed",
  "constraints": [],
  "raw_query": "<original query>"
}

User query: {query}
```

### API Key Management

- Gemini API key stored in `.env` file as `GEMINI_API_KEY`
- Never committed to git
- `.env.example` provided in repo

---

## 18. Dashboard Structure

### Layout Description

```
[Header: ORCA logo | Role selector | Language toggle EN/HI]
[Map: Full-width left panel | Side panel: right]

MAP shows:
  - Zone A, B, C polygons (coloured by status)
  - User location marker (blue)
  - Selected destination marker (green, after decision)
  - Route polyline (dashed, after decision)
  - Boundary polygons (red outline)
  - Hazard markers (when alerts active)

SIDE PANEL shows:
  [Before decision]
    Chat input and history

  [After evaluate]
    Zone name
    Status badge: GO / CAUTION / WAIT
    Score: 82/100
    Wave: 1.4m
    Wind: 12 km/h
    PFZ: 86/100
    Distance: 18 km
    Boundary: Clear
    Explanation text (Gemini)
    [TRACK DECISION] button

  [After track]
    WATCHING (checkmark)
    Saved at: 07:30 AM
    [CHECK AGAIN] button
    [SIMULATE CONDITION CHANGE] button  (demo)

  [After alert]
    ALERT badge
    Wave: 1.4m -> 2.8m (red, exceeded)
    Explanation text
    REPAIR OPTIONS:
      A: Leave 2h earlier -> GO (79) [SELECT]
      B: Zone C -> GO (81) [SELECT]
      C: Wait 14:00 -> GO (76) [SELECT]
    [I'LL WAIT] button

  [After repair selected]
    REPAIRED (checkmark)
    Plan updated message
```

### Map Layer Toggles

| Layer | Default | Description |
|---|---|---|
| Fishing Zones | ON | Coloured polygons Zone A/B/C |
| User Location | ON | Blue marker |
| Destination | ON | Green marker when decision made |
| Route | ON | Dashed polyline when decision made |
| Boundaries | ON | Red/orange polygon outlines |
| Hazards | OFF | Warning markers when alerts active |

---

## 19. Frontend Architecture

**Framework:** Next.js 14 (App Router)
**Language:** TypeScript
**Map:** react-leaflet v4
**Styling:** Tailwind CSS
**State:** React useState / useReducer (no Redux — prototype is simple enough)
**API calls:** fetch with custom hooks

**Why Next.js:** File-based routing, great developer experience, SSR capability if needed.
**Why TypeScript:** Type safety prevents bugs in complex Decision Object handling.
**Why Tailwind:** Rapid styling without a custom CSS framework, good for prototype speed.

### Page Structure

```
/                   -> Dashboard (main page)
/decisions          -> List of tracked decisions
/decisions/[id]     -> Single decision detail + watch panel
/feedback/[id]      -> Post-mission feedback form [P1]
```

### Key Components

```
components/
  Map/
    OrcaMap.tsx         -> Main Leaflet map wrapper
    ZoneLayer.tsx       -> Renders fishing zone polygons
    RouteLayer.tsx      -> Renders route polyline
    BoundaryLayer.tsx   -> Renders boundary polygons
    HazardLayer.tsx     -> Renders hazard markers
  Decision/
    DecisionPanel.tsx   -> Side panel with GO/CAUTION/WAIT
    ConditionCard.tsx   -> Single condition value display
    TrackButton.tsx     -> TRACK DECISION button + state
    WatchPanel.tsx      -> WATCHING state with CHECK AGAIN
    AlertPanel.tsx      -> ALERT state with change details
    RepairOptions.tsx   -> Verified repair options list
  Chat/
    ChatPanel.tsx       -> Chat input + message history
    ChatMessage.tsx     -> Individual message bubble
  Layout/
    Header.tsx          -> App header with role selector
    DataSourceBadge.tsx -> [LIVE] / [CACHED] / [DEMO DATA] badge
```

### State Shape

```typescript
interface AppState {
  currentDecision: DecisionResult | null;
  trackedDecision: DecisionObject | null;
  watchStatus: 'idle' | 'watching' | 'alert' | 'repaired';
  changeEvent: ChangeEvent | null;
  repairOptions: RepairOption[];
  conditions: MarineConditions | null;
  zones: ZoneInfo[];
  chatHistory: ChatMessage[];
  userLanguage: 'en' | 'hi';
  dataSource: 'live' | 'cache' | 'demo';
}
```

---

## 20. Backend Architecture

**Framework:** FastAPI (Python 3.11+)
**Structure:** Modular, flat — no microservices
**Database:** SQLite via sqlite3 stdlib (no ORM needed)
**HTTP client:** httpx (async)
**Geometry:** shapely (point-in-polygon for boundary checks)

### Module Dependency Flow

```
api/routes.py
    -> modules/query_understanding.py   (calls Gemini)
    -> modules/data_collection.py       (calls Open-Meteo / cache)
         -> adapters/weather_adapter.py
         -> adapters/pfz_adapter.py
         -> adapters/boundary_adapter.py
    -> modules/decision_engine.py       (pure Python, no external calls)
    -> modules/decision_store.py        (SQLite read/write)
    -> modules/decision_watch.py        (orchestrates watch flow)
         -> modules/decision_engine.py  (re-used for comparison)
         -> modules/explanation.py      (calls Gemini)
         -> modules/repair_engine.py    (re-uses decision_engine)
    -> modules/explanation.py           (calls Gemini)
```

### Configuration Files

```
config/
  thresholds.json       -> Decision engine thresholds (configurable)
  zones.json            -> Demo zone definitions
  demo_locations.json   -> Pre-cached geocoded locations
```

### Environment Variables (.env)

```
GEMINI_API_KEY=your_key_here
OPEN_METEO_BASE_URL=https://marine-api.open-meteo.com/v1/marine
FRONTEND_URL=http://localhost:3000
DATABASE_PATH=./data/decisions.db
CACHE_TTL_SECONDS=3600
DEMO_MODE=false
```

---

## 21. Folder / Project Structure

```
ORCA/
  PLAN.md                           <- This file (frozen source of truth)
  README.md                         <- Project overview
  .env.example                      <- Environment variable template
  .gitignore
  
  backend/                          <- Python FastAPI backend
    main.py                         <- FastAPI app entry point
    requirements.txt
    api/
      routes.py                     <- All API route definitions
    modules/
      query_understanding.py        <- Gemini NL parsing
      data_collection.py            <- Data orchestration
      decision_engine.py            <- Deterministic rules
      decision_store.py             <- SQLite persistence
      decision_watch.py             <- Watch + change detection
      repair_engine.py              <- Repair/Wait option generator
      explanation.py                <- Gemini explanation calls
    adapters/
      weather_adapter.py            <- Open-Meteo adapter
      pfz_adapter.py                <- PFZ/zone data adapter
      sst_adapter.py                <- NOAA SST adapter [P1]
      boundary_adapter.py           <- GeoJSON boundary loader
    models/
      schemas.py                    <- All dataclasses/Pydantic models
    config/
      thresholds.json               <- Configurable thresholds
      zones.json                    <- Demo zone definitions
      demo_locations.json           <- Pre-cached geocoded locations
    data/
      pfz_zones.geojson             <- Demo fishing zones
      boundaries.geojson            <- Demo boundary polygons
      decisions.db                  <- SQLite database (gitignored)
    cache/
      weather_demo.json             <- Demo weather fallback
      sst_demo.json                 <- Demo SST fallback [P1]
  
  frontend/                         <- Next.js frontend
    package.json
    tsconfig.json
    next.config.js
    tailwind.config.js
    public/
      icons/                        <- Map marker icons
    src/
      app/
        page.tsx                    <- Main dashboard
        decisions/
          page.tsx                  <- Decision list
          [id]/page.tsx             <- Decision detail
        feedback/
          [id]/page.tsx             <- Feedback form [P1]
      components/
        Map/
        Decision/
        Chat/
        Layout/
      hooks/
        useDecision.ts
        useWatch.ts
        useChat.ts
      lib/
        api.ts                      <- API client functions
        types.ts                    <- TypeScript type definitions
      styles/
        globals.css
```

---

## 22. API Endpoints

All endpoints prefixed with `/api`.

### Query / Decision Flow

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/query | Parse user query, return structured intent |
| GET | /api/zones | Get all available demo fishing zones |
| GET | /api/conditions | Get current marine conditions for a location |
| POST | /api/evaluate | Run decision engine for a zone/time |
| POST | /api/decisions | Create and store a Decision Object (Track Decision) |
| GET | /api/decisions | List all tracked decisions |
| GET | /api/decisions/{id} | Get a single Decision Object |

### Watch / Change / Repair Flow

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/decisions/{id}/watch | Run Decision Watch (Check Again) |
| POST | /api/decisions/{id}/simulate-change | Inject simulated condition change |
| POST | /api/decisions/{id}/select-repair | User selects a repair option |
| POST | /api/decisions/{id}/wait | User selects to wait |

### Feedback [P1]

| Method | Endpoint | Description |
|---|---|---|
| POST | /api/decisions/{id}/feedback | Submit post-mission feedback |
| GET | /api/decisions/{id}/comparison | Get Predicted vs Actual comparison |

### Health / Demo

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/health | Service health check |
| GET | /api/demo/reset | Reset demo state (clear decisions) |

---

## 23. Request / Response Examples

### POST /api/query

Request:
```json
{
  "message": "Where should I go fishing tomorrow morning?",
  "user_id": "user_demo_fisherman",
  "language": "en"
}
```

Response:
```json
{
  "intent": "fishing_recommendation",
  "zone": null,
  "time_reference": "tomorrow_morning",
  "resolved_datetime": "2026-08-26T06:00:00",
  "user_role": "fisherman",
  "language": "en",
  "constraints": [],
  "raw_query": "Where should I go fishing tomorrow morning?",
  "suggested_action": "evaluate_all_zones"
}
```

---

### POST /api/evaluate

Request:
```json
{
  "user_id": "user_demo_fisherman",
  "zone_id": "zone_b",
  "planned_start": "2026-08-26T06:00:00Z",
  "planned_return": "2026-08-26T14:00:00Z",
  "origin": { "lat": 9.966, "lon": 76.267, "name": "Kochi Port" }
}
```

Response:
```json
{
  "zone_id": "zone_b",
  "zone_name": "Zone B",
  "status": "GO",
  "score": 82,
  "safety_score": 90,
  "fishing_score": 86,
  "effort_score": 74,
  "boundary_violation": false,
  "hard_stop": false,
  "reasons": [
    "Wave height 1.4m is within safe limit (2.5m)",
    "Wind speed 12 km/h is within safe limit (30 km/h)",
    "PFZ score 86 indicates high fishing potential",
    "Distance 18km is within acceptable range",
    "No boundary restrictions apply"
  ],
  "explanation": "Zone B is recommended. Sea conditions are safe with low waves and moderate wind. Fishing potential is high and the zone is accessible from your location.",
  "conditions": {
    "wave_height_m": 1.4,
    "wind_speed_kmh": 12.0,
    "current_speed_ms": 0.3,
    "data_source": "live"
  },
  "data_source": "live"
}
```

---

### POST /api/decisions/{id}/simulate-change

Request:
```json
{
  "override_conditions": {
    "wave_height_m": 2.8
  }
}
```

Response:
```json
{
  "affected": true,
  "previous_status": "GO",
  "new_status": "ALERT",
  "change_event": {
    "detected_at": "2026-08-26T07:15:00Z",
    "changes": [
      {
        "field": "wave_height_m",
        "original": 1.4,
        "current": 2.8,
        "threshold": 2.5,
        "threshold_crossed": true
      }
    ]
  },
  "explanation": "Your Zone B plan is no longer suitable. Wave height has increased from 1.4m to 2.8m, exceeding the safety limit of 2.5m.",
  "repair_options": [
    {
      "option_id": "repair_depart_early",
      "type": "depart_early",
      "description": "Leave 2 hours earlier (04:00 instead of 06:00)",
      "decision_result": { "status": "GO", "score": 79 },
      "verified": true
    },
    {
      "option_id": "repair_zone_c",
      "type": "alternate_zone",
      "description": "Move to Zone C instead",
      "zone_id": "zone_c",
      "decision_result": { "status": "GO", "score": 81 },
      "verified": true
    },
    {
      "option_id": "repair_wait",
      "type": "wait",
      "description": "Wait until 14:00 when conditions improve",
      "modified_start": "2026-08-26T14:00:00Z",
      "decision_result": { "status": "GO", "score": 76 },
      "verified": true
    }
  ]
}
```

---

### POST /api/decisions/{id}/select-repair

Request:
```json
{ "option_id": "repair_depart_early" }
```

Response:
```json
{
  "decision_id": "dec_20260826_001",
  "current_status": "REPAIRED",
  "selected_action": {
    "action_type": "repair",
    "option_id": "repair_depart_early",
    "selected_at": "2026-08-26T07:20:00Z"
  },
  "message": "Plan updated. You will now depart at 04:00 AM. Stay safe!"
}
```

---

## 24. Demo Data Strategy

### Three Data Categories

| Category | Badge | Description |
|---|---|---|
| Live | [LIVE] green | Data from a real external API call that succeeded |
| Cached | [CACHED] yellow | Data from a recent successful API call, served from local cache |
| Demo | [DEMO DATA] orange | Pre-prepared static data, used when API is unavailable |

### Demo Scenario Setup

The prototype ships with a pre-configured demo scenario:

- **Location:** Kochi, Kerala coast
- **Demo zones:** Zone A, Zone B, Zone C (GeoJSON polygons in Arabian Sea off Kochi)
- **Starting conditions:** Wave 1.4m, Wind 12 km/h, Current 0.3 m/s -> Zone B is GO
- **Simulated change:** Wave -> 2.8m (crosses 2.5m threshold)
- **Repair options:** Three pre-calculated safe options

This scenario is deterministic and will work identically whether Open-Meteo is reachable or not.

### Demo Reset

GET /api/demo/reset clears all decisions from SQLite and resets the demo state. Use before each presentation run.

---

## 25. Fallback Strategy

### Every External Data Source Has Three Layers

```
Layer 1 (LIVE):
  Call actual API with 5s timeout.
  On success: cache response with timestamp.

Layer 2 (CACHED):
  If Layer 1 fails, check if cached response
  exists and is less than CACHE_TTL_SECONDS old.
  Use cached data, label as [CACHED].

Layer 3 (DEMO):
  If Layer 1 and Layer 2 both fail,
  load from static demo file.
  Use demo data, label as [DEMO DATA].
```

### Fallback Files

| Source | Live | Cache File | Demo File |
|---|---|---|---|
| Weather/Marine | Open-Meteo | cache/weather_{zone}.json | cache/weather_demo.json |
| SST [P1] | NOAA ERDDAP | cache/sst_{region}.json | cache/sst_demo.json |
| Geocoding [P1] | Nominatim | cache/geocode_cache.json | config/demo_locations.json |
| Zones | N/A (local) | N/A | data/pfz_zones.geojson |
| Boundaries | N/A (local) | N/A | data/boundaries.geojson |

### Implementation Pattern

```python
async def get_conditions(lat: float, lon: float, zone_id: str) -> MarineConditions:
    try:
        result = await weather_adapter.fetch_live(lat, lon)
        cache_adapter.save(zone_id, result)
        return result.with_source("live")
    except Exception:
        cached = cache_adapter.load(zone_id)
        if cached:
            return cached.with_source("cache")
        return load_demo_data(zone_id).with_source("demo")
```

---

## 26. Error Handling

### Principles

1. **The demo must never crash.** Every code path must have a fallback.
2. **Errors must be logged, not swallowed.** Log to file for debugging.
3. **API errors must be graceful.** Return demo data, not 500 errors, when external APIs fail.
4. **Gemini failures must be graceful.** If Gemini is unreachable, return a pre-written template explanation.

### Gemini Fallback

```python
FALLBACK_EXPLANATIONS = {
    "decision_go": "This zone is recommended based on current sea conditions and fishing potential.",
    "decision_caution": "Proceed with caution. Some conditions are marginal.",
    "decision_wait": "It is not recommended to proceed at this time.",
    "change_alert": "Conditions have changed and your plan may be affected.",
    "repair_options": "Alternative options have been calculated for your review."
}

async def get_explanation(prompt: str, fallback_key: str) -> str:
    try:
        return await gemini_client.generate(prompt)
    except Exception as e:
        logger.error(f"Gemini call failed: {e}")
        return FALLBACK_EXPLANATIONS[fallback_key]
```

### HTTP Error Responses

All errors return structured JSON:
```json
{
  "error": true,
  "code": "GEMINI_UNAVAILABLE",
  "message": "Explanation service temporarily unavailable. Showing default message.",
  "data": {}
}
```

### Frontend Error Handling

- Show data even if explanation text is missing
- Show [DEMO DATA] badge automatically when fallback is active
- Never show a blank white screen — always show the map and last known data

---

## 27. Development Phases

### Phase 0 — Project Setup (Day 1)
- [ ] GitHub repository created
- [ ] Backend FastAPI + virtual environment setup
- [ ] Frontend Next.js + TypeScript + Tailwind setup
- [ ] .env.example created
- [ ] SQLite with initial schema created
- [ ] Gemini API key verified working
- [ ] Open-Meteo verified returning data for Kochi coordinates
- [ ] data/pfz_zones.geojson created with 3 zones
- [ ] data/boundaries.geojson created with demo polygons
- [ ] cache/weather_demo.json created with demo weather data
- [ ] Both servers run locally

### Phase 1 — Map + Zones (Day 1-2)
- [ ] Leaflet map renders centred on Kerala/Kochi coast
- [ ] Zone A, B, C polygons displayed with labels
- [ ] User location marker (hardcoded Kochi for demo)
- [ ] Boundary polygons displayed in red
- [ ] /api/zones endpoint returns zone GeoJSON data

### Phase 2 — Data + Decision Engine (Day 2-3)
- [ ] WeatherAdapter calls Open-Meteo and caches result
- [ ] BoundaryAdapter loads GeoJSON, implements point-in-polygon
- [ ] PFZAdapter returns demo PFZ scores for each zone
- [ ] DistanceCalculator computes Haversine distance
- [ ] decision_engine.py implements full scoring logic
- [ ] /api/conditions returns MarineConditions
- [ ] /api/evaluate returns DecisionResult
- [ ] Thresholds loaded from config/thresholds.json
- [ ] All fallback layers work (test by disconnecting internet)

### Phase 3 — Gemini Query + Dashboard UI (Day 3-4)
- [ ] query_understanding.py sends message to Gemini, returns intent JSON
- [ ] Chat panel renders in UI, accepts user input
- [ ] User message triggers /api/query then /api/evaluate
- [ ] Decision panel shows GO / CAUTION / WAIT with score
- [ ] Condition values shown in panel
- [ ] Gemini explanation text shown below verdict
- [ ] Data source badge shows correctly

### Phase 4 — Decision Object + Track (Day 4-5)
- [ ] decision_store.py creates Decision Object in SQLite
- [ ] POST /api/decisions endpoint works
- [ ] TRACK DECISION button calls endpoint, shows WATCHING state
- [ ] Decision Object stored with all required fields
- [ ] GET /api/decisions/{id} returns full Decision Object
- [ ] Map updates to show route from user to destination zone

### Phase 5 — Watch + Change Detection (Day 5-6)
- [ ] decision_watch.py loads Decision Object and fetches conditions
- [ ] Threshold comparison logic works for wave height, wind
- [ ] CHECK AGAIN button calls /api/decisions/{id}/watch
- [ ] If not affected: WATCHING status confirmed, no alert
- [ ] SIMULATE CONDITION CHANGE button works with wave override
- [ ] If affected: Decision status changes to ALERT
- [ ] ChangeEvent created and appended to change_history

### Phase 6 — Explain + Repair/Wait (Day 6-7)
- [ ] explanation.py calls Gemini with ChangeEvent, returns explanation text
- [ ] Alert panel shows in UI with explanation text
- [ ] repair_engine.py generates and verifies candidates
- [ ] Each repair option shows status badge and description
- [ ] User can select a repair option
- [ ] POST /api/decisions/{id}/select-repair updates Decision Object
- [ ] Decision status changes to REPAIRED
- [ ] WAIT option also works and updates status to WAITING

### Phase 7 — Integration Test + Demo Polish (Day 7-8)
- [ ] Full demo flow works end-to-end
- [ ] Demo reset endpoint clears state cleanly
- [ ] All fallbacks verified (test with API disabled)
- [ ] Gemini fallback explanations work
- [ ] UI shows correct badges for data source
- [ ] Chat conversation history persists during session
- [ ] Map auto-zooms to selected zone on decision
- [ ] Tested on presentation laptop

### Phase 8 [P1] — Feedback + SST + Polish (Day 8-10)
- [ ] Feedback form for post-mission data
- [ ] /api/decisions/{id}/feedback stores feedback
- [ ] Predicted vs Actual display
- [ ] SST adapter with NOAA ERDDAP + fallback
- [ ] SST layer on map
- [ ] Hindi/Hinglish query understanding tested

---

## 28. P0 / P1 / P2 Priorities

### P0 — MUST WORK BEFORE SIH DEMO

| # | Item | Phase |
|---|---|---|
| 1 | Project setup (both servers running) | 0 |
| 2 | Leaflet map with demo zones | 1 |
| 3 | PFZ/zone data loaded from GeoJSON | 1 |
| 4 | Open-Meteo weather data with fallback | 2 |
| 5 | Deterministic decision engine | 2 |
| 6 | GO / CAUTION / WAIT result | 2 |
| 7 | Dashboard showing decision + conditions | 3 |
| 8 | Gemini query understanding (intent extraction) | 3 |
| 9 | Chat input -> decision output | 3 |
| 10 | TRACK DECISION button -> Decision Object stored | 4 |
| 11 | CHECK AGAIN + SIMULATE CONDITION CHANGE | 5 |
| 12 | Change detection + threshold comparison | 5 |
| 13 | Gemini explanation of change | 6 |
| 14 | Repair options generated + verified | 6 |
| 15 | User selects repair -> Decision Object updated | 6 |
| 16 | Full demo flow works reliably | 7 |

**Rule: Do not start P1 work until all P0 items are checked off.**

### P1 — Important If Time Allows

| # | Item |
|---|---|
| 14 | SST data layer (NOAA + fallback) |
| 15 | Additional map layer toggles |
| 16 | Nominatim geocoding for location search |
| 17 | Post-mission feedback form |
| 18 | Predicted vs Actual comparison display |
| 19 | Hindi/Hinglish query testing + improvements |

### P2 — Future Only (Do NOT Build in V1)

| # | Item |
|---|---|
| 20 | AIS dataset integration |
| 21 | Real PFZ ML model |
| 22 | Coast Guard / Navy / Researcher dashboards |
| 23 | Background scheduler for automatic watches |
| 24 | Push notifications |
| 25 | PostgreSQL/PostGIS migration |
| 26 | LangGraph / n8n orchestration |
| 27 | Kubernetes deployment |
| 28 | Multi-vessel fleet tracking |

---

## 29. Demo Flow

This is the exact sequence the demo presenter follows during the SIH presentation.

```
[SETUP — before judges arrive]
- Open ORCA in browser
- Map shows Kerala coast with Zone A, Zone B, Zone C
- Clear previous decisions: GET /api/demo/reset
- Confirm LIVE or DEMO DATA badge is showing
- Test SIMULATE CONDITION CHANGE once to verify it works

[STEP 1 — ASK]
Type in chat: "Where should I go fishing tomorrow morning?"
Wait for Gemini to parse intent (2-3 seconds).
Point out: "ORCA extracted intent: fishing, tomorrow morning, fisherman role."

[STEP 2 — EVALUATE]
System calls /api/evaluate for all three zones.
Decision panel shows:
  Zone B -> GO (82)
  Zone A -> CAUTION (61)
  Zone C -> WAIT (38) [or adjust based on demo config]
Map highlights Zone B in green. Route shown. Explanation text appears.
Say: "ORCA evaluated wave height, wind, fishing potential, distance, and boundary status."

[STEP 3 — TRACK]
Click: [TRACK DECISION]
Panel switches to WATCHING (checkmark)
Say: "ORCA has saved this as a Decision Object. It will now monitor the conditions
that justified this recommendation."
Optionally show the Decision Object JSON briefly.

[STEP 4 — CONDITION CHANGE]
Click: [SIMULATE CONDITION CHANGE]
Say: "It's now 2 hours later. Wave conditions have changed."
Behind the scenes: wave_height_m injected as 2.8m.
Decision Watch runs. Threshold comparison executes.

[STEP 5 — ALERT]
Panel switches to ALERT.
Wave value shows: 1.4m -> 2.8m (red, limit exceeded shown).
Gemini explanation appears.
Say: "ORCA didn't just say 'weather changed.' It checked whether this change
affects THIS specific user's accepted decision. The wave exceeded the limit,
so the GO status is now invalid."

[STEP 6 — REPAIR OPTIONS]
Three options shown with GO verification badges.
Say: "Each option was re-verified by the same deterministic decision engine.
ORCA never suggests an option that hasn't been calculated to be safe."

[STEP 7 — SELECT]
Select Option A: Leave 2 hours earlier.
Status -> REPAIRED (checkmark)
Decision Object updated with selected_action.
Say: "The decision lifecycle is complete.
ORCA tracked the decision, detected the change, explained the impact,
and found a verified safe alternative."

[IF TIME ALLOWS — P1]
Show simple feedback form.
Show Predicted vs Actual screen.
```

---

## 30. SIH Presentation Flow

### Judge Questions to Prepare For

| Question | Prepared Answer |
|---|---|
| "Is this real data?" | "We use real weather data from Open-Meteo API where available, clearly labelled. PFZ and fishing zone data are prototype demo data. In production, these connect to ISRO/INCOIS APIs." |
| "Why not use Gemini to make the decision?" | "Safety-critical marine decisions must be deterministic and auditable. Gemini parses language and explains results — Python code enforces the rules. This is the correct design for a safety-critical system." |
| "What makes this different from a chatbot?" | "A chatbot gives information and forgets it. ORCA saves the decision, monitors the conditions that justified it, detects when those conditions change, and tells you whether your specific plan is still valid." |
| "Why SQLite?" | "Appropriate for a prototype tracking a small number of decisions. Production would migrate to PostgreSQL/PostGIS." |
| "Does it support other languages?" | "Yes. Gemini handles Hindi, English, and Hinglish. Both query understanding and explanations use language-aware prompts." |
| "What if the API is down?" | "Every data source has a three-layer fallback: live API -> recent cache -> demo data. The system always works." |
| "How do you handle boundary violations?" | "Boundary checks use GeoJSON polygons with deterministic Python point-in-polygon computation. A boundary violation is a hard stop — Gemini never makes this decision." |

### Core Message for Judges

1. The innovation is the lifecycle, not the chat.
2. AI understands and explains. Code decides. This is what makes ORCA trustworthy.
3. The demo is reliable — condition change is controlled via simulate button.
4. PFZ and satellite data are simulated; the architecture shows exactly where real data plugs in.
5. The entire flow works end-to-end right now.

---

## 31. Testing Strategy

### Unit Tests

| Module | What to Test |
|---|---|
| decision_engine.py | All threshold combinations; hard stop rules; score calculation; GO/CAUTION/WAIT boundaries |
| decision_watch.py | Threshold crossing detection; no-change case; partial change case |
| repair_engine.py | Each repair candidate type; verify-only-safe-options rule; all-fail edge case |
| boundary_adapter.py | Point inside polygon; point outside polygon; point on edge |
| data_collection.py | Fallback chain: mock API failure -> cache load -> demo load |

### Integration Tests

| Scenario | Test |
|---|---|
| Full happy path | Query -> Evaluate -> Track -> Check (no change) |
| Full alert path | Query -> Evaluate -> Track -> Simulate change -> Explain -> Repair |
| All-zones evaluate | Evaluate all 3 zones in one request |
| Demo reset | Reset -> verify database is empty |
| API failure | Disable Open-Meteo mock -> confirm demo data returned |
| Gemini failure | Mock Gemini error -> confirm fallback explanation returned |

### Manual Tests Before Demo

- [ ] Full demo flow on real browser (not localhost — use LAN IP)
- [ ] Demo reset works cleanly
- [ ] SIMULATE CONDITION CHANGE button works
- [ ] All three repair options show GO badges
- [ ] REPAIRED status persists after page refresh
- [ ] Map markers and route appear correctly
- [ ] [DEMO DATA] badge appears when expected
- [ ] Chat accepts Hindi text and returns reasonable response
- [ ] Works on the presentation laptop specifically
- [ ] Works without internet connection

---

## 32. Definition of Done

The ORCA V1 prototype is DONE when all criteria below are met:

### Functional

- [ ] User can type a natural language fishing query and receive GO/CAUTION/WAIT
- [ ] Recommendation includes wave, wind, PFZ score, distance, and boundary status
- [ ] Map shows zones, user location, recommended destination, and route
- [ ] TRACK DECISION button persists a Decision Object to SQLite
- [ ] CHECK AGAIN button triggers condition re-evaluation
- [ ] SIMULATE CONDITION CHANGE button injects wave_height_m: 2.8
- [ ] System detects threshold crossing and changes status to ALERT
- [ ] Explanation text explains exactly which condition changed and by how much
- [ ] Three repair options are shown, each with GO verification badge
- [ ] User can select a repair option and status updates to REPAIRED
- [ ] Full flow works without internet (using demo/cached data)
- [ ] Full flow works with real Open-Meteo data
- [ ] Gemini API failure is handled gracefully (fallback explanation shown)

### Quality

- [ ] [LIVE] / [CACHED] / [DEMO DATA] badge always visible
- [ ] Demo data is clearly labelled and never presented as real institutional data
- [ ] Thresholds are in config/thresholds.json, not hardcoded
- [ ] Decision engine has no Gemini calls
- [ ] Gemini modules never return safety verdicts
- [ ] All repair options are pre-verified by decision engine before display
- [ ] /api/demo/reset clears state cleanly

### Demo Reliability

- [ ] Demo flow completes within 5 minutes
- [ ] No crashes or 500 errors during full flow
- [ ] Works on presentation laptop with fresh browser
- [ ] Works without internet connection
- [ ] SIMULATE CONDITION CHANGE is always deterministic

---

## 33. Future Scope

These items are INTENTIONALLY excluded from V1. They represent the natural production roadmap.

### Short-term (Post-SIH / V2)

- Real INCOIS PFZ API integration
- SST and chlorophyll layers from MOSDAC/ISRO
- Basic background scheduler (check tracked decisions every 30 minutes)
- AIS vessel trajectory visualization
- Post-mission feedback and Predicted vs Actual analytics
- Improved Hindi/regional language support
- Coast Guard dashboard (vessel tracking, hazards)

### Medium-term (V3)

- PostgreSQL/PostGIS migration for geospatial queries
- Real-time cyclone and lightning advisory integration (IMD/NDMA)
- Researcher dashboard (SST, chlorophyll, productivity analysis)
- Multiple user roles with authentication
- Vessel registration and profile management
- Mobile app (React Native or PWA)

### Long-term (Production)

- Full ISRO/MOSDAC satellite data integration
- Disaster Management dashboard
- Fleet tracking and management
- Offline-capable mobile app for fishermen with limited connectivity
- Machine learning for PFZ prediction (historical catch + SST + chlorophyll)
- Advanced agent orchestration (LangGraph or equivalent, when needed)
- Kubernetes deployment with horizontal scaling
- Integration with national fisheries databases

---

## 34. Explicit NOT-TO-BUILD List

The following items are explicitly excluded from the V1 prototype. If anyone proposes adding one during development, the answer is NO unless the full team agrees it is essential for the P0 demo flow.

### Infrastructure

- NO: PostgreSQL / PostGIS
- NO: Redis or any caching server (use file-based cache)
- NO: Kubernetes
- NO: n8n
- NO: LangGraph
- NO: Message queues (Celery, RabbitMQ, Kafka)
- NO: Background task scheduler (Celery beat, APScheduler, cron)
- NO: WebSockets for real-time updates (polling is fine for prototype)

### AI / ML

- NO: PFZ prediction machine learning model
- NO: Custom satellite image analysis
- NO: Voice recognition / speech-to-text
- NO: Computer vision
- NO: Any model training or fine-tuning
- NO: Multiple AI models (Gemini only)
- NO: AI-driven safety decisions (Gemini never gives GO/CAUTION/WAIT)

### User Roles

- NO: Coast Guard dashboard
- NO: Navy / Military dashboard
- NO: Researcher dashboard
- NO: Disaster Management dashboard
- NO: User authentication / login system
- NO: Multi-user session management

### Data

- NO: AIS dataset processing (V1 scope)
- NO: Real ISRO/MOSDAC satellite API integration (use demo data)
- NO: Real INCOIS PFZ API (use demo GeoJSON)
- NO: Real-time vessel tracking
- NO: Historical data analysis

### Features

- NO: Push notifications (browser or SMS)
- NO: Email alerts
- NO: PDF report generation
- NO: User account management
- NO: Mobile native app
- NO: Offline-first architecture
- NO: Fleet management
- NO: Autonomous vessel control suggestions
- NO: Multi-language UI text (chat supports Hindi, UI is English only in V1)

---

## Final Architectural Principle

> **"AI understands and explains. Code calculates and decides."**

> **"ORCA is not a chatbot with marine data. ORCA is a decision system with a conversational AI layer."**

The core value ORCA demonstrates at SIH is:

> **A marine recommendation should not disappear after it is given.**
>
> ORCA turns that recommendation into a living decision that can be:
> DECIDED -> TRACKED -> RECHECKED -> EXPLAINED -> REPAIRED / DELAYED -> UPDATED

**If a feature does not contribute to demonstrating this lifecycle, it does not belong in V1.**

---

*PLAN.md Version: 1.0.0*
*Created: 2026-08-25*
*Status: FROZEN — Project Contract*
*Do not modify without explicit team agreement.*
