#!/usr/bin/env python3
"""Generates web/data/seed.json — SAMPLE data for the prototype.

Everything here is illustrative:
  * price levels are plausible ballparks, not live mandi quotes
  * business names are fictional and prefixed "Sample"
  * phone numbers are non-dialable placeholders (00000 ...)
Real prices come from the /api/prices endpoint when DATA_GOV_API_KEY is set
(Agmarknet daily mandi prices on data.gov.in).
"""
import json, pathlib, random

OUT = pathlib.Path(__file__).resolve().parent.parent / "frontend" / "public" / "data" / "seed.json"
rnd = random.Random(20260919)

PLACES = {  # name: (state, lat, lng)
    "Guntur": ("Andhra Pradesh", 16.3067, 80.4365),
    "Ongole": ("Andhra Pradesh", 15.5057, 80.0499),
    "Kurnool": ("Andhra Pradesh", 15.8281, 78.0373),
    "Nandyal": ("Andhra Pradesh", 15.4786, 78.4836),
    "Vijayawada": ("Andhra Pradesh", 16.5062, 80.6480),
    "Tirupati": ("Andhra Pradesh", 13.6288, 79.4192),
    "Warangal": ("Telangana", 17.9689, 79.5941),
    "Khammam": ("Telangana", 17.2473, 80.1514),
    "Hyderabad": ("Telangana", 17.3850, 78.4867),
    "Bengaluru": ("Karnataka", 12.9716, 77.5946),
    "Chennai": ("Tamil Nadu", 13.0827, 80.2707),
    "Coimbatore": ("Tamil Nadu", 11.0168, 76.9558),
    "Nagpur": ("Maharashtra", 21.1458, 79.0882),
}

# crop -> (modal price band Rs/quintal, markets that trade it)
CROPS = {
    "paddy":     ((2150, 2450), ["Guntur", "Ongole", "Vijayawada", "Khammam", "Warangal", "Nandyal", "Chennai"]),
    "tomato":    ((1400, 3200), ["Kurnool", "Tirupati", "Hyderabad", "Bengaluru", "Chennai", "Nandyal", "Coimbatore"]),
    "chilli":    ((11500, 17500), ["Guntur", "Khammam", "Warangal", "Kurnool", "Hyderabad"]),
    "cotton":    ((6400, 7600), ["Guntur", "Kurnool", "Warangal", "Nandyal", "Nagpur", "Khammam"]),
    "maize":     ((1900, 2350), ["Guntur", "Kurnool", "Warangal", "Nandyal", "Khammam", "Hyderabad"]),
    "groundnut": ((5300, 6800), ["Kurnool", "Nandyal", "Tirupati", "Ongole", "Bengaluru", "Coimbatore"]),
    "onion":     ((1200, 2400), ["Kurnool", "Hyderabad", "Bengaluru", "Nagpur", "Chennai", "Vijayawada"]),
    "banana":    ((1500, 2600), ["Tirupati", "Vijayawada", "Chennai", "Coimbatore", "Bengaluru"]),
}

def prices():
    rows = []
    for crop, ((lo, hi), markets) in CROPS.items():
        base = rnd.uniform(lo, hi)
        for m in markets:
            state, lat, lng = PLACES[m]
            modal = base * rnd.uniform(0.93, 1.08)
            drift = rnd.uniform(-0.012, 0.012)
            series = []
            p = modal / (1 + drift * 6)
            for _ in range(7):
                series.append(int(round(p / 10.0) * 10))
                p *= 1 + drift + rnd.uniform(-0.008, 0.008)
            m_modal = series[-1]
            rows.append({
                "market": m, "state": state, "lat": lat, "lng": lng, "crop": crop,
                "min": int(round(m_modal * 0.9 / 10) * 10),
                "modal": m_modal,
                "max": int(round(m_modal * 1.12 / 10) * 10),
                "trend": series, "source": "sample",
            })
    return rows

def near(place, jitter=0.25):
    _, lat, lng = PLACES[place]
    return round(lat + rnd.uniform(-jitter, jitter), 4), round(lng + rnd.uniform(-jitter, jitter), 4)

def phone(n):
    return f"00000{n:05d}"

def buyers():
    spec = [
        ("Sample FPO - Guntur Chilli Growers", "fpo", "Guntur", ["chilli", "cotton"]),
        ("Sample FPO - Prakasam Paddy Producers", "fpo", "Ongole", ["paddy", "maize"]),
        ("Sample FPO - Rayalaseema Groundnut Farmers", "fpo", "Kurnool", ["groundnut", "onion", "tomato"]),
        ("Sample FPO - Nandyal Maize and Cotton", "fpo", "Nandyal", ["maize", "cotton", "groundnut"]),
        ("Sample Agro Traders - Vijayawada", "buyer", "Vijayawada", ["paddy", "banana", "chilli"]),
        ("Sample Spice Exports - Guntur", "buyer", "Guntur", ["chilli"]),
        ("Sample Fresh Mart - Hyderabad", "buyer", "Hyderabad", ["tomato", "onion", "banana"]),
        ("Sample Mills - Khammam Rice", "buyer", "Khammam", ["paddy", "maize"]),
        ("Sample Ginning Co - Warangal", "buyer", "Warangal", ["cotton", "maize"]),
        ("Sample Oil Mills - Tirupati", "buyer", "Tirupati", ["groundnut"]),
        ("Sample Fruit Wholesaler - Coimbatore", "buyer", "Coimbatore", ["banana", "tomato", "onion"]),
        ("Sample Veg Aggregator - Bengaluru", "buyer", "Bengaluru", ["tomato", "onion", "banana"]),
    ]
    out = []
    for i, (name, typ, place, crops) in enumerate(spec, 1):
        lat, lng = near(place)
        out.append({"id": f"b{i}", "name": name, "type": typ, "place": place,
                    "state": PLACES[place][0], "lat": lat, "lng": lng, "crops": crops,
                    "phone": phone(100 + i), "sample": True})
    return out

def storage():
    spec = [
        ("Sample Cold Storage - Guntur Yard", "Guntur", ["chilli", "onion"], "2-8 C", 55),
        ("Sample Cold Chain - Ongole", "Ongole", ["tomato", "banana", "onion"], "8-12 C", 62),
        ("Sample Cold Storage - Kurnool", "Kurnool", ["onion", "tomato", "chilli"], "2-10 C", 48),
        ("Sample Agri Cold Room - Nandyal", "Nandyal", ["tomato", "banana", "onion"], "8-14 C", 60),
        ("Sample FPO Cold Room - Vijayawada", "Vijayawada", ["banana", "tomato"], "12-14 C", 70),
        ("Sample Cold Storage - Khammam", "Khammam", ["chilli", "onion"], "2-8 C", 52),
        ("Sample Cold Storage - Warangal", "Warangal", ["chilli", "onion", "tomato"], "2-10 C", 50),
        ("Sample Cold Storage - Tirupati", "Tirupati", ["banana", "tomato"], "10-14 C", 66),
        ("Sample Cold Hub - Hyderabad", "Hyderabad", ["tomato", "onion", "banana", "chilli"], "2-14 C", 80),
        ("Sample Cold Storage - Bengaluru", "Bengaluru", ["tomato", "onion", "banana"], "4-12 C", 85),
    ]
    out = []
    for i, (name, place, crops, temp, rate) in enumerate(spec, 1):
        lat, lng = near(place, 0.12)
        out.append({"id": f"s{i}", "name": name, "place": place, "state": PLACES[place][0],
                    "lat": lat, "lng": lng, "crops": crops, "temp": temp, "rate": rate,
                    "free_qtl": rnd.choice([400, 800, 1200, 2000, 3500]),
                    "phone": phone(200 + i), "sample": True})
    return out

def transporters():
    spec = [
        ("Sample Transport - Guntur", "Guntur"), ("Sample Logistics - Ongole", "Ongole"),
        ("Sample Tempo Service - Kurnool", "Kurnool"), ("Sample Goods Carrier - Nandyal", "Nandyal"),
        ("Sample Trucks - Vijayawada", "Vijayawada"), ("Sample Pickup Hire - Tirupati", "Tirupati"),
        ("Sample Transport - Khammam", "Khammam"), ("Sample Logistics - Warangal", "Warangal"),
        ("Sample Movers - Hyderabad", "Hyderabad"), ("Sample Freight - Bengaluru", "Bengaluru"),
    ]
    out = []
    for i, (name, place) in enumerate(spec, 1):
        lat, lng = near(place, 0.1)
        out.append({"id": f"t{i}", "name": name, "place": place, "state": PLACES[place][0],
                    "lat": lat, "lng": lng, "phone": phone(300 + i),
                    "vehicles": ["tempo", "pickup", "truck"][: rnd.choice([2, 3, 3])],
                    "sample": True})
    return out

def main():
    data = {
        "generated": "sample-data",
        "places": {k: {"state": v[0], "lat": v[1], "lng": v[2]} for k, v in PLACES.items()},
        "vehicle_rates": {  # Rs per km (sample), min charge Rs, capacity quintal
            "tempo": {"rate": 14, "min": 500, "cap": 10},
            "pickup": {"rate": 18, "min": 800, "cap": 20},
            "truck": {"rate": 32, "min": 2500, "cap": 60},
        },
        "prices": prices(), "buyers": buyers(), "storage": storage(), "transporters": transporters(),
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print({k: len(v) for k, v in data.items() if isinstance(v, list)})

if __name__ == "__main__":
    main()
