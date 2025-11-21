#!/usr/bin/env python3
"""
Test script for the fraud detection API
"""

import requests
import json
import numpy as np

# API endpoint
API_URL = "http://localhost:8000"

def test_health_endpoint():
    """Test the health endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get(f"{API_URL}/health")
        if response.status_code == 200:
            print("Health endpoint working:", response.json())
            return True
        else:
            print(f"Health endpoint failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"Health endpoint error: {e}")
        return False

def test_prediction_endpoint():
    """Test the prediction endpoint with sample data"""
    print("\nTesting prediction endpoint...")
    
    # Sample transaction features based on the trained model
    # Features: step, amount, oldbalanceOrg, oldbalanceDest, isFlaggedFraud, 
    # type_CASH_IN, type_CASH_OUT, type_DEBIT, type_PAYMENT, type_TRANSFER
    
    test_cases = [
        {
            "name": "Normal Transaction (Payment)",
            "features": [1, 100.0, 1000.0, 500.0, 0, 0, 0, 0, 1, 0]  # Payment transaction
        },
        {
            "name": "Suspicious Transaction (Large Cash Out)",
            "features": [5, 50000.0, 100000.0, 0.0, 0, 0, 1, 0, 0, 0]  # Large cash out
        },
        {
            "name": "High Risk Transaction (Transfer)",
            "features": [10, 200000.0, 250000.0, 0.0, 1, 0, 0, 0, 0, 1]  # Flagged transfer
        }
    ]
    
    for test_case in test_cases:
        print(f"\nTesting: {test_case['name']}")
        try:
            payload = {"features": test_case["features"]}
            response = requests.post(f"{API_URL}/predict", json=payload)
            
            if response.status_code == 200:
                result = response.json()
                print(f"Prediction successful:")
                print(f"   Prediction: {result['prediction']} ({'Fraud' if result['prediction'] == 1 else 'Normal'})")
                print(f"   Risk Score: {result['risk_score']:.4f}")
            else:
                print(f"Prediction failed: {response.status_code}")
                print(f"   Error: {response.text}")
                
        except Exception as e:
            print(f"Prediction error: {e}")

def test_invalid_input():
    """Test the API with invalid input"""
    print("\nTesting invalid input handling...")
    
    invalid_cases = [
        {
            "name": "Missing features",
            "payload": {}
        },
        {
            "name": "Wrong feature count",
            "payload": {"features": [1, 2, 3]}  # Should be 10 features
        },
        {
            "name": "Non-numeric features",
            "payload": {"features": ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]}
        }
    ]
    
    for test_case in invalid_cases:
        print(f"\nTesting: {test_case['name']}")
        try:
            response = requests.post(f"{API_URL}/predict", json=test_case["payload"])
            result = response.json()
            
            if "error" in result:
                print(f"Error handling working: {result['error']}")
            else:
                print(f"Unexpected response: {result}")
                
        except Exception as e:
            print(f"Test error: {e}")

def main():
    """Run all API tests"""
    print("Starting Fraud Detection API Tests\n")
    print("=" * 50)
    
    # Test health endpoint
    if not test_health_endpoint():
        print("Server not responding. Make sure the API is running on port 8000")
        return
    
    # Test prediction functionality
    test_prediction_endpoint()
    
    # Test error handling
    test_invalid_input()
    
    print("\n" + "=" * 50)
    print("API testing completed!")

if __name__ == "__main__":
    main()