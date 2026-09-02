import pytest
from unittest.mock import patch, MagicMock
from streamlit.testing.v1 import AppTest
import pandas as pd
import numpy as np

# Mocking the artifacts so the app doesn't need real ML models to run tests
@pytest.fixture(autouse=True)
def mock_joblib_load():
    with patch('app.joblib.load') as mock_load:
        # Create a mock preprocessor
        mock_preprocessor = MagicMock()
        mock_preprocessor.transform.return_value = pd.DataFrame(np.zeros((1, 14)))
        mock_preprocessor.feature_names_ = [f"feature_{i}" for i in range(14)]
        
        # Create a mock model
        mock_model = MagicMock()
        mock_model.predict_proba.return_value = np.array([[0.1, 0.9]])
        
        # Assign returns based on what's being loaded
        def side_effect(path):
            path_str = str(path)
            if 'preprocessor' in path_str:
                return mock_preprocessor
            elif 'model' in path_str:
                return mock_model
            return MagicMock()
            
        mock_load.side_effect = side_effect
        yield mock_load

@pytest.fixture(autouse=True)
def mock_json_load():
    with patch('app.json.load') as mock_load:
        mock_load.return_value = {"catboost": 0.5, "xgboost": 0.5, "lightgbm": 0.5}
        yield mock_load
        
@pytest.fixture(autouse=True)
def mock_path_exists():
    with patch('app.Path.exists') as mock_exists:
        mock_exists.return_value = True
        yield mock_exists

@pytest.fixture(autouse=True)
def mock_gemini():
    with patch('app.genai.Client') as mock_client:
        mock_instance = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "Mocked Threat Intelligence Report: Fraud spike detected due to coordinated device clustering."
        mock_instance.models.generate_content.return_value = mock_response
        mock_client.return_value = mock_instance
        yield mock_client
        
@pytest.fixture(autouse=True)
def mock_shap():
    # SHAP plotting can cause issues in headless tests, so we mock it
    with patch('app.shap.plots.waterfall') as mock_waterfall:
        yield mock_waterfall

@pytest.fixture(autouse=True)
def mock_pyplot():
    # Prevent matplotlib from trying to open windows
    with patch('app.st.pyplot') as mock_pyplot:
        yield mock_pyplot

def test_app_renders_successfully():
    """Test that the app renders without throwing exceptions."""
    at = AppTest.from_file("../app.py").run()
    assert not at.exception
    
    # Check for main title
    assert any("Razorpay AI Buildathon" in title.value for title in at.title)
    assert any("Merchant: M1982863514" in sub.value for sub in at.subheader)

def test_gemini_report_generation():
    """Test clicking the 'Generate Threat Intelligence Report' button."""
    # Ensure GEMINI_API_KEY is set so it doesn't show the warning
    with patch.dict('os.environ', {'GEMINI_API_KEY': 'mock_key'}):
        at = AppTest.from_file("../app.py").run()
        assert not at.exception
        
        # Click the primary button (Generate Threat Intelligence Report)
        # It's the first button in the app that isn't in a form, but let's find it
        report_button = None
        for button in at.button:
            if button.label == "Generate Threat Intelligence Report":
                report_button = button
                break
                
        assert report_button is not None, "Threat intelligence button not found"
        
        # Click it
        report_button.click().run()
        
        # It should show the mocked response in an info box
        found_report = False
        for info in at.info:
            if "Mocked Threat Intelligence Report" in str(info.value):
                found_report = True
                break
                
        assert found_report, "Mocked report was not displayed after clicking button"

def test_single_transaction_evaluation():
    """Test evaluating a single transaction payload."""
    at = AppTest.from_file("../app.py").run()
    
    # Click the "Explain Single Transaction" button
    explain_button = None
    for button in at.button:
        if button.label == "Explain Single Transaction":
            explain_button = button
            break
            
    assert explain_button is not None, "Explain button not found"
    
    explain_button.click().run()
    
    # We should see the Fraud Score metric now
    found_score = False
    for metric in at.metric:
        if metric.label == "Fraud Score (Probability)":
            found_score = True
            # Since our mock returns [[0.1, 0.9]], the fraud prob is 0.9000
            assert "0.9000" in str(metric.value)
            break
            
    assert found_score, "Fraud score metric not found after clicking explain button"
