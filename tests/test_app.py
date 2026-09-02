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
        def mock_transform(X):
            n_samples = X.shape[0] if hasattr(X, 'shape') else len(X)
            return pd.DataFrame(np.zeros((n_samples, 14)))
        mock_preprocessor.transform.side_effect = mock_transform
        mock_preprocessor.feature_names_ = [f"feature_{i}" for i in range(14)]
        
        # Create a mock model that handles variable batch size
        mock_model = MagicMock()
        def mock_predict_proba(X):
            # Return shape (n_samples, 2)
            n_samples = X.shape[0] if hasattr(X, 'shape') else len(X)
            return np.tile([0.1, 0.9], (n_samples, 1))
        mock_model.predict_proba.side_effect = mock_predict_proba
        
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
def mock_read_csv():
    with patch('app.pd.read_csv') as mock_read:
        # Create a tiny mock dataframe for the dashboard
        df = pd.DataFrame({
            'nameDest': ['C985934102', 'C985934102', 'C985934102', 'C985934102'],
            'device_id': ['DEV_RING_A', 'DEV_RING_B', 'DEV_RING_C', 'DEV_NORMAL'],
            'nameOrig': ['C123', 'C124', 'C125', 'C126']
        })
        mock_read.return_value = df
        yield mock_read

@pytest.fixture(autouse=True)
def mock_engineer_features():
    with patch('app.engineer_features') as mock_engineer:
        mock_engineer.side_effect = lambda x: x
        yield mock_engineer

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
    if at.exception:
        print(f"App exception: {at.exception[0]}")
    assert not at.exception
    
    # Check for main title
    assert any("Razorpay AI Buildathon" in title.value for title in at.title)
    assert any("Merchant: C985934102" in sub.value for sub in at.subheader)

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
