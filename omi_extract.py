"""
Optimus OMI Extraction v2 — Full-depth conversation & transcript harvester.
"""
import asyncio, aiohttp, json, sys, os
from datetime import datetime, timedelta, timezone

API_KEY = os.environ.get("OMI_API_KEY", "omi_mcp_2aab1f6ac76721257bf4c9d88cae0ba1")
ENDPOINT = "https://api.omi.me/v1/mcp/sse"
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "omi_full_extract.json")
END_DATE = datetime.now(timezone.utc).strftime("%Y-%m-%d")
START_DATE = (datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%d")
PAGE_SIZE = 100
MAX_RETRIES = 3
MAX_PAGES = 50
TIMEOUT_SECS = 45

req_counter = 0

def next_id():
    global req_counter; req_counter += 1; return req_counter

async def call_omi(session, method, params=None, retries=MAX_RETRIES):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
    }
    body = {"jsonrpc": "2.0", "method": method, "id": next_id()}
    if params: body["params"] = params
    for attempt in range(retries):
        try:
            async with session.post(
                ENDPOINT, json=body, headers=headers,
                timeout=aiohttp.ClientTimeout(total=TIMEOUT_SECS)
            ) as r:
                text = await r.text()
                for line in text.split('\n'):
                    if line.startswith('data:'):
                        payload = line[5:].strip()
                        if payload:
                            parsed = json.loads(payload)
                            if 'error' in parsed:
                                print(f"  API error: {parsed['error']}", file=sys.stderr)
                                return None
                            return parsed
            return None
        except (aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError) as e:
            wait = 2 ** attempt
            print(f"  Retry {attempt+1}/{retries} after {type(e).__name__} (wait {wait}s)", file=sys.stderr)
            await asyncio.sleep(wait)
    print(f"  FAILED after {retries} retries for {method}", file=sys.stderr)
    return None

def extract_text(response):
    if not response or 'result' not in response: return None
    return '\n'.join(c.get('text', '') for c in response['result'].get('content', []) if c.get('text'))

def safe_json(text, fallback=None):
    if not text: return fallback
    try: return json.loads(text)
    except (json.JSONDecodeError, ValueError, TypeError): return fallback

async def paginate_memories(session):
    all_items, offset, page = [], 0, 0
    while page < MAX_PAGES:
        print(f"  Memories offset={offset}...", file=sys.stderr)
        resp = await call_omi(session, "tools/call", {
            "name": "get_memories", "arguments": {"limit": PAGE_SIZE, "offset": offset}
        })
        items = safe_json(extract_text(resp), {}).get('memories', [])
        if not items: break
        all_items.extend(items)
        if len(items) < PAGE_SIZE: break
        offset += PAGE_SIZE; page += 1; await asyncio.sleep(0.5)
    return all_items

async def paginate_conversations(session):
    all_items, offset, page = [], 0, 0
    while page < MAX_PAGES:
        print(f"  Conversations offset={offset} ({START_DATE} to {END_DATE})...", file=sys.stderr)
        resp = await call_omi(session, "tools/call", {
            "name": "get_conversations",
            "arguments": {"limit": PAGE_SIZE, "offset": offset, "start_date": START_DATE, "end_date": END_DATE}
        })
        items = safe_json(extract_text(resp), {}).get('conversations', [])
        if not items: break
        all_items.extend(items)
        if len(items) < PAGE_SIZE: break
        offset += PAGE_SIZE; page += 1; await asyncio.sleep(0.5)
    return all_items

async def fetch_all_transcripts(session, conversations):
    transcripts, failed_ids = {}, []
    for i, conv in enumerate(conversations):
        cid = conv.get('id', '')
        title = conv.get('structured', {}).get('title', '?')[:50]
        print(f"  Transcript {i+1}/{len(conversations)}: {title} ({cid[:8]})", file=sys.stderr)
        resp = await call_omi(session, "tools/call", {
            "name": "get_conversation_by_id", "arguments": {"conversation_id": cid}
        })
        data = safe_json(extract_text(resp))
        if data:
            transcripts[cid] = data
        else:
            print(f"    WARN: no transcript for {cid[:8]}", file=sys.stderr)
            failed_ids.append(cid)
        await asyncio.sleep(0.7)
    return transcripts, failed_ids

async def main():
    print(f"=== Optimus OMI v2 | {START_DATE} to {END_DATE} ===", file=sys.stderr)
    result = {
        "extraction_timestamp": datetime.now(timezone.utc).isoformat(),
        "date_window": {"start": START_DATE, "end": END_DATE},
        "memories": [], "conversations": [], "transcripts": {},
        "failed_transcript_ids": [], "stats": {}
    }
    async with aiohttp.ClientSession() as session:
        await call_omi(session, "initialize", {
            "protocolVersion": "2025-03-26", "capabilities": {},
            "clientInfo": {"name": "optimus-v2", "version": "2.0"}
        })
        result["memories"] = await paginate_memories(session)
        result["conversations"] = await paginate_conversations(session)
        result["transcripts"], result["failed_transcript_ids"] = await fetch_all_transcripts(session, result["conversations"])

    seg_count = 0
    text_chars = 0
    for t in result['transcripts'].values():
        conv_data = t.get('conversation', {}) if isinstance(t, dict) else {}
        segments = conv_data.get('transcript_segments', []) if isinstance(conv_data, dict) else []
        if isinstance(segments, list):
            seg_count += len(segments)
            text_chars += sum(len(s.get('text', '')) for s in segments if isinstance(s, dict))

    result["stats"] = {
        "total_memories": len(result["memories"]),
        "total_conversations": len(result["conversations"]),
        "transcripts_retrieved": len(result["transcripts"]),
        "transcripts_failed": len(result["failed_transcript_ids"]),
        "failed_ids": result["failed_transcript_ids"][:20],
        "total_segments": seg_count,
        "total_text_chars": text_chars,
        "approx_words": text_chars // 5
    }

    if not result["memories"]: print("WARNING: Zero memories retrieved!", file=sys.stderr)
    if not result["conversations"]: print("WARNING: Zero conversations retrieved!", file=sys.stderr)
    if not result["transcripts"]: print("WARNING: Zero transcripts retrieved!", file=sys.stderr)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False, default=str)

    print(json.dumps(result["stats"], indent=2))

asyncio.run(main())
