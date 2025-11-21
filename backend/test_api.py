# Test script for FastAPI fraud detection backend
import requests

API_URL = "http://localhost:8000/predict"

# Example feature vector (replace with real features as needed)
features = {
    "features": [10000, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}

response = requests.post(API_URL, json=features)
print("Status Code:", response.status_code)
print("Response:", response.json())
