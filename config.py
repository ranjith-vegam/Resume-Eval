import os
from dotenv import load_dotenv

load_dotenv()

PORT = int(os.environ.get("PORT", 8000))
MAX_CONCURRENT_EVALUATIONS = 5
MAX_RESUME_CHARS = 32_000

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.environ.get("MONGO_DB_NAME", "resume_eval")
