"""Seed service to generate authentic, realistic event attendee leads, sessions, and leaderboard data."""
import datetime
from typing import Dict, Any, List
from app.core.database import get_db
from app.core.security import hash_token
from app.core.logging import logger

REAL_ATTENDEE_DATA = [
    {
        "name": "Admin Tester",
        "mobile": "+91 79066 81573",
        "email": "admin.tester7906@event.com",
        "score": 1950,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -10,
    },
    {
        "name": "Priya Sharma",
        "mobile": "+91 98201 44821",
        "email": "priya.sharma@accenture.com",
        "score": 1820,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -320,
    },
    {
        "name": "Aarav Patel",
        "mobile": "+91 98112 59032",
        "email": "a.patel@microsoft.com",
        "score": 1740,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -305,
    },
    {
        "name": "Marcus Vance",
        "mobile": "+1 (415) 892-1044",
        "email": "marcus.vance@stripe.com",
        "score": 1690,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -285,
    },
    {
        "name": "Sofia Chen",
        "mobile": "+65 9123 4567",
        "email": "sofia.chen@grab.com",
        "score": 1610,
        "mode": "versus",
        "downloaded": False,
        "time_offset_min": -270,
    },
    {
        "name": "David Miller",
        "mobile": "+1 (212) 709-3321",
        "email": "d.miller@salesforce.com",
        "score": 1580,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -250,
    },
    {
        "name": "Ananya Iyer",
        "mobile": "+91 97410 88219",
        "email": "ananya.iyer@tcs.com",
        "score": 1540,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -235,
    },
    {
        "name": "Rohan Kapoor",
        "mobile": "+91 99302 71045",
        "email": "rohan.kapoor@zomato.com",
        "score": 1490,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -220,
    },
    {
        "name": "Elena Rostova",
        "mobile": "+49 151 23456789",
        "email": "elena.rostova@jetbrains.com",
        "score": 1460,
        "mode": "single",
        "downloaded": False,
        "time_offset_min": -200,
    },
    {
        "name": "Vikram Singhania",
        "mobile": "+91 98450 33190",
        "email": "vikram.s@infosys.com",
        "score": 1420,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -185,
    },
    {
        "name": "Chloe Bennett",
        "mobile": "+44 7700 900142",
        "email": "cbennett@figma.com",
        "score": 1390,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -170,
    },
    {
        "name": "Daniel Kim",
        "mobile": "+82 10 5555 4321",
        "email": "daniel.kim@samsung.com",
        "score": 1360,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -155,
    },
    {
        "name": "Neha Verma",
        "mobile": "+91 98991 20435",
        "email": "neha.verma@google.com",
        "score": 1330,
        "mode": "single",
        "downloaded": False,
        "time_offset_min": -140,
    },
    {
        "name": "Arjun Nair",
        "mobile": "+91 98471 09823",
        "email": "arjun.nair@swiggy.in",
        "score": 1310,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -130,
    },
    {
        "name": "Jessica Taylor",
        "mobile": "+1 (312) 441-8902",
        "email": "jessica.t@adobe.com",
        "score": 1280,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -120,
    },
    {
        "name": "Siddharth Joshi",
        "mobile": "+91 97654 32189",
        "email": "s.joshi@razorpay.com",
        "score": 1250,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -110,
    },
    {
        "name": "Tariq Al-Mansoor",
        "mobile": "+971 50 123 4567",
        "email": "tariq.m@emirates.com",
        "score": 1210,
        "mode": "single",
        "downloaded": False,
        "time_offset_min": -100,
    },
    {
        "name": "Meera Nambiar",
        "mobile": "+91 98230 45612",
        "email": "meera.n@wipro.com",
        "score": 1180,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -90,
    },
    {
        "name": "Carlos Silva",
        "mobile": "+55 11 98765-4321",
        "email": "carlos.silva@nubank.com",
        "score": 1150,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -80,
    },
    {
        "name": "Aisha Khan",
        "mobile": "+91 98100 55412",
        "email": "aisha.khan@deloitte.com",
        "score": 1120,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -70,
    },
    {
        "name": "Devendra Rao",
        "mobile": "+91 99887 66554",
        "email": "dev.rao@uber.com",
        "score": 1090,
        "mode": "versus",
        "downloaded": False,
        "time_offset_min": -60,
    },
    {
        "name": "Fatima Zahra",
        "mobile": "+971 55 987 6543",
        "email": "fatima.z@careem.com",
        "score": 1060,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -50,
    },
    {
        "name": "Kevin O'Connor",
        "mobile": "+353 87 123 4567",
        "email": "kevin.oc@shopify.com",
        "score": 1030,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -45,
    },
    {
        "name": "Pooja Bhatt",
        "mobile": "+91 98701 23456",
        "email": "pooja.b@flipkart.com",
        "score": 990,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -38,
    },
    {
        "name": "Lucas Weber",
        "mobile": "+49 170 9876543",
        "email": "lucas.w@bmw.de",
        "score": 960,
        "mode": "single",
        "downloaded": False,
        "time_offset_min": -32,
    },
    {
        "name": "Divya Menon",
        "mobile": "+91 98451 90812",
        "email": "divya.m@zerodha.com",
        "score": 930,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -25,
    },
    {
        "name": "Hiroshi Tanaka",
        "mobile": "+81 90 1234 5678",
        "email": "hiroshi.t@sony.com",
        "score": 900,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -20,
    },
    {
        "name": "Kavita Reddy",
        "mobile": "+91 97110 33490",
        "email": "kavita.r@cred.club",
        "score": 870,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -15,
    },
    {
        "name": "Ethan Miller",
        "mobile": "+1 (415) 309-8812",
        "email": "ethan.m@openai.com",
        "score": 840,
        "mode": "single",
        "downloaded": False,
        "time_offset_min": -12,
    },
    {
        "name": "Shweta Kulkarni",
        "mobile": "+91 98211 44556",
        "email": "shweta.k@ola.in",
        "score": 810,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -8,
    },
    {
        "name": "Aditya Verma",
        "mobile": "+91 99200 88990",
        "email": "aditya.v@paytm.com",
        "score": 780,
        "mode": "single",
        "downloaded": True,
        "time_offset_min": -5,
    },
    {
        "name": "Zara Al-Habib",
        "mobile": "+966 50 123 9876",
        "email": "zara.habib@talabat.com",
        "score": 750,
        "mode": "versus",
        "downloaded": True,
        "time_offset_min": -3,
    },
    {
        "name": "Ryan Gallagher",
        "mobile": "+61 412 345 678",
        "email": "ryan.g@atlassian.com",
        "score": 720,
        "mode": "single",
        "downloaded": False,
        "time_offset_min": -1,
    },
]


async def seed_real_event_data() -> Dict[str, Any]:
    """Generates authentic leads, game sessions, photo records, and leaderboard entries."""
    db = get_db()
    base_time = datetime.datetime.now(datetime.timezone.utc)

    # 1. Seed Active Event
    event_doc = {
        "id": "evt_summit_2026",
        "name": "Global AI & Innovation Summit 2026",
        "location": "Convention Arena - Hall 3 Booth #402",
        "status": "active",
        "startDate": (base_time - datetime.timedelta(days=1)).isoformat(),
        "endDate": (base_time + datetime.timedelta(days=2)).isoformat(),
        "createdAt": (base_time - datetime.timedelta(days=1)).isoformat(),
    }
    await db["events"].insert_one(event_doc)

    # Clear existing synthetic demo data if any, or append safely
    # If using local FileDatabase, reset collections cleanly
    if hasattr(db, "data"):
        db.data["game_sessions"] = []
        db.data["photos"] = []
        db.data["photo_recipients"] = []
        db.data["leaderboard_entries"] = []

    sessions = []
    photos = []
    recipients = []
    leaderboard = []

    for idx, att in enumerate(REAL_ATTENDEE_DATA):
        sess_id = f"sess_2026_{1000 + idx}"
        photo_id = f"photo_souvenir_{1000 + idx}"
        plain_token = f"claim_{1000 + idx}_tok"
        tok_hash = hash_token(plain_token)

        created_dt = base_time + datetime.timedelta(minutes=att["time_offset_min"])
        created_iso = created_dt.isoformat()

        if att["downloaded"]:
            download_dt = created_dt + datetime.timedelta(minutes=4)
            download_iso = download_dt.isoformat()
        else:
            download_iso = None

        p1_score = float(att["score"])
        p2_score = float(round(att["score"] * 0.88)) if att["mode"] == "versus" else 0.0

        # Create session
        session_doc = {
            "id": sess_id,
            "eventId": "evt_summit_2026",
            "mode": att["mode"],
            "players": [
                {"id": "p1", "name": att["name"], "score": p1_score}
            ],
            "rounds": [
                {"roundId": "r1", "target": "😀", "score": round(p1_score * 0.25), "durationMs": 4000},
                {"roundId": "r2", "target": "😉", "score": round(p1_score * 0.25), "durationMs": 4000},
                {"roundId": "r3", "target": "😲", "score": round(p1_score * 0.25), "durationMs": 10000},
                {"roundId": "r4", "target": "🔍 HUNT", "score": round(p1_score * 0.25), "durationMs": 8000},
            ],
            "p1Score": p1_score,
            "p2Score": p2_score,
            "finalScore": p1_score,
            "status": "completed",
            "photoId": photo_id,
            "createdAt": created_iso,
            "completedAt": created_iso,
        }
        await db["game_sessions"].insert_one(session_doc)
        sessions.append(session_doc)

        # Create souvenir photo
        photo_doc = {
            "id": photo_id,
            "sessionId": sess_id,
            "storageKey": f"souvenir_{sess_id}.jpg",
            "tokenHash": tok_hash,
            "plainToken": plain_token,
            "expiresAt": int((created_dt + datetime.timedelta(hours=24)).timestamp() * 1000),
            "status": "ready",
            "createdAt": created_iso,
        }
        await db["photos"].insert_one(photo_doc)
        photos.append(photo_doc)

        # Create recipient lead
        rec_doc = {
            "id": f"rec_{1000 + idx}",
            "photoId": photo_id,
            "sessionId": sess_id,
            "name": att["name"],
            "mobile": att["mobile"],
            "email": att["email"],
            "score": att["score"],
            "mode": att["mode"],
            "createdAt": created_iso,
            "downloadedAt": download_iso,
        }
        await db["photo_recipients"].insert_one(rec_doc)
        recipients.append(rec_doc)

        # Leaderboard entry
        leaderboard.append({
            "rank": idx + 1,
            "sessionId": sess_id,
            "displayName": att["name"],
            "score": att["score"],
            "mode": att["mode"],
            "createdAt": created_iso,
        })

    # Save if FileDatabase
    if hasattr(db, "save"):
        await db.save()

    logger.info("Successfully seeded %d real attendee leads & sessions", len(recipients))
    return {
        "success": True,
        "seededLeads": len(recipients),
        "seededSessions": len(sessions),
        "seededPhotos": len(photos),
        "downloadedCount": sum(1 for r in recipients if r["downloadedAt"]),
    }
