import os
import json
import time
import random
from prompt import generate_prompt
from api import callApi

ACCOUNTS_FILE = "accounts.json"
LOCK_FILE = "task.lock"
MIN_INTERVAL = 12 * 60   # minimum 12 min between posts
MAX_INTERVAL = 25 * 60   # maximum 25 min between posts
TASK_TIMEOUT = 15 * 60   # 15 min max for a single task
CHECK_INTERVAL = 60

# -----------------------
# Lock Mechanism
# -----------------------
def is_task_locked():
    if os.path.exists(LOCK_FILE):
        with open(LOCK_FILE, "r") as f:
            timestamp = float(f.read().strip())
            if time.time() - timestamp < TASK_TIMEOUT:
                return True
    return False

def lock_task():
    with open(LOCK_FILE, "w") as f:
        f.write(str(time.time()))

def unlock_task():
    if os.path.exists(LOCK_FILE):
        os.remove(LOCK_FILE)

# -----------------------
# Account Utilities
# -----------------------
def generate_random_credentials(count: int):
    domains = ["example.com", "mail.com", "test.org", "fake.io"]
    chars = "abcdefghijklmnopqrstuvwxyz0123456789"

    def rstr(n):
        return "".join(random.choice(chars) for _ in range(n))

    return [
        {"email": f"{rstr(8)}@{random.choice(domains)}", "password": rstr(12)}
        for _ in range(count)
    ]

def load_or_create_accounts():
    MAX_ACCOUNTS = 4
    if os.path.exists(ACCOUNTS_FILE):
        with open(ACCOUNTS_FILE) as f:
            accounts = json.load(f)
        if len(accounts) >= MAX_ACCOUNTS:
            return accounts[:MAX_ACCOUNTS]
    else:
        accounts = []

    needed = MAX_ACCOUNTS - len(accounts)
    accounts.extend(generate_random_credentials(needed))
    with open(ACCOUNTS_FILE, "w") as f:
        json.dump(accounts, f, indent=2)
    return accounts[:MAX_ACCOUNTS]

# -----------------------
# Generation Config
# -----------------------
MODELS = ["flux", "sdxl"]
SAMPLERS = ["euler_a", "euler", "dpm_2m_karras", "dpm_sde_karras"]

# Portrait-favored aspect ratios — better for character/person images
ASPECT_RATIOS = [
    {"ratio": "9:16", "width": 544, "height": 960, "weight": 40},   # portrait tall — best for people
    {"ratio": "2:3",  "width": 512, "height": 768, "weight": 30},   # portrait medium
    {"ratio": "3:4",  "width": 512, "height": 682, "weight": 15},   # portrait slight
    {"ratio": "1:1",  "width": 512, "height": 512, "weight": 10},   # square
    {"ratio": "16:9", "width": 960, "height": 544, "weight": 5},    # landscape (rare)
]

def weighted_choice(options):
    weights = [o["weight"] for o in options]
    return random.choices(options, weights=weights, k=1)[0]

def run_task():
    if is_task_locked():
        print("[SKIP] Task locked.")
        return False

    try:
        lock_task()
        accounts = load_or_create_accounts()
        user = random.choice(accounts)
        prompt = generate_prompt()
        dims = weighted_choice(ASPECT_RATIOS)

        task = {
            "email": user["email"],
            "password": user["password"],
            "prompt": prompt,
            "count": 4,
            "width": dims["width"],
            "height": dims["height"],
            "modelId": random.choice(MODELS),
            "steps": random.choice([25, 30, 35, 40]),
            "cfg": random.choice([6.0, 7.0, 7.5, 8.0]),
            "sampler": random.choice(SAMPLERS),
        }

        # 50% chance of adding a seed for reproducibility
        if random.random() < 0.5:
            task["seed"] = str(random.randint(1, 2147483647))

        print(f"\n[TASK] model={task['modelId']} size={dims['ratio']} prompt={prompt[:80]}...")
        callApi(task)
        return True

    finally:
        unlock_task()

# -----------------------
# Main Loop
# -----------------------
if __name__ == "__main__":
    print("[AdultAI Bot] Starting...")
    while True:
        try:
            executed = run_task()
        except Exception as e:
            print(f"[ERROR] {e}")
            executed = False

        if executed:
            # Vary the sleep time so posting feels natural, not robotic
            sleep_for = random.randint(MIN_INTERVAL, MAX_INTERVAL)
            print(f"[SLEEP] Next post in {sleep_for // 60}m {sleep_for % 60}s\n")
            time.sleep(sleep_for)
        else:
            time.sleep(CHECK_INTERVAL)
