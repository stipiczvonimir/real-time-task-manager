import argparse
import json
import sys
import win32file

PIPE_NAME = r"\\.\pipe\taskmanagement-ipc"


def send_request(request: dict) -> dict:
    try:
        handle = win32file.CreateFile(
            PIPE_NAME,
            win32file.GENERIC_READ | win32file.GENERIC_WRITE,
            0,
            None,
            win32file.OPEN_EXISTING,
            0,
            None
        )

        payload = (json.dumps(request) + "\n").encode("utf-8")
        win32file.WriteFile(handle, payload)

        _, data = win32file.ReadFile(handle, 65536)
        response_text = data.decode("utf-8").strip()

        win32file.CloseHandle(handle)

        return json.loads(response_text)

    except Exception as e:
        return {"ok": False, "error": f"IPC Error: {e}"}


def print_response(resp: dict):
    if not isinstance(resp, dict):
        print("Error: invalid response format")
        sys.exit(1)

    if not resp.get("ok"):
        print(f"Error: {resp.get('error', 'Unknown error')}")
        sys.exit(1)

    data = resp.get("data")

    if isinstance(data, list):
        if not data:
            print("No tasks found.")
            return

        print("=== Tasks ===")
        for task in data:
            print(f"ID: {task.get('id')}")
            print(f"Title: {task.get('title')}")
            print(f"Description: {task.get('description', '')}")
            print(f"Status: {task.get('status')}")
            print("-" * 30)
        return

    if data is not None:
        print(json.dumps(data, indent=2))
    else:
        print("Success.")


def validate_status(s: str) -> str:
    allowed = {"TODO", "InProgress", "Done"}
    if s not in allowed:
        raise argparse.ArgumentTypeError(f"Invalid status '{s}'. Allowed: {', '.join(sorted(allowed))}")
    return s


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="taskcli",
        description="Task client over Windows named-pipe IPC",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("list", help="List all tasks")

    pc = sub.add_parser("create", help="Create a task")
    pc.add_argument("--title", required=True, help="Task title")
    pc.add_argument("--description", default="", help="Task description (optional)")
    pc.add_argument("--status", type=validate_status, help="Task status (TODO/InProgress/Done)")

    pu = sub.add_parser("update", help="Update a task")
    pu.add_argument("--id", type=int, required=True, help="Task ID")
    pu.add_argument("--title", help="New title")
    pu.add_argument("--description", help="New description")
    pu.add_argument("--status", type=validate_status, help="New status (TODO/InProgress/Done)")

    pd = sub.add_parser("delete", help="Delete a task")
    pd.add_argument("--id", type=int, required=True, help="Task ID to delete")

    return p


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.cmd == "list":
        req = {"action": "list"}

    elif args.cmd == "create":
        req = {"action": "create", "title": args.title}
        if args.description:
            req["description"] = args.description
        if args.status:
            req["status"] = args.status

    elif args.cmd == "update":
        req = {"action": "update", "id": args.id}
        if args.title is not None:
            req["title"] = args.title
        if args.description is not None:
            req["description"] = args.description
        if args.status is not None:
            req["status"] = args.status

        if len(req) == 2:  
            print("Nothing to update (provide --title/--description/--status).")
            return 2

    elif args.cmd == "delete":
        req = {"action": "delete", "id": args.id}

    else:
        parser.print_help()
        return 2

    resp = send_request(req)
    print_response(resp)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())