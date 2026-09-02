# AI Risk Manager: Fraud-Spike Detector & Abuse-Ring Sentinel

**Razorpay AI Buildathon — Track 2 Submission**

## 1. Problem
In high-volume transaction environments, traditional fraud detection models operate in a vacuum—they look at a single transaction, output a risk score, and ignore the broader network context. Worse, these models are often tuned for abstract ML metrics (like F1-score) instead of the actual business objective: **Maximizing Net Savings (ROI)** while minimizing false-positive friction for legitimate users. When an organized abuse-ring attacks, flat classifiers fail to see the big picture, leaving merchants vulnerable to rapid fraud spikes.

## 2. Solution
**AI Risk Manager** is a production-grade fraud defense system that moves beyond flat transaction scoring. It combines:
1. **Merchant-Level Risk Aggregation**: Real-time monitoring of transaction velocity and fraud rates to detect spikes instantly.
2. **Abuse-Ring Graph Clustering**: A `NetworkX`-powered entity graph that connects Customers, Devices, and Merchants to reveal organized abuse rings.
3. **Generative AI Threat Intelligence**: Integration with **Gemini 3.6 Flash** to automatically synthesize complex ML metrics and graph clusters into a plain-English, actionable threat intelligence report.
4. **ROI-Optimized Thresholds**: A decision engine mathematically tuned to maximize actual rupees saved rather than abstract ML scores.

## 3. Live Demo
Run the Merchant Risk Dashboard to see Abuse-Ring detection and Gemini AI reasoning in action!

> [!NOTE]
> The abuse ring structure (device clusters mapping to coordinated attacks) is a synthetic attack scenario layered onto the original PaySim data specifically to demonstrate merchant-level detection and graph investigation.

```bash
# 1. Provide your Gemini API key
echo 'GEMINI_API_KEY="your_api_key_here"' > .env

# 2. Start the visual UI
streamlit run app.py
```

## 4. Architecture

Our pipeline implements a three-stage Imbalance Handling Strategy (IHS) targeting Indian merchant fraud patterns (e.g., chargebacks, account-takeover, transaction-velocity abuse). 

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  IEEE-CIS    │     │   PaySim     │     │  Preprocess  │
│  6.3M rows   │────▶│  6.3M rows   │────▶│  Impute/Norm │
│  400+ feats  │     │  11 feats    │     │  Freq Encode │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                          ┌──────────────────────▼──────────────────┐
                          │     Three-Stage IHS                     │
                          │  1. SMOTE (Data-Level)                  │
                          │  2. Class Weights (Algorithm-Level)     │
                          │  3. Threshold Optimization (Decision)   │
                          └───────────────────────┬─────────────────┘
                                                  │
     ┌────────────────────────────────────────────▼───────────────────────┐
     │           Model Suite (Ablation-Driven Selection)                  │
     │  Top Boosted: XGB │ LGBM │ CatBoost (Selected for Stacking/Demo) │
     │  Classical & Unsupervised (Used to prove baseline limits)          │
     └────────────────────────┬───────────────────────────────────────────┘
                              │
               ┌──────────────▼──────────────┐
               │ Merchant-Level Dashboard    │
               │ - Fraud Spike Detection     │
               │ - NetworkX Abuse Rings      │
               │ - Gemini Threat Intel       │
               │ - SHAP Waterfall            │
               └─────────────────────────────┘
```

## 5. Why it's different

1. **Not just a classifier**: It visualizes the abuse-ring using graph analytics.
2. **Generative AI layer**: Uses an LLM to explain the attack vector to risk analysts in natural language.
3. **Business-Cost Optimal Thresholding**: We calculate the exact ROI of blocking fraud versus the cost of a false positive, and deploy the threshold that maximizes `TP * Value - FP * Cost`.

## 6. Results & Methodology

### Dataset & Methodology
We train and evaluate on a massive dataset of **6,362,620 transactions**. To simulate a real-world production deployment and prevent data leakage, we enforce a strict chronological split:

- **TRAIN**: First 70% chronologically.
- **VALIDATION**: Last 30% of training period (used for early stopping).
- **TEST**: Final 30% chronological holdout.

> [!IMPORTANT]
> The test set was strictly held-out and **never** used for feature selection, hyperparameter tuning, threshold selection, or model selection. Thresholds are selected exclusively on the chronological validation set and frozen before evaluating the final chronological test set.

### Performance Context (HistGradientBoosting)

**Top Model Performance:**
- Precision: 96.89%
- Recall: 78.33%
- PR-AUC: 93.28%

**At what threshold?**
Using the Business-Cost Optimal Threshold ($t=0.337$) on the Test Set:

|                 | Predicted Legit | Predicted Fraud |
|-----------------|-----------------|-----------------|
| **Actual Legit**| 1,900,266       | 8,950           |
| **Actual Fraud**| 961             | 4,549           |

*Note: FP count represents the friction introduced to legitimate users, balanced mathematically against the ₹ value of the 4,549 caught fraud transactions.*

## 7. False-Positive Economics (ROI)

If we assume an average fraud transaction value of ₹5,000 and a false-positive friction cost of ₹50:

```
Business Recommendation:
Deploying hist_gradient_boosting using the Business-Optimal threshold (0.337) yields maximum ROI.
At this threshold, we catch ₹22,745,000 in fraud but block legitimate transactions costing ₹447,500 in friction.
Net savings: ₹22,297,500 (97.5% of total possible fraud losses).
```
Run the ROI analysis yourself: `python scripts/cost_benefit_analysis.py --dataset paysim --fp-cost 100`

## 8. How to run the ML Pipeline

1. **Environment Setup** (Pinned for perfect reproducibility):
```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. **Download Datasets**:
Place [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) in `data/raw/paysim/paysim.csv`.
Place [IEEE-CIS](https://www.kaggle.com/c/ieee-fraud-detection/data) in `data/raw/ieee/`.

3. **Run Pipeline**:
```bash
python main.py --dataset paysim --skip-tuning --models xgboost lightgbm catboost
```

4. **Run pipeline + latency benchmark**:
```bash
# Our latency benchmark measures the true path: JSON parsing → DF Creation → Feature Eng → Preprocessing → Predict
# Target: <100ms
python main.py --dataset paysim --skip-tuning --models decision_tree
```

## 9. Limitations
- **Graph Scalability**: The current `NetworkX` rendering in the Streamlit app handles small-to-medium clusters. For true planetary-scale visualization, a dedicated graph database (like Neo4j) and WebGL frontend would be required.
- **LLM Latency**: The Gemini API call adds ~1-2 seconds of latency to the dashboard's threat intel generation, though the core ML prediction remains sub-100ms.

## 10. Security / Defense-Only Focus
This project is built explicitly for defense. The dataset is heavily anonymized, and the architecture focuses on **blocking** attacks rather than offensive deanonymization. Feature engineering relies on aggregations and behavioral velocity rather than PII.
