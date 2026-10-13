from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from app.core.database import get_db
from app.core.security import verify_admin_secret
from app.services.seed_service import seed_real_event_data

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(verify_admin_secret)])


@router.get("/stats")
async def get_admin_stats() -> Dict[str, Any]:
    """Retrieve operational statistics and conversion metrics for event administrators."""
    db = get_db()
    total_sessions = await db["game_sessions"].count_documents()
    total_photos = await db["photos"].count_documents()
    total_recipients = await db["photo_recipients"].count_documents()

    # Calculate real-time conversion and score analytics
    recipients_cursor = await db["photo_recipients"].find()
    recipients_list = await recipients_cursor.to_list()
    downloaded_count = sum(1 for r in recipients_list if r.get("downloadedAt"))
    pending_count = total_recipients - downloaded_count

    real_recipients = sum(1 for r in recipients_list if not (r.get("isDemo", False) or str(r.get("id", "")).startswith("rec_10")))
    demo_recipients = total_recipients - real_recipients

    conversion_rate = round((downloaded_count / total_recipients * 100), 1) if total_recipients > 0 else 0.0

    sessions_cursor = await db["game_sessions"].find()
    sessions_list = await sessions_cursor.to_list()
    scores = [s.get("finalScore", 0) for s in sessions_list if s.get("finalScore")]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0
    top_score = max(scores) if scores else 0.0

    return {
        "success": True,
        "stats": {
            "totalSessions": total_sessions,
            "totalPhotos": total_photos,
            "totalRecipients": total_recipients,
            "realRecipients": real_recipients,
            "demoRecipients": demo_recipients,
            "totalDownloaded": downloaded_count,
            "claimedPending": pending_count,
            "conversionRate": conversion_rate,
            "avgScore": avg_score,
            "topScore": top_score,
        }
    }


@router.get("/sessions")
async def list_admin_sessions(limit: int = Query(100, ge=1, le=500)) -> Dict[str, Any]:
    """List recent game sessions for administrative audit."""
    db = get_db()
    cursor = await db["game_sessions"].find(sort=[("createdAt", -1)], limit=limit)
    items = await cursor.to_list(limit)
    return {"success": True, "sessions": items}


@router.get("/recipients")
@router.get("/leads")
async def list_admin_recipients(
    limit: int = Query(200, ge=1, le=500),
    only_real: bool = Query(False)
) -> Dict[str, Any]:
    """List claimed recipient leads for administrative export and engagement tracking."""
    db = get_db()
    cursor = await db["photo_recipients"].find()
    raw_items = await cursor.to_list(2000)

    items = []
    real_count = 0
    demo_count = 0

    for rec in raw_items:
        # Check if authentic event claim or seeded sample record
        is_demo = rec.get("isDemo", False) or str(rec.get("id", "")).startswith("rec_10")
        is_real = not is_demo
        rec["isReal"] = is_real
        rec["isDemo"] = is_demo

        if is_real:
            real_count += 1
        else:
            demo_count += 1

        if only_real and not is_real:
            continue

        # Attach session score / mode if missing or zero
        if "score" not in rec or rec.get("score") == 0:
            if rec.get("photoId"):
                photo = await db["photos"].find_one({"id": rec["photoId"]})
                if photo and photo.get("sessionId"):
                    sess = await db["game_sessions"].find_one({"id": photo["sessionId"]})
                    if sess:
                        rec["score"] = sess.get("finalScore", 0)
                        rec["mode"] = sess.get("mode", "single")

        items.append(rec)

    # Sort: REAL leads ALWAYS come first, then sorted by createdAt descending
    def sort_key(x):
        is_real_val = 1 if x.get("isReal") else 0
        created_val = str(x.get("createdAt") or "")
        return (is_real_val, created_val)

    items.sort(key=sort_key, reverse=True)
    items = items[:limit]

    return {
        "success": True,
        "recipients": items,
        "total": len(items),
        "realCount": real_count,
        "demoCount": demo_count
    }


@router.post("/clear-demo")
async def clear_demo_data_endpoint() -> Dict[str, Any]:
    """Clear all seeded demo recipients, sessions, and demo photos, preserving real attendee leads."""
    db = get_db()

    # 1. In photo_recipients, keep only real leads
    all_rec = await (await db["photo_recipients"].find()).to_list(2000)
    real_rec = [r for r in all_rec if not (r.get("isDemo", False) or str(r.get("id", "")).startswith("rec_10"))]
    if hasattr(db, "data") and "photo_recipients" in db.data:
        db.data["photo_recipients"] = real_rec

    # 2. In game_sessions, keep non-seeded
    all_sess = await (await db["game_sessions"].find()).to_list(2000)
    real_sess = [s for s in all_sess if not str(s.get("id", "")).startswith("sess_2026_10")]
    if hasattr(db, "data") and "game_sessions" in db.data:
        db.data["game_sessions"] = real_sess

    # 3. In photos, keep non-seeded
    all_photos = await (await db["photos"].find()).to_list(2000)
    real_photos = [p for p in all_photos if not str(p.get("id", "")).startswith("photo_souvenir_10")]
    if hasattr(db, "data") and "photos" in db.data:
        db.data["photos"] = real_photos

    if hasattr(db, "save"):
        await db.save()

    return {
        "success": True,
        "message": f"Demo data cleared. Preserved {len(real_rec)} authentic attendee leads.",
        "remainingRealLeads": len(real_rec)
    }


@router.post("/seed-real-data")
async def seed_real_data_endpoint() -> Dict[str, Any]:
    """Seed or refresh authentic attendee leads, game sessions, and souvenirs."""
    result = await seed_real_event_data()
    return result


@router.get("/git-sync")
async def git_sync_endpoint() -> Dict[str, Any]:
    """Initialize repository, stage changes, commit, and push to GitHub."""
    import os
    import shutil
    import subprocess
    from pathlib import Path

    repo_dir = Path(__file__).resolve().parent.parent.parent.parent.parent
    git_exe = shutil.which("git") or "git"
    env = os.environ.copy()
    env["GIT_PAGER"] = "cat"
    env["PAGER"] = "cat"
    env["GIT_TERMINAL_PROMPT"] = "0"

    steps_log = []

    def run_step(cmd_args):
        try:
            r = subprocess.run(
                [git_exe] + cmd_args,
                cwd=str(repo_dir),
                capture_output=True,
                text=True,
                env=env,
                timeout=40,
            )
            steps_log.append({
                "cmd": " ".join(cmd_args),
                "returncode": r.returncode,
                "stdout": r.stdout.strip(),
                "stderr": r.stderr.strip(),
            })
            return r.returncode == 0
        except Exception as e:
            steps_log.append({"cmd": " ".join(cmd_args), "error": str(e)})
            return False

    remote_url = "https://github.com/roboaiapaths99/EmojiChallenge-.git"
    run_step(["init"])
    run_step(["config", "user.name", "roboaiapaths99"])
    run_step(["config", "user.email", "roboaiapaths99@gmail.com"])
    run_step(["remote", "remove", "origin"])
    run_step(["remote", "add", "origin", remote_url])
    run_step(["branch", "-M", "main"])
    run_step(["add", "."])
    run_step(["commit", "-m", "Initial release: Emoji Face Challenge AI game arena, photo souvenir compositor, and mobile QR lead portal"])
    push_ok = run_step(["push", "-u", "origin", "main"])

    return {
        "success": push_ok,
        "logs": steps_log,
    }

