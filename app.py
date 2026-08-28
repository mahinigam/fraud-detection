import streamlit as st
import json
import joblib
import pandas as pd
from pathlib import Path
import shap
import matplotlib.pyplot as plt
from src.data.feature_engineering import engineer_features

st.set_page_config(page_title="AI Risk Manager Demo", page_icon="🚨", layout="wide")

st.title("Razorpay AI Buildathon — Risk Manager Demo")
st.markdown("### Fraud-Spike Detector & Abuse-Ring Sentinel")

# Sidebar
st.sidebar.header("Configuration")
dataset = st.sidebar.selectbox("Dataset", ["paysim", "ieee"], index=0)
model_name = st.sidebar.selectbox("Model", ["catboost", "lightgbm", "xgboost"], index=0)

# Load Models
@st.cache_resource
def load_artifacts(ds, mod):
    preprocessor_path = Path(f"data/processed/preprocessor_{ds}.pkl")
    model_path = Path(f"outputs/model_{ds}_{mod}.pkl")
    thresholds_path = Path(f"outputs/thresholds_{ds}.json")
    
    if not preprocessor_path.exists() or not model_path.exists():
        return None, None, None
        
    preprocessor = joblib.load(preprocessor_path)
    model = joblib.load(model_path)
    with open(thresholds_path, 'r') as f:
        thresholds = json.load(f)
    threshold = thresholds.get(mod, 0.5)
    return preprocessor, model, threshold

preprocessor, model, threshold = load_artifacts(dataset, model_name)

if not preprocessor:
    st.error(f"Models not found for {dataset}/{model_name}. Please run the pipeline first.")
    st.stop()

# Default Transaction
default_paysim = """{
  "step": 5,
  "type": "CASH_OUT",
  "amount": 5000000.0,
  "oldbalanceOrg": 5000000.0,
  "newbalanceOrig": 0.0,
  "oldbalanceDest": 10000.0,
  "newbalanceDest": 5010000.0
}"""

# Main Area
col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("Transaction JSON")
    transaction_text = st.text_area("Paste transaction here:", value=default_paysim, height=300)

with col2:
    st.subheader("Analysis")
    if st.button("Evaluate Risk", type="primary"):
        try:
            data = json.loads(transaction_text)
            df = pd.DataFrame([data])
            
            # Preprocess
            df_engineered = engineer_features(df)
            X_processed = preprocessor.transform(df_engineered)
            X_np = X_processed.values.astype("float32")
            
            # Predict
            if hasattr(model, "predict_proba"):
                prob = model.predict_proba(X_np)[0, 1]
            else:
                prob = model.predict(X_np)[0]
                
            is_fraud = prob >= threshold
            
            # Display Result
            st.metric("Fraud Score (Probability)", f"{prob:.4f}", delta=f"Threshold: {threshold:.4f}", delta_color="off")
            if is_fraud:
                st.error("🚨 HIGH RISK: Transaction Blocked")
            else:
                st.success("✅ LOW RISK: Transaction Approved")
                
            # Explainability
            st.markdown("### SHAP Explanation")
            with st.spinner("Generating explanation..."):
                explainer = shap.TreeExplainer(model)
                shap_values = explainer.shap_values(X_np)
                
                # Check for multiclass shap output
                if isinstance(shap_values, list):
                    shap_values = shap_values[1]
                
                fig, ax = plt.subplots(figsize=(10, 3))
                # For a single sample, force_plot or waterfall can be used. Using decision_plot or bar for matplotlib compatibility.
                shap.plots.waterfall(shap.Explanation(values=shap_values[0], 
                                                      base_values=explainer.expected_value[1] if isinstance(explainer.expected_value, list) else explainer.expected_value, 
                                                      data=X_np[0], 
                                                      feature_names=X_processed.columns.tolist()), show=False)
                st.pyplot(fig)
                
        except Exception as e:
            st.error(f"Error evaluating transaction: {str(e)}")
