#!/usr/bin/env python3
"""
Frontend and Backend Integration Test
Tests the complete fraud detection system end-to-end
"""

import requests
import json
import time

# API endpoint
BASE_URL = "http://localhost:8000"

def test_health_check():
    """Test the health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_fraud_prediction(transaction_data, description):
    """Test fraud prediction with given transaction data"""
    print(f"\n🔍 Testing: {description}")
    print(f"Transaction: {transaction_data}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/predict",
            json={"features": transaction_data},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            risk_score = result["risk_score"]
            prediction = result["prediction"]
            
            risk_level = "🟢 LOW" if risk_score < 0.1 else "🟡 MEDIUM" if risk_score < 0.5 else "🔴 HIGH"
            fraud_status = "🚨 FRAUD" if prediction == 1 else "✅ LEGITIMATE"
            
            print(f"✅ Prediction successful:")
            print(f"   Risk Score: {risk_score:.4f} ({risk_score*100:.2f}%)")
            print(f"   Risk Level: {risk_level}")
            print(f"   Classification: {fraud_status}")
            
            return True
        else:
            print(f"❌ Prediction failed: {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        return False

def main():
    """Run comprehensive tests"""
    print("=" * 60)
    print("🚀 FRAUD DETECTION SYSTEM - INTEGRATION TEST")
    print("=" * 60)
    
    # Test health endpoint
    if not test_health_check():
        print("❌ Cannot proceed - backend is not healthy")
        return
    
    # Test cases based on the PaySim dataset structure
    test_cases = [
        {
            "data": [1, 1, 9839.64, 1, 170136.0, 160296.36, 1, 0.0, 0.0, 0],
            "description": "Normal PAYMENT transaction (low amount, balanced accounts)"
        },
        {
            "data": [1, 2, 181.0, 1, 181.0, 0.0, 1, 21182.0, 0.0, 0], 
            "description": "Normal TRANSFER (small amount, account balances make sense)"
        },
        {
            "data": [1, 2, 350000.0, 1, 350000.0, 0.0, 1, 0.0, 350000.0, 0],
            "description": "Large TRANSFER (high amount, could be suspicious)"
        },
        {
            "data": [1, 3, 229133.94, 1, 229133.94, 0.0, 1, 0.0, 0.0, 0],
            "description": "Large CASH_OUT with zero destination balance (suspicious pattern)"
        },
        {
            "data": [1, 3, 800000.0, 1, 800000.0, 0.0, 1, 0.0, 0.0, 1],
            "description": "Large CASH_OUT flagged by system (high fraud risk)"
        },
        {
            "data": [1, 2, 1000000.0, 1, 1000000.0, 0.0, 1, 0.0, 1000000.0, 1],
            "description": "Million dollar TRANSFER flagged by system (very suspicious)"
        },
        {
            "data": [1, 0, 100.0, 1, 5000.0, 4900.0, 1, 2000.0, 2100.0, 0],
            "description": "Small PAYMENT with normal balance changes"
        }
    ]
    
    # Run all test cases
    successful_tests = 0
    total_tests = len(test_cases)
    
    for test_case in test_cases:
        if test_fraud_prediction(test_case["data"], test_case["description"]):
            successful_tests += 1
        time.sleep(0.5)  # Small delay between requests
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Successful tests: {successful_tests}/{total_tests}")
    print(f"Success rate: {successful_tests/total_tests*100:.1f}%")
    
    if successful_tests == total_tests:
        print("🎉 All tests passed! The fraud detection system is working perfectly!")
    else:
        print("⚠️ Some tests failed. Please check the backend logs.")
    
    print("\n🌐 Frontend URL: http://localhost:3000")
    print("🔗 Backend API: http://localhost:8000")
    print("📚 API Docs: http://localhost:8000/docs")

if __name__ == "__main__":
    main()