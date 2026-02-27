import json
import sys
import win32file

PIPE_NAME = r"\\.\pipe\taskmanagement-ipc"

def send_request(request: dict):
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

        response = json.loads(response_text)

        if response.get("ok") and isinstance(response.get("data"), list):
            tasks = response["data"]

            if not tasks:
                print("No tasks found.")
            else:
                print("\n=== Tasks ===")
                for task in tasks:
                    print(f"ID: {task['id']}")
                    print(f"Title: {task['title']}")
                    print(f"Description: {task.get('description', '')}")
                    print(f"Status: {task['status']}")
                    print("-" * 30)
        else:
            if response.get("ok"):
                print("Success.")
            else:
                print(f"Error: {response.get('error')}")

        win32file.CloseHandle(handle)

    except Exception as e:
        print(f"IPC Error: {e}")

def prompt_nonempty(label: str) -> str:
    while True:
        v = input(label).strip()
        if v:
            return v

def menu():
    while True:
        print("\n=== Python Task Client (IPC) ===")
        print("1) List tasks")
        print("2) Create task")
        print("3) Update task")
        print("4) Delete task")
        print("5) Exit")

        choice = input("Select: ").strip()

        if choice == "1":
            send_request({"action": "list"})

        elif choice == "2":
            title = prompt_nonempty("Title: ")
            description = input("Description (optional): ").strip()
            status = input("Status (TODO/InProgress/Done) [optional]: ").strip()

            req = {"action": "create", "title": title}
            if description:
                req["description"] = description
            if status:
                req["status"] = status

            send_request(req)

        elif choice == "3":
            try:
                task_id = int(prompt_nonempty("Task ID: "))
            except ValueError:
                print("Invalid ID.")
                continue

            title = input("New title (blank = no change): ").strip()
            description = input("New description (blank = no change): ").strip()
            status = input("New status (TODO/InProgress/Done) (blank = no change): ").strip()

            req = {"action": "update", "id": task_id}
            if title != "":
                req["title"] = title
            if description != "":
                req["description"] = description
            if status != "":
                req["status"] = status

            if len(req.keys()) == 2:
                print("Nothing to update.")
                continue

            send_request(req)

        elif choice == "4":
            try:
                task_id = int(prompt_nonempty("Task ID to delete: "))
            except ValueError:
                print("Invalid ID.")
                continue

            send_request({"action": "delete", "id": task_id})

        elif choice == "5":
            print("Exiting")
            break

        else:
            print("Invalid choice.")

if __name__ == "__main__":
    menu()