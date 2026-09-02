import streamlit as st
import json
import joblib
import pandas as pd
import numpy as np
from pathlib import Path
import shap
import matplotlib.pyplot as plt
import networkx as nx
from google import genai
from dotenv import load_dotenv
import os
from src.data.feature_engineering import engineer_features

# Load environment variables
load_dotenv()
gemini_api_key = os.environ.get("GEMINI_API_KEY")

st.set_page_config(page_title="AI Risk Manager Demo", page_icon="🚨", layout="wide")

st.title("Razorpay AI Buildathon — Risk Manager Demo")
st.markdown("### Merchant-Level Risk & Abuse-Ring Sentinel Dashboard")

# ── Sidebar Configuration ──
st.sidebar.header("Configuration")
dataset = st.sidebar.selectbox("Dataset", ["paysim", "ieee"], index=0)
model_name = st.sidebar.selectbox(
    "Select Model for Inference",
    ["lightgbm", "xgboost", "catboost", "hist_gradient_boosting", "stacking_ensemble", "random_forest"],
    index=0
)
merchant_name = st.sidebar.text_input("Simulate Merchant ID", value="M1982863514")

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
    # Defaulting to Business-Optimal or F1
    threshold = thresholds.get(mod, 0.5)
    return preprocessor, model, threshold

preprocessor, model, threshold = load_artifacts(dataset, model_name)

if not preprocessor:
    st.error(f"Models not found for {dataset}/{model_name}. Please run the pipeline first.")
    st.stop()

# ── Real Data Integration ──
demo_data_path = Path("data/raw/demo_transactions.csv")
if demo_data_path.exists():
    df_demo = pd.read_csv(demo_data_path)
else:
    st.error("Demo dataset not found. Run scripts/generate_demo_data.py first.")
    st.stop()
    
# Filter for current merchant
merchant_df = df_demo[df_demo['nameDest'] == merchant_name].copy()
if merchant_df.empty:
    st.warning(f"No transactions found for merchant {merchant_name}")
    st.stop()

# Run actual inference to get flagged transactions
merchant_engineered = engineer_features(merchant_df)
X_merchant = preprocessor.transform(merchant_engineered)
if hasattr(preprocessor, "feature_names_"):
    X_merchant = X_merchant.reindex(columns=preprocessor.feature_names_, fill_value=0.0)
X_np_merchant = X_merchant.values.astype("float32")

if hasattr(model, "predict_proba"):
    probs = model.predict_proba(X_np_merchant)[:, 1]
else:
    probs = model.predict(X_np_merchant)

merchant_df['risk_score'] = probs
merchant_df['is_flagged'] = (merchant_df['risk_score'] >= threshold).astype(int)

total_txns = len(merchant_df)
fraud_txns = merchant_df['is_flagged'].sum()
baseline_rate = 0.31 # Industry average
current_rate = (fraud_txns / total_txns) * 100 if total_txns > 0 else 0

st.markdown("---")
st.subheader(f"Merchant: {merchant_name}")

# Metrics Row
col1, col2, col3, col4 = st.columns(4)
col1.metric("Merchant Transactions", f"{len(merchant_df):,}")
col2.metric("Fraud-Risk Transactions", f"{fraud_txns}")
col3.metric("Current Fraud Rate", f"{current_rate:.2f}%", f"{(current_rate - baseline_rate)/baseline_rate * 100:.0f}%", delta_color="inverse")
col4.metric("Baseline Fraud Rate", f"{baseline_rate:.2f}%")

if current_rate > baseline_rate * 2:
    st.error("🚨 **FRAUD SPIKE DETECTED** 🚨")
else:
    st.success("✅ Normal Transaction Volume")

st.markdown("---")
st.subheader("Why? Abuse-Ring Investigation")

# ── Construct NetworkX Graph for Abuse Ring ──
# We create a bipartite/tripartite graph: Customers -> Devices/IPs -> Merchant
G = nx.Graph()

# Add node for Merchant
merchant_node = f"Merchant {merchant_name}"
G.add_node(merchant_node, type='merchant', color='red', size=800)

flagged_df = merchant_df[merchant_df['is_flagged'] == 1]
suspicious_devices = flagged_df['device_id'].value_counts()
top_clusters = suspicious_devices.head(3).index.tolist()
cluster_concentration = (suspicious_devices.head(3).sum() / fraud_txns * 100) if fraud_txns > 0 else 0

for dev in suspicious_devices.index:
    # Only draw devices with multiple flagged connections or in top 3 to keep graph readable
    if suspicious_devices[dev] > 1 or dev in top_clusters:
        G.add_node(dev, type='device', color='orange', size=500)
        G.add_edge(dev, merchant_node, weight=3)

for idx, row in flagged_df.iterrows():
    cust = f"Customer {row['nameOrig'][-4:]}" # Anonymized customer
    dev = row['device_id']
    if dev in G.nodes:
        G.add_node(cust, type='customer', color='lightblue', size=300)
        G.add_edge(cust, dev, weight=1)

# Draw Graph
col_graph, col_ai = st.columns([1.5, 1])

with col_graph:
    st.markdown("### 🕸️ Abuse-Ring Graph Analysis")
    fig, ax = plt.subplots(figsize=(8, 6))
    
    pos = nx.spring_layout(G, k=0.5, iterations=50, seed=42)
    colors = [node[1]['color'] for node in G.nodes(data=True)]
    sizes = [node[1]['size'] for node in G.nodes(data=True)]
    
    nx.draw_networkx_nodes(G, pos, node_color=colors, node_size=sizes, alpha=0.8, ax=ax)
    nx.draw_networkx_edges(G, pos, width=2.0, alpha=0.5, ax=ax)
    nx.draw_networkx_labels(G, pos, font_size=9, font_family="sans-serif", ax=ax)
    
    ax.axis('off')
    st.pyplot(fig)

with col_ai:
    st.markdown("**Generative AI Analyst Report Generation**")
    
    if st.button("Generate Threat Intelligence Report", type="primary"):
        if not gemini_api_key or gemini_api_key == "your_api_key_here":
            st.warning("⚠️ Please provide a valid GEMINI_API_KEY in the .env file to generate the report.")
        else:
            with st.spinner("Analyzing ML outputs & graph patterns..."):
                try:
                    client = genai.Client(api_key=gemini_api_key)
                    prompt = f"""
                    You are an expert Risk Operations Analyst. Analyze the following deterministic evidence generated by our ML models and graph clustering algorithms to produce a concise threat intelligence report for human review.
                    
                    Evidence:
                    - Merchant: {merchant_name}
                    - Transaction velocity increase: {current_rate / baseline_rate * 100 if baseline_rate > 0 else 0:.0f}%
                    - {cluster_concentration:.0f}% of flagged transactions share {len(top_clusters)} highly-connected device clusters.
                    - Current Fraud Rate: {current_rate:.2f}% (Baseline: {baseline_rate:.2f}%)
                    
                    Format the output strictly as:
                    **Risk Explanation:** [1 paragraph synthesis of the ML/Graph evidence explaining the likely attack vector]
                    **Actionable Insights:** [Bullet points for human analysts]
                    """
                    
                    response = client.models.generate_content(
                        model='gemini-3.6-flash',
                        contents=prompt,
                    )
                    st.info(response.text)
                except Exception as e:
                    st.error(f"Failed to generate report: {e}")
    else:
        st.info("Click the button above to generate a natural language explanation of the ongoing attack using Gemini 3.6 Flash.")
        
st.markdown("---")
st.subheader("Model Explainability (SHAP)")
st.markdown("Select a sample transaction from the attack cluster to see the model's logic.")

# Mock a transaction payload
default_payload = {
  "step": 743,
  "type": "TRANSFER",
  "amount": 7316.34,
  "oldbalanceOrg": 7316.34,
  "newbalanceOrig": 0.0,
  "oldbalanceDest": 0.0,
  "newbalanceDest": 0.0
}

transaction_text = st.text_area("JSON Payload:", value=json.dumps(default_payload, indent=2), height=200)

if st.button("Explain Single Transaction"):
    try:
        data = json.loads(transaction_text)
        df = pd.DataFrame([data])
        
        # Preprocess
        df_engineered = engineer_features(df)
        X_processed = preprocessor.transform(df_engineered)
        if hasattr(preprocessor, "feature_names_"):
            X_processed = X_processed.reindex(columns=preprocessor.feature_names_, fill_value=0.0)
        X_np = X_processed.values.astype("float32")
        
        # Predict
        if hasattr(model, "predict_proba"):
            prob = model.predict_proba(X_np)[0, 1]
        else:
            prob = model.predict(X_np)[0]
            
        st.metric("Fraud Score (Probability)", f"{prob:.4f}", delta=f"Threshold: {threshold:.4f}", delta_color="off")
        
        with st.spinner("Generating SHAP explanation..."):
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(X_np)
            
            if isinstance(shap_values, list):
                shap_values = shap_values[1]
                
            fig, ax = plt.subplots(figsize=(10, 4))
            
            # Using shap.plots.waterfall inside streamlit safely
            # Note: shap.plots.waterfall acts directly on plt.gca() by default
            explanation = shap.Explanation(
                values=shap_values[0], 
                base_values=explainer.expected_value[1] if isinstance(explainer.expected_value, list) else explainer.expected_value, 
                data=X_np[0], 
                feature_names=X_processed.columns.tolist()
            )
            shap.plots.waterfall(explanation, show=False)
            
            st.pyplot(fig)
            
    except Exception as e:
        st.error(f"Error evaluating transaction: {str(e)}")
